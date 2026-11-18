import { defineConfig } from 'vite';
import { attachRooms } from './server/rooms.js';

// In dev, host the race rooms on Vite's own server so `npm run dev` is all you need.
const rooms = {
  name: 'race-rooms',
  configureServer(server) {
    if (server.httpServer) attachRooms(server.httpServer);
  },
  configurePreviewServer(server) {
    if (server.httpServer) attachRooms(server.httpServer);
  },
};

// three.js alone is ~500 kB minified; that's expected for this game.
export default defineConfig({ plugins: [rooms], build: { chunkSizeWarningLimit: 800 } });
