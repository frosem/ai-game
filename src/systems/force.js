// The Force field: universal defense, centered on the reticle, guns offline.
// Enemy ships are immune. This is the only thing that stops ion bolts.

import { CONFIG } from '../config.js';
import { drawStripFrame } from '../assets.js';

const FORCE_WAVE_FPS = 10;

export class ForceSystem {
  constructor() {
    this.wasActive = false;
    this.sinceRelease = 0;
  }

  reset() {
    this.wasActive = false;
    this.sinceRelease = 0;
  }

  update(dt, world) {
    const { player, input, bolts, asteroids, particles, audio, score, convoy } = world;
    const f = CONFIG.force;

    if (player.forceLockout > 0) player.forceLockout -= dt;

    const held = input.forceHeld() && player.alive;
    const canStart =
      player.forceCharge >= f.minToActivate && player.forceLockout <= 0;

    let active = player.forceActive;
    if (!active) {
      if (held && canStart) active = true;
    } else {
      // stay active while held and charged
      active = held && player.forceCharge > 0;
    }
    player.forceActive = active;

    if (active && !this.wasActive) {
      if (audio) audio.play('forceOn');
    } else if (!active && this.wasActive) {
      if (audio) audio.play('forceOff');
      this.sinceRelease = 0;
    }
    this.wasActive = active;

    if (active) {
      player.forceCharge -= f.drainPerSec * dt;
      if (player.forceCharge <= 0) {
        player.forceCharge = 0;
        player.forceActive = false;
        player.forceLockout = f.emptyLockout;
        this.sinceRelease = 0;
        if (audio) audio.play('forceEmpty');
      }
      this.fieldEffects(dt, world);
    } else {
      this.sinceRelease += dt;
      if (this.sinceRelease >= f.regenDelay && player.forceCharge < f.capacity) {
        player.forceCharge = Math.min(
          f.capacity,
          player.forceCharge + f.regenPerSec * dt
        );
      }
    }
    void convoy;
  }

  fieldEffects(dt, world) {
    const { player, input, bolts, asteroids, particles, audio, score, convoy } = world;
    const f = CONFIG.force;
    const cx = input.mouse.x;
    const cy = input.mouse.y;
    const r2 = f.radius * f.radius;

    // Bolts entering the field are destroyed (red and ion alike).
    for (let i = 0; i < bolts.cap; i++) {
      const b = bolts.pool[i];
      if (!b.active || b.friendly) continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const isIon = b.type === 'ion';
      if (isIon && !f.stopsIonBolts) continue;
      if (!isIon && !f.stopsRedBolts) continue;
      b.active = false;
      particles.burst(b.x, b.y, isIon ? 14 : 8, isIon ? '#c9a6ff' : '#ffb08a', 260, 0.4, 4);
      if (audio) audio.play('forceStop');
      if (isIon) score.forceSave();
      else score.boltShotDown();
    }

    // Asteroids are redirected away from the convoy (once each).
    if (f.stopsAsteroids) {
      for (let i = 0; i < asteroids.cap; i++) {
        const a = asteroids.pool[i];
        if (!a.active || a.deflected) continue;
        const dx = a.x - cx;
        const dy = a.y - cy;
        if (dx * dx + dy * dy > r2) continue;
        redirectAwayFromConvoy(a, convoy);
        a.deflected = true;
        particles.burst(a.x, a.y, 12, '#9fd0ff', 220, 0.4, 4);
        if (audio) audio.play('forceStop');
        score.asteroidDeflect();
      }
    }
    void dt;
  }

  draw(ctx, player, input) {
    if (!player.forceActive) return;
    const f = CONFIG.force;
    const cx = input.mouse.x;
    const cy = input.mouse.y;
    const pulse = 1 + Math.sin(player.t * CONFIG.fx.forcePulseSpeed) * 0.04;
    const r = f.radius * pulse;

    ctx.save();
    drawStripFrame('fx_force_wave', ctx, cx, cy, player.t * FORCE_WAVE_FPS, (r * 2) / 128);
    const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    g.addColorStop(0, 'rgba(120,210,255,0)');
    g.addColorStop(0.7, 'rgba(120,210,255,0.10)');
    g.addColorStop(1, 'rgba(150,230,255,0.32)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(180,240,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // inner rotating arcs
    ctx.strokeStyle = 'rgba(200,245,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a0 = player.t * 2 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, a0, a0 + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function redirectAwayFromConvoy(a, convoy) {
  let nx = a.x - convoy.x;
  let ny = a.y - convoy.y;
  const nlen = Math.hypot(nx, ny) || 1;
  nx /= nlen;
  ny /= nlen;
  const speed = Math.hypot(a.vx, a.vy) || CONFIG.asteroid.speed[0];
  a.vx = nx * speed;
  a.vy = ny * speed;
}