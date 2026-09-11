// Luke's X-wing. Movement has momentum; aim is instantaneous and decoupled
// from the hull's facing. The ship's speed is never zero (constant driftX).

import { CONFIG, clamp } from '../config.js';
import { drawSprite, drawStripFrame } from '../assets.js';

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    const p = CONFIG.player;
    this.x = CONFIG.VIRTUAL_W * 0.32;
    this.y = CONFIG.VIRTUAL_H * 0.5;
    this.vx = 0;
    this.vy = 0;
    this.hearts = p.hearts;
    this.maxHearts = p.hearts;
    this.hitRadius = p.hitRadius;
    this.aimAngle = 0;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.alive = true;
    this.hullBank = 0;
    this.forceCharge = CONFIG.force.capacity;
    this.forceLockout = 0;
    this.forceActive = false;
    this.forceWasEmpty = false;
    this.hitFlash = 0;
    this.muzzleFlash = 0;
    this.t = 0;
  }

  update(dt, input, world) {
    if (!this.alive) return;
    const p = CONFIG.player;
    this.t += dt;

    // --- movement: nudge with momentum plus a permanent drift ---
    const dir = input.moveDir();
    const ax = dir.x * p.accel;
    const ay = dir.y * p.accel;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.vx -= this.vx * p.drag * dt;
    this.vy -= this.vy * p.drag * dt;

    const sp = Math.hypot(this.vx, this.vy);
    if (sp > p.maxSpeed) {
      const k = p.maxSpeed / sp;
      this.vx *= k;
      this.vy *= k;
    }

    this.x += (this.vx + p.driftX) * dt;
    this.y += this.vy * dt;

    // Rule R3: the ship never stops moving. Only snap when the resultant
    // velocity is effectively zero; using driftX here cancels left movement
    // before its counter-thrust can build up.
    if (Math.hypot(this.vx + p.driftX, this.vy) < 1) {
      this.vx = 0;
      this.vy = 0;
    }

    const margin = this.hitRadius + 4;
    this.x = clamp(this.x, margin, CONFIG.VIRTUAL_W - margin);
    this.y = clamp(this.y, margin, CONFIG.VIRTUAL_H - margin);

    // --- aim: instantaneous, independent of hull facing ---
    this.aimAngle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
    const targetBank = clamp(this.vy * p.bankFactor, -0.5, 0.5);
    this.hullBank += (targetBank - this.hullBank) * Math.min(1, dt * 8);

    // --- timing ---
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);

    // --- fire (held auto-fire, gated by cooldown; disabled by the Force) ---
    const canFire =
      this.alive &&
      input.fireHeld() &&
      this.fireCooldown <= 0 &&
      !this.forceActive;
    if (canFire) {
      this.fire(world);
    }
  }

  fire(world) {
    const p = CONFIG.player;
    const muzzle = p.muzzleOffset;
    const mx = this.x + Math.cos(this.aimAngle) * muzzle;
    const my = this.y + Math.sin(this.aimAngle) * muzzle;
    const b = world.bolts.spawnPlayer(
      mx, my, this.aimAngle, p.boltSpeed, p.boltLife, p.boltDamage
    );
    if (b) {
      this.fireCooldown = p.FIRE_COOLDOWN_MS / 1000;
      this.muzzleFlash = CONFIG.fx.muzzleFlashSeconds;
      if (world.audio) world.audio.play('fire');
    }
  }

  takeHit(world, knockX = 0, knockY = 0) {
    if (!this.alive || this.invuln > 0) return false;
    const p = CONFIG.player;
    this.hearts -= 1;
    this.invuln = p.invulnSeconds;
    this.hitFlash = 1;
    this.vx += knockX;
    this.vy += knockY;
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.alive = false;
    }
    return true;
  }

  draw(ctx) {
    if (!this.alive) return;
    const blink =
      this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.hullBank);
    const hull = this.forceActive ? 'player_xwing_force' : 'player_xwing';
    if (!blink) {
      drawSprite(hull, ctx, 0, 0, 0, 1);
    } else {
      ctx.globalAlpha = 0.4;
      drawSprite(hull, ctx, 0, 0, 0, 1);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // cannons track the reticle (decoupled from hull facing)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle);
    ctx.fillStyle = '#dfe6ee';
    ctx.fillRect(6, -7, 34, 4);
    ctx.fillRect(6, 3, 34, 4);
    if (this.muzzleFlash > 0) {
      const frame = (1 - this.muzzleFlash / CONFIG.fx.muzzleFlashSeconds) * 3;
      drawStripFrame('fx_muzzle_flash', ctx, 40, -7, frame, 1.6);
      drawStripFrame('fx_muzzle_flash', ctx, 40, 7, frame, 1.6);
    }
    ctx.restore();

    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash * 0.5;
      ctx.fillStyle = '#ff8a6a';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.hitRadius + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawReticle(ctx, input, forceActive) {
    if (!this.alive) return;
    const { mouse } = input;
    const p = CONFIG.player;
    const ready = this.fireCooldown <= 0;
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    if (forceActive) {
      // Force glyph
      ctx.strokeStyle = '#8fe3ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + this.t * 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = ready ? '#e8f4ff' : 'rgba(232,244,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      // cooldown ring
      const frac = ready ? 1 : 1 - this.fireCooldown / (p.FIRE_COOLDOWN_MS / 1000);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(232,244,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.moveTo(0, -4);
      ctx.lineTo(0, 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  currentSpeed() {
    return Math.hypot(this.vx + CONFIG.player.driftX, this.vy);
  }
}
