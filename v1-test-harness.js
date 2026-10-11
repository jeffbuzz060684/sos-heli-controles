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
global.FileReader = function(){
  this.onload = null;
  this.readAsArrayBuffer = (f) => {
    setTimeout(() => {
      Promise.resolve((f && f.arrayBuffer) ? f.arrayBuffer() : f).then(ab => {
        this.result = ab; // un vrai navigateur remplit reader.result
        if(this.onload) this.onload({ target: { result: ab } });
      });
    }, 5);
  };
  this.readAsText = (f) => {
    setTimeout(() => {
      this.result = (f && f.text) ? f.text() : String(f);
      if(this.onload) this.onload({ target: { result: this.result } });
    }, 5);
  };
};

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
  T("version v3", APP_VERSION === "v3");
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

  console.log("=== L. Export Excel (.xlsx) ===");
  let xCap = null;
  const xDl = global.download;
  global.download = (name, content) => { xCap = { name, content }; };
  exportXlsx();
  const xb = xCap.content;
  T("xlsx : signature ZIP (PK\\x03\\x04)", xb && xb.length > 4 && xb[0] === 0x50 && xb[1] === 0x4B && xb[2] === 0x03 && xb[3] === 0x04);
  T("xlsx : nom de fichier identique au registre d'origine", xCap.name === "SUIVI CONTROL SOS_HELI-" + today() + ".xlsx");
  const zlib = require("zlib");
  function unzipN(u8){
    const files = {};
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for(let i = u8.length - 22; i >= 0; i--){ if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; } }
    if(eocd < 0) throw new Error("EOCD introuvable");
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    for(let k = 0; k < count; k++){
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = Buffer.from(u8.subarray(off + 46, off + 46 + nlen)).toString("utf8");
      const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      let data = u8.subarray(lho + 30 + lnlen + lelen, lho + 30 + lnlen + lelen + csize);
      if(method === 8) data = zlib.inflateRawSync(Buffer.from(data));
      else if(method !== 0) throw new Error("méthode " + method);
      files[name] = Buffer.from(data);
      off += 46 + nlen + elen + clen;
    }
    return files;
  }
  const xf = unzipN(new Uint8Array(xb));
  T("xlsx : 8 fichiers du package OOXML", Object.keys(xf).length === 8 && !!xf["[Content_Types].xml"] && !!xf["xl/worksheets/sheet1.xml"] && !!xf["xl/styles.xml"] && !!xf["docProps/core.xml"]);
  const wbx = xf["xl/workbook.xml"].toString("utf8");
  T("xlsx : feuille « Registre Matériel »", wbx.includes('name="Registre Matériel"'));
  T("xlsx : recalcul forcé à l'ouverture (TODAY() vivant)", wbx.includes('fullCalcOnLoad="1"'));
  const sx = xf["xl/worksheets/sheet1.xml"].toString("utf8");
  const nRows = (sx.match(/<row /g) || []).length;
  T("xlsx : 326 lignes (titre, date, compteurs ×2, en-têtes + 321 données)", nRows === 5 + state.items.length);
  T("xlsx : en-têtes d'origine en ligne 8", sx.includes("MATÉRIEL / ÉLÉMENT") && sx.includes("STATUT ACTUALISÉ") && sx.includes("PLAFONNÉ À\nLA DATE LIMITE ?") && sx.includes("OBSERVATION / NOTES BRUTES"));
  T("xlsx : formule prochain contrôle exacte (H9)", sx.includes('IF(AND(ISNUMBER(F9),ISNUMBER(E9)),IF(AND(ISNUMBER(G9),EDATE(F9,E9)&gt;G9),G9,EDATE(F9,E9)),IF(ISNUMBER(G9),G9,""))'));
  T("xlsx : formule plafonné exacte (I9)", sx.includes('IF(AND(ISNUMBER(F9),ISNUMBER(E9),ISNUMBER(G9),EDATE(F9,E9)&gt;G9),"⚠️ Oui","")'));
  T("xlsx : formule jours restants exacte (J9)", sx.includes('IF(ISNUMBER(H9),H9-TODAY(),"")'));
  T("xlsx : formule statut ≤ 2 mois exacte (K9)", sx.includes('IF($H9&lt;TODAY(),"🔴 En retard",IF($H9-TODAY()&lt;=60,"🟠 À prévoir (≤ 2 mois)","🟢 OK")'));
  T("xlsx : détection HS par notes REFORME/H.S (K9)", sx.includes('IF(OR(ISNUMBER(SEARCH("REFORME",$L9)),ISNUMBER(SEARCH("H.S",$L9))),"🔴 Hors service / Réformé"'));
  const gi = state.items.findIndex(i => i.num === 292);
  const grow = 9 + gi;
  T("xlsx : variante ≤ 5 JOURS sur les WORMS GE (K" + grow + ")", sx.includes('&lt;=5,"🟠 À prévoir (≤ 5 JOURS)"'));
  T("xlsx : date serial du dernier contrôle GE 1 (F" + grow + ")", sx.includes('<c r="F' + grow + '" s="2"><v>' + isoToSerial(state.items[gi].last) + '</v></c>'));
  T("xlsx : compteurs COUNTIF identiques à l'original", sx.includes("COUNTA(A9:A" + (8 + state.items.length) + ")") && sx.includes('COUNTIF(K9:K' + (8 + state.items.length) + ',"🟢 OK")') && sx.includes('COUNTIF(K9:K' + (8 + state.items.length) + ',"🔴 En retard")'));
  T("xlsx : 10 fusions comme l'original", sx.includes('<mergeCells count="10">') && sx.includes('<mergeCell ref="A1:M1"/>') && sx.includes('<mergeCell ref="J4:K4"/>'));
  T("xlsx : volet figé sous la ligne 8 (A9)", sx.includes('<pane ySplit="8" topLeftCell="A9"'));
  T("xlsx : quadrillage masqué comme l'original", sx.includes('showGridLines="0"'));
  T("xlsx : 13 colonnes aux largeurs d'origine", (sx.match(/customWidth="1"/g) || []).length === 13 && sx.includes('width="117.43"'));
  const stx = xf["xl/styles.xml"].toString("utf8");
  T("xlsx : format date mm-dd-yy + jours entier", stx.includes('formatCode="mm-dd-yy"') && stx.includes('formatCode="0"'));
  T("xlsx : Arial 20 gras partout, en-têtes bleus/blancs", stx.includes('<name val="Arial"/>') && stx.includes('rgb="FF2E5AAC"') && stx.includes('rgb="FFFFFFFF"'));
  T("xlsx : statuts en cache pour lecture directe", sx.includes("⚪ Sans échéance connue</v>") && sx.includes("🔴 Hors service / Réformé</v>"));
  T("xlsx : convention '/' du registre pour notes vides (colonne L)", (function(){ var nL = (sx.match(/r="L\d+" s="\d+" t="inlineStr"><is><t>\/<\/t><\/is>/g) || []).length; var nD = (sx.match(/r="D\d+" s="\d+" t="inlineStr"><is><t>\/<\/t><\/is>/g) || []).length; return nL === state.items.filter(function(i){ return !i.notes; }).length && nD === state.items.filter(function(i){ return i.resp === "/"; }).length; })());
  fs.writeFileSync("/tmp/export-test.xlsx", Buffer.from(xb));
  global.download = xDl;

  console.log("=== M. Import Excel (.xlsx) ===");
  // fixture xlsx construit ici : entrées compressed (deflate) + stored, sharedStrings, formules, ligne 777
  function zipMk(entries){ // [{name, data(Buffer), deflate}]
    const enc = new TextEncoder(), chunks = [], central = [];
    let off = 0;
    const push = u8 => { chunks.push(u8); off += u8.length; };
    entries.forEach(e2 => {
      const raw = Buffer.isBuffer(e2.data) ? new Uint8Array(e2.data) : (e2.data instanceof Uint8Array ? e2.data : enc.encode(e2.data));
      const data = e2.deflate ? new Uint8Array(zlib.deflateRawSync(Buffer.from(raw))) : raw;
      const nameU8 = enc.encode(e2.name);
      const crc = crc32(raw);
      const lh = new Uint8Array(30), dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
      dv.setUint16(8, e2.deflate ? 8 : 0, true); dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, raw.length, true);
      dv.setUint16(26, nameU8.length, true); dv.setUint16(28, 0, true);
      push(lh); push(nameU8); push(data);
      central.push({ nameU8, crc, csize: data.length, usize: raw.length, method: e2.deflate ? 8 : 0, lho: off - data.length - nameU8.length - 30 });
    });
    const cdStart = off;
    central.forEach(c2 => {
      const ch = new Uint8Array(46), dv = new DataView(ch.buffer);
      dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true);
      dv.setUint16(10, c2.method, true); dv.setUint16(12, 0, true); dv.setUint16(14, 0x21, true);
      dv.setUint32(16, c2.crc, true); dv.setUint32(20, c2.csize, true); dv.setUint32(24, c2.usize, true);
      dv.setUint16(28, c2.nameU8.length, true); dv.setUint32(42, c2.lho, true);
      push(ch); push(c2.nameU8);
    });
    const eo = new Uint8Array(22), dv2 = new DataView(eo.buffer);
    dv2.setUint32(0, 0x06054b50, true); dv2.setUint16(8, central.length, true); dv2.setUint16(10, central.length, true);
    dv2.setUint32(12, off - cdStart, true); dv2.setUint32(16, cdStart, true);
    push(eo);
    const out = new Uint8Array(off); let p = 0;
    chunks.forEach(c2 => { out.set(c2, p); p += c2.length; });
    return out;
  }
  const d45 = Math.round((Date.parse(today()) - 45*86400000)/86400000) + 25569;
  const fxSheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + '<row r="8"><c r="A8" t="inlineStr"><is><t>N°</t></is></c></row>'
    + '<row r="9"><c r="A9"><v>1</v></c><c r="B9" t="s"><v>0</v></c><c r="C9" t="s"><v>1</v></c>'
    + '<c r="D9" t="inlineStr"><is><t>CHEF TEST</t></is></c><c r="E9"><v>6</v></c>'
    + '<c r="F9"><v>' + isoToSerial("2026-01-15") + '</v></c><c r="G9"><v>' + isoToSerial("2027-01-15") + '</v></c>'
    + '<c r="H9"><f>IF(1,"","")</f></c><c r="K9"><f>IF($H9-TODAY()&lt;=60,"🟠 À prévoir (≤ 2 mois)","🟢 OK")</f></c>'
    + '<c r="M9" t="inlineStr"><is><t>REF-42</t></is></c></row>'
    + '<row r="10"><c r="A10"><v>2</v></c><c r="B10" t="inlineStr"><is><t>GE SECTION</t></is></c>'
    + '<c r="C10" t="inlineStr"><is><t>GE Test</t></is></c><c r="E10"><v>1</v></c><c r="F10"><v>' + d45 + '</v></c>'
    + '<c r="K10"><f>IF($H10-TODAY()&lt;=5,"🟠 À prévoir (≤ 5 JOURS)","🟢 OK")</f></c></row>'
    + '<row r="11"><c r="A11"><v>3</v></c><c r="B11" t="inlineStr"><is><t>SEC</t></is></c>'
    + '<c r="C11" t="inlineStr"><is><t>Corde Test</t></is></c>'
    + '<c r="L11" t="inlineStr"><is><t>REFORME (966 descente)</t></is></c></row>'
    + '<row r="12"><c r="A12"><v>321</v></c><c r="B12" t="inlineStr"><is><t>777</t></is></c></row>'
    + '</sheetData></worksheet>';
  const fxFiles = [
    { name: "[Content_Types].xml", data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>' },
    { name: "xl/workbook.xml", data: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Registre Matériel" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: "xl/sharedStrings.xml", data: '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2"><si><t>Section T</t></si><si><t>Pompe Test</t></si></sst>', deflate: true },
    { name: "xl/worksheets/sheet1.xml", data: fxSheet, deflate: true }
  ];
  const fxBytes = zipMk(fxFiles);
  T("import xlsx : fixture valide (PK)", fxBytes[0] === 0x50 && fxBytes[1] === 0x4B);
  const fxItems = await xlsxRead(fxBytes);
  T("import xlsx : 3 matériels (ligne 777 écartée)", Array.isArray(fxItems) && fxItems.length === 3);
  T("import xlsx : sharedStrings lus (section/matériel)", fxItems[0].sec === "Section T" && fxItems[0].mat === "Pompe Test" && fxItems[0].num === 1);
  T("import xlsx : dates serial → ISO", fxItems[0].last === "2026-01-15" && fxItems[0].lim === "2027-01-15");
  T("import xlsx : périodicité + responsable + réf", fxItems[0].per === 6 && fxItems[0].resp === "CHEF TEST" && fxItems[0].ref === "REF-42");
  T("import xlsx : variante ≤ 5 JOURS détectée (a5)", fxItems[1].a5 === true && fxItems[0].a5 === false);
  T("import xlsx : dates converties (J-45)", fxItems[1].last === new Date(Date.parse(today()) - 45*86400000).toISOString().slice(0,10));
  T("import xlsx : HS par notes REFORME", fxItems[2].hs === true && fxItems[2].notes === "REFORME (966 descente)");
  // import complet avec confirmation, journal et préservation historique
  state = defaultState(); primeShadow(); persist(); renderAll();
  const keepIt = state.items.find(i => i.num === 4);
  keepIt.hist = [{ d: "2026-07-06", n: "contrôle bureau veritas" }];
  const keepId = keepIt.id;
  const fx4 = JSON.parse(JSON.stringify(keepIt)); // simulate: même num+mat réimporté
  fxFiles[4] = { name: "xl/worksheets/sheet1.xml", data: '<?xml version="1.0"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + '<row r="9"><c r="A9"><v>4</v></c><c r="B9" t="inlineStr"><is><t>CAPINAV</t></is></c>'
    + '<c r="C9" t="inlineStr"><is><t>' + keepIt.mat.replace(/</g, "&lt;") + '</t></is></c>'
    + '<c r="F9"><v>' + isoToSerial("2026-07-06") + '</v></c><c r="E9"><v>6</v></c>'
    + '<c r="G9"><v>' + isoToSerial("2031-07-01") + '</v></c></row>'
    + '</sheetData></worksheet>', deflate: true };
  state.items = [keepIt]; primeShadow(); persist(); renderAll();
  state.log = [];
  const fx2 = zipMk(fxFiles);
  await importXlsxBuffer(fx2.buffer.slice(fx2.byteOffset, fx2.byteOffset + fx2.byteLength));
  await flush();
  T("import xlsx : registre remplacé (1 matériel)", state.items.length === 1 && state.items[0].num === 4 && state.items[0].sec === "CAPINAV");
  T("import xlsx : id + historique conservés (même num+mat)", state.items[0].id === keepId && state.items[0].hist.length === 1 && state.items[0].hist[0].n === "contrôle bureau veritas");
  T("import xlsx : journalisé comme import", state.log.length === 1 && state.log[0].act === "import" && state.log[0].chg.some(c => c[0] === "Source"));
  T("import xlsx : secours local créé", !!store[KEY + "-secours"]);
  // confirmation refusée
  const beforeN = state.items.length;
  resetConfirm(false);
  await importXlsxBuffer(fx2.buffer.slice(fx2.byteOffset, fx2.byteOffset + fx2.byteLength));
  await flush();
  T("import xlsx : refus = rien changé", state.items.length === beforeN);
  // fichier corrompu → refus propre
  resetConfirm(true);
  state.log = [];
  await importXlsxBuffer(new Uint8Array([0x50, 0x4B, 0x03, 0x04, 1, 2, 3, 4, 5]).buffer);
  await flush();
  T("import xlsx : fichier corrompu refusé proprement", document.getElementById("toast").innerHTML.indexOf("illisible") >= 0 && state.items.length === beforeN);
  // branchement importFile : PK → Excel, sinon JSON
  state = defaultState(); primeShadow(); persist(); renderAll();
  const evX = { target: { files: [{ arrayBuffer: async () => fx2.buffer.slice(fx2.byteOffset, fx2.byteOffset + fx2.byteLength) }] } };
  resetConfirm(true);
  importFile(evX);
  await flush();
  T("importFile : .xlsx détecté par signature PK", state.items.length === 1 && state.items[0].num === 4);
  resetConfirm(true);
  T("importFile : JSON inchangé (importJsonText)", importJsonText(snapshot, true) === true);

  // test réel (local uniquement, absent de la CI) : le registre Excel de Jade
  const realPath = "/home/user/uploads/SUIVI CONTROL SOS_HELI.xlsx";
  if(fs.existsSync(realPath)){
    const realItems = await xlsxRead(new Uint8Array(fs.readFileSync(realPath)));
    T("réel : 321 matériels extraits", Array.isArray(realItems) && realItems.length === 321);
    T("réel : 5 WORMS GE à seuil 5 jours", realItems.filter(i => i.a5).length === 5);
    T("réel : 6 hors service", realItems.filter(i => i.hs).length === 6);
    const rg1 = realItems.find(i => i.mat === "2016 BMPM GE 1");
    T("réel : GE 1 (per 1, dernier 2026-09-04)", rg1 && rg1.per === 1 && rg1.last === "2026-09-04" && rg1.a5 === true);
    const rc4 = realItems.find(i => i.num === 4);
    T("réel : corde n°000 989-001 (2026-07-06 / 2031-07-01)", rc4 && rc4.last === "2026-07-06" && rc4.lim === "2031-07-01");
    const r10 = realItems.find(i => i.num === 10);
    T("réel : brassières FUSCO 26-51 (2025-06-30 / 2026-10-30)", r10 && r10.last === "2025-06-30" && r10.lim === "2026-10-30");
    const r303 = realItems.find(i => i.num === 320);
    T("réel : TOHATSU n°1 en section correcte", r303 && r303.sec === "Moto-pompe (TOHATSU VE 1500) (FDF DIH)");
    // ligne 277 de l'Excel réel : n° présent, matériel vide, périodicité 1 → gardée (fidèle au registre)
    const rEmpty = realItems.filter(i => !i.mat || !i.mat.trim());
    T("réel : fidèle au registre (277 = seule ligne sans nom, per 1)", rEmpty.length === 1 && rEmpty[0].num === 277 && rEmpty[0].per === 1 && rEmpty[0].sec === "Claie moto-pompe WAJAX-MARK-3");
    T("réel : 4 lignes sans n° mais avec matériel", realItems.filter(i => (i.num === null || i.num === undefined) && i.mat && i.mat.trim()).length === 4);
  }

  if(driveTimer) clearTimeout(driveTimer);
  console.log("\n================================");
  console.log("RÉSULTAT : " + pass + " réussis, " + fail + " échoués");
  if(fail) process.exit(1);
})().catch(e => { console.error("CRASH:", e); process.exit(2); });
