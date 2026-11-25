// Boot réel avec DOM STRICT — SOS HELI Contrôles (complément du harnais)
// getElementById renvoie null si l'id n'existe nulle part dans index.html
// (ni dans les <input ... id=...> statiques, ni dans les innerHTML générés par le code).
// Détecte les crashes que le harnais masque (leçon 17 du retour d'expérience).
"use strict";
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync("index.html", "utf8");
const swSrc = fs.readFileSync("sw.js", "utf8");
const appJs = html.split("<script>")[1].split("</script>")[0];

// ids présents dans le fichier (statiques + générés par innerHTML dans le code)
const knownIds = new Set();
for(const m of html.matchAll(/id="([^"]+)"/g)) knownIds.add(m[1]);
console.log("DOM strict : " + knownIds.size + " ids connus dans index.html");

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
function makeEl(){
  return {
    value: "", innerHTML: "", textContent: "", checked: false, files: null,
    style: {}, listeners: {},
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
    setAttribute(){}, focus(){}, select(){}, click(){}, appendChild(){}, removeChild(){}, setSelectionRange(){}
  };
}
const elMap = {};
global.document = {
  hidden: true,
  getElementById: id => {
    if(!knownIds.has(id)) throw new Error("DOM STRICT : getElementById(" + JSON.stringify(id) + ") → id inconnu !");
    return (elMap[id] = elMap[id] || makeEl());
  },
  createElement: () => makeEl(),
  addEventListener(){},
  body: { appendChild(){}, removeChild(){} }
};
global.window = globalThis;
global.addEventListener = global.addEventListener || function(){};
global.removeEventListener = global.removeEventListener || function(){};
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
global.__badge = -1;
navigator.setAppBadge = n => { global.__badge = n; };
navigator.clearAppBadge = () => { global.__badge = 0; };
global.confirm = () => true;
global.URL.createObjectURL = () => "blob:stub";
global.URL.revokeObjectURL = () => {};
global.fetch = () => new Promise(r => setTimeout(() => r({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") }), 5));
global.download = (name) => { console.log("  (téléchargement stub : " + name + ")"); };

let ok = 0, fail = 0;
function T(name, cond){ if(cond){ ok++; console.log("  ✅ " + name); } else { fail++; console.log("  ❌ " + name); } }

vm.runInThisContext(appJs, { filename: "app.js" });

(async function(){
  // boot
  load();
  renderAll();
  T("boot : état chargé", state.items.length === 321);
  ["retard", "perime", "prevoir", "ok", "hs", "sans", "all"].forEach(k => {
    setStatFilter(k);
    renderAll();
    T("DOM strict : filtre " + k + " re-rendu sans crash", true);
  });
  state.cfg.statFilter = "all";
  // fiche matériels
  openItem(state.items[0].id);
  E("fLast").value = today();
  refreshPreview();
  doControle();
  closeSheet();
  T("DOM strict : fiche + contrôle daté sans crash", true);
  // filtre « sans » avec astuce de saisie
  setStatFilter("sans");
  renderList();
  T("DOM strict : hint « à saisir » affiché", document.getElementById("list").innerHTML.indexOf("À saisir sur le terrain") >= 0);
  state.cfg.statFilter = "all";
  // journal + exports
  openJournal(); closeJournal();
  exportJournalCsv();
  exportFile(); exportCsv(); exportXlsx(); exportRetards();
  T("DOM strict : journal + 4 exports sans crash", true);
  // Drive simulé : la carte sauvegarde avec config posée
  state.cfg.dCid = "X"; state.cfg.dRefresh = "Y";
  renderBackupCard();
  T("DOM strict : bouton export retards dans la carte sauvegarde", document.getElementById("backupCard").innerHTML.indexOf("exportRetards()") >= 0);
  await new Promise(r => setTimeout(r, 60));

  // nettoyage des timers de l'app (driveTimer auto 30 s, toast 6 s) pour un exit immédiat
  try{ if(typeof driveTimer !== "undefined" && driveTimer) clearTimeout(driveTimer); }catch(e){}
  try{ if(typeof toastTimer !== "undefined" && toastTimer) clearTimeout(toastTimer); }catch(e){}

  console.log("\nDOM STRICT : " + ok + " ok, " + fail + " échoués");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH DOM STRICT :", e && e.message ? e.message : e); process.exit(2); });
