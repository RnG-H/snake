const SIZE = 20;
const CELLS = 20;
const TICK_MS = 110;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');

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
  overlayTitle.textContent = `Game over - ${score} pts. Press any key to restart`;
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

function draw() {
  ctx.fillStyle = '#08120b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ff5c7a';
  ctx.fillRect(food.x * SIZE + 2, food.y * SIZE + 2, SIZE - 4, SIZE - 4);
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? '#b8ffc4' : '#3bd65a';
    ctx.fillRect(s.x * SIZE + 1, s.y * SIZE + 1, SIZE - 2, SIZE - 2);
  });
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
