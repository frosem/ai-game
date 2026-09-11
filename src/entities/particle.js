// Pooled particle system. Hard cap with oldest-first eviction, zero allocation
// in the hot loop.

import { CONFIG, randRange } from '../config.js';
import { drawStripFrame, stripFrameCount } from '../assets.js';

export class ParticleSystem {
  constructor() {
    const cap = CONFIG.fx.particleCap;
    this.cap = cap;
    this.pool = new Array(cap);
    for (let i = 0; i < cap; i++) {
      this.pool[i] = {
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1,
        size: 2, color: '#fff',
        drag: 1,
      };
    }
    this.cursor = 0;
    // A handful of concurrent sprite-strip explosions, layered on top of the
    // procedural bursts above. Never many at once, so a plain array is fine.
    this.fx = [];
  }

  reset() {
    for (let i = 0; i < this.cap; i++) this.pool[i].active = false;
    this.cursor = 0;
    this.fx.length = 0;
  }

  spawn(x, y, vx, vy, life, color, size, drag = 0.9) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.cap;
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life;
    p.color = color; p.size = size; p.drag = drag;
  }

  burst(x, y, count, color, speed, life, size) {
    for (let i = 0; i < count; i++) {
      const a = randRange(0, Math.PI * 2);
      const s = randRange(speed * 0.3, speed);
      this.spawn(
        x, y,
        Math.cos(a) * s, Math.sin(a) * s,
        randRange(life * 0.5, life),
        color,
        randRange(size * 0.5, size)
      );
    }
  }

  // Plays one pass of a generated explosion strip (fx_explosion_big/small) at
  // (x, y). Silently does nothing if the strip failed to load.
  explode(x, y, key, scale = 1.6, fps = 20) {
    const count = stripFrameCount(key);
    if (count <= 1) return;
    this.fx.push({ x, y, key, age: 0, fps, count, scale });
  }

  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const e = this.fx[i];
      e.age += dt;
      if (e.age * e.fps >= e.count) this.fx.splice(i, 1);
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + t * 0.6);
      ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < this.fx.length; i++) {
      const e = this.fx[i];
      drawStripFrame(e.key, ctx, e.x, e.y, e.age * e.fps, e.scale);
    }
  }
}