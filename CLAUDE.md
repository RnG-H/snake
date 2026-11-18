# Dustline Derby

Online 3D horse race: Vite + three.js client, Node `ws` room server. No framework, no test suite.

## Commands
- `npm install` - install deps
- `npm run dev` - dev server at http://localhost:5173 (also hosts the `/ws` race rooms via a Vite plugin)
- `npm run build` - production build to `dist/` (use this to verify changes)
- `npm start` - production server: serves `dist/` and `/ws` on `PORT` (default 3000)

## Layout
- `index.html` - canvas, lobby panel, HUD, results
- `src/main.js` - renderer, scene, game state machine, camera, main loop
- `src/course.js` - course layout and ground physics (pure, no three.js; the server imports it too)
- `src/track.js` - builds course meshes and the sky from `course.js`
- `src/models.js` - horse and rider models plus their animation
- `src/player.js` - local horse physics and keyboard input (fixed 60 Hz step)
- `src/net.js` - WebSocket client and remote interpolation
- `src/ui.js` - DOM for lobby, HUD and results
- `server/rooms.js` - rooms, ready/countdown, state relay, results
- `server/index.js` - production static and WebSocket server
- `DESIGN.md` - rough design of rider, horses and course

## Conventions
- Dependencies are limited to `three` and `ws` (plus Vite). Don't add more without asking.
- Course tuning lives in `src/course.js`; movement tuning lives in `TUNING` in `src/player.js`.
- `src/course.js` and `src/player.js` run in Node, so course physics can be checked headlessly without a browser.
- `?debug` exposes `window.__derby` and checkpoint teleport keys.
