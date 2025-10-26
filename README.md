# Temple-des-kacpers

## Démarrer l'API leaderboard

1. Dans un terminal :
   ```bash
   cd server
   node server.js
   ```
   L'API écoute par défaut sur `http://localhost:8787`.
   (Tu peux changer le port via la variable d'environnement `PORT`.)

2. Ouvre ensuite `index.html` (par exemple via `open index.html`) dans ton navigateur.

Le jeu tentera automatiquement de contacter l'API pour lire/écrire le classement (URL configurable via `window.KACPER_API_URL` ou `window.TEMPLE_API_URL` dans `index.html`).  
Si l'API est indisponible, un classement local (stocké dans `localStorage`) sera utilisé en secours.
