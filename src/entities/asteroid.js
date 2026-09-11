// Asteroids travel in a straight line between two points fixed at spawn.
// Velocity is computed once and never recomputed. Large rocks are not
// destructible by gunfire (Force or dodge only).

import {
  CONFIG,
  randRange,
  randInt,
  lerpPair,
  difficultyAt,
} from '../config.js';
import { drawSprite } from '../assets.js';

const CAP = 64;
const SIZE_KEYS = ['small', 'medium', 'large'];

export class AsteroidSystem {
  constructor() {
    this.cap = CAP;
    this.pool = new Array(CAP);
    for (let i = 0; i < CAP; i++) {
      this.pool[i] = {
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        r: 18, angle: 0, spin: 0,
        sizeKey: 'small',
        hp: 1, maxHp: 1,
        destructible: true,
        points: 0,
        deflected: false,
      };
    }
    this.cursor = 0;
  }

  reset() {
    for (let i = 0; i < CAP; i++) this.pool[i].active = false;
    this.cursor = 0;
  }

  get activeCount() {
    let n = 0;
    for (let i = 0; i < CAP; i++) if (this.pool[i].active) n++;
    return n;
  }

  spawn(difficulty, player) {
    const a = CONFIG.asteroid;
    // pick size by configured weights
    const sizeKey = pickSize(a.sizeWeights);
    const spec = a.sizes[sizeKey];
    const speed =
      lerpPair(a.speed, difficulty) *
      randRange(a.speedJitter[0], a.speedJitter[1]);
    const hpScale = lerpPair(a.hpScale, difficulty);

    const start = randomPointOnBand(randInt(0, 3));
    const end = randomPointOnBand(oppositeBand(start.band), start.band);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;

    let hp = spec.hp;
    if (sizeKey === 'large' && !a.largeDestructible) hp = Infinity;
    else if (hp !== Infinity) hp = Math.max(1, Math.round(hp * hpScale));

    const ast = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % CAP;
    ast.active = true;
    ast.x = start.x;
    ast.y = start.y;
    ast.vx = (dx / len) * speed;
    ast.vy = (dy / len) * speed;
    ast.r = spec.r;
    ast.angle = randRange(0, Math.PI * 2);
    ast.spin = randRange(-1.2, 1.2);
    ast.sizeKey = sizeKey;
    ast.hp = hp;
    ast.maxHp = hp;
    ast.destructible = !(sizeKey === 'large' && !a.largeDestructible);
    ast.points = spec.points;
    ast.deflected = false;
    // anti-frustration: nudge spawn away from the player
    if (player) avoidPlayer(ast, player);
    return ast;
  }

  update(dt) {
    for (let i = 0; i < CAP; i++) {
      const ast = this.pool[i];
      if (!ast.active) continue;
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;
      ast.angle += ast.spin * dt;
      const m = CONFIG.asteroid.despawnMargin;
      if (
        ast.x < -m * 2 ||
        ast.x > CONFIG.VIRTUAL_W + m * 2 ||
        ast.y < -m * 2 ||
        ast.y > CONFIG.VIRTUAL_H + m * 2
      ) {
        ast.active = false;
      }
    }
  }

  damage(ast, amount) {
    if (!ast.active || !ast.destructible || ast.hp === Infinity) return false;
    ast.hp -= amount;
    if (ast.hp <= 0) {
      ast.active = false;
      return true;
    }
    return false;
  }

  draw(ctx) {
    for (let i = 0; i < CAP; i++) {
      const ast = this.pool[i];
      if (!ast.active) continue;
      const key = `asteroid_${ast.sizeKey[0]}`;
      drawSprite(key, ctx, ast.x, ast.y, ast.angle, 1);
    }
  }
}

function pickSize(weights) {
  const total = weights[0] + weights[1] + weights[2];
  let r = Math.random() * total;
  for (let i = 0; i < 3; i++) {
    if (r < weights[i]) return SIZE_KEYS[i];
    r -= weights[i];
  }
  return SIZE_KEYS[0];
}

function oppositeBand(band) {
  return (band + 2) % 4;
}

// band 0=left, 1=right, 2=top, 3=bottom. Points sit just outside the field.
function randomPointOnBand(band, nearBand = -1) {
  const W = CONFIG.VIRTUAL_W;
  const H = CONFIG.VIRTUAL_H;
  const off = CONFIG.asteroid.spawnOffset;
  switch (band) {
    case 0:
      return { band, x: -off, y: randRange(80, H - 80) };
    case 1:
      return { band, x: W + off, y: randRange(80, H - 80) };
    case 2:
      return { band, x: randRange(80, W - 80), y: -off };
    default:
      return { band, x: randRange(80, W - 80), y: H + off };
  }
}

function avoidPlayer(ast, player) {
  const min = CONFIG.spawn.minDistanceFromPlayer;
  const d = Math.hypot(ast.x - player.x, ast.y - player.y);
  if (d < min) {
    // push the start point along the trajectory until it clears the player
    const push = (min - d) + 20;
    const vlen = Math.hypot(ast.vx, ast.vy) || 1;
    ast.x -= (ast.vx / vlen) * push;
    ast.y -= (ast.vy / vlen) * push;
  }
}

// Exposed for collision/test readouts.
export function asteroidHpFor(sizeKey, difficulty) {
  const spec = CONFIG.asteroid.sizes[sizeKey];
  if (sizeKey === 'large' && !CONFIG.asteroid.largeDestructible) return Infinity;
  return spec.hp === Infinity
    ? Infinity
    : Math.max(1, Math.round(spec.hp * lerpPair(CONFIG.asteroid.hpScale, difficulty)));
}

export function asteroidDifficulty(elapsed) {
  return difficultyAt(elapsed);
}