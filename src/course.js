// Course layout and ground physics. Pure data + math (no three.js), so the
// room server can import it too. Units are metres; the course runs along +z.

export const HALF_WIDTH = 14; // corridor half-width around the centreline
export const START_Z = 9;
export const START_LINE_Z = 12;
export const FINISH_Z = 1160;
export const COURSE_END = 1200;
export const MAX_PLAYERS = 8;

// Gently winding centreline, straightened through the start, ravine and bridge.
const calm = (z, a, b, edge = 25) =>
  1 - smoothstep(a - edge, a, z) * (1 - smoothstep(b, b + edge, z));
export function centerX(z) {
  const wind = 7 * Math.sin(z / 95) + 3 * Math.sin(z / 41 + 1.3);
  return wind * calm(z, -100, 40) * calm(z, 730, 890) * calm(z, 1120, 1300);
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Sections, in order. Used for HUD labels and the design doc.
export const SECTIONS = [
  { name: 'Start Gate', z: 0 },
  { name: 'Rolling Prairie', z: 40 },
  { name: 'Hurdle Run', z: 260 },
  { name: 'Mud Flats', z: 440 },
  { name: 'Rock Ledges', z: 580 },
  { name: "Devil's Gap", z: 715 },
  { name: 'Rope Bridge', z: 790 },
  { name: 'Long Descent', z: 885 },
  { name: 'Finish', z: 1140 },
];

// Respawn points; the last one you passed is where a fall puts you back.
export const CHECKPOINTS = [START_Z, 260, 440, 575, 712, 785, 885, 1000];

// Hurdles span the full width: jump them or stumble.
export const HURDLES = [
  { z: 290, h: 0.8, type: 'log' },
  { z: 325, h: 1.0, type: 'fence' },
  { z: 356, h: 0.8, type: 'log' },
  { z: 388, h: 1.0, type: 'fence' },
  { z: 418, h: 0.8, type: 'log' },
];
const HURDLE_DEPTH = 0.5;

// Mud patches (ellipses, x relative to the centreline): slow you down.
export const MUD = [
  { xr: -6, z: 465, rx: 7, rz: 12 },
  { xr: 6, z: 492, rx: 6, rz: 10 },
  { xr: -2, z: 520, rx: 9, rz: 9 },
  { xr: 8, z: 548, rx: 5, rz: 11 },
  { xr: -9, z: 556, rx: 5, rz: 8 },
];

// Rock ledges: a stepped mesa on the left (x relative). Jump up for a clean
// line, or weave through the boulders on the right.
export const LEDGES = [
  { x0: -13.5, x1: -3.5, z0: 595, z1: 700, h: 1.0 },
  { x0: -13.5, x1: -3.5, z0: 612, z1: 688, h: 2.0 },
  { x0: -13.5, x1: -3.5, z0: 630, z1: 676, h: 3.0 },
];
export const BOULDERS = [
  { xr: 2, z: 608, r: 1.6 },
  { xr: 9, z: 622, r: 2.0 },
  { xr: 4.5, z: 641, r: 1.5 },
  { xr: 11, z: 655, r: 1.4 },
  { xr: 1, z: 668, r: 1.8 },
  { xr: 7.5, z: 684, r: 1.7 },
];
const BOULDER_H = 2.6;

// Gaps: the ravine must be jumped; the chasm is crossed on a narrow bridge.
export const RAVINE = { z0: 745, z1: 755 };
export const CHASM = { z0: 800, z1: 870 };
export const BRIDGE_HALF = 1.8;
export const VOID = -Infinity;
export const FALL_LIMIT = 12; // metres below the rim before you respawn

// Base elevation (no obstacles): rolling prairie hills and the long descent.
export function baseHeight(x, z) {
  let h = 0;
  if (z > 60 && z < 260) h += 0.9 * (1 - Math.cos((2 * Math.PI * (z - 60)) / 66.67));
  h -= 14 * smoothstep(900, 1140, z);
  h += 0.12 * Math.sin(x * 0.35 + z * 0.07) * Math.sin(z * 0.031);
  return h;
}

export function bridgeSag(z) {
  return 0.9 * Math.sin((Math.PI * (z - CHASM.z0)) / (CHASM.z1 - CHASM.z0));
}

export function inMud(x, z) {
  const xr = x - centerX(z);
  return MUD.some((m) => ((xr - m.xr) / m.rx) ** 2 + ((z - m.z) / m.rz) ** 2 < 1);
}

// Height of whatever you would stand on at (x, z): terrain, hurdle tops,
// ledges, boulders, the bridge deck. VOID over the ravine/chasm.
export function groundHeight(x, z) {
  const xr = x - centerX(z);
  if (z > RAVINE.z0 && z < RAVINE.z1) return VOID;
  if (z > CHASM.z0 && z < CHASM.z1) {
    return Math.abs(xr) < BRIDGE_HALF ? baseHeight(x, CHASM.z0) - bridgeSag(z) + 0.15 : VOID;
  }
  let h = baseHeight(x, z);
  let top = 0;
  for (const hd of HURDLES) {
    if (Math.abs(z - hd.z) < HURDLE_DEPTH / 2) top = Math.max(top, hd.h);
  }
  for (const l of LEDGES) {
    if (xr > l.x0 && xr < l.x1 && z > l.z0 && z < l.z1) top = Math.max(top, l.h);
  }
  for (const b of BOULDERS) {
    if ((xr - b.xr) ** 2 + (z - b.z) ** 2 < b.r * b.r) top = Math.max(top, BOULDER_H);
  }
  return h + top;
}

// Which "rim" height to measure falls against (top of the gap you fell into).
export function rimHeight(z) {
  return baseHeight(0, z);
}

export function sectionAt(z) {
  let s = SECTIONS[0];
  for (const sec of SECTIONS) if (z >= sec.z) s = sec;
  return s.name;
}

// Starting stalls: 8 lanes across the start gate.
export function startSlot(i) {
  return { x: -10.5 + 3 * i, z: START_Z };
}
