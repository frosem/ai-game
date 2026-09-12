// Keyboard + mouse input. The reticle is reported in virtual world space.
// Movement keys nudge a ship that already drifts; aim is instantaneous.

import { CONFIG } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: CONFIG.VIRTUAL_W * 0.5, y: CONFIG.VIRTUAL_H * 0.5 };
    this.mouseDown = false;
    this.forceDown = false;
    this.clickQueued = false;
    // view transform, updated by the renderer each frame
    this.viewScale = 1;
    this.viewOffX = 0;
    this.viewOffY = 0;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') return;
      const target = e.target;
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      this.keys.add(e.code);
      // stop arrows/space from scrolling the page
      if (
        e.code === 'Space' ||
        e.code.startsWith('Arrow') ||
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD'
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.forceDown = false;
    });

    this.canvas.addEventListener('mousemove', (e) => this._move(e));
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.clickQueued = true;
      }
      if (e.button === 2) this.forceDown = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.forceDown = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _move(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left - this.viewOffX) / this.viewScale;
    const py = (e.clientY - rect.top - this.viewOffY) / this.viewScale;
    this.mouse.x = px;
    this.mouse.y = py;
  }

  setView(scale, offX, offY) {
    this.viewScale = scale;
    this.viewOffX = offX;
    this.viewOffY = offY;
  }

  consumeClick() {
    const c = this.clickQueued;
    this.clickQueued = false;
    return c;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True while any pause key is held (edge handled by main).
  pausePressed() {
    return this.isDown('Escape') || this.isDown('KeyP');
  }

  restartPressed() {
    return this.isDown('KeyR');
  }

  // Directional intent in virtual space, normalised.
  moveDir() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  fireHeld() {
    return this.mouseDown;
  }

  forceHeld() {
    return this.forceDown || this.isDown('Space');
  }

  anyAdvance() {
    return (
      this.mouseDown ||
      this.isDown('Space') ||
      this.isDown('Enter') ||
      this.isDown('KeyR')
    );
  }
}
