# Lane Zero — Prototype

A small Phaser 3 prototype for the mobile wave shooter "Lane Zero". The project serves a minimal browser-playable demo using a Node/Express server.

## How to run

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the server

   ```bash
   npm start
   ```

3. Open http://localhost:3000 in a browser (mobile emulation recommended)

## Files

- `index.html` — entry page that loads Phaser and `src/game.js`
- `src/game.js` — game prototype (Phaser)
- `style.css` — minimal styling for the container
- `server.js` — Express static server + index route
- `package.json` — Node manifest

## Next steps

- Implement core gameplay systems (swipe, shooting, enemies, power-ups)
- Add Workshop and persistence for upgrades
- Add art, sounds, and mobile input tuning