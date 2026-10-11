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
- **Sauvegarde Google Drive** (dossier `taffbmpm` par défaut, configurable) :
  fusion multi-appareils (dernier modifié gagne + pierres tombales), auto 30 s.
- **Exports** : JSON (sauvegarde/restauration) et CSV ouvrable dans Excel.

## Configuration Google (une seule fois)

1. Console Google Cloud → APIs & Services → activer **Google Drive API**.
2. OAuth client (Web) avec URI de redirection `https://developers.google.com/oauthplayground`.
3. OAuth Playground → ⚙️ *Use your own OAuth credentials* → scope
   `https://www.googleapis.com/auth/drive.file` → **Authorize** → **Exchange** → Refresh token.
4. Dans l'app : Options → Client ID / Secret / Refresh Token → Enregistrer.

(Le token `drive.file` des autres apps Patrimoine / Tâches & Relances est réutilisable.)

## Développement

- `index.html` : app complète (sans dépendance). `sw.js` : service worker (cache `sos-heli-controles-v1`).
- `tools/gen-icons.js` : icônes PNG générées au build (pur Node + zlib).
- `v1-test-harness.js` : harnais Node (89 tests) — `node v1-test-harness.js index.html sw.js` (joué par la CI à chaque push).
- Données initiales : `SEED` embarqué dans `index.html` (extrait de l'Excel le 2026-10-11).

## Déploiement

Chaque push sur `main` redéploie le site (workflow GitHub Actions) et rejoue les tests.
