// DOM side: lobby, roster, swatches, HUD, countdown, toasts, results.
import { COATS, PONCHOS } from './models.js';
import { FINISH_Z } from './course.js';

const $ = (id) => document.getElementById(id);
export const el = {
  lobby: $('lobby'), joinForm: $('join-form'), name: $('name'), room: $('room'), solo: $('solo'),
  roomView: $('room-view'), roomCode: $('room-code'), copyLink: $('copy-link'), roster: $('roster'),
  ready: $('ready'), startNow: $('start-now'), lobbyMsg: $('lobby-msg'),
  coats: $('coats'), coatName: $('coat-name'), ponchos: $('ponchos'),
  hud: $('hud'), place: $('place'), placeOf: $('place-of'), timer: $('timer'), dots: $('progress-dots'),
  section: $('section'), countdown: $('countdown'), toast: $('toast'),
  speed: $('speed'), speedBar: $('speed-bar'), staminaBar: $('stamina-bar'),
  results: $('results'), resultsList: $('results-list'), resultsClose: $('results-close'),
};

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export const fmtTime = (t) => {
  if (t == null) return 'DNF';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---- Look pickers.
export function buildSwatches(profile, onChange) {
  el.coats.innerHTML = '';
  for (const [key, c] of Object.entries(COATS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch coat';
    b.title = c.name;
    b.setAttribute('aria-label', `${c.name} horse`);
    b.style.background = `linear-gradient(135deg, ${c.body} 60%, ${c.mane} 60%)`;
    b.onclick = () => { profile.coat = key; refresh(); onChange(); };
    b.dataset.key = key;
    el.coats.append(b);
  }
  el.ponchos.innerHTML = '';
  for (const [key, color] of Object.entries(PONCHOS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.title = key;
    b.setAttribute('aria-label', `${key} poncho`);
    b.style.background = color;
    b.onclick = () => { profile.poncho = color; refresh(); onChange(); };
    b.dataset.key = color;
    el.ponchos.append(b);
  }
  function refresh() {
    for (const b of el.coats.children) b.setAttribute('aria-pressed', b.dataset.key === profile.coat);
    for (const b of el.ponchos.children) b.setAttribute('aria-pressed', b.dataset.key === profile.poncho);
    el.coatName.textContent = COATS[profile.coat]?.name || '';
  }
  refresh();
}

export function showRoom(code) {
  el.joinForm.hidden = true;
  el.roomView.hidden = false;
  el.roomCode.textContent = code;
}
export function showJoinForm() {
  el.joinForm.hidden = false;
  el.roomView.hidden = true;
}

export function renderRoster(players, myId, hostId) {
  el.roster.innerHTML = players
    .sort((a, b) => a.slot - b.slot)
    .map((p) => `<li class="${p.id === myId ? 'me' : ''}">
      <span class="dot" style="background:${esc(p.poncho)}"></span>
      <span class="dot" style="background:${esc(COATS[p.coat]?.body || '#888')}"></span>
      <span class="who">${esc(p.name)}${p.id === myId ? ' (you)' : ''}</span>
      ${p.id === hostId ? '<span class="tag">host</span>' : ''}
      ${p.racing ? '<span class="tag">racing</span>' : p.ready ? '<span class="ok">✔ ready</span>' : '<span class="tag">…</span>'}
    </li>`).join('');
}

export function lobbyMessage(text) { el.lobbyMsg.textContent = text || ''; }

// ---- HUD.
let toastTimer;
export function toast(text, ms = 1400) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
}

let lastCount = null;
export function setCountdown(text) {
  if (text === lastCount) return;
  lastCount = text;
  el.countdown.textContent = text;
  el.countdown.classList.remove('pop');
  void el.countdown.offsetWidth;
  if (text) el.countdown.classList.add('pop');
}

export function updateHud({ place, total, time, speed, stamina, section, riders, myId }) {
  el.place.textContent = ordinal(place);
  el.placeOf.textContent = `/ ${total}`;
  el.timer.textContent = fmtTime(time);
  el.speed.textContent = Math.round(speed * 3.6);
  el.speedBar.style.width = `${Math.min(100, (speed / 24) * 100)}%`;
  el.staminaBar.style.width = `${stamina * 100}%`;
  el.staminaBar.parentElement.classList.toggle('low', stamina < 0.25);
  if (el.section.textContent !== section) el.section.textContent = section;
  // Progress dots, one per rider.
  while (el.dots.children.length < riders.length) el.dots.append(document.createElement('i'));
  while (el.dots.children.length > riders.length) el.dots.lastChild.remove();
  riders.forEach((r, i) => {
    const d = el.dots.children[i];
    d.style.left = `${Math.max(0, Math.min(100, (r.z / FINISH_Z) * 100))}%`;
    d.style.background = r.poncho;
    d.className = r.id === myId ? 'me' : '';
  });
}

export function showResults(results, myId) {
  el.resultsList.innerHTML = results.map((r, i) => `<li class="${r.id === myId ? 'me' : ''}">
    <span class="pos">${r.time == null ? '–' : ordinal(i + 1)}</span>
    <span class="dot" style="background:${esc(r.poncho)}"></span>
    <span>${esc(r.name)}${r.id === myId ? ' (you)' : ''}</span>
    <span class="time">${fmtTime(r.time)}</span>
  </li>`).join('');
  el.results.hidden = false;
}
