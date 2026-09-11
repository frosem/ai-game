// Enemy archetypes: Interceptor (pressures the player), Gunship (shoots the
// convoy with shootable red bolts), Ion Lancer (long telegraph, unshootable
// ion bolt — the Force window). Everything is parametrized from CONFIG.enemy.

import {
  CONFIG,
  randRange,
  lerpPair,
  clamp,
} from '../config.js';
import { drawSprite } from '../assets.js';

const CAP = 32;
const TYPES = ['interceptor', 'gunship', 'lancer'];

export class EnemySystem {
  constructor() {
    this.cap = CAP;
    this.pool = new Array(CAP);
    for (let i = 0; i < CAP; i++) {
      this.pool[i] = makeEnemy();
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

  spawn(type, difficulty, player, convoy) {
    const spec = CONFIG.enemy[type];
    const hpScale = lerpPair(CONFIG.enemy.hpScale, difficulty);
    const start = spawnPoint(player);
    const e = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % CAP;
    e.active = true;
    e.type = type;
    e.x = start.x;
    e.y = start.y;
    e.vx = 0;
    e.vy = 0;
    e.hp = Math.max(1, Math.round(spec.hp * hpScale));
    e.maxHp = e.hp;
    e.speed = spec.speed;
    e.hitRadius = spec.hitRadius;
    e.fireInterval = spec.fireIntervalSeconds;
    e.telegraphSeconds = spec.telegraphSeconds;
    e.boltSpeed = spec.boltSpeed;
    e.points = spec.points;
    e.targets = spec.targets;
    e.boltShootable = spec.boltShootable !== false;
    e.standoff = spec.standoff;
    e.fireTimer = spec.fireIntervalSeconds * randRange(0.5, 1.0);
    e.telegraphing = false;
    e.aimAngle = 0;
    e.hoverY = convoy ? clamp(convoy.y + randRange(-160, 160), 90, 810) : start.y;
    e.chargeGlow = 0;
    e.hitFlash = 0;
    return e;
  }

  update(dt, world) {
    const { player, convoy, bolts } = world;
    for (let i = 0; i < CAP; i++) {
      const e = this.pool[i];
      if (!e.active) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4);

      // --- movement ---
      let tx;
      let ty;
      if (e.type === 'interceptor') {
        tx = player.x;
        ty = player.y;
      } else {
        tx = convoy.x + e.standoff;
        ty = e.hoverY;
      }
      steer(e, tx, ty, dt);

      // --- firing ---
      e.fireTimer -= dt;
      const willTelegraph =
        e.fireTimer <= e.telegraphSeconds && e.fireTimer > 0;
      e.telegraphing = willTelegraph;
      if (e.telegraphing) {
        e.chargeGlow = clamp(
          1 - e.fireTimer / e.telegraphSeconds,
          0,
          1
        );
      }

      if (e.fireTimer <= 0) {
        const fired = fire(e, world);
        if (fired) {
          const j = CONFIG.enemy.fireJitter;
          e.fireTimer = e.fireInterval * randRange(j[0], j[1]);
          e.telegraphing = false;
          e.chargeGlow = 0;
        } else {
          // anti-frustration gate blocked the ion shot: hold and retry shortly
          e.fireTimer = CONFIG.enemy.telegraphChargeDelay;
        }
        void bolts;
      }

      // keep on screen vertically; despawn if it drifts far off horizontally
      e.y = clamp(e.y, CONFIG.enemy.clampY, CONFIG.VIRTUAL_H - CONFIG.enemy.clampY);
      if (e.x < -CONFIG.enemy.despawnMargin) e.active = false;
    }
  }

  damage(e, amount) {
    if (!e.active) return false;
    e.hp -= amount;
    e.hitFlash = 1;
    if (e.hp <= 0) {
      e.active = false;
      return true;
    }
    return false;
  }

  draw(ctx) {
    for (let i = 0; i < CAP; i++) {
      const e = this.pool[i];
      if (!e.active) continue;
      const scale = 1;
      drawSprite(`enemy_${e.type}`, ctx, e.x, e.y, 0, scale);
      if (e.hitFlash > 0) {
        ctx.globalAlpha = e.hitFlash * 0.7;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.hitRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawTelegraphs(ctx, convoy) {
    for (let i = 0; i < CAP; i++) {
      const e = this.pool[i];
      if (!e.active || !e.telegraphing) continue;
      const target = e.targets === 'player' ? null : convoy;
      drawTelegraph(ctx, e, target);
    }
  }
}

function makeEnemy() {
  return {
    active: false,
    type: 'interceptor',
    x: 0, y: 0, vx: 0, vy: 0,
    hp: 1, maxHp: 1,
    speed: 100,
    hitRadius: 26,
    fireInterval: 2,
    telegraphSeconds: 0.5,
    boltSpeed: 400,
    points: 100,
    targets: 'player',
    boltShootable: true,
    standoff: 300,
    fireTimer: 1,
    telegraphing: false,
    aimAngle: 0,
    hoverY: 300,
    chargeGlow: 0,
    hitFlash: 0,
  };
}

function steer(e, tx, ty, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const arrive =
    e.type === 'interceptor'
      ? CONFIG.enemy.arriveDistance.interceptor
      : CONFIG.enemy.arriveDistance.standoff;
  let speed = e.speed;
  if (d < arrive) speed *= d / arrive; // ease into the standoff point
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function fire(e, world) {
  const { player, convoy, bolts, audio, state } = world;
  const target = e.targets === 'player' ? player : convoy;

  // anti-frustration guarantees for ion bolts
  if (e.type === 'lancer') {
    const maxIon = CONFIG.spawn.maxIonBoltsInFlight;
    const nowIon = bolts.countIon();
    if (nowIon >= maxIon) return false;
    if (
      state.lastIonFireAt !== null &&
      state.elapsed - state.lastIonFireAt < CONFIG.spawn.ionSpacingSeconds
    ) {
      return false;
    }
  }

  // simple lead for slow-moving convoy
  let aimX = target.x;
  let aimY = target.y;
  if (e.targets === 'convoy' && target.vx !== undefined) {
    const dist = Math.hypot(target.x - e.x, target.y - e.y);
    const t = dist / e.boltSpeed;
    aimX += target.vx * t;
    aimY += target.vy * t;
  }
  const angle = Math.atan2(aimY - e.y, aimX - e.x);
  e.aimAngle = angle;

  const isIon = e.type === 'lancer';
  const b = bolts.spawnEnemy(
    e.x,
    e.y,
    angle,
    e.boltSpeed,
    isIon ? 'ion' : 'red',
    isIon ? CONFIG.bolt.enemyIonLife : CONFIG.bolt.enemyRedLife,
    isIon ? CONFIG.bolt.ionR : CONFIG.bolt.redR
  );
  if (!b) return false;

  if (isIon) {
    state.lastIonFireAt = state.elapsed;
    if (audio) audio.play('ionFire');
  } else if (audio) {
    audio.play('enemyFire');
  }
  return true;
}

function drawTelegraph(ctx, e, target) {
  if (e.type === 'lancer') {
    // dotted aim line to the convoy
    const angle = Math.atan2(
      (target ? target.y : e.y) - e.y,
      (target ? target.x : e.x + 1) - e.x
    );
    ctx.save();
    ctx.strokeStyle = `rgba(190,150,255,${0.35 + e.chargeGlow * 0.5})`;
    ctx.lineWidth = 2 + e.chargeGlow * 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    if (target) ctx.lineTo(target.x, target.y);
    else ctx.lineTo(e.x + Math.cos(angle) * 900, e.y + Math.sin(angle) * 900);
    ctx.stroke();
    ctx.setLineDash([]);
    // growing charge glow
    ctx.fillStyle = `rgba(200,160,255,${0.15 + e.chargeGlow * 0.4})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 14 + e.chargeGlow * 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (e.type === 'gunship') {
    ctx.save();
    ctx.strokeStyle = `rgba(255,110,80,${0.2 + e.chargeGlow * 0.5})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    if (target) ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else {
    // interceptor: short muzzle tell
    ctx.save();
    ctx.fillStyle = `rgba(255,90,60,${0.15 + e.chargeGlow * 0.45})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 8 + e.chargeGlow * 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function spawnPoint(player) {
  const W = CONFIG.VIRTUAL_W;
  const H = CONFIG.VIRTUAL_H;
  const min = CONFIG.spawn.minDistanceFromPlayer;
  const off = CONFIG.enemy.spawnEdgeOffset;
  const rightChance = CONFIG.enemy.spawnBandRightChance;
  const topChance = CONFIG.enemy.spawnBandTopChance;
  let x = 0;
  let y = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const band = Math.random();
    if (band < rightChance) {
      x = W + off;
      y = randRange(80, H - 80);
    } else if (band < rightChance + topChance) {
      x = randRange(W * 0.4, W - 80);
      y = -off;
    } else {
      x = randRange(W * 0.4, W - 80);
      y = H + off;
    }
    if (Math.hypot(x - player.x, y - player.y) >= min) break;
  }
  return { x, y };
}

export { TYPES };