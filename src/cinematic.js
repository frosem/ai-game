// In-engine scripted intro: the Razor Crest fights five hunters, Mando guns
// down four, an ion hit kills the Crest's guns, and Grogu shoves the fifth
// hunter into an asteroid. Then Luke drops in. Skippable from frame 1.
//
// Timing lives in CONFIG.cinematic; captions in STRINGS.cinematic. Everything
// is drawn with canvas primitives and the procedural sprites.

import { CONFIG } from './config.js';
import { STRINGS } from './strings.js';
import { drawSprite } from './assets.js';
import { drawPanel } from './systems/dialog.js';

const W = CONFIG.VIRTUAL_W;
const H = CONFIG.VIRTUAL_H;

// Fixed staging geometry (virtual units).
const CREST_X = 500;
const CREST_Y = 430;
const PURSUER_SPACING = 150;
const PURSUER_LEAD = 190;

export class Cinematic {
  constructor() {
    this.reset();
  }

  reset() {
    const c = CONFIG.cinematic;
    this.t = 0;
    this.finished = false;
    this.crest = { x: W + 260, y: CREST_Y, disabled: false };
    this.pursuers = [];
    for (let i = 0; i < 5; i++) {
      this.pursuers.push({
        x: W + 260 + PURSUER_LEAD + i * PURSUER_SPACING,
        y: CREST_Y + (i % 2 === 0 ? -34 : 30),
        alive: true,
        dying: 0,
        kind: i === 4 ? 'lancer' : 'interceptor',
      });
    }
    this.mandoBolts = [];
    this.ionBolt = null;
    this.explosions = [];
    this.luke = null;
    this.force = 0;
    this.forceAt = null;
    this.asteroid = { x: 1220, y: 150, angle: 0, spin: 0.9, shown: true };
    this.events = {};
    // audio queue for this frame (consumed by update's caller via world)
    void c;
  }

  skip() {
    this.finished = true;
  }

  fired(key) {
    if (this.events[key]) return false;
    this.events[key] = true;
    return true;
  }

  update(dt, world) {
    const c = CONFIG.cinematic;
    this.t += dt;

    // --- Razor Crest flies in and settles ---
    const enter = easeOut(clamp01(this.t / c.crestEnterSeconds));
    this.crest.x = lerp(W + 260, CREST_X, enter);
    this.crest.y = CREST_Y + Math.sin(this.t * 1.4) * 5;

    // --- pursuers keep formation behind the Crest until their beat ---
    for (let i = 0; i < this.pursuers.length; i++) {
      const p = this.pursuers[i];
      if (!p.alive) {
        p.dying += dt;
        continue;
      }
      const formationX = this.crest.x + PURSUER_LEAD + i * PURSUER_SPACING;
      if (i === 4 && this.t >= c.ionHitSeconds) {
        // the surviving hunter closes to firing range, then is dragged
        // toward the asteroid by Grogu's Force
        let tx;
        let ty;
        let k;
        if (this.t < c.forceSeconds) {
          tx = this.crest.x + 560;
          ty = CREST_Y;
          k = 0.9;
        } else {
          tx = this.asteroid.x;
          ty = this.asteroid.y;
          k = 1.7;
        }
        p.x += (tx - p.x) * Math.min(1, dt * k);
        p.y += (ty - p.y) * Math.min(1, dt * k);
      } else {
        p.x += (formationX - p.x) * Math.min(1, dt * 1.6);
        p.y += (CREST_Y + (i % 2 === 0 ? -34 : 30) - p.y) * Math.min(1, dt * 1.6);
      }
    }

    // --- Mando guns down four, one at a time ---
    for (let i = 0; i < 4; i++) {
      const key = `kill${i}`;
      if (this.t >= c.killsAtSeconds[i] && this.fired(key)) {
        const target = this.pursuers[i];
        this.mandoBolts.push({
          x: this.crest.x + 96,
          y: this.crest.y - 8,
          tx: target.x,
          ty: target.y,
          t: 0,
          dur: 0.18,
          target,
        });
        play(world, 'fire');
      }
    }
    for (let i = this.mandoBolts.length - 1; i >= 0; i--) {
      const b = this.mandoBolts[i];
      b.t += dt;
      b.tx = b.target.x;
      b.ty = b.target.y;
      if (b.t >= b.dur) {
        this.addExplosion(b.target.x, b.target.y, 1);
        b.target.alive = false;
        this.mandoBolts.splice(i, 1);
        play(world, 'explosion');
        world.fx.addShake(4);
      }
    }

    // --- the fifth hunter lands an ion hit: the Crest's guns die ---
    if (this.t >= c.ionFireSeconds && this.fired('ionFire')) {
      const hunter = this.pursuers[4];
      this.ionBolt = {
        x: hunter.x,
        y: hunter.y,
        tx: this.crest.x + 60,
        ty: this.crest.y,
        t: 0,
        dur: c.ionHitSeconds - c.ionFireSeconds,
      };
      play(world, 'ionFire');
    }
    if (this.ionBolt) {
      this.ionBolt.t += dt;
      this.ionBolt.tx = this.crest.x + 60;
      this.ionBolt.ty = this.crest.y;
      if (this.ionBolt.t >= this.ionBolt.dur) {
        this.crest.disabled = true;
        this.addExplosion(this.crest.x + 80, this.crest.y, 0.7, '#c9a6ff');
        this.ionBolt = null;
        play(world, 'asteroidHit');
        world.fx.addShake(6);
      }
    }

    // --- Grogu strains; the Force grows around the Crest ---
    if (this.t >= c.forceSeconds) {
      this.force = Math.min(1, (this.t - c.forceSeconds) / 1.4);
      if (this.fired('forceOn')) play(world, 'forceOn');
    }

    // --- asteroid closes in and the hunter is shoved into it ---
    if (this.t < c.shoveSeconds) {
      const move = clamp01((this.t - c.forceSeconds) / (c.shoveSeconds - c.forceSeconds));
      this.asteroid.x = lerp(1380, 1120, move);
      this.asteroid.y = lerp(90, 260, move);
      this.asteroid.angle += this.asteroid.spin * dt;
    }
    if (this.t >= c.shoveSeconds && this.fired('shove')) {
      this.pursuers[4].alive = false;
      this.addExplosion(this.asteroid.x, this.asteroid.y, 1.6, '#9fd0ff');
      this.asteroid.angle = 0;
      play(world, 'forceStop');
      play(world, 'explosion');
      world.fx.addShake(16);
    }
    // the asteroid is knocked away, spent
    if (this.t >= c.shoveSeconds) {
      this.asteroid.x += 150 * dt;
      this.asteroid.y -= 95 * dt;
      this.asteroid.angle += 0.4 * dt;
    }

    // --- more hunters close in; Luke drops out of hyperspace ---
    if (this.t >= c.lukeSeconds && this.fired('luke')) {
      for (let i = 0; i < 3; i++) {
        this.pursuers.push({
          x: W + 120 + i * 150,
          y: 300 + i * 120,
          alive: true,
          dying: 0,
          kind: 'interceptor',
        });
      }
      this.luke = { x: 860, y: -160, targetY: 560, t: 0 };
      play(world, 'lukeArrival');
    }
    if (this.luke) {
      this.luke.t += dt;
      const p = clamp01(this.luke.t / 1.2);
      this.luke.y = lerp(-160, this.luke.targetY, easeOut(p));
      if (this.crest.disabled && this.fired('lukeRepair')) {
        this.crest.disabled = false; // Luke's arrival turns the tide
      }
    }

    // --- effects ---
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.t += dt;
      if (e.t >= e.dur) this.explosions.splice(i, 1);
    }

    if (this.t >= c.totalSeconds) this.finished = true;
  }

  addExplosion(x, y, scale, color) {
    const sparks = [];
    const n = Math.round(10 * scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (60 + Math.random() * 220) * scale;
      sparks.push({
        a,
        s,
        size: 2 + Math.random() * 4 * scale,
      });
    }
    this.explosions.push({
      x,
      y,
      t: 0,
      dur: 0.55 + 0.25 * scale,
      r0: 8,
      r1: 44 * scale,
      color: color || '#ffb15a',
      sparks,
    });
  }

  captionIndex() {
    const times = CONFIG.cinematic.captionTimes;
    let idx = 0;
    for (let i = 0; i < times.length; i++) {
      if (this.t >= times[i]) idx = i;
    }
    return idx;
  }

  draw(ctx, world) {
    // world may be undefined when called without it; keep optional audio/fx use.
    const crest = this.crest;

    // asteroid first (background hazard)
    if (this.asteroid.shown) {
      drawSprite('asteroid_l', ctx, this.asteroid.x, this.asteroid.y, this.asteroid.angle, 1);
    }

    // pursuers
    for (const p of this.pursuers) {
      if (!p.alive && p.dying > 0.4) continue;
      ctx.save();
      if (!p.alive) ctx.globalAlpha = Math.max(0, 1 - p.dying / 0.4);
      drawSprite(`enemy_${p.kind}`, ctx, p.x, p.y, 0, p.kind === 'lancer' ? 0.9 : 1);
      ctx.restore();
    }

    // Mando's bolts
    for (const b of this.mandoBolts) {
      const p = clamp01(b.t / b.dur);
      const x = lerp(b.x, b.tx, p);
      const y = lerp(b.y, b.ty, p);
      const a = Math.atan2(b.ty - b.y, b.tx - b.x);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#ff7a3c';
      ctx.fillRect(-16, -3, 22, 6);
      ctx.fillStyle = '#ffe0b0';
      ctx.fillRect(2, -1.5, 8, 3);
      ctx.restore();
    }

    // ion bolt
    if (this.ionBolt) {
      const p = clamp01(this.ionBolt.t / this.ionBolt.dur);
      const x = lerp(this.ionBolt.x, this.ionBolt.tx, p);
      const y = lerp(this.ionBolt.y, this.ionBolt.ty, p);
      const a = Math.atan2(this.ionBolt.ty - this.ionBolt.y, this.ionBolt.tx - this.ionBolt.x);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#7b3fd6';
      ctx.fillRect(-18, -5, 30, 10);
      ctx.fillStyle = '#efe0ff';
      ctx.fillRect(-6, -3, 14, 6);
      ctx.restore();
    }

    // the Razor Crest (with engine trail)
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#66ccff';
    ctx.beginPath();
    ctx.ellipse(crest.x - 46, crest.y, 30, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawSprite('convoy_ship', ctx, crest.x, crest.y, 0, 1);
    if (crest.disabled) {
      // dead guns: dark score marks where the cannons were
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#241a10';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(crest.x + 26, crest.y + 12);
      ctx.lineTo(crest.x + 40, crest.y + 2);
      ctx.moveTo(crest.x + 26, crest.y + 2);
      ctx.lineTo(crest.x + 40, crest.y + 12);
      ctx.stroke();
      ctx.restore();
    }

    // Grogu's Force push
    if (this.force > 0 && this.t < CONFIG.cinematic.shoveSeconds + 0.4) {
      const cx = crest.x;
      const cy = crest.y;
      const r = 70 + this.force * 150;
      const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
      g.addColorStop(0, 'rgba(120,230,160,0.05)');
      g.addColorStop(1, 'rgba(140,255,180,0.34)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,255,200,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const hunter = this.pursuers[4];
      if (hunter && this.t < CONFIG.cinematic.shoveSeconds) {
        // a push beam from the foundling to the hunter, and a grip aura on it
        ctx.strokeStyle = `rgba(160,255,190,${0.3 + this.force * 0.55})`;
        ctx.lineWidth = 3 + this.force * 5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(hunter.x, hunter.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(150,255,190,${0.12 + this.force * 0.35})`;
        ctx.beginPath();
        ctx.arc(hunter.x, hunter.y, 26 + this.force * 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,255,215,0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Grogu bark
      if (this.force > 0.5 && this.t < CONFIG.cinematic.shoveSeconds) {
        bubble(ctx, STRINGS.saves[0].grogu, crest.x - 30, crest.y - 140);
      }
    }

    // explosions
    for (const e of this.explosions) {
      const p = clamp01(e.t / e.dur);
      const r = lerp(e.r0, e.r1, p);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3d0';
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      for (const s of e.sparks) {
        const d = s.s * p;
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x + Math.cos(s.a) * d, e.y + Math.sin(s.a) * d, s.size, s.size);
      }
      ctx.restore();
    }

    // Luke's X-wing
    if (this.luke) {
      const lp = clamp01(this.luke.t / 1.2);
      const trail = Math.max(0, 1 - lp * 1.4);
      if (trail > 0) {
        ctx.save();
        ctx.globalAlpha = trail * 0.6;
        ctx.fillStyle = '#bfe9ff';
        ctx.beginPath();
        ctx.ellipse(this.luke.x, this.luke.y - 78, 16, 74 * trail, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawSprite('player_xwing', ctx, this.luke.x, this.luke.y, 0, 1.2);
    }

    // caption
    const idx = this.captionIndex();
    const heading = STRINGS.cinematic[idx].heading;
    const isFinal = idx === STRINGS.cinematic.length - 1;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isFinal) {
      const a = clamp01((this.t - CONFIG.cinematic.captionTimes[idx]) / 0.5);
      ctx.globalAlpha = a;
      ctx.font = 'bold 84px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(heading, W / 2 + 4, 150 + 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(heading, W / 2, 150);
    }
    ctx.restore();

    // Non-final beats: the same Persona-idiom panel gameplay barks use, voiced
    // as Mando's own read on the escape. Beat duration is just the gap to the
    // next caption time, so the panel's own fade/typewriter pacing lines up
    // with the cinematic's existing beat cadence.
    if (!isFinal) {
      const times = CONFIG.cinematic.captionTimes;
      const start = times[idx];
      const duration = (times[idx + 1] ?? CONFIG.cinematic.totalSeconds) - start;
      drawPanel(ctx, {
        speaker: 'mando',
        text: STRINGS.cinematic[idx].line || heading,
        portrait: 'portrait_mando',
        t: this.t - start,
        duration,
      });
    }

    // skip affordance
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(STRINGS.skip, W - 110, 60);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(200,215,240,0.7)';
    ctx.fillText(STRINGS.cinematicHint, W / 2, 60);
    // progress bar
    const p = clamp01(this.t / CONFIG.cinematic.totalSeconds);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, H - 6, W, 6);
    ctx.fillStyle = '#8fe3ff';
    ctx.fillRect(0, H - 6, W * p, 6);
    ctx.restore();
    void world;
  }
}

function play(world, name) {
  if (world && world.audio) world.audio.play(name);
}

function bubble(ctx, text, x, y) {
  ctx.save();
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = '#bff0c8';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - 26, w, 52, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c2b20';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
