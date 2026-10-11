const SIZE = 20;
const CELLS = 20;
const TICK_MS = 110;

// 8-color palette, read from :root in style.css (the stylesheet loads before this script).
const css = getComputedStyle(document.documentElement);
const [INK, MOSS, FERN, LEAF, LIME, CREAM, APPLE, BARK] =
  ['ink', 'moss', 'fern', 'leaf', 'lime', 'cream', 'apple', 'bark']
    .map((n) => css.getPropertyValue(`--${n}`).trim());

// Sprite pixel maps: 10x10 art pixels per cell, '.' is transparent.
const PALETTE = { k: INK, d: FERN, m: LEAF, l: LIME, w: CREAM, r: APPLE, b: BARK };
const ART = 10;
const PX = SIZE / ART;

// Head and tail face right; rotated/flipped for the other directions.
const HEAD = [
  '..dddddd..',
  '.dmllllmd.',
  'dmmmmwkmmd',
  'dmmmmwkmmd',
  'dmmmmmmkmd',
  'dmmmmmmkmd',
  'dmmmmwkmmd',
  'dmmmmwkmmd',
  '.dmmmmmmd.',
  '..dddddd..',
];
const TAIL = [
  'dddd......',
  'mmmmddd...',
  'mlmmmmmdd.',
  'mmmmmmmmmd',
  'mmmmmmmmmd',
  'mmmmmmmmmd',
  'mmmmmmmmmd',
  'mlmmmmmdd.',
  'mmmmddd...',
  'dddd......',
];
const BODY = [
  'mmmmmmmmmm',
  'mmlmmmmmlm',
  'mlmmmmmlmm',
  'mmmmmmmmmm',
  'mmmmlmmmmm',
  'mmmlmmmmmm',
  'mmmmmmmmmm',
  'mmlmmmmmlm',
  'mlmmmmmlmm',
  'mmmmmmmmmm',
];
const APPLE_MAP = [
  '....b.mm..',
  '....bmm...',
  '.rrrrbrrr.',
  'rrwwrrrrrr',
  'rrwrrrrrrr',
  'rrrrrrrrrr',
  'rrrrrrrrbr',
  'rrrrrrrbbr',
  '.rrrrrbbb.',
  '..rrrrbb..',
];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');

let best = 0;
try { best = Number(localStorage.getItem('snake-best')) || 0; } catch {}
bestEl.textContent = best;

let snake, dir, nextDir, food, score, timer;

function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = nextDir = { x: 1, y: 0 };
  score = 0;
  scoreEl.textContent = score;
  placeFood();
  draw();
}

function placeFood() {
  do {
    food = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}

function start() {
  reset();
  overlay.classList.add('hidden');
  overlay.classList.remove('over');
  clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
}

function gameOver() {
  clearInterval(timer);
  timer = null;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    try { localStorage.setItem('snake-best', best); } catch {}
  }
  overlayTitle.textContent = `Game over - ${score} pts`;
  overlayMsg.textContent = 'Press any key to restart';
  overlay.classList.add('over');
  overlay.classList.remove('hidden');
}

function tick() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const hitWall = head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS;
  if (hitWall || snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver();
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreEl.textContent = score;
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

// Turn a pixel map into a 10x10 canvas, optionally rotated to face a direction.
function orient(map, d) {
  const n = ART;
  return map.map((_, i) => Array.from({ length: n }, (_, j) => {
    if (d.x === 1) return map[i][j];
    if (d.x === -1) return map[i][n - 1 - j];
    if (d.y === -1) return map[j][n - 1 - i];
    return map[n - 1 - j][i];
  }).join(''));
}

function bake(map) {
  const c = document.createElement('canvas');
  c.width = c.height = ART;
  const g = c.getContext('2d');
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = PALETTE[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }];
const dirKey = (d) => `${d.x},${d.y}`;
const headSprites = {};
const tailSprites = {};
for (const d of DIRS) {
  headSprites[dirKey(d)] = bake(orient(HEAD, d));
  tailSprites[dirKey(d)] = bake(orient(TAIL, d));
}
const bodySprite = bake(BODY);
const appleSprite = bake(APPLE_MAP);

// Board is static: checkered tiles with a few deterministic grass tufts.
const board = document.createElement('canvas');
board.width = board.height = CELLS * SIZE;
(() => {
  const g = board.getContext('2d');
  for (let y = 0; y < CELLS; y++) {
    for (let x = 0; x < CELLS; x++) {
      g.fillStyle = (x + y) % 2 ? MOSS : INK;
      g.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
      const h = (x * 73 + y * 151 + x * y * 17) % 11;
      if (h === 0) {
        g.fillStyle = FERN;
        const ox = x * SIZE + 12;
        const oy = y * SIZE + 10;
        g.fillRect(ox, oy, PX, PX);
        g.fillRect(ox + PX, oy - PX, PX, PX);
      }
    }
  }
})();

function draw() {
  ctx.drawImage(board, 0, 0);
  ctx.drawImage(appleSprite, food.x * SIZE, food.y * SIZE, SIZE, SIZE);

  const last = snake.length - 1;
  for (let i = last; i >= 0; i--) {
    const s = snake[i];
    const px = s.x * SIZE;
    const py = s.y * SIZE;
    if (i === 0) {
      ctx.drawImage(headSprites[dirKey(dir)], px, py, SIZE, SIZE);
    } else if (i === last) {
      const p = snake[i - 1];
      ctx.drawImage(tailSprites[dirKey({ x: s.x - p.x, y: s.y - p.y })], px, py, SIZE, SIZE);
    } else {
      ctx.drawImage(bodySprite, px, py, SIZE, SIZE);
      // outline only the sides that don't connect to a neighbouring segment
      ctx.fillStyle = FERN;
      const linked = (dx, dy) =>
        [snake[i - 1], snake[i + 1]].some((n) => n.x === s.x + dx && n.y === s.y + dy);
      if (!linked(0, -1)) ctx.fillRect(px, py, SIZE, PX);
      if (!linked(0, 1)) ctx.fillRect(px, py + SIZE - PX, SIZE, PX);
      if (!linked(-1, 0)) ctx.fillRect(px, py, PX, SIZE);
      if (!linked(1, 0)) ctx.fillRect(px + SIZE - PX, py, PX, SIZE);
    }
  }
}

const KEYS = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
};

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key in KEYS) e.preventDefault();
  if (!timer) return start();
  const d = KEYS[key];
  if (d && !(d.x === -dir.x && d.y === -dir.y)) nextDir = d;
});

reset();
