# SOS HELI — Contrôles Matériel 🚁

PWA de suivi des contrôles périodiques du matériel SOS HELI, générée à partir du
registre Excel « SUIVI CONTROL SOS_HELI.xlsx » (321 matériels, import 2026-10-11).

## Fonctions

- **Statuts recalculés en direct**, formules identiques au registre Excel :
  prochain contrôle = dernier contrôle + périodicité (plafonné à la date limite),
  🔴 en retard / 🟠 à prévoir (≤ 60 j ou ≤ 5 j selon le matériel) / 🟢 OK /
  🔴 hors service / ⚪ sans échéance.
- **✅ Contrôle en un geste** : bouton sur chaque ligne (date du jour) ou contrôle
  daté avec note ; historique par matériel ; Annuler 5 s.
- **Filtres** par statut, par section, recherche plein texte ; sections repliables.
- **Ajout / édition / suppression** de matériels, hors-service, notes, responsable.
- **🕘 Journal des modifications (v2)** : chaque action (contrôle, édition champ par
  champ, ajout, suppression, annulation, import) est horodatée ; export **CSV
  journal** (DATE;HEURE;ACTION;N°;SECTION;MATÉRIEL;MODIFICATIONS;NOTE) à
  répercuter dans l'Excel d'origine, plafond 500 entrées, fusion Drive
  dédoublonnée.
- **🔔 Alertes (v2)** : bandeau en tête de registre (retards + contrôles à faire
  sous 7 jours, HS exclus), bouton ✔ par ligne, badge sur l'icône de l'app
  installée (badge iOS/Android).
- **🟩 Export Excel .xlsx (v3)** : régénère le registre à l'identique de
  l'original — mêmes en-têtes, mise en forme (Arial 20, couleurs, fusions, volet
  figé, largeurs), et surtout **formules vivantes** (`TODAY()`, `EDATE`, statuts
  avec variante ≤ 5 jours des WORMS GE) qui recalculent seules à l'ouverture.
  Fichier `SUIVI CONTROL SOS_HELI-AAAA-MM-JJ.xlsx`, zéro dépendance (ZIP OOXML
  écrit en pur JS).
- **📥 Import Excel .xlsx (v3)** : le champ d'import accepte directement le
  vrai registre (détection par signature) ; formules partagées, sharedStrings,
  dates et statuts en cache décodés ; n° + historiques conservés par
  correspondance N°/matériel ; confirmation + secours local avant remplacement.
- **Sauvegarde Google Drive** (dossier `taffbmpm` par défaut, configurable) :
  fusion multi-appareils (dernier modifié gagne + pierres tombales), auto 30 s.
- **Exports** : JSON (sauvegarde/restauration), **Excel .xlsx**, CSV registre et
  CSV journal ouvrables dans Excel.

## Configuration Google (une seule fois)

1. Console Google Cloud → APIs & Services → activer **Google Drive API**.
2. OAuth client (Web) avec URI de redirection `https://developers.google.com/oauthplayground`.
3. OAuth Playground → ⚙️ *Use your own OAuth credentials* → scope
   `https://www.googleapis.com/auth/drive.file` → **Authorize** → **Exchange** → Refresh token.
4. Dans l'app : Options → Client ID / Secret / Refresh Token → Enregistrer.

(Le token `drive.file` des autres apps Patrimoine / Tâches & Relances est réutilisable.)

## Développement

- `index.html` : app complète (sans dépendance). `sw.js` : service worker (cache `sos-heli-controles-v3`).
- `tools/gen-icons.js` : icônes PNG générées au build (pur Node + zlib).
- `v1-test-harness.js` : harnais Node (169 tests, dont export xlsx vérifié
  cellule par cellule et import du registre réel) —
  `node v1-test-harness.js index.html sw.js` (joué par la CI à chaque push).
- Données initiales : `SEED` embarqué dans `index.html` (extrait de l'Excel le 2026-10-11).
