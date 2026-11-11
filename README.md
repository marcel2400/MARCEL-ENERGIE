# Atelier Manager

Logiciel de gestion d'atelier pour Windows : clients, rendez-vous, interventions, devis, finances.

## Technologie

- **Electron** — véritable application de bureau Windows (pas un site web)
- **React** — interface moderne et fluide
- **SQLite** (intégré à Node/Electron via `node:sqlite`) — base de données locale fiable, aucune dépendance native
- **API Adresse (data.gouv.fr)** — autocomplétion des adresses en ligne, avec repli **hors ligne** sur les 34 969 communes françaises (embarquées)

## Développement

```bash
npm install
npm test              # tests de la couche données (22 tests)
npm run build:renderer
npm start             # lance l'application
```

## Construire l'installateur Windows (.exe)

```bash
npm run dist
```

L'installateur NSIS est généré dans `release/AtelierManager-Setup-1.0.0.exe`
(raccourci bureau + menu Démarrer créés automatiquement, installation en français).

## Structure

- `electron/main.js` — processus principal (fenêtre, IPC, sauvegardes)
- `electron/db.js` — couche SQLite (schéma complet, recherche normalisée, doublons)
- `electron/adresse.js` — autocomplétion d'adresses (en ligne + hors ligne)
- `src/` — interface React (pages Clients, Tableau de bord, Paramètres…)
- `scripts/` — génération du référentiel des communes et de l'icône
- `tests/run.mjs` — tests automatisés
