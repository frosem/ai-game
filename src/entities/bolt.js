// Pooled bolts. Two colour-coded classes: RED (shootable) and ION (Force-only).
// Colour coding is a hard rule — never mix them.

import { CONFIG } from '../config.js';

const CAP = 320;

export class BoltSystem {
  constructor() {
    this.cap = CAP;
    this.pool = new Array(CAP);
    for (let i = 0; i < CAP; i++) {
      this.pool[i] = {
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1,
        type: 'red',      // 'red' | 'ion'
        friendly: false,  // player-owned?
        shootable: true,
        damage: 1,
        r: 6,
      };
    }
    this.cursor = 0;
  }

  reset() {
    for (let i = 0; i < CAP; i++) this.pool[i].active = false;
    this.cursor = 0;
  }

  _get() {
    const b = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % CAP;
    return b;
  }

  spawnPlayer(x, y, angle, speed, life, damage) {
    const b = this._get();
    b.active = true;
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.life = life; b.maxLife = life;
    b.type = 'red';
    b.friendly = true;
    b.shootable = false;
    b.damage = damage;
    b.r = CONFIG.bolt.playerR;
    return b;
  }

  spawnEnemy(x, y, angle, speed, type, life, r) {
    const b = this._get();
    b.active = true;
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.life = life; b.maxLife = life;
    b.type = type;
    b.friendly = false;
    b.shootable = type === 'red';
    b.damage = 1;
    b.r = r;
    return b;
  }

  update(dt) {
    for (let i = 0; i < CAP; i++) {
      const b = this.pool[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (
        b.x < -60 ||
        b.x > CONFIG.VIRTUAL_W + 60 ||
        b.y < -60 ||
        b.y > CONFIG.VIRTUAL_H + 60
      ) {
        b.active = false;
      }
    }
  }

  draw(ctx) {
    for (let i = 0; i < CAP; i++) {
      const b = this.pool[i];
      if (!b.active) continue;
      if (b.type === 'ion') {
        drawIonBolt(ctx, b);
      } else {
        drawRedBolt(ctx, b);
      }
    }
  }

  countIon() {
    let n = 0;
    for (let i = 0; i < CAP; i++) {
      const b = this.pool[i];
      if (b.active && !b.friendly && b.type === 'ion') n++;
    }
    return n;
  }
}

function drawRedBolt(ctx, b) {
  const ang = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);
  ctx.fillStyle = '#ff5a3c';
  ctx.fillRect(-12, -2.5, 20, 5);
  ctx.fillStyle = '#ffd2c2';
  ctx.fillRect(2, -1.5, 7, 3);
  ctx.restore();
}

function drawIonBolt(ctx, b) {
  const ang = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);
  // crackling body
  ctx.fillStyle = '#7b3fd6';
  ctx.fillRect(-16, -4, 26, 8);
  ctx.fillStyle = '#c9a6ff';
  ctx.fillRect(-8, -6, 14, 12);
  ctx.fillStyle = '#efe0ff';
  ctx.fillRect(4, -3, 8, 6);
  // static sparks
  ctx.strokeStyle = '#e6ccff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = -10 + ((b.life * 999) % 20) + i * 8;
    ctx.moveTo(x, -7);
    ctx.lineTo(x + 4, 0);
    ctx.lineTo(x, 7);
  }
  ctx.stroke();
  ctx.restore();
}