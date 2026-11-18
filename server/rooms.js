// Race rooms over WebSocket (path /ws). The server owns the lobby, the
// countdown and the results; movement is client-authoritative and relayed.
import { WebSocketServer } from 'ws';
import { FINISH_Z, MAX_PLAYERS } from '../src/course.js';

const COUNTDOWN_MS = 3500;
const FINISH_GRACE_MS = 45000; // after the first finisher, the rest have this long
const rooms = new Map();
let nextId = 1;

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  let code;
  do code = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  while (rooms.has(code));
  return code;
}

const clean = (v, max) => String(v ?? '').replace(/[^\p{L}\p{N} _'.-]/gu, '').trim().slice(0, max);

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(data);
}

function roster(room) {
  broadcast(room, {
    t: 'roster',
    phase: room.phase,
    host: room.host,
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, coat: p.coat, poncho: p.poncho, ready: p.ready, slot: p.slot, racing: p.racing,
    })),
  });
}

function freeSlot(room) {
  const used = new Set([...room.players.values()].map((p) => p.slot));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return -1;
}

function startCountdown(room) {
  room.phase = 'racing';
  room.finishes = [];
  room.startAt = Date.now() + COUNTDOWN_MS;
  clearTimeout(room.endTimer);
  for (const p of room.players.values()) {
    p.racing = true;
    p.ready = false;
    p.z = 0;
    p.finishTime = null;
  }
  roster(room);
  broadcast(room, { t: 'countdown', inMs: COUNTDOWN_MS });
}

function maybeStart(room) {
  const ps = [...room.players.values()];
  if (room.phase === 'lobby' && ps.length && ps.every((p) => p.ready)) startCountdown(room);
}

function endRace(room) {
  if (room.phase !== 'racing') return;
  clearTimeout(room.endTimer);
  const racers = [...room.players.values()].filter((p) => p.racing);
  const results = [
    ...room.finishes,
    ...racers.filter((p) => p.finishTime == null).map((p) => ({ id: p.id, name: p.name, poncho: p.poncho, time: null })),
  ];
  room.phase = 'lobby';
  for (const p of room.players.values()) { p.racing = false; p.ready = false; }
  broadcast(room, { t: 'results', results });
  roster(room);
}

function maybeEnd(room) {
  const racers = [...room.players.values()].filter((p) => p.racing);
  if (room.phase === 'racing' && racers.every((p) => p.finishTime != null)) endRace(room);
}

function leave(player) {
  const room = player.room;
  if (!room) return;
  room.players.delete(player.id);
  player.room = null;
  if (!room.players.size) {
    clearTimeout(room.endTimer);
    rooms.delete(room.code);
    return;
  }
  if (room.host === player.id) room.host = room.players.keys().next().value;
  broadcast(room, { t: 'left', id: player.id });
  roster(room);
  maybeEnd(room);
  maybeStart(room);
}

function onMessage(player, msg) {
  const room = player.room;
  switch (msg.t) {
    case 'join': {
      if (room) return;
      let code = clean(msg.room, 4).toUpperCase();
      if (!code) code = newCode();
      let r = rooms.get(code);
      if (!r) {
        r = { code, players: new Map(), host: player.id, phase: 'lobby', finishes: [], startAt: 0 };
        rooms.set(code, r);
      }
      const slot = freeSlot(r);
      if (slot < 0) return send(player.ws, { t: 'error', msg: `Room ${code} is full (${MAX_PLAYERS} riders).` });
      Object.assign(player, {
        room: r, slot, ready: false, racing: false, z: 0, finishTime: null,
        name: clean(msg.name, 16) || `Rider ${player.id}`,
        coat: clean(msg.coat, 12) || 'chestnut',
        poncho: /^#[0-9a-f]{6}$/i.test(msg.poncho) ? msg.poncho : '#b3322a',
      });
      r.players.set(player.id, player);
      send(player.ws, { t: 'welcome', id: player.id, room: code, slot });
      if (r.phase === 'racing') send(player.ws, { t: 'inprogress', elapsedMs: Date.now() - r.startAt });
      roster(r);
      return;
    }
    case 'look': {
      if (!room) return;
      if (typeof msg.coat === 'string') player.coat = clean(msg.coat, 12);
      if (/^#[0-9a-f]{6}$/i.test(msg.poncho)) player.poncho = msg.poncho;
      roster(room);
      return;
    }
    case 'ready': {
      if (!room || room.phase !== 'lobby') return;
      player.ready = !!msg.v;
      roster(room);
      maybeStart(room);
      return;
    }
    case 'start': {
      if (room && room.phase === 'lobby' && room.host === player.id) startCountdown(room);
      return;
    }
    case 'state': {
      if (!room || !Array.isArray(msg.s) || msg.s.length !== 6 || !msg.s.every(Number.isFinite)) return;
      player.z = msg.s[2];
      broadcast(room, { t: 'state', id: player.id, s: msg.s }, player);
      return;
    }
    case 'finish': {
      if (!room || room.phase !== 'racing' || !player.racing || player.finishTime != null) return;
      if (player.z < FINISH_Z - 40) return; // the last relayed position must be near the line
      const serverTime = (Date.now() - room.startAt) / 1000;
      // Trust the client's own clock unless it is wildly off from the server's.
      const t = Number(msg.time);
      player.finishTime = Number.isFinite(t) && Math.abs(t - serverTime) < 3 ? t : serverTime;
      room.finishes.push({ id: player.id, name: player.name, poncho: player.poncho, time: player.finishTime });
      broadcast(room, { t: 'finished', id: player.id, place: room.finishes.length, time: player.finishTime });
      if (room.finishes.length === 1) room.endTimer = setTimeout(() => endRace(room), FINISH_GRACE_MS);
      maybeEnd(room);
      return;
    }
    case 'ping': {
      send(player.ws, { t: 'pong', c: msg.c });
      return;
    }
  }
}

export function attachRooms(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url || !req.url.startsWith('/ws')) return; // let Vite's HMR socket through
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    const player = { id: nextId++, ws, room: null };
    ws.on('message', (data) => {
      if (data.length > 2048) return;
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg && typeof msg.t === 'string') onMessage(player, msg);
    });
    ws.on('close', () => leave(player));
  });
  // Drop dead connections.
  const alive = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 15000);
  wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });
  wss.on('close', () => clearInterval(alive));
  return wss;
}
