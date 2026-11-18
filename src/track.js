// Builds the course meshes from the layout in course.js: canyon terrain,
// hurdles, mud, rock ledges, boulders, the ravine, the rope bridge, the start
// gate and the finish arch.
import * as THREE from 'three';
import {
  HALF_WIDTH, START_LINE_Z, FINISH_Z, COURSE_END, SECTIONS, CHECKPOINTS,
  HURDLES, MUD, LEDGES, BOULDERS, RAVINE, CHASM, BRIDGE_HALF,
  centerX, baseHeight, bridgeSag, smoothstep, startSlot, MAX_PLAYERS,
} from './course.js';

const flat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });

// Cheap deterministic noise.
const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// Visual terrain height: corridor floor, canyon walls outside, deep gaps.
function terrainHeight(x, z) {
  const d = Math.abs(x - centerX(z)) - HALF_WIDTH;
  const inGap = (z > RAVINE.z0 && z < RAVINE.z1 + 1) || (z > CHASM.z0 && z < CHASM.z1 + 1);
  let h = baseHeight(x, z);
  if (d < 0) {
    if (inGap) h -= z > CHASM.z0 ? 26 : 30;
    return h;
  }
  const rough = 1.6 * Math.sin(x * 0.21 + z * 0.13) + 1.1 * Math.sin(z * 0.37 - x * 0.11);
  h += (20 + rough) * smoothstep(0, 10, d) + 0.6 * hash(Math.round(x), Math.round(z));
  // Behind the start and past the end, close the canyon.
  h += 24 * smoothstep(-5, -35, z) + 24 * smoothstep(COURSE_END, COURSE_END + 30, z);
  return h;
}

const C = (hex) => new THREE.Color(hex);
const DUST = C('#c98e57'), DUST2 = C('#b97b48'), GRASS = C('#9a9a52'), MUDC = C('#5a3b26');
const BANDS = ['#b45f36', '#cf8550', '#9c4a2c', '#dba06a', '#a8583a'].map(C);
const GAPROCK = C('#6e3422');

function terrainColor(x, z, h) {
  const xr = x - centerX(z);
  const d = Math.abs(xr) - HALF_WIDTH;
  const n = hash(Math.round(x * 0.5), Math.round(z * 0.5));
  if (d < 0 && h > baseHeight(x, z) - 1) {
    if (MUD.some((m) => ((xr - m.xr) / m.rx) ** 2 + ((z - m.z) / m.rz) ** 2 < 1)) return MUDC;
    const c = DUST.clone().lerp(DUST2, n);
    const grassy = z > 30 && z < 440 ? 0.55 * smoothstep(0.3, 0.9, hash(Math.round(x / 3), Math.round(z / 3))) : 0;
    return c.lerp(GRASS, grassy);
  }
  if (d < 0) return GAPROCK.clone().lerp(BANDS[2], n * 0.5);
  return BANDS[Math.floor((h + 40) / 2.6 + n * 0.4) % BANDS.length];
}

function buildTerrain() {
  const x0 = -80, x1 = 80, dx = 2, z0 = -50, z1 = COURSE_END + 60, dz = 1;
  const nx = (x1 - x0) / dx + 1, nz = (z1 - z0) / dz + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    const z = z0 + j * dz;
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * dx;
      const h = terrainHeight(x, z);
      const k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      const c = terrainColor(x, z, h);
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, flat('#ffffff', { vertexColors: true }));
  m.receiveShadow = true;
  return m;
}

// A box that follows the winding centreline: x0r..x1r across, z0..z1 along.
function curvedSlab(x0r, x1r, z0, z1, top, bottom, step = 1) {
  const p = [];
  const quad = (a, b, c, d) => p.push(...a, ...b, ...c, ...a, ...c, ...d);
  const zs = [];
  for (let z = z0; z < z1; z += step) zs.push(z);
  zs.push(z1);
  const at = (z) => {
    const cx = centerX(z), xl = cx + x0r, xr = cx + x1r;
    return { l: [xl, top(xl, z), z], r: [xr, top(xr, z), z], lb: [xl, bottom, z], rb: [xr, bottom, z] };
  };
  for (let i = 0; i < zs.length - 1; i++) {
    const A = at(zs[i]), B = at(zs[i + 1]);
    quad(A.l, B.l, B.r, A.r); // top
    quad(A.lb, B.lb, B.l, A.l); // left side
    quad(A.r, B.r, B.rb, A.rb); // right side
  }
  const S = at(z0), E = at(z1);
  quad(S.lb, S.l, S.r, S.rb);
  quad(E.rb, E.r, E.l, E.lb);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.computeVertexNormals();
  return geo;
}

function textTexture(lines, { w = 512, h = 128, bg = '#6b4226', fg = '#fbf1dc', font = 'bold 64px Georgia, serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 6;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const list = [].concat(lines);
  list.forEach((t, i) => g.fillText(t, w / 2, (h * (i + 0.5)) / list.length, w - 30));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addShadowed(parent, mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function buildCourse(scene) {
  const root = new THREE.Group();
  scene.add(root);
  root.add(buildTerrain());

  const wood = flat('#7b5132'), woodLight = flat('#a8794c'), paint = flat('#efe6d2');
  const rock = flat('#9a5a38'), rockDark = flat('#7c4428');

  // ---- Hurdles: logs and post-and-rail fences across the full width.
  for (const hd of HURDLES) {
    const cx = centerX(hd.z), y = baseHeight(cx, hd.z);
    if (hd.type === 'log') {
      const log = addShadowed(root, new THREE.Mesh(new THREE.CylinderGeometry(hd.h / 2, hd.h / 2, HALF_WIDTH * 2 + 2, 9), wood));
      log.rotation.z = Math.PI / 2;
      log.position.set(cx, y + hd.h / 2, hd.z);
      for (const s of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(hd.h / 2 - 0.02, 9), woodLight);
        cap.position.set(cx + s * (HALF_WIDTH + 1.01), y + hd.h / 2, hd.z);
        cap.rotation.y = (s * Math.PI) / 2;
        root.add(cap);
      }
    } else {
      for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += 2.8) {
        const post = addShadowed(root, new THREE.Mesh(new THREE.BoxGeometry(0.16, hd.h + 0.15, 0.16), paint));
        post.position.set(cx + x, y + (hd.h + 0.15) / 2, hd.z);
      }
      for (const ry of [0.35, 0.65, 0.95]) {
        const rail = addShadowed(root, new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, 0.1, 0.08), paint));
        rail.position.set(cx, y + ry * hd.h, hd.z);
      }
    }
  }

  // ---- Rock ledges (stepped mesa) and boulders.
  LEDGES.forEach((l, i) => {
    const geo = curvedSlab(l.x0, l.x1, l.z0, l.z1, (x, z) => baseHeight(x, z) + l.h, -2);
    addShadowed(root, new THREE.Mesh(geo, i % 2 ? rockDark : rock));
  });
  for (const b of BOULDERS) {
    const x = centerX(b.z) + b.xr;
    const m = addShadowed(root, new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockDark));
    m.scale.set(b.r, 1.45, b.r);
    m.position.set(x, baseHeight(x, b.z) + 1.15, b.z);
    m.rotation.y = b.z;
  }

  // ---- River at the bottom of the chasm.
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_WIDTH * 2 + 4, CHASM.z1 - CHASM.z0 + 2),
    flat('#3f7f8f', { roughness: 0.3, metalness: 0.1 }),
  );
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, -25, (CHASM.z0 + CHASM.z1) / 2);
  root.add(river);

  // ---- Rope bridge: planks, posts, ropes.
  const deckY = (z) => baseHeight(0, CHASM.z0) - bridgeSag(z) + 0.15;
  const plankGeo = new THREE.BoxGeometry(BRIDGE_HALF * 2, 0.08, 0.45);
  const nPlanks = Math.floor((CHASM.z1 - CHASM.z0 + 2) / 0.6);
  const planks = new THREE.InstancedMesh(plankGeo, woodLight, nPlanks);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < nPlanks; i++) {
    const z = CHASM.z0 - 1 + i * 0.6;
    tmp.position.set(centerX(z), deckY(Math.min(Math.max(z, CHASM.z0), CHASM.z1)) - 0.04, z);
    tmp.rotation.set(0, 0, (hash(i, 3) - 0.5) * 0.06);
    tmp.updateMatrix();
    planks.setMatrixAt(i, tmp.matrix);
  }
  planks.castShadow = planks.receiveShadow = true;
  root.add(planks);
  for (const s of [-1, 1]) {
    const pts = [];
    for (let z = CHASM.z0; z <= CHASM.z1; z += 2) pts.push(new THREE.Vector3(centerX(z) + s * (BRIDGE_HALF + 0.1), deckY(z) + 0.9, z));
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.04, 4), flat('#d8c08a'));
    root.add(rope);
    for (const z of [CHASM.z0, CHASM.z1]) {
      const post = addShadowed(root, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), wood));
      post.position.set(centerX(z) + s * (BRIDGE_HALF + 0.1), deckY(z) + 0.6, z);
    }
  }

  // ---- Start gate: stalls with gates that swing open, and a banner arch.
  const gates = [];
  for (let i = 0; i <= MAX_PLAYERS; i++) {
    const x = startSlot(i).x - 1.5;
    const div = addShadowed(root, new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 5), paint));
    div.position.set(x, 0.8, START_LINE_Z - 3);
    if (i < MAX_PLAYERS) {
      const g = new THREE.Group();
      g.position.set(x + 0.1, 0, START_LINE_Z - 0.4);
      const bar = addShadowed(g, new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.1), flat('#b3322a')));
      bar.position.set(1.4, 1.0, 0);
      const bar2 = bar.clone();
      bar2.position.y = 0.55;
      g.add(bar2);
      root.add(g);
      gates.push(g);
    }
  }
  const arch = (z, label, bg) => {
    for (const s of [-1, 1]) {
      const p = addShadowed(root, new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), wood));
      p.position.set(centerX(z) + s * (HALF_WIDTH + 0.5), baseHeight(0, z) + 3.5, z);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_WIDTH * 2 + 1.6, 1.6, 0.2),
      [wood, wood, wood, wood,
        new THREE.MeshBasicMaterial({ map: textTexture(label, { bg, w: 1024 }) }),
        new THREE.MeshBasicMaterial({ map: textTexture(label, { bg, w: 1024 }) })],
    );
    banner.position.set(centerX(z), baseHeight(0, z) + 6.4, z);
    banner.castShadow = true;
    root.add(banner);
  };
  arch(START_LINE_Z + 1, 'DUSTLINE DERBY', '#7a2e1e');
  arch(FINISH_Z, 'FINISH', '#1f1a17');

  // Checkered finish line and painted start line.
  const checker = document.createElement('canvas');
  checker.width = 256; checker.height = 16;
  const cg = checker.getContext('2d');
  for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {
    cg.fillStyle = (i + j) % 2 ? '#111' : '#f4f0e6';
    cg.fillRect(i * 8, j * 8, 8, 8);
  }
  const ctex = new THREE.CanvasTexture(checker);
  ctex.magFilter = THREE.NearestFilter;
  ctex.colorSpace = THREE.SRGBColorSpace;
  const line = (z, material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 1.2), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(centerX(z), baseHeight(0, z) + 0.06, z);
    m.receiveShadow = true;
    root.add(m);
  };
  line(FINISH_Z, new THREE.MeshStandardMaterial({ map: ctex, roughness: 1 }));
  line(START_LINE_Z + 0.3, flat('#efe6d2'));

  // ---- Section signs and checkpoint flags.
  for (const sec of SECTIONS.slice(1, -1)) {
    const z = sec.z + 4;
    const x = centerX(z) + HALF_WIDTH - 1.5;
    const y = baseHeight(x, z);
    const post = addShadowed(root, new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), wood));
    post.position.set(x, y + 1.2, z);
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.1),
      [wood, wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: textTexture(sec.name.toUpperCase(), { font: 'bold 54px Georgia, serif' }) })]);
    board.position.set(x - 0.6, y + 2.2, z + 0.1);
    board.rotation.y = Math.PI + 0.35;
    board.castShadow = true;
    root.add(board);
  }
  const flagMat = flat('#e8c547');
  for (const z of CHECKPOINTS.slice(1)) {
    for (const s of [-1, 1]) {
      const x = centerX(z) + s * (HALF_WIDTH - 0.6);
      const y = baseHeight(x, z);
      const pole = addShadowed(root, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 5), paint));
      pole.position.set(x, y + 1.5, z);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), flagMat);
      flag.material.side = THREE.DoubleSide;
      flag.position.set(x - s * 0.45, y + 2.7, z);
      root.add(flag);
    }
  }

  // ---- Scenery: cacti and rocks at the corridor edges, distant mesas.
  const cactusMat = flat('#5f7d3e');
  for (let i = 0; i < 140; i++) {
    const z = 20 + rnd() * (COURSE_END - 40);
    if ((z > RAVINE.z0 - 4 && z < RAVINE.z1 + 4) || (z > CHASM.z0 - 4 && z < CHASM.z1 + 4)) continue;
    const s = rnd() < 0.5 ? -1 : 1;
    const x = centerX(z) + s * (HALF_WIDTH + 0.3 + rnd() * 2.5);
    const y = terrainHeight(x, z);
    if (rnd() < 0.55) {
      const c = new THREE.Group();
      const h = 2 + rnd() * 2.5;
      addShadowed(c, new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 7), cactusMat)).position.y = h / 2;
      for (const side of [-1, 1]) {
        if (rnd() < 0.3) continue;
        const ah = h * (0.25 + rnd() * 0.3);
        const arm = addShadowed(c, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, ah, 6), cactusMat));
        arm.position.set(side * 0.55, h * (0.45 + rnd() * 0.2) + ah / 2, 0);
        const elbow = addShadowed(c, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 6), cactusMat));
        elbow.rotation.z = Math.PI / 2;
        elbow.position.set(side * 0.35, arm.position.y - ah / 2, 0);
      }
      c.position.set(x, y - 0.2, z);
      c.rotation.y = rnd() * 6;
      root.add(c);
    } else {
      const size = 0.5 + rnd();
      const r = addShadowed(root, new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rnd() < 0.5 ? rock : rockDark));
      r.position.set(x, y - size * 0.4, z);
      r.rotation.set(rnd() * 3, rnd() * 3, 0);
    }
  }
  const mesaMats = BANDS.map((c) => flat(c));
  for (let i = 0; i < 26; i++) {
    const s = i % 2 ? -1 : 1;
    const z = -100 + rnd() * (COURSE_END + 300);
    const x = s * (110 + rnd() * 160);
    const h = 25 + rnd() * 45;
    const r = 15 + rnd() * 30;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 7), mesaMats[i % mesaMats.length]);
    m.position.set(x, h / 2 - 8, z);
    root.add(m);
  }

  let gateOpen = 0, gateTarget = 0;
  return {
    setGates(open) { gateTarget = open ? 1 : 0; if (!open) gateOpen = 0; },
    update(dt) {
      gateOpen += (gateTarget - gateOpen) * Math.min(1, dt * 6);
      for (const g of gates) g.rotation.y = -gateOpen * 1.6;
    },
  };
}

// Gradient sky dome with a low sun.
export function buildSky(scene, sunDir) {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sun: { value: sunDir.clone().normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 sun;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 horizon = vec3(0.98, 0.70, 0.45);
        vec3 mid = vec3(0.86, 0.52, 0.42);
        vec3 top = vec3(0.30, 0.30, 0.52);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, top, smoothstep(0.15, 0.8, h));
        float s = max(dot(vDir, sun), 0.0);
        col += vec3(1.0, 0.85, 0.55) * pow(s, 400.0) * 1.5 + vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  scene.add(sky);
  return sky;
}
