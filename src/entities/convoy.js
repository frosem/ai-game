// The Razor Crest. Not player-controlled. Its 3 hearts ARE Grogu's Force saves.
// Flies a gentle scripted sine path across the mid-left of the screen.

import { CONFIG } from '../config.js';
import { drawSprite } from '../assets.js';

export class Convoy {
  constructor() {
    this.reset();
  }

  reset() {
    this.hearts = CONFIG.convoy.hearts;
    this.maxHearts = CONFIG.convoy.hearts;
    this.x = CONFIG.convoy.baseX;
    this.y = CONFIG.convoy.baseY;
    this.vx = 0;
    this.vy = 0;
    this.hitRadius = CONFIG.convoy.hitRadius;
    this.graceRemaining = 0;
    this.t = 0;
    this.hitFlash = 0;
    this.alive = true;
  }

  update(dt) {
    const c = CONFIG.convoy;
    this.t += dt;
    const prevX = this.x;
    const prevY = this.y;
    this.x = c.baseX + Math.sin(this.t * c.sineSpeedX) * c.sineAmpX;
    this.y = c.baseY + Math.sin(this.t * c.sineSpeedY) * c.sineAmpY;
    this.vx = (this.x - prevX) / dt;
    this.vy = (this.y - prevY) / dt;
    if (this.graceRemaining > 0) this.graceRemaining -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
  }

  // Returns true if the hit landed (not blocked by i-frames / grace).
  takeHit(damage) {
    if (!this.alive) return false;
    if (this.graceRemaining > 0) return false;
    this.hearts -= damage;
    this.graceRemaining = CONFIG.convoy.graceSeconds;
    this.hitFlash = 1;
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.alive = false;
    }
    return true;
  }

  draw(ctx) {
    const bob = Math.sin(this.t * 4) * 3;
    drawSprite('convoy_ship', ctx, this.x, this.y + bob, 0, 1);
    // engine glow
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#66ccff';
    ctx.beginPath();
    ctx.ellipse(this.x - CONFIG.convoy.hitRadius * 0.75, this.y + bob, 10, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash * 0.6;
      ctx.fillStyle = '#7dffb0';
      ctx.beginPath();
      ctx.arc(this.x, this.y, CONFIG.convoy.hitRadius + 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}