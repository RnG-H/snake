// WebSocket client: lobby messages, own-state upload and remote interpolation.
const SEND_HZ = 20;
const INTERP_DELAY = 110; // ms behind real time we render remote horses

export class Net extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.id = null;
    this.room = null;
    this.remotes = new Map(); // id -> [{t, s}]
    this.lastSend = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 5000);
      ws.onopen = () => { clearTimeout(timer); this.ws = ws; resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('unreachable')); };
      ws.onclose = () => {
        if (this.ws === ws) { this.ws = null; this.emit('disconnect'); }
      };
      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        this.handle(msg);
      };
    });
  }

  get connected() { return this.ws?.readyState === 1; }

  send(msg) { if (this.connected) this.ws.send(JSON.stringify(msg)); }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  handle(msg) {
    switch (msg.t) {
      case 'welcome': this.id = msg.id; this.room = msg.room; break;
      case 'state': {
        let buf = this.remotes.get(msg.id);
        if (!buf) this.remotes.set(msg.id, (buf = []));
        buf.push({ t: performance.now(), s: msg.s });
        if (buf.length > 30) buf.shift();
        return; // hot path: no event
      }
      case 'left': this.remotes.delete(msg.id); break;
    }
    this.emit(msg.t, msg);
  }

  // Throttled upload of our own state.
  sendState(snapshot, now = performance.now()) {
    if (now - this.lastSend < 1000 / SEND_HZ) return;
    this.lastSend = now;
    this.send({ t: 'state', s: snapshot });
  }

  // Interpolated [x,y,z,yaw,speed,flags] for a remote player, or null.
  sample(id, now = performance.now()) {
    const buf = this.remotes.get(id);
    if (!buf || !buf.length) return null;
    const t = now - INTERP_DELAY;
    if (t <= buf[0].t) return buf[0].s;
    for (let i = buf.length - 1; i > 0; i--) {
      const a = buf[i - 1], b = buf[i];
      if (t >= a.t && t <= b.t) {
        const k = (t - a.t) / (b.t - a.t || 1);
        // Big jumps (respawns) snap instead of sliding.
        if (Math.abs(b.s[2] - a.s[2]) > 15) return b.s;
        return a.s.map((v, j) => (j === 5 ? b.s[5] : v + (b.s[j] - v) * k));
      }
    }
    return buf[buf.length - 1].s;
  }
}
