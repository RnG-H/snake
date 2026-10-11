# Snake

Small browser Snake game: Vite + vanilla JS, no framework, no tests.

## Commands
- `npm install` - install deps
- `npm run dev` - dev server at http://localhost:5173
- `npm run build` - production build to `dist/` (use this to verify changes)
- `npm run preview` - serve the production build

## Layout
- `index.html` - page shell (canvas, score, overlay)
- `src/main.js` - all game logic (grid 20x20, tick loop, input, localStorage high score)
- `src/style.css` - retro styling

## Conventions
- Keep it dependency-free apart from Vite.
- Game constants (`SIZE`, `CELLS`, `TICK_MS`) live at the top of `src/main.js`.
