// Rough character designs, built from three.js primitives (low-poly, flat-shaded).
//   Horse: one body plan, four coats.
//   Rider: "the Drifter", a frontier courier in a wide-brim hat, bandana and poncho.
// Every model faces +z with its origin on the ground between the hooves.
import * as THREE from 'three';

export const COATS = {
  chestnut: { name: 'Chestnut', body: '#8f4a22', mane: '#3a1a0c', points: '#5a2a12', marking: '#f2ead8' },
  black: { name: 'Black', body: '#25201e', mane: '#0f0d0c', points: '#f2ead8', marking: '#f2ead8' },
  grey: { name: 'Dapple Grey', body: '#a9a8a2', mane: '#e8e6df', points: '#55534f', marking: '#d8d6cf' },
  palomino: { name: 'Palomino', body: '#d8a64e', mane: '#f5ecd2', points: '#b7853a', marking: '#f5ecd2' },
};

export const PONCHOS = {
  crimson: '#b3322a', rust: '#c8642c', mustard: '#d9a63a', sage: '#6f8f5a',
  teal: '#2a8585', indigo: '#3d4aa8', plum: '#7d3c6e', ivory: '#e6d9bb',
};

const mats = new Map();
function mat(color) {
  if (!mats.has(color)) {
    mats.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 }));
  }
  return mats.get(color);
}

function mesh(geo, color, parent, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function pivot(parent, pos = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...pos);
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------- horse ----
function buildHorse(coatKey) {
  const c = COATS[coatKey] || COATS.chestnut;
  const root = new THREE.Group();
  const body = pivot(root, [0, 1.25, 0]); // everything above the legs bobs with this

  // Barrel, chest and rump.
  mesh(new THREE.CylinderGeometry(0.4, 0.38, 1.35, 7), c.body, body, [0, 0, 0], [Math.PI / 2, 0, 0]);
  mesh(new THREE.IcosahedronGeometry(0.43, 0), c.body, body, [0, 0.06, 0.68]);
  mesh(new THREE.IcosahedronGeometry(0.45, 0), c.body, body, [0, 0.05, -0.66]);

  // Neck and head, on a pivot at the withers so the head can nod.
  const neck = pivot(body, [0, 0.22, 0.78]);
  neck.rotation.x = 0.65;
  mesh(new THREE.CylinderGeometry(0.17, 0.27, 0.95, 6), c.body, neck, [0, 0.42, 0]);
  mesh(new THREE.BoxGeometry(0.07, 0.85, 0.14), c.mane, neck, [0, 0.45, -0.2]);
  const head = pivot(neck, [0, 0.88, 0.02]);
  head.rotation.x = 1.65; // muzzle forward and down; local -z is the forehead
  mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.62, 5), c.body, head, [0, 0.27, 0]);
  mesh(new THREE.BoxGeometry(0.06, 0.4, 0.03), c.marking, head, [0, 0.28, -0.13], [0.12, 0, 0]); // blaze
  mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), '#111', head, [0.13, 0.12, -0.08]); // eyes
  mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), '#111', head, [-0.13, 0.12, -0.08]);
  mesh(new THREE.ConeGeometry(0.05, 0.16, 4), c.body, head, [0.08, -0.02, -0.1], [-2.36, 0, 0.2]); // ears
  mesh(new THREE.ConeGeometry(0.05, 0.16, 4), c.body, head, [-0.08, -0.02, -0.1], [-2.36, 0, -0.2]);

  // Tail.
  const tail = pivot(body, [0, 0.25, -1.0]);
  tail.rotation.x = 0.3;
  mesh(new THREE.CylinderGeometry(0.05, 0.16, 0.85, 5), c.mane, tail, [0, -0.4, 0]); // flares toward the tip

  // Tack: saddle blanket, saddle, reins.
  mesh(new THREE.BoxGeometry(0.86, 0.06, 0.7), '#e2d3b0', body, [0, 0.39, -0.05]);
  mesh(new THREE.BoxGeometry(0.6, 0.12, 0.5), '#5b3418', body, [0, 0.45, -0.05]);
  mesh(new THREE.BoxGeometry(0.12, 0.14, 0.1), '#5b3418', body, [0, 0.55, 0.17]); // horn

  // Legs: upper (shoulder/hip) and lower (knee/hock) pivots, hooves.
  const legs = [];
  const legDefs = [
    { x: 0.21, z: 0.66, front: true, off: 0.5 }, // fore left
    { x: -0.21, z: 0.66, front: true, off: 0.62 }, // fore right
    { x: 0.21, z: -0.66, front: false, off: 0.0 }, // hind left
    { x: -0.21, z: -0.66, front: false, off: 0.12 }, // hind right
  ];
  for (const d of legDefs) {
    const upper = pivot(body, [d.x, -0.1, d.z]);
    mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.55, 5), c.body, upper, [0, -0.27, 0]);
    const lower = pivot(upper, [0, -0.55, 0]);
    mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 5), c.points, lower, [0, -0.25, 0]);
    mesh(new THREE.BoxGeometry(0.14, 0.1, 0.16), '#2a2420', lower, [0, -0.52, 0.01]);
    legs.push({ upper, lower, ...d });
  }

  return { root, body, neck, head, tail, legs };
}

// ---------------------------------------------------------------- rider ----
function buildRider(poncho) {
  const skin = '#c58c62';
  const hat = '#3b2a1e';
  const trousers = '#4a4038';
  const boots = '#2a1c14';
  const bandana = poncho === PONCHOS.crimson ? '#e6d9bb' : '#8e2420';

  const root = new THREE.Group(); // sits on the saddle
  // Legs in the stirrups.
  for (const s of [1, -1]) {
    mesh(new THREE.BoxGeometry(0.13, 0.13, 0.45), trousers, root, [0.2 * s, 0.05, 0.12], [0.25, 0, 0]);
    mesh(new THREE.BoxGeometry(0.11, 0.48, 0.12), trousers, root, [0.4 * s, -0.17, 0.27], [-0.25, 0, 0.12 * s]);
    mesh(new THREE.BoxGeometry(0.13, 0.12, 0.22), boots, root, [0.44 * s, -0.43, 0.33]);
  }

  // Upper body leans from the hips.
  const torso = pivot(root, [0, 0.08, 0]);
  torso.rotation.x = 0.45;
  mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), '#d8cbb0', torso, [0, 0.26, 0]); // shirt
  mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.42, 6), poncho, torso, [0, 0.3, 0]); // poncho
  mesh(new THREE.CylinderGeometry(0.33, 0.365, 0.06, 6), '#f0e4c6', torso, [0, 0.16, 0]); // stripe
  mesh(new THREE.BoxGeometry(0.22, 0.2, 0.1), '#7a4a26', torso, [-0.18, 0.12, -0.17]); // satchel
  // Arms reach forward to the reins.
  for (const s of [1, -1]) {
    mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), poncho, torso, [0.23 * s, 0.3, 0.21], [-0.84, 0, 0.1 * s]);
    mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skin, torso, [0.2 * s, 0.14, 0.38]);
  }

  // Head, bandana, hat; plus a scarf tail that flutters behind.
  const head = pivot(torso, [0, 0.62, 0.02]);
  head.rotation.x = -0.35;
  mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), skin, head);
  mesh(new THREE.BoxGeometry(0.215, 0.1, 0.215), bandana, head, [0, -0.06, 0]);
  mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), '#1a1210', head, [0, 0.03, 0.105]); // eye shadow
  mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 10), hat, head, [0, 0.12, 0]);
  mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.17, 7), hat, head, [0, 0.21, 0]);
  mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.04, 7), '#c9a25a', head, [0, 0.15, 0]); // hat band
  const scarf = pivot(head, [0, -0.08, -0.1]);
  mesh(new THREE.BoxGeometry(0.1, 0.03, 0.4), bandana, scarf, [0, 0, -0.2]);

  return { root, torso, head, scarf };
}

// ---------------------------------------------------------------- racer ----
// A horse with a rider and an optional floating name tag, plus its animation.
export function createRacer({ coat = 'chestnut', poncho = PONCHOS.crimson, name = '' } = {}) {
  const horse = buildHorse(coat);
  const rider = buildRider(poncho);
  rider.root.position.set(0, 0.55, -0.08);
  horse.body.add(rider.root);

  const group = new THREE.Group();
  group.add(horse.root);
  if (name) {
    const tag = nameTag(name, poncho);
    tag.position.set(0, 3.25, 0);
    group.add(tag);
  }

  let phase = Math.random() * 10;
  let tuck = 0; // 0 = galloping legs, 1 = tucked for a jump
  let stumbleT = 0;
  let t = 0;

  // speed (m/s), airborne (bool), stumble (0..1, 1 = just stumbled)
  function animate(dt, { speed = 0, airborne = false, stumble = 0 } = {}) {
    t += dt;
    const gait = Math.min(1, speed / 16);
    phase += dt * (1.5 + speed * 0.78);
    tuck += ((airborne ? 1 : 0) - tuck) * Math.min(1, dt * 12);
    stumbleT = stumble;

    for (const L of horse.legs) {
      const p = phase + L.off * Math.PI * 2;
      const swing = Math.sin(p) * (0.08 + 0.75 * gait);
      const bend = Math.max(0, Math.sin(p + 1.3)) * (0.1 + 1.1 * gait);
      const run = { u: swing, l: L.front ? bend : -bend };
      const tucked = L.front ? { u: -0.9, l: 1.7 } : { u: 0.75, l: -1.3 };
      L.upper.rotation.x = run.u + (tucked.u - run.u) * tuck;
      L.lower.rotation.x = run.l + (tucked.l - run.l) * tuck;
    }

    const bob = Math.abs(Math.sin(phase)) * 0.09 * gait;
    horse.body.position.y = 1.25 + bob - 0.05 * tuck;
    horse.body.rotation.x = Math.sin(phase) * 0.05 * gait - 0.12 * tuck + 0.25 * stumbleT;
    horse.body.rotation.z = Math.sin(t * 30) * 0.08 * stumbleT;
    horse.neck.rotation.x = 0.65 + Math.sin(phase + 0.6) * 0.12 * gait + 0.25 * gait
      + Math.sin(t * 1.3) * 0.04 * (1 - gait) + 0.5 * stumbleT;
    horse.tail.rotation.x = 0.3 + 0.8 * gait + 0.4 * tuck;
    horse.tail.rotation.z = Math.sin(t * (2 + speed * 0.4)) * 0.25;

    // Rider: two-point lean at speed, absorbs the bob, flails on a stumble.
    rider.root.position.y = 0.55 - bob * 0.6;
    rider.torso.rotation.x = 0.35 + 0.35 * gait + 0.2 * tuck - 0.6 * stumbleT;
    rider.torso.rotation.z = Math.sin(t * 22) * 0.25 * stumbleT;
    rider.head.rotation.x = -0.25 - 0.35 * gait;
    rider.scarf.rotation.x = 0.1 + Math.sin(t * 18) * 0.1 * gait - 0.3 * gait;
    rider.scarf.rotation.y = Math.sin(t * 9) * 0.3 * gait;
  }

  animate(0);
  return { group, animate };
}

function nameTag(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px system-ui, sans-serif';
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(30, 18, 12, 0.75)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 8, w, 48, 12);
  g.fill();
  g.fillStyle = color;
  g.fillRect((256 - w) / 2 + 10, 26, 10, 10);
  g.fillStyle = '#fbf1dc';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128 + 8, 33, 220);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(2.4, 0.6, 1);
  return s;
}
