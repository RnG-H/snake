// Production server: serves the built game from dist/ and hosts race rooms on /ws.
// Usage: npm run build && npm start   (PORT defaults to 3000)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachRooms } from './rooms.js';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    let file = join(DIST, path);
    if (!file.startsWith(DIST)) throw new Error('outside dist');
    if (!(await stat(file).catch(() => null))?.isFile()) file = join(DIST, 'index.html');
    const body = await readFile(file);
    const cache = file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found. Did you run "npm run build"?');
  }
});

attachRooms(server);
server.listen(PORT, () => console.log(`Dustline Derby on http://localhost:${PORT}`));
