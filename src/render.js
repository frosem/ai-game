// Camera, letterboxed virtual resolution, one procedural scrolling star layer,
// and the draw helpers that keep every other module out of raw canvas math.

import { CONFIG, clamp, randRange } from './config.js';
import { getImage } from './assets.js';

const NEBULA_SPEED = 9; // px/sec, slower than the star layers: it reads as distant

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    // Pixel art: never interpolate sprite pixels when scaling.
    this.ctx.imageSmoothingEnabled = false;
    this.cssW = 0;
    this.cssH = 0;
    this.scale = 1;
    this.padX = 0;
    this.padY = 0;
    this.shake = 0;
    this.stars = [];
    this.nebulaX = 0;
    this._buildStars();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _buildStars() {
    const count = 190;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: randRange(0, CONFIG.VIRTUAL_W),
        y: randRange(0, CONFIG.VIRTUAL_H),
        size: randRange(0.6, 2.2),
        speed: randRange(8, 46),
        alpha: randRange(0.25, 0.9),
      });
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = this.canvas.clientWidth || window.innerWidth;
    this.cssH = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    // Resizing the backing store resets context state.
    this.ctx.imageSmoothingEnabled = false;
    this.scale = Math.min(
      this.cssW / CONFIG.VIRTUAL_W,
      this.cssH / CONFIG.VIRTUAL_H
    );
    this.padX = (this.cssW - CONFIG.VIRTUAL_W * this.scale) / 2;
    this.padY = (this.cssH - CONFIG.VIRTUAL_H * this.scale) / 2;
    this.dpr = dpr;
  }

  addShake(amount) {
    this.shake = Math.min(this.shake + amount, 40);
  }

  begin(dt, timeScale) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // letterbox: paint the whole window black first
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    this.shake = Math.max(0, this.shake - CONFIG.fx.shakeDecay * this.shake * dt);
    let sx = 0;
    let sy = 0;
    if (this.shake > 0.2) {
      sx = randRange(-this.shake, this.shake);
      sy = randRange(-this.shake, this.shake);
    }

    ctx.setTransform(
      dpr * this.scale,
      0,
      0,
      dpr * this.scale,
      dpr * (this.padX + sx * this.scale),
      dpr * (this.padY + sy * this.scale)
    );
    // content is drawn in virtual units from here on
    this._drawNebula(ctx, dt, timeScale);
    this._updateStars(dt, timeScale);
    this._drawStars(ctx);
  }

  // Generated nebula backdrop (project-sw art), tiled and slow-scrolled behind
  // the procedural star layers. Degrades to plain black if the art is missing.
  _drawNebula(ctx, dt, timeScale) {
    const img = getImage('bg_nebula');
    if (!img) return;
    const h = CONFIG.VIRTUAL_H;
    const w = CONFIG.VIRTUAL_W;
    const tileW = Math.round(img.width * (h / img.height));
    this.nebulaX -= NEBULA_SPEED * dt * timeScale;
    if (this.nebulaX <= -tileW) this.nebulaX += tileW;
    ctx.globalAlpha = 0.55;
    for (let x = Math.floor(this.nebulaX) - tileW; x < w + tileW; x += tileW) {
      ctx.drawImage(img, 0, 0, img.width, img.height, x, 0, tileW, h);
    }
    ctx.globalAlpha = 1;
  }

  _updateStars(dt, timeScale) {
    const w = CONFIG.VIRTUAL_W;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.x -= s.speed * dt * timeScale;
      if (s.x < -4) {
        s.x = w + 4;
        s.y = randRange(0, CONFIG.VIRTUAL_H);
      }
    }
  }

  _drawStars(ctx) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#cfe3ff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  end() {
    // restore identity (HUD modules use their own transform)
    const dpr = this.dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Sets the letterbox transform so UI can draw in virtual coordinates.
  hudBegin() {
    const dpr = this.dpr;
    this.ctx.setTransform(
      dpr * this.scale,
      0,
      0,
      dpr * this.scale,
      dpr * this.padX,
      dpr * this.padY
    );
  }

  hudEnd() {
    const dpr = this.dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // --- screen-space overlays (called after end()) ---
  clearToWorld() {}

  edgeTint(color, strength) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.cssW;
    const h = this.cssH;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color);
    g.addColorStop(0.28, 'rgba(0,0,0,0)');
    g.addColorStop(0.72, 'rgba(0,0,0,0)');
    g.addColorStop(1, color);
    ctx.globalAlpha = clamp(strength, 0, 1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  wholeTint(color, strength) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = clamp(strength, 0, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.globalAlpha = 1;
  }
}