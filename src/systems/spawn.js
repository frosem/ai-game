// Difficulty director. Pure interpolation on elapsed time, no wave table.
// Spawn intervals carry +/-25% jitter. Final surge at t = 100 s.

import { CONFIG, lerpPair, randRange } from '../config.js';

export class SpawnDirector {
  constructor() {
    this.reset();
  }

  reset() {
    this.enemyTimer = CONFIG.spawn.initialEnemyTimer;
    this.asteroidTimer = CONFIG.spawn.initialAsteroidTimer;
    this.finalSurgeFired = false;
  }

  update(dt, world, difficulty) {
    const s = CONFIG.spawn;
    const st = world.state;

    if (!this.finalSurgeFired && st.elapsed >= s.finalSurgeAtSeconds) {
      this.finalSurgeFired = true;
      st.finalSurge = true;
      if (world.audio) world.audio.play('surge');
      world.fx.surgePulse = 1;
    }

    const surgeFactor = this.finalSurgeFired ? s.finalSurgeFactor : 1;

    // --- enemies ---
    this.enemyTimer -= dt;
    const maxEnemies = Math.round(lerpPair(s.maxEnemies, difficulty));
    if (this.enemyTimer <= 0) {
      if (world.enemies.activeCount < maxEnemies) {
        const type = pickType(lerpPair(s.lancerShare, difficulty));
        world.enemies.spawn(type, difficulty, world.player, world.convoy);
        this.enemyTimer = this._interval(
          lerpPair(s.enemyIntervalSeconds, difficulty) * surgeFactor
        );
      } else {
        this.enemyTimer = CONFIG.spawn.retryInterval;
      }
    }

    // --- asteroids ---
    this.asteroidTimer -= dt;
    const maxAsteroids = Math.round(lerpPair(s.maxAsteroids, difficulty));
    if (this.asteroidTimer <= 0) {
      if (world.asteroids.activeCount < maxAsteroids) {
        world.asteroids.spawn(difficulty, world.player);
        this.asteroidTimer = this._interval(
          lerpPair(CONFIG.asteroid.intervalSeconds, difficulty) * surgeFactor
        );
      } else {
        this.asteroidTimer = CONFIG.spawn.retryInterval;
      }
    }
  }

  _interval(base) {
    const j = CONFIG.spawn.jitter;
    return base * randRange(1 - j, 1 + j);
  }
}

function pickType(lancerShare) {
  const r = Math.random();
  if (r < lancerShare) return 'lancer';
  // remaining spawns split between interceptors and gunships (gunships threaten the convoy)
  const rest = (r - lancerShare) / (1 - lancerShare || 1);
  return rest < 0.55 ? 'interceptor' : 'gunship';
}