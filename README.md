# SOS HELI — Contrôles Matériel 🚁

PWA de suivi des contrôles périodiques du matériel SOS HELI, générée à partir du
registre Excel « SUIVI CONTROL SOS_HELI.xlsx » (321 matériels, import 2026-10-11).

## v4 (2026-11-26) : Excel Drive automatique

- **📊 Répercussion automatique dans Drive** : à chaque sauvegarde (30 s après
  une modification, verrouillage d'écran, ou bouton), l'app génère l'Excel
  « SUIVI CONTROL SOS_HELI.xlsx » **dans le même dossier Drive que le JSON**
  (création au premier envoi, PATCH ensuite). Case à cocher « Répercuter chaque
  modification dans l'Excel du Drive » + bouton manuel + ligne d'état
  (dernière mise à jour) dans la carte sauvegarde. Échec non bloquant.
- **Le fichier Excel poussé embarque toutes les améliorations v4** :
  - **🔵 statut « périmé — requalifier » distinct du vrai retard** dans la
    formule K (l'Excel d'origine comptait ces lignes « en retard ») ;
  - **⛔ Hors service / Réformé** différencié dans le STATUT (au lieu de rouge) ;
  - **colonne N « SEUIL ALERTE (JOURS) »** explicite (60, 5 pour les WORMS GE) ;
  - **feuille Synthèse** : compteurs vivants (HG/red/pér/7j) + tableau par
    section (52 sections, total général) ;
  - **feuille Journal (app)** : relevé des 200 dernières modifications ;
  - **filtre automatique** A8:N, **mise en forme conditionnelle** (statuts + jours
    restants, 8 dxfs), **validations** (périodicité 1-120 mois, seuil 1-365 j) ;
  - **dates au format JJ/MM/AAAA** ; recalcul forcé à l'ouverture.
- L'export local « 🟩 Exporter Excel (.xlsx) » produit le même fichier, daté.
- Import : le lecteur .xlsx lit les fichiers v3/v4 (colonne N et nouveaux
  statuts tolérés, détection a5 conservée via l'étiquette « 5 JOURS »).
- Harnais 191 tests (0 échec) + boot DOM strict ; OOXML v4 vérifié openpyxl
  **et** recalculé par LibreOffice (1 621 formules conformes au seed :
  321 matériels, 13 retards, 9 périmés).

## v3.2 (2026-11-25)

- **📅 Statut « périmé » distinct** : un matériel contrôlé à jour dans son cycle
  mais dont la date limite (péremption) est dépassée n'est plus compté comme
  « en retard » — c'est la date limite qu'il faut requalifier. Compteur dédié,
  mention « limite à actualiser » sur la ligne, bandeau d'alertes décompte les
  « péremption(s) à requalifier ». L'export Excel reste fidèle au registre
  (la formule K affiche « 🔴 En retard » pour ces lignes dans l'Excel d'origine).
- **⛔ Hors service différencié** : les HS/réformés s'affichent ⛔ dans la liste,
  plus de confusion avec les vrais retards 🔴.
- **🚨 Export retard(s) / péremption(s)** : CSV dédié (BOM UTF-8, `;`) trié par
  prochaine date, colonnes N°/SECTION/MATÉRIEL/PROCHAIN/JOURS DE DÉPASSEMENT/
  STATUT/NOTES/RÉF — à imprimer ou ramener au foyer.
- **⚡ Vue « sans échéance » guidée** : le filtre ⚪ affiche une consigne de
  saisie sur le terrain (un appui sur ✔ crée l'échéance immédiatement).
- Harnais 177 tests + boot DOM strict ; tests datés rendus robustes (plus de
  dépendance à la date du jour).

## Fonctions

- **Statuts recalculés en direct**, formules identiques au registre Excel :
  prochain contrôle = dernier contrôle + périodicité (plafonné à la date limite),
  🔴 en retard / 📅 périmé-limite à actualiser (v3.2) / 🟠 à prévoir (≤ 60 j ou
  ≤ 5 j selon le matériel) / 🟢 OK / ⛔ hors service / ⚪ sans échéance.
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
- `v1-test-harness.js` : harnais Node (177 tests, dont export xlsx vérifié
  cellule par cellule et import du registre réel) —
  `node v1-test-harness.js index.html sw.js` (joué par la CI à chaque push).
- `strict-dom-test.js` : boot réel avec DOM strict ( détecte les crashes que le
  harnais masque) — `node strict-dom-test.js`.
- Données initiales : `SEED` embarqué dans `index.html` (extrait de l'Excel le 2026-10-11).
