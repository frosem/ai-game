// Broad-phase-ish collision resolution. All checks are circle-circle in virtual
// units. No allocation.

import { CONFIG } from '../config.js';
import { STRINGS } from '../strings.js';

export function handleCollisions(world) {
  const { player, convoy, enemies, bolts, asteroids, particles, audio, score, state } =
    world;

  playerBoltsVsEnemies(world);
  playerBoltsVsBolts(world);
  playerBoltsVsAsteroids(world);
  enemyBoltsVsShips(world);
  asteroidsVsShips(world);
  enemiesVsPlayer(world);

  void player;
  void convoy;
  void enemies;
  void bolts;
  void asteroids;
  void particles;
  void audio;
  void score;
  void state;
}

function hits(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

function playerBoltsVsEnemies(world) {
  const { bolts, enemies, particles, audio, score } = world;
  for (let i = 0; i < bolts.cap; i++) {
    const b = bolts.pool[i];
    if (!b.active || !b.friendly) continue;
    for (let j = 0; j < enemies.cap; j++) {
      const e = enemies.pool[j];
      if (!e.active) continue;
      if (!hits(b.x, b.y, b.r, e.x, e.y, e.hitRadius)) continue;
      b.active = false;
      const killed = enemies.damage(e, b.damage);
      particles.burst(b.x, b.y, 4, '#ffd9a0', 180, 0.25, 3);
      if (killed) {
        score.enemyKill();
        particles.burst(e.x, e.y, 22, '#ff9a5a', 360, 0.6, 5);
        particles.burst(e.x, e.y, 10, '#ffe9b0', 220, 0.5, 4);
        particles.explode(e.x, e.y, 'fx_explosion_small');
        if (audio) audio.play('explosion');
        world.fx.addShake(6);
      }
      break;
    }
  }
}

function playerBoltsVsBolts(world) {
  const { bolts, particles, audio, score } = world;
  for (let i = 0; i < bolts.cap; i++) {
    const b = bolts.pool[i];
    if (!b.active || !b.friendly) continue;
    for (let j = 0; j < bolts.cap; j++) {
      const t = bolts.pool[j];
      if (!t.active || t.friendly || !t.shootable || t.type !== 'red') continue;
      if (!hits(b.x, b.y, b.r, t.x, t.y, t.r)) continue;
      b.active = false;
      t.active = false;
      score.boltShotDown();
      particles.burst(t.x, t.y, 8, '#ffb08a', 220, 0.35, 3);
      if (audio) audio.play('boltDown');
      break;
    }
  }
}

function playerBoltsVsAsteroids(world) {
  const { bolts, asteroids, particles, audio, score } = world;
  for (let i = 0; i < bolts.cap; i++) {
    const b = bolts.pool[i];
    if (!b.active || !b.friendly) continue;
    for (let j = 0; j < asteroids.cap; j++) {
      const a = asteroids.pool[j];
      if (!a.active || !a.destructible) continue;
      if (!hits(b.x, b.y, b.r, a.x, a.y, a.r)) continue;
      b.active = false;
      const destroyed = asteroids.damage(a, b.damage);
      particles.burst(b.x, b.y, 5, '#c9c2ad', 160, 0.3, 3);
      if (destroyed) {
        score.asteroidKill(a.points);
        particles.burst(a.x, a.y, 18, '#a89f8a', 300, 0.6, 5);
        particles.explode(a.x, a.y, 'fx_explosion_small');
        if (audio) audio.play('asteroidHit');
      }
      break;
    }
  }
}

function enemyBoltsVsShips(world) {
  const { bolts, player, convoy, particles, audio, score, state } = world;
  for (let i = 0; i < bolts.cap; i++) {
    const b = bolts.pool[i];
    if (!b.active || b.friendly) continue;

    // vs player
    if (player.alive && hits(b.x, b.y, b.r, player.x, player.y, player.hitRadius)) {
      b.active = false;
      particles.burst(b.x, b.y, 8, b.type === 'ion' ? '#c9a6ff' : '#ffb08a', 220, 0.35, 3);
      if (!state.god) {
        const applied = player.takeHit(world);
        if (applied) {
          score.heartLost();
          particles.explode(player.x, player.y, 'fx_explosion_small');
          onPlayerHit(world);
          if (audio) audio.play('explosion');
          world.fx.addShake(8);
        }
      }
      continue;
    }

    // vs convoy (red and ion alike)
    if (convoy.alive && hits(b.x, b.y, b.r, convoy.x, convoy.y, convoy.hitRadius)) {
      b.active = false;
      particles.burst(convoy.x, convoy.y, 12, '#7dffb0', 240, 0.45, 4);
      onConvoyHit(world);
    }
  }
}

function asteroidsVsShips(world) {
  const { asteroids, player, convoy, particles, audio, score, state } = world;
  const a = CONFIG.asteroid;
  for (let i = 0; i < asteroids.cap; i++) {
    const ast = asteroids.pool[i];
    if (!ast.active) continue;

    // vs player
    if (player.alive && hits(ast.x, ast.y, ast.r, player.x, player.y, player.hitRadius)) {
      if (state.god) {
        // still shatter so the test run stays clean
      } else if (player.invuln <= 0) {
        const nlen = Math.hypot(ast.vx, ast.vy) || 1;
        const kx = (ast.vx / nlen) * a.knockback;
        const ky = (ast.vy / nlen) * a.knockback;
        if (a.INSTAKILL) {
          player.hearts = 0;
          player.alive = false;
        } else {
          for (let d = 0; d < a.damageToPlayer; d++) player.takeHit(world, kx, ky);
        }
        score.heartLost();
        onPlayerHit(world);
        if (audio) audio.play('asteroidHit');
      }
      particles.explode(ast.x, ast.y, 'fx_explosion_small');
      particles.burst(ast.x, ast.y, 16, '#b8b09a', 300, 0.6, 5);
      world.fx.addShake(a.shakeOnHit);
      ast.active = false;
      continue;
    }

    // vs convoy
    if (convoy.alive && hits(ast.x, ast.y, ast.r, convoy.x, convoy.y, convoy.hitRadius)) {
      particles.burst(ast.x, ast.y, 16, '#b8b09a', 300, 0.6, 5);
      world.fx.addShake(a.shakeOnHit);
      ast.active = false;
      for (let d = 0; d < a.damageToConvoy; d++) onConvoyHit(world);
    }
  }
}

function enemiesVsPlayer(world) {
  const { enemies, player, particles, audio, score, state } = world;
  for (let i = 0; i < enemies.cap; i++) {
    const e = enemies.pool[i];
    if (!e.active || !player.alive) continue;
    if (!hits(e.x, e.y, e.hitRadius, player.x, player.y, player.hitRadius)) continue;
    if (state.god || player.invuln > 0) continue;
    const nlen = Math.hypot(e.vx, e.vy) || 1;
    player.takeHit(world, (e.vx / nlen) * CONFIG.enemy.ramKnockback, (e.vy / nlen) * CONFIG.enemy.ramKnockback);
    score.heartLost();
    particles.burst(player.x, player.y, 14, '#ff9a5a', 300, 0.5, 4);
    particles.explode(player.x, player.y, 'fx_explosion_small');
    onPlayerHit(world);
    if (audio) audio.play('explosion');
    world.fx.addShake(10);
  }
}

// Any non-fatal hit on the player gets a short in-character Luke bark, the
// same treatment the convoy gets on saveBark. Skipped on the fatal hit —
// STRINGS.playerHits only has entries for hearts still remaining, and the
// game-over overlay would cover the panel anyway.
function onPlayerHit(world) {
  const { player, dialog, audio } = world;
  if (!dialog) return;
  const line = STRINGS.playerHits[player.maxHearts - player.hearts - 1];
  if (line) dialog.push('luke', line, { portrait: 'portrait_luke' });
  if (audio) audio.play('lukeRadio');
}

// Any damage reaching the convoy consumes a heart and triggers a Grogu save.
function onConvoyHit(world) {
  const { convoy, score, audio, dialog, state } = world;
  const landed = convoy.takeHit(1);
  if (!landed) return; // grace window blocked it

  score.heartLost();
  const saveIndex = convoy.maxHearts - convoy.hearts; // 1..3
  if (dialog) dialog.saveBark(saveIndex - 1);

  if (saveIndex === 1) {
    state.savedOnce = true;
    world.fx.greenFlash = 1;
    if (audio) audio.play('save1');
    world.fx.addShake(6);
  } else if (saveIndex === 2) {
    state.groguTired = true;
    world.fx.redTint = 1;
    if (audio) audio.play('save2');
    world.fx.addShake(8);
  } else if (saveIndex >= 3) {
    state.groguSpent = true;
    if (audio) audio.play('save3');
    if (!state.pendingConvoyDeath) {
      state.pendingConvoyDeath = true;
      state.slowmo = CONFIG.slowmo.convoySave3Seconds;
    }
  }
}
