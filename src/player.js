// Local horse: keyboard input and simple kinematics against course.js.
import {
  HALF_WIDTH, FINISH_Z, CHECKPOINTS, FALL_LIMIT, centerX, groundHeight, rimHeight, inMud, startSlot,
} from './course.js';

export const TUNING = {
  gallop: 17, sprint: 24, accel: 7, sprintAccel: 10, brake: 18, coast: 3.5,
  turn: 2.0, jumpV: 8.2, gravity: 22, step: 0.45, mudFactor: 0.5,
  staminaDrain: 0.24, staminaRegen: 0.12, stumbleTime: 0.7,
};

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export function createInput() {
  const keys = { up: false, down: false, left: false, right: false, jump: false, sprint: false };
  const ignore = (e) => e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey;
  addEventListener('keydown', (e) => {
    if (ignore(e) || !(e.code in KEYMAP)) return;
    keys[KEYMAP[e.code]] = true;
    e.preventDefault();
  });
  addEventListener('keyup', (e) => { if (e.code in KEYMAP) keys[KEYMAP[e.code]] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  return keys;
}

export class Player {
  constructor(slot = 0) {
    this.reset(slot);
  }

  reset(slot = this.slot) {
    const s = startSlot(slot);
    this.slot = slot;
    this.x = s.x; this.z = s.z;
    this.y = groundHeight(this.x, this.z);
    this.vy = 0;
    this.yaw = 0;
    this.speed = 0;
    this.stamina = 1;
    this.airborne = false;
    this.stumble = 0; // seconds left
    this.checkpoint = 0;
    this.finished = false;
    this.locked = true; // until the countdown ends
    this.events = [];
  }

  respawn() {
    const z = CHECKPOINTS[this.checkpoint];
    this.x = centerX(z); this.z = z;
    this.y = groundHeight(this.x, this.z);
    this.vy = 0; this.speed = 0; this.yaw = 0; this.airborne = false;
    this.events.push('respawn');
  }

  bump() {
    this.speed *= 0.3;
    this.stumble = TUNING.stumbleTime;
    this.events.push('stumble');
  }

  step(dt, keys) {
    const T = TUNING;
    const canDrive = !this.locked && !this.finished;
    const k = canDrive ? keys : {};
    this.stumble = Math.max(0, this.stumble - dt);

    // Speed.
    const sprinting = k.sprint && k.up && this.stamina > 0.02 && !this.airborne;
    this.stamina = Math.min(1, Math.max(0, this.stamina + (sprinting ? -T.staminaDrain : T.staminaRegen) * dt));
    let top = sprinting ? T.sprint : T.gallop;
    if (!this.airborne && inMud(this.x, this.z)) top *= T.mudFactor;
    if (this.stumble > 0) top *= 0.4;
    if (!this.airborne) {
      if (k.up && this.speed < top) this.speed = Math.min(top, this.speed + (sprinting ? T.sprintAccel : T.accel) * dt);
      else if (this.speed > top) this.speed = Math.max(top, this.speed - T.brake * 0.6 * dt);
      else if (!k.up) this.speed = Math.max(0, this.speed - T.coast * dt);
      if (k.down) this.speed = Math.max(0, this.speed - T.brake * dt);
    }
    if (this.finished) this.speed = Math.max(0, this.speed - 6 * dt);

    // Steering: a little less agile at full tilt, very limited in the air.
    const steer = (k.left ? 1 : 0) - (k.right ? 1 : 0);
    const agility = (this.airborne ? 0.25 : 1) * (1 - 0.35 * Math.min(1, this.speed / T.sprint));
    this.yaw += steer * T.turn * agility * dt;
    this.yaw = Math.max(-1.4, Math.min(1.4, this.yaw));

    // Jump.
    if (k.jump && !this.airborne && this.stumble <= 0) {
      this.vy = T.jumpV;
      this.speed = Math.max(this.speed, 3); // a standing hop still clears a hurdle
      this.airborne = true;
      this.events.push('jump');
    }

    // Move horizontally, checking what is underfoot at the new spot.
    const nx = this.x + Math.sin(this.yaw) * this.speed * dt;
    const nz = this.z + Math.cos(this.yaw) * this.speed * dt;
    const g = groundHeight(nx, nz);
    const blocked = this.airborne ? this.y < g - 0.1 : g - this.y > T.step;
    if (blocked) {
      // Hitting something at speed is a stumble; leaning on it just stops you.
      if (this.speed > 6 && this.stumble <= 0) this.bump();
      else this.speed = Math.min(this.speed, 5);
    } else {
      this.x = nx; this.z = nz;
    }

    // Canyon walls.
    const cx = centerX(this.z);
    const lim = HALF_WIDTH - 0.8;
    if (Math.abs(this.x - cx) > lim) {
      this.x = cx + Math.sign(this.x - cx) * lim;
      this.speed *= 1 - 2 * dt;
      this.yaw *= 1 - 4 * dt;
    }
    if (this.z < 2) this.z = 2;

    // Vertical: snap to the ground when grounded, fall otherwise.
    const ground = groundHeight(this.x, this.z);
    if (!this.airborne) {
      if (ground >= this.y - T.step) this.y = ground;
      else { this.airborne = true; this.vy = 0; }
    }
    if (this.airborne) {
      this.vy -= T.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        this.y = ground;
        this.vy = 0;
        this.airborne = false;
        this.events.push('land');
      }
    }
    if (this.y < rimHeight(this.z) - FALL_LIMIT) this.respawn();

    // Checkpoints and finish.
    if (!this.airborne) {
      while (this.checkpoint + 1 < CHECKPOINTS.length && this.z >= CHECKPOINTS[this.checkpoint + 1]) {
        this.checkpoint++;
        this.events.push('checkpoint');
      }
    }
    if (!this.finished && !this.locked && this.z >= FINISH_Z) {
      this.finished = true;
      this.events.push('finish');
    }
  }

  // Compact state for the network: [x, y, z, yaw, speed, flags]
  snapshot() {
    const flags = (this.airborne ? 1 : 0) | (this.stumble > 0 ? 2 : 0);
    const r = (v) => Math.round(v * 100) / 100;
    return [r(this.x), r(this.y), r(this.z), r(this.yaw), r(this.speed), flags];
  }

  // Debug: jump to a checkpoint.
  teleport(i) {
    this.checkpoint = Math.max(0, Math.min(CHECKPOINTS.length - 1, i));
    this.respawn();
  }
}
