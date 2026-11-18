import * as THREE from 'three';
import { createRacer, PONCHOS } from './models.js';
import { buildCourse, buildSky } from './track.js';
import { Player, createInput, TUNING } from './player.js';
import { Net } from './net.js';
import { CHECKPOINTS, FINISH_Z, START_LINE_Z, centerX, baseHeight, sectionAt, startSlot } from './course.js';
import * as ui from './ui.js';

const { el } = ui;
const DEBUG = new URLSearchParams(location.search).has('debug');

// ---------------------------------------------------------------- scene ----
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#e7a77a', 90, 430);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);

const sunDir = new THREE.Vector3(0.55, 0.42, 0.72).normalize();
const sky = buildSky(scene, sunDir);
scene.add(new THREE.HemisphereLight('#ffd9a8', '#7a4a2e', 1.25));
const sun = new THREE.DirectionalLight('#ffd2a0', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 160 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const course = buildCourse(scene);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- state ----
const keys = createInput();
const net = new Net();
const me = new Player(0);

let profile = { name: '', coat: 'chestnut', poncho: PONCHOS.crimson };
try { profile = { ...profile, ...JSON.parse(localStorage.getItem('dustline-profile')) }; } catch {}
const saveProfile = () => { try { localStorage.setItem('dustline-profile', JSON.stringify(profile)); } catch {} };

const state = {
  mode: 'menu', // menu | lobby | countdown | race | spectate
  offline: false,
  myId: 'me',
  hostId: null,
  players: new Map(), // id -> { id, name, coat, poncho, slot, ready, racing, racer, look }
  countdownEnd: 0,
  raceStart: 0,
  finishTime: null,
  finishOrder: [], // ids in finishing order
};

function localRecord() {
  return { id: state.myId, name: profile.name || 'You', coat: profile.coat, poncho: profile.poncho, slot: me.slot, racing: true };
}

// Keep a 3D racer per player in sync with their look.
function syncRacer(p) {
  const look = `${p.coat}|${p.poncho}|${p.name}`;
  if (p.racer && p.look === look) return;
  if (p.racer) scene.remove(p.racer.group);
  p.racer = createRacer({ coat: p.coat, poncho: p.poncho, name: p.id === state.myId ? '' : p.name });
  p.look = look;
  scene.add(p.racer.group);
  placeAtSlot(p);
}
// In the lobby riders line up in front of the gate; at the countdown they enter the stalls.
const LINEUP_Z = START_LINE_Z + 7;
function placeAtSlot(p) {
  const s = startSlot(p.slot);
  const inStalls = state.mode === 'countdown' || state.mode === 'race';
  const x = inStalls ? s.x : s.x * 0.55, z = inStalls ? s.z : LINEUP_Z;
  p.racer.group.position.set(x, baseHeight(x, z), z);
  p.racer.group.rotation.y = 0;
}
function setPlayers(list) {
  const seen = new Set();
  for (const info of list) {
    seen.add(info.id);
    const p = state.players.get(info.id) || {};
    Object.assign(p, info);
    state.players.set(info.id, p);
    syncRacer(p);
  }
  for (const [id, p] of state.players) {
    if (!seen.has(id)) { scene.remove(p.racer.group); state.players.delete(id); }
  }
}
function myRecord() { return state.players.get(state.myId); }

// ---------------------------------------------------------------- flow -----
ui.buildSwatches(profile, () => {
  saveProfile();
  const p = myRecord();
  if (p) { p.coat = profile.coat; p.poncho = profile.poncho; syncRacer(p); }
  net.send({ t: 'look', coat: profile.coat, poncho: profile.poncho });
});
el.name.value = profile.name;
el.room.value = new URLSearchParams(location.search).get('room') || '';

function enterMenu(message = '') {
  state.mode = 'menu';
  state.offline = false;
  state.myId = 'me';
  setPlayers([]);
  me.reset(0);
  setPlayers([localRecord()]);
  ui.showJoinForm();
  el.lobby.hidden = false;
  el.hud.hidden = true;
  el.results.hidden = true;
  course.setGates(false);
  ui.lobbyMessage(message);
}

el.joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profile.name = el.name.value.trim().slice(0, 16);
  saveProfile();
  ui.lobbyMessage('Riding to the stalls…');
  try {
    if (!net.connected) await net.connect();
  } catch {
    ui.lobbyMessage("Couldn't reach the race server. You can still practice solo.");
    return;
  }
  net.send({ t: 'join', room: el.room.value.trim(), name: profile.name, coat: profile.coat, poncho: profile.poncho });
});

el.solo.addEventListener('click', () => {
  profile.name = el.name.value.trim().slice(0, 16);
  saveProfile();
  state.offline = true;
  state.myId = 'me';
  setPlayers([]);
  setPlayers([localRecord()]);
  startCountdown(3000);
});

el.ready.addEventListener('click', () => {
  const p = myRecord();
  net.send({ t: 'ready', v: !(p && p.ready) });
});
el.startNow.addEventListener('click', () => net.send({ t: 'start' }));
el.copyLink.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?room=${net.room}`;
  try { await navigator.clipboard.writeText(url); ui.lobbyMessage('Invite link copied.'); } catch { ui.lobbyMessage(url); }
});
el.resultsClose.addEventListener('click', () => {
  el.results.hidden = true;
  if (state.offline) return enterMenu();
  backToStalls();
});

function backToStalls() {
  state.mode = 'lobby';
  el.hud.hidden = true;
  el.lobby.hidden = false;
  me.reset(myRecord()?.slot ?? 0);
  for (const p of state.players.values()) placeAtSlot(p);
  net.remotes.clear();
  course.setGates(false);
}

function startCountdown(ms) {
  state.mode = 'countdown';
  state.countdownEnd = performance.now() + ms;
  state.finishTime = null;
  state.finishOrder = [];
  me.reset(myRecord()?.slot ?? 0);
  for (const p of state.players.values()) placeAtSlot(p);
  net.remotes.clear();
  course.setGates(false);
  el.lobby.hidden = true;
  el.results.hidden = true;
  el.hud.hidden = false;
}

// ---- Network events.
net.addEventListener('welcome', ({ detail }) => {
  state.myId = detail.id;
  state.mode = 'lobby';
  setPlayers([]);
  me.reset(detail.slot);
  ui.showRoom(detail.room);
  ui.lobbyMessage('');
  history.replaceState(null, '', `?room=${detail.room}${DEBUG ? '&debug' : ''}`);
});
net.addEventListener('roster', ({ detail }) => {
  state.hostId = detail.host;
  setPlayers(detail.players);
  ui.renderRoster(detail.players, state.myId, state.hostId);
  const mine = myRecord();
  el.ready.textContent = mine?.ready ? 'Ready ✔' : "I'm ready";
  el.ready.classList.toggle('on', !!mine?.ready);
  el.startNow.hidden = state.hostId !== state.myId || detail.phase !== 'lobby';
  el.ready.disabled = detail.phase !== 'lobby';
});
net.addEventListener('countdown', ({ detail }) => startCountdown(detail.inMs));
net.addEventListener('inprogress', () => {
  state.mode = 'spectate';
  ui.lobbyMessage("A race is under way. You'll ride in the next one.");
});
net.addEventListener('finished', ({ detail }) => {
  state.finishOrder.push(detail.id);
  if (detail.id !== state.myId) {
    const p = state.players.get(detail.id);
    ui.toast(`${p?.name || 'A rider'} finished ${ui.ordinal(detail.place)}`, 1800);
  } else {
    ui.toast(`You finished ${ui.ordinal(detail.place)}! ${ui.fmtTime(detail.time)}`, 3000);
  }
});
net.addEventListener('results', ({ detail }) => {
  ui.showResults(detail.results, state.myId);
  el.hud.hidden = true;
  if (state.mode === 'spectate') state.mode = 'lobby';
});
net.addEventListener('error', ({ detail }) => ui.lobbyMessage(detail.msg));
net.addEventListener('disconnect', () => enterMenu('Lost connection to the race server.'));

// ---------------------------------------------------------------- race -----
function handlePlayerEvents() {
  for (const ev of me.events) {
    if (ev === 'stumble') { ui.toast('Stumbled!'); shake = 0.5; }
    if (ev === 'respawn') { ui.toast('Took a fall. Back to the checkpoint.', 1800); shake = 0.3; }
    if (ev === 'checkpoint') ui.toast('Checkpoint', 900);
    if (ev === 'finish') {
      state.finishTime = (performance.now() - state.raceStart) / 1000;
      if (state.offline) {
        state.finishOrder.push(state.myId);
        let best = Infinity;
        try { best = Number(localStorage.getItem('dustline-best')) || Infinity; } catch {}
        const record = state.finishTime < best;
        if (record) try { localStorage.setItem('dustline-best', state.finishTime.toFixed(2)); } catch {}
        ui.toast(record ? `New best! ${ui.fmtTime(state.finishTime)}` : `Finished! Best ${ui.fmtTime(best)}`, 2500);
        setTimeout(() => {
          ui.showResults([{ id: 'me', name: profile.name || 'You', poncho: profile.poncho, time: state.finishTime }], 'me');
          el.hud.hidden = true;
        }, 2200);
      } else {
        net.sendState(me.snapshot(), Infinity);
        net.send({ t: 'finish', time: state.finishTime });
      }
    }
  }
  me.events.length = 0;
}

// Riders in the race with their current z, for ranking and the progress bar.
function riderPositions() {
  const out = [];
  for (const p of state.players.values()) {
    if (!p.racing && !state.offline) continue;
    const z = p.id === state.myId ? me.z : (net.sample(p.id)?.[2] ?? startSlot(p.slot).z);
    out.push({ id: p.id, z, poncho: p.poncho });
  }
  const order = state.finishOrder;
  out.sort((a, b) => {
    const fa = order.indexOf(a.id), fb = order.indexOf(b.id);
    if (fa >= 0 || fb >= 0) return (fa < 0 ? 1e9 : fa) - (fb < 0 ? 1e9 : fb);
    return b.z - a.z;
  });
  return out;
}

// ---------------------------------------------------------------- camera ---
const camPos = new THREE.Vector3(0, 4, -6);
const camLook = new THREE.Vector3();
let shake = 0;

function chase(dt, x, y, z, yaw, speed) {
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const want = new THREE.Vector3(x, y, z).addScaledVector(fwd, -7.5).add(new THREE.Vector3(0, 3.4, 0));
  const floor = baseHeight(want.x, want.z) + 1.2;
  if (want.y < floor && y > floor - 3) want.y = floor;
  const k = 1 - Math.exp(-dt * 5);
  camPos.lerp(want, k);
  camLook.lerp(new THREE.Vector3(x, y + 1.4, z).addScaledVector(fwd, 5), 1 - Math.exp(-dt * 8));
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  camera.lookAt(camLook);
  const fov = 62 + Math.min(1, speed / TUNING.sprint) * 12;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
}

function orbit(t, target) {
  const a = t * 0.22 + 0.6;
  camera.position.set(target.x + Math.sin(a) * 5.2, target.y + 2.0, target.z + Math.cos(a) * 5.2);
  camera.lookAt(target.x, target.y + 1.2, target.z);
  if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
  // Shift the view so the horse sits to the right of the lobby panel.
  if (!el.lobby.hidden && innerWidth > 760) {
    const panel = el.lobby.getBoundingClientRect().right;
    const visibleW = 2 * 5.4 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    camera.translateX(-((panel / 2) / innerWidth) * visibleW);
  }
  camPos.copy(camera.position);
  camLook.set(target.x, target.y + 1.2, target.z + 5);
}

// ---------------------------------------------------------------- loop -----
const clock = new THREE.Clock();
let elapsed = 0;

const STEP = 1 / 60; // physics runs at a fixed rate, independent of frame rate
let acc = 0;

function frame() {
  const dt = Math.min(0.25, clock.getDelta());
  elapsed += dt;
  const now = performance.now();
  const mine = myRecord();

  if (state.mode === 'countdown') {
    const left = state.countdownEnd - now;
    ui.setCountdown(left > 0 ? String(Math.ceil(left / 1000)) : 'GO!');
    if (left <= 0) {
      state.mode = 'race';
      state.raceStart = state.countdownEnd;
      me.locked = false;
      course.setGates(true);
      setTimeout(() => ui.setCountdown(''), 800);
    }
  }

  const racing = state.mode === 'race' || state.mode === 'countdown';
  if (racing) {
    acc += dt;
    while (acc >= STEP) { me.step(STEP, keys); acc -= STEP; }
    handlePlayerEvents();
    if (!state.offline) net.sendState(me.snapshot(), now);
  }

  // Own racer.
  if (mine?.racer) {
    const g = mine.racer.group;
    if (racing) {
      g.position.set(me.x, me.y, me.z);
      g.rotation.y = me.yaw;
    }
    mine.racer.animate(dt, racing
      ? { speed: me.speed, airborne: me.airborne, stumble: me.stumble / TUNING.stumbleTime }
      : { speed: 0 });
  }

  // Remote racers.
  let leader = null;
  for (const p of state.players.values()) {
    if (p.id === state.myId || !p.racer) continue;
    const s = (state.mode === 'race' || state.mode === 'spectate' || state.mode === 'countdown') ? net.sample(p.id, now) : null;
    if (s) {
      p.racer.group.position.set(s[0], s[1], s[2]);
      p.racer.group.rotation.y = s[3];
      p.racer.animate(dt, { speed: s[4], airborne: !!(s[5] & 1), stumble: s[5] & 2 ? 0.8 : 0 });
      if (!leader || s[2] > leader.s[2]) leader = { p, s };
    } else {
      p.racer.animate(dt, { speed: 0 });
    }
  }

  // Camera.
  if (state.freeCam) { /* debug: camera driven externally */ }
  else if (racing) chase(dt, me.x, me.y, me.z, me.yaw, me.speed);
  else if (state.mode === 'spectate' && leader) chase(dt, leader.s[0], leader.s[1], leader.s[2], leader.s[3], leader.s[4]);
  else if (mine?.racer) orbit(elapsed, mine.racer.group.position);

  // HUD.
  if (racing) {
    const riders = riderPositions();
    const place = riders.findIndex((r) => r.id === state.myId) + 1 || 1;
    const time = state.mode === 'race' ? (state.finishTime ?? (now - state.raceStart) / 1000) : 0;
    ui.updateHud({
      place, total: riders.length, time, speed: me.speed, stamina: me.stamina,
      section: sectionAt(me.z), riders, myId: state.myId,
    });
  }

  // Sun and its shadow box follow the camera's focus.
  sun.target.position.copy(camLook);
  sun.position.copy(camLook).addScaledVector(sunDir, 80);
  sky.position.copy(camera.position);
  course.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- debug ----
if (DEBUG) {
  window.__derby = { me, state, net, camera, scene, createRacer, THREE, cx: centerX, bh: baseHeight };
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const n = Number(e.key);
    if (n >= 1 && n <= CHECKPOINTS.length) me.teleport(n - 1);
    if (e.key === '9') { me.x = centerX(FINISH_Z - 25); me.z = FINISH_Z - 25; me.y = baseHeight(me.x, me.z); }
  });
}

enterMenu();
requestAnimationFrame(frame);
