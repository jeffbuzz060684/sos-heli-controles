// Harnais de tests v1 — SOS HELI Contrôles Matériel
// node v1-test-harness.js <index.html> <sw.js>
"use strict";
const fs = require("fs"), vm = require("vm");
const idxPath = process.argv[2] || "index.html";
const swPath = process.argv[3] || "sw.js";
const html = fs.readFileSync(idxPath, "utf8");
const swSrc = fs.readFileSync(swPath, "utf8");
const appJs = html.split("<script>")[1].split("</script>")[0];

// ---------- stubs ----------
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
function makeEl(){
  const el = {
    value: "", innerHTML: "", textContent: "", checked: false, files: null,
    style: {}, listeners: {},
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
    setAttribute(){}, focus(){}, select(){}, click(){},
    appendChild(){}, removeChild(){},
    setSelectionRange(){}
  };
  return el;
}
const elMap = {};
global.document = {
  hidden: true,
  getElementById: id => (elMap[id] = elMap[id] || makeEl()),
  createElement: () => makeEl(),
  addEventListener(){},
  body: { appendChild(){}, removeChild(){} }
};
global.window = globalThis;
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
global.__badge = -1;
navigator.setAppBadge = n => { global.__badge = n; };
navigator.clearAppBadge = () => { global.__badge = 0; };
let confirmAnswer = true;
global.confirm = () => confirmAnswer;
global.URL.createObjectURL = () => "blob:stub";
global.URL.revokeObjectURL = () => {};

// fetch stub pilotable
let reqs = [];
let __remote = null;          // contenu actuel du fichier Drive
let __remoteExists = false;   // le fichier Drive existe-t-il
let __tokenFail = false;
global.fetch = function(url, opts){
  reqs.push({ url, method: (opts && opts.method) || "GET", body: opts && opts.body });
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if(String(url).indexOf("oauth2.googleapis.com/token") >= 0){
        if(__tokenFail) return resolve({ ok: false, json: () => Promise.resolve({ error: "invalid_grant" }) });
        return resolve({ ok: true, json: () => Promise.resolve({ access_token: "TOK123" }) });
      }
      if(String(url).indexOf("/drive/v3/files?") >= 0 && String(url).indexOf("q=") >= 0){
        const q = decodeURIComponent(String(url).split("q=")[1]);
        if(q.indexOf("google-apps.folder") >= 0) return resolve({ ok: true, json: () => Promise.resolve({ files: [{ id: "FOLD1", name: "taffbmpm" }] }) });
        if(q.indexOf("application/json") >= 0){
          if(__remoteExists) return resolve({ ok: true, json: () => Promise.resolve({ files: [{ id: "FILE1", name: "sos-heli-controles.json" }] }) });
          return resolve({ ok: true, json: () => Promise.resolve({ files: [] }) });
        }
        return resolve({ ok: true, json: () => Promise.resolve({ files: [] }) });
      }
      if(String(url).indexOf("alt=media") >= 0){
        return resolve({ ok: true, text: () => Promise.resolve(__remote || "") });
      }
      if(String(url).indexOf("/upload/drive/v3/files") >= 0){
        if(opts && opts.body){
          if(String(url).indexOf("uploadType=multipart") >= 0){
            const mMatch = String(opts.body).match(/Content-Type: application\/json\n\n([\s\S]*?)\n--sosb--$/);
            __remote = mMatch ? mMatch[1] : null;
          } else {
            __remote = String(opts.body);
          }
        }
        __remoteExists = true;
        return resolve({ ok: true, json: () => Promise.resolve({ id: "FILE1" }) });
      }
      resolve({ ok: true, json: () => Promise.resolve({}) });
    }, 5);
  });
};

// ---------- exécution de l'app ----------
vm.runInThisContext(appJs, { filename: "app.js" });
const flush = () => new Promise(r => setTimeout(r, 30));

// ---------- asserts ----------
let pass = 0, fail = 0;
function T(name, cond){
  if(cond){ pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name); }
}
function resetConfirm(v){ confirmAnswer = v; }

(async function main(){
  console.log("=== A. Chargement & invariants ===");
  T("seed chargé : 321 matériels", state.items.length === 321);
  T("version v2", APP_VERSION === "v2");
  T("clé storage", KEY === "sos-heli-controles-v1");
  T("sw.js : cache aligné sur la version app", swSrc.indexOf("sos-heli-controles-" + APP_VERSION) >= 0);
  T("sw.js : pas d'ancien cache", swSrc.indexOf("sos-heli-controles-v0") < 0);
  T("index : manifeste lié", html.indexOf("manifest.webmanifest") >= 0);
  const manifestSrc = fs.readFileSync("manifest.webmanifest", "utf8");
  T("index : icônes liées", html.indexOf("icon-192.png") >= 0 && manifestSrc.indexOf("icon-512.png") >= 0);
  T("index : seed injecté", html.indexOf("/*__SEED__*/[]") < 0 && html.indexOf('"m001"') >= 0);
  T("localStorage rempli au 1er lancement", !!store["sos-heli-controles-v1"]);

  console.log("=== B. Calculs (formules Excel) ===");
  T("today() : format ISO local", /^\d{4}-\d{2}-\d{2}$/.test(today()));
  T("addMonthsISO 2026-01-31 +1 → 2026-02-28", addMonthsISO("2026-01-31", 1) === "2026-02-28");
  T("addMonthsISO 2026-01-31 +2 → 2026-03-31", addMonthsISO("2026-01-31", 2) === "2026-03-31");
  T("addMonthsISO 2026-11-30 +3 → 2027-02-28", addMonthsISO("2026-11-30", 3) === "2027-02-28");
  T("addMonthsISO 2026-08-28 +12 → 2027-08-28", addMonthsISO("2026-08-28", 12) === "2027-08-28");
  const m4 = state.items.find(i => i.num === 35); // PARAMASQUE MICRO-K
  T("num 35 présent (PARAMASQUE)", !!m4 && m4.mat.indexOf("PARAMASQUE") >= 0);
  T("num 35 : plafonné à la date limite 2026-10-16", nextOf(m4).d === "2026-10-16" && nextOf(m4).capped === true);
  T("num 35 : statut à prévoir", statutOf(m4) === "prevoir");
  const m1 = state.items.find(i => i.num === 1);
  T("num 1 : HS via notes REFORME", statutOf(m1) === "hs" && isHs(m1));
  const m10 = state.items.find(i => i.num === 10);
  T("num 10 : en retard (FUSCO 26-51, 2026-06-30)", statutOf(m10) === "retard");
  const m18 = state.items.find(i => i.mat === "Tenue TYPHOON (x10)");
  T("TYPHOON (x10) : sans échéance connue", !!m18 && statutOf(m18) === "sans");
  const m292 = state.items.find(i => i.num === 292);
  T("num 292 : seuil 5 jours détecté", m292.a5 === true);
  T("num 292 : prochain 2026-10-04 → en retard aujourd'hui", statutOf(m292) === "retard");
  // même matériel contrôlé aujourd'hui → J-31 → OK pour seuil 5 j
  m292.last = today();
  T("num 292 contrôlé aujourd'hui : OK (31 j > seuil 5)", statutOf(m292) === "ok");
  m292.a5 = false;
  T("num 292 sans seuil 5 : à prévoir (31 j ≤ 60)", statutOf(m292) === "prevoir");
  m292.a5 = true; m292.last = "2026-09-04";
  const probeRev = { sec: "X", mat: "y", per: null, last: null, lim: null, notes: "A REVISER", hist: [] };
  T("notes A REVISER → à réviser", statutOf(probeRev) === "reviser");
  const probeOk = { sec: "X", mat: "y", per: null, last: null, lim: null, notes: "OK", hist: [] };
  T("notes OK → OK", statutOf(probeOk) === "ok");
  const probeCap = { sec: "X", mat: "y", per: 6, last: "2026-07-06", lim: "2026-08-01", hist: [] };
  T("EDATE > limite → plafonné (2026-08-01)", nextOf(probeCap).d === "2026-08-01" && nextOf(probeCap).capped === true);

  console.log("=== C. Contrôle effectué ===");
  const it292 = state.items.find(i => i.num === 292);
  const before = { last: it292.last, hist: JSON.parse(JSON.stringify(it292.hist)) };
  quickCheck(it292.id);
  T("quickCheck : last = aujourd'hui", it292.last === today());
  T("quickCheck : historique +1", it292.hist.length === before.hist.length + 1);
  T("quickCheck : statut recalculé OK", statutOf(it292) === "ok");
  T("quickCheck : toast avec Annuler", document.getElementById("toast").innerHTML.indexOf("Annuler") >= 0);
  T("quickCheck : sauvegardé (u posé)", it292.u > 0);
  window._toastAction();
  T("Annuler : last restauré", it292.last === before.last);
  T("Annuler : historique restauré", it292.hist.length === before.hist.length);
  T("Annuler : statut retour en retard", statutOf(it292) === "retard");
  // contrôle daté + note via la feuille
  openItem(it292.id);
  document.getElementById("ctlDate").value = "2026-10-05";
  document.getElementById("ctlNote").value = "Vidange + bougie";
  doControle();
  T("doControle : date choisie enregistrée", it292.last === "2026-10-05");
  T("doControle : note dans l'historique", it292.hist[0].n === "Vidange + bougie");
  T("doControle : statut recalculé (J–25, seuil 5 j → OK)", statutOf(it292) === "ok");
  closeSheet();
  const noPer = state.items.find(i => !i.per && !i.lim && !isHs(i));
  if(noPer){
    openItem(noPer.id);
    document.getElementById("ctlDate").value = today();
    doControle();
    T("sans périodicité : toast d'avertissement", document.getElementById("toast").innerHTML.indexOf("sans périodicité") >= 0);
    closeSheet();
  }

  console.log("=== D. Ajout / édition / suppression ===");
  const n0 = state.items.length;
  openItem(null);
  document.getElementById("fSec").value = "TEST SECTION";
  document.getElementById("fMat").value = "Matériel de test";
  document.getElementById("fPer").value = "6";
  document.getElementById("fLast").value = today();
  saveItem();
  const added = state.items.find(i => i.mat === "Matériel de test");
  T("ajout : +1 matériel", state.items.length === n0 + 1 && !!added);
  T("ajout : prochain contrôle J+6 mois", nextOf(added).d === addMonthsISO(today(), 6));
  T("ajout : u horodaté", added.u > 0);
  openItem(added.id);
  document.getElementById("fMat").value = "Matériel de test renommé";
  saveItem();
  T("édition : renommé", added.mat === "Matériel de test renommé");
  // validation
  openItem(null);
  document.getElementById("fMat").value = "";
  saveItem();
  T("validation : nom vide refusé", state.items.length === n0 + 1 && document.getElementById("toast").innerHTML.indexOf("obligatoire") >= 0);
  closeSheet();
  openItem(added.id);
  document.getElementById("fLast").value = "2027-01-01";
  document.getElementById("fLim").value = "2026-01-01";
  saveItem();
  T("validation : limite < dernier refusée", state.items.length === n0 + 1 && added.lim === null);
  closeSheet();
  openItem(added.id);
  resetConfirm(true);
  deleteItem();
  T("suppression : retiré + tombstone", state.items.length === n0 && state.tombs[added.id] > 0);
  window._toastAction();
  T("Annuler suppression : restauré", state.items.find(i => i.id === added.id) && !state.tombs[added.id]);
  resetConfirm(false);
  openItem(added.id);
  deleteItem();
  T("confirmation refusée : rien supprimé", state.items.length === n0 + 1);
  closeSheet();

  console.log("=== E. Rendu & filtres ===");
  renderAll();
  const counts = { retard: 0, prevoir: 0, ok: 0, hs: 0, sans: 0 };
  state.items.forEach(i => { const k = statutOf(i); if(k === "reviser") counts.prevoir++; else counts[k]++; });
  const statsHtml = document.getElementById("stats").innerHTML;
  T("stats : retards affichés", statsHtml.indexOf("🔴 " + counts.retard) >= 0);
  T("stats : OK affichés", statsHtml.indexOf("🟢 " + counts.ok) >= 0);
  T("stats : HS affichés", statsHtml.indexOf("⛔ " + counts.hs) >= 0);
  T("liste : section CAPINAV présente", document.getElementById("list").innerHTML.indexOf("CAPINAV") >= 0);
  setStatFilter("retard");
  T("filtre retard : tous les visibles en retard", visibleItems().every(i => statutOf(i) === "retard") && visibleItems().length === counts.retard);
  setStatFilter("prevoir");
  T("filtre à prévoir : prevoir ou à réviser", visibleItems().every(i => ["prevoir", "reviser"].indexOf(statutOf(i)) >= 0));
  setStatFilter("retard"); // back to all (toggle)
  state.cfg.statFilter = "all";
  state.cfg.q = "tohatsu";
  renderList();
  T("recherche 'tohatsu' : filtre la liste", visibleItems().length === state.items.filter(i => (i.mat + " " + i.sec).toLowerCase().indexOf("tohatsu") >= 0).length && visibleItems().length > 0 && visibleItems().length < state.items.length);
  state.cfg.q = "";
  state.cfg.secFilter = "CAPINAV";
  renderList();
  T("filtre section CAPINAV", visibleItems().every(i => i.sec === "CAPINAV") && visibleItems().length === 30);
  state.cfg.secFilter = "";
  renderAll();
  const secCount = document.getElementById("list").innerHTML.split("sech").length - 1;
  toggleSec("CAPINAV");
  T("section repliée : entrées masquées", document.getElementById("list").innerHTML.split('class="item').length - 1 === secCount - 30 + 0 || document.getElementById("list").innerHTML.indexOf("Corde lisse (Marlow) n°140") < 0);
  toggleSec("CAPINAV");

  console.log("=== F. Fusion Drive ===");
  const victim = state.items[0];
  const remoteNewer = JSON.parse(JSON.stringify(victim));
  remoteNewer.notes = "NOTE DISTANTE";
  remoteNewer.u = (victim.u || 0) + 100000;
  const remoteExtra = { id: "rX1", sec: "DISTANT", mat: "Matériel distant", per: 12, last: today(), hist: [], u: Date.now() };
  const m = mergeRemote({ v: 1, items: [remoteNewer, remoteExtra], tombs: {} });
  T("fusion : 1 ajouté", m.added === 1);
  T("fusion : 1 modifié", m.changed === 1);
  T("fusion : note distante appliquée", victim.notes === "NOTE DISTANTE");
  T("fusion : matériel distant ajouté", !!state.items.find(i => i.id === "rX1"));
  // tombstone distante supprime un local
  const local2 = state.items[5];
  const m2 = mergeRemote({ v: 1, items: [], tombs: {} });
  const mF3 = mergeRemote({ v: 1, items: [], tombs: { [local2.id]: Date.now() } });
  T("fusion : tombstone distante retire le local", mF3.removed === 1 && !state.items.find(i => i.id === local2.id));
  T("fusion : tombstone propagée localement", state.tombs[local2.id] > 0);
  // tombstone locale empêche la résurrection
  const mF4 = mergeRemote({ v: 1, items: [{ id: local2.id, sec: "X", mat: "zombie", u: Date.now() + 5 }], tombs: {} });
  T("fusion : pas de résurrection (tombstone plus récente)", !state.items.find(i => i.id === local2.id && i.mat === "zombie") || state.tombs[local2.id] >= (Date.now() - 1000));
  // nettoyage state de test
  state.items = state.items.filter(i => i.id !== "rX1");
  delete state.tombs[local2.id];
  state.items.push(local2);
  primeShadow();

  console.log("=== G. Drive bout en bout (stubs) ===");
  state.cfg.dCid = "CID"; state.cfg.dRefresh = "RTOK"; state.cfg.dFolder = "taffbmpm";
  _tok = null; _tokAt = 0;
  __remoteExists = false; __remote = null;
  reqs = [];
  await driveSend(true);
  await flush();
  T("drive : token demandé", reqs.some(r => r.url.indexOf("oauth2.googleapis.com/token") >= 0));
  T("drive : dossier trouvé (taffbmpm)", reqs.some(r => String(r.url).indexOf("google-apps.folder") >= 0));
  T("drive : fichier créé (multipart)", reqs.some(r => String(r.url).indexOf("uploadType=multipart") >= 0));
  T("drive : contenu = les matériels", __remote && JSON.parse(__remote).items.length === state.items.length);
  T("drive : driveSyncedAt posé", state.driveSyncedAt > 0);
  T("drive : pilule à jour", document.getElementById("drivePill").textContent.indexOf("à jour") >= 0);
  // 2e envoi : fichier existe → téléchargé, fusionné, PATCH
  reqs = [];
  await driveSend(true);
  await flush();
  T("drive 2 : téléchargé avant envoi", reqs.some(r => String(r.url).indexOf("alt=media") >= 0));
  T("drive 2 : PATCH de mise à jour", reqs.some(r => r.method === "PATCH" && String(r.url).indexOf("uploadType=media") >= 0));
  T("drive 2 : verrou libéré", driveSending === false);
  // échec token
  __tokenFail = true; _tok = null; _tokAt = 0; reqs = [];
  await driveSend(true);
  await flush();
  T("drive échec : toast impossible", document.getElementById("toast").innerHTML.indexOf("impossible") >= 0);
  T("drive échec : verrou libéré quand même", driveSending === false);
  __tokenFail = false; _tok = null; _tokAt = 0;
  // restauration
  __remote = JSON.stringify({ v: 1, items: [{ id: "rest1", sec: "S", mat: "Restauré", hist: [] }], tombs: {} });
  resetConfirm(true);
  reqs = [];
  await driveRestore();
  await flush();
  T("restauration : état remplacé", state.items.length === 1 && state.items[0].mat === "Restauré");
  T("restauration : secours sauvegardé", !!store["sos-heli-controles-v1-secours"]);
  // rechargement propre pour la suite
  state = defaultState(); primeShadow(); persist(); renderAll();

  console.log("=== H. Export ===");
  const ex = JSON.parse(exportData());
  T("export JSON : 321 matériels, v1", ex.items.length === 321 && ex.v === 1 && ex.app === "sos-heli-controles");
  let captured = null;
  const dlOrig = global.download;
  global.download = (name, content) => { captured = { name, content }; };
  exportCsv();
  T("export CSV : nom daté", captured && captured.name.indexOf("suivi-controles-sos-heli-") === 0 && captured.name.indexOf(".csv") > 0);
  const lines = captured.content.replace(/^\uFEFF/, "").split("\r\n");
  T("export CSV : en-têtes Excel", lines[0].indexOf("MATÉRIEL / ÉLÉMENT") >= 0 && lines[0].indexOf("STATUT") >= 0);
  T("export CSV : 322 lignes", lines.length === 322);
  T("export CSV : BOM UTF-8", captured.content.charCodeAt(0) === 0xFEFF);
  global.download = dlOrig;
  // import roundtrip
  const snapshot = exportData();
  resetConfirm(true);
  T("import roundtrip : ok", importJsonText(snapshot, true) === true && state.items.length === 321);
  resetConfirm(false);
  T("import : confirmation refusée = rien changé", importJsonText('{"v":1,"items":[]}', false) === false && state.items.length === 321);
  T("import : JSON cassé refusé", importJsonText("{{{", true) === false);

  console.log("=== I. Divers ===");
  T("persistance : état sérialisable", JSON.parse(store["sos-heli-controles-v1"]).items.length === state.items.length);
  T("seuil 5 j : 5 matériels", state.items.filter(i => i.a5).length === 5);
  T("HS : 6 matériels", state.items.filter(i => isHs(i)).length === 6);
  T("sections uniques ordonnées", sections().length === new Set(state.items.map(i => i.sec)).size);

  console.log("=== J. Journal des modifications (v2) ===");
  // état v1 (sans journal) accepté au chargement
  localStorage.setItem(KEY, JSON.stringify({ v:1, items:[{ id:"v1a", sec:"S", mat:"V1 sans log", hist:[] }], tombs:{} }));
  load();
  T("journal : état v1 sans log accepté", state.items.length === 1 && Array.isArray(state.log) && state.log.length === 0);
  importJsonText(snapshot, true);
  T("journal : registre 321 restauré", state.items.length === 321);
  state.log = [];
  // contrôle en un geste → journalisé avec ancien→nouveau
  const jIt = state.items.find(i => i.num === 292);
  const jOld = jIt.last;
  quickCheck(jIt.id);
  T("journal : quickCheck ajoute une entrée 'controle'", state.log.length === 1 && state.log[0].act === "controle" && state.log[0].id === jIt.id && state.log[0].num === 292);
  T("journal : diff ancien → aujourd'hui", state.log[0].chg.length === 1 && state.log[0].chg[0][0] === "Dernier contrôle" && state.log[0].chg[0][1] === jOld && state.log[0].chg[0][2] === today());
  T("journal : note 'un geste' présente", state.log[0].n === "Contrôle enregistré en un geste");
  // annulation journalisée
  undoLast();
  T("journal : annulation journalisée + date restaurée", state.log.length === 2 && state.log[0].act === "annulation" && jIt.last === jOld);
  T("journal : annulation : diff retour arrière", state.log[0].chg[0][1] === today() && state.log[0].chg[0][2] === jOld);
  // édition : seuls les champs modifiés sont journalisés
  openItem(jIt.id);
  document.getElementById("fResp").value = "RESPONSABLE TEST";
  saveItem();
  const jEdit = state.log[0];
  T("journal : edit journalisé (1 seul champ)", jEdit.act === "edit" && jEdit.chg.length === 1 && jEdit.chg[0][0] === "Responsable" && jIt.resp === "RESPONSABLE TEST");
  const jLenAfterEdit = state.log.length;
  openItem(jIt.id);
  saveItem();
  T("journal : sauvegarde sans changement → rien journalisé", state.log.length === jLenAfterEdit);
  // ajout journalisé
  openItem(null);
  document.getElementById("fSec").value = "SECTION J";
  document.getElementById("fMat").value = "JADE TEST J";
  document.getElementById("fPer").value = "12";
  saveItem();
  const jAdded = state.items.find(i => i.mat === "JADE TEST J");
  T("journal : ajout journalisé", !!jAdded && state.log[0].act === "ajout" && state.log[0].id === jAdded.id && state.log[0].sec === "SECTION J");
  // suppression + annulation journalisées
  resetConfirm(true);
  openItem(jAdded.id);
  deleteItem();
  T("journal : suppression journalisée", state.log[0].act === "suppression" && !state.items.some(i => i.id === jAdded.id));
  undoLast();
  T("journal : suppression annulée → restauré + journalisé", state.items.some(i => i.id === jAdded.id) && state.log[0].act === "annulation");
  // plafond 500
  state.log = [];
  for(let i = 0; i < 505; i++) state.log.push({ t: i + 1, id: "x" + i, act: "edit", chg: [["N", i, i + 1]] });
  logAdd("edit", null, [["T", 1, 2]]);
  T("journal : plafonné à 500 entrées", state.log.length === 500 && state.log[0].chg[0][0] === "T");
  // fusion Drive dédoublonnée
  state.log = [];
  const jE1 = { t: 1000, id: "a", act: "controle", chg: [["Dernier contrôle", "x", "y"]] };
  const jE2 = { t: 2000, id: "b", act: "edit", chg: [["Responsable", "x", "y"]] };
  state.log = [jE1];
  mergeLogs([jE1, jE2]);
  T("journal : fusion dédoublonnée, tri du plus récent", state.log.length === 2 && state.log[0] === jE2 && state.log[1] === jE1);
  // export CSV du journal
  state.log = [
    { t: 1760161800000, act: "controle", num: 292, sec: "TIC", mat: "WORMS", chg: [["Dernier contrôle", "2026-09-04", "2026-10-11"]], n: "note test" },
    { t: 1760110700000, act: "edit", num: null, sec: "S", mat: "X", chg: [], n: null }
  ];
  let jCap = null;
  const jDl = global.download;
  global.download = (name, content) => { jCap = { name, content }; };
  exportJournalCsv();
  const jLines = jCap.content.replace(/^\uFEFF/, "").split("\r\n");
  T("journal CSV : nom daté + BOM UTF-8", jCap.name.indexOf("journal-modifications-sos-heli-") === 0 && jCap.name.indexOf(".csv") > 0 && jCap.content.charCodeAt(0) === 0xFEFF);
  T("journal CSV : en-têtes", jLines[0] === "\"DATE\";\"HEURE\";\"ACTION\";\"N°\";\"SECTION\";\"MATÉRIEL\";\"MODIFICATIONS\";\"NOTE\"");
  T("journal CSV : log+1 lignes, ancien en premier", jLines.length === 3 && jLines[1].indexOf("Modification") >= 0 && jLines[2].indexOf("Contrôle") >= 0);
  T("journal CSV : diff lisible ancien → nouveau", jLines[2].indexOf("Dernier contrôle : 2026-09-04 → 2026-10-11") >= 0 && jLines[2].indexOf("note test") >= 0);
  global.download = jDl;
  // panneau journal + effacement
  state.log = [{ t: Date.now(), act: "controle", num: 1, sec: "S", mat: "MAT J", chg: [], n: "x" }];
  openJournal();
  T("journal : panneau ouvert, entrée rendue", document.getElementById("jSheet").classList.contains("open") && document.getElementById("jList").innerHTML.indexOf("MAT J") >= 0);
  closeJournal();
  T("journal : panneau fermé", !document.getElementById("jSheet").classList.contains("open"));
  resetConfirm(false);
  clearJournal();
  T("journal : effacement refusé sans confirmation", state.log.length === 1);
  resetConfirm(true);
  clearJournal();
  T("journal : effacement confirmé vide le journal", state.log.length === 0);

  console.log("=== K. Alertes (v2) ===");
  state = defaultState(); primeShadow(); persist(); renderAll();
  const kAl = alertItems();
  const kRet = state.items.filter(i => statutOf(i) === "retard").length;
  T("alertes : contient tous les retards", kAl.filter(i => statutOf(i) === "retard").length === kRet);
  T("alertes : uniquement retard ou ≤ 7 j", kAl.every(i => statutOf(i) === "retard" || daysTo(nextOf(i).d) <= 7));
  T("alertes : matériels HS exclus", kAl.every(i => statutOf(i) !== "hs"));
  T("alertes : trié par prochaine date", kAl.every((i, x) => x === 0 || (nextOf(kAl[x - 1]).d || "9999") <= (nextOf(i).d || "9999")));
  T("alertes : bandeau rendu dans #alerts", document.getElementById("alerts").innerHTML.indexOf("🔔 Alertes : " + kAl.length) >= 0);
  T("alertes : badge = nombre d'alertes", global.__badge === kAl.length);
  T("alertes : compteur retard affiché", document.getElementById("alerts").innerHTML.indexOf(kRet + " en retard") >= 0);
  // contrôle d'un retard avec périodicité → sort des alertes, badge recalculé
  // (le GE WORMS n°292 : per 1 mois, pas de date limite → prochain à J+31 après contrôle)
  const kTarget = kAl.find(i => i.num === 292);
  T("alertes : cible trouvée (GE WORMS n°292 en retard)", !!kTarget && statutOf(kTarget) === "retard");
  const kBefore = alertItems().length;
  quickCheck(kTarget.id);
  const kAfter = alertItems();
  T("alertes : contrôle fait sortir le matériel", statutOf(kTarget) !== "retard" && !kAfter.some(i => i.id === kTarget.id));
  T("alertes : badge recalculé après contrôle", global.__badge === kAfter.length && global.__badge === kBefore - 1);

  if(driveTimer) clearTimeout(driveTimer);
  console.log("\n================================");
  console.log("RÉSULTAT : " + pass + " réussis, " + fail + " échoués");
  if(fail) process.exit(1);
})().catch(e => { console.error("CRASH:", e); process.exit(2); });
