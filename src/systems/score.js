// Points, combo multiplier and personal best. Combo resets to 1.0 whenever any
// heart is lost — the player's or the convoy's.

import { CONFIG, clamp } from '../config.js';

const BEST_KEY = 'protect-the-foundling.best';

export class Score {
  constructor() {
    this.best = this._loadBest();
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 1.0;
    this.linger = 0;
    this.kills = 0;
    this.boltsDown = 0;
    this.forceSaves = 0;
    this.deflections = 0;
    this.survivalAccum = 0;
    this.newBest = false;
  }

  _loadBest() {
    try {
      return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  _saveBest() {
    try {
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem(BEST_KEY, String(this.best));
        this.newBest = true;
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }

  _add(points, withCombo = true) {
    const gained = withCombo ? Math.round(points * this.combo) : points;
    this.score += gained;
    return gained;
  }

  enemyKill() {
    this.kills++;
    this._add(CONFIG.score.enemyKill);
    this.combo = Math.min(CONFIG.score.comboMax, this.combo + CONFIG.score.comboStep);
    this.linger = CONFIG.score.comboLingerSeconds;
  }

  boltShotDown() {
    this.boltsDown++;
    this._add(CONFIG.score.boltShotDown);
  }

  forceSave() {
    this.forceSaves++;
    this._add(CONFIG.score.forceSave);
  }

  asteroidDeflect() {
    this.deflections++;
    this._add(CONFIG.score.asteroidDeflect);
  }

  asteroidKill(points) {
    this._add(points);
  }

  survival(dt) {
    this.survivalAccum += CONFIG.score.survivalPerSec * dt;
    if (this.survivalAccum >= 1) {
      const whole = Math.floor(this.survivalAccum);
      this.score += whole;
      this.survivalAccum -= whole;
    }
  }

  heartLost() {
    this.combo = 1.0;
    this.linger = 0;
  }

  update(dt) {
    if (this.linger > 0) {
      this.linger -= dt;
    } else if (this.combo > 1.0) {
      this.combo = Math.max(
        1.0,
        this.combo - CONFIG.score.comboLingerDrainPerSec * dt
      );
    }
  }

  finish(playerHearts, convoyHearts) {
    const bonus =
      CONFIG.score.victoryBonus +
      CONFIG.score.heartBonus * (playerHearts + convoyHearts);
    this.score += bonus;
    this._saveBest();
    return bonus;
  }

  finishLoss() {
    this._saveBest();
  }

  comboFrac() {
    return clamp((this.combo - 1) / (CONFIG.score.comboMax - 1), 0, 1);
  }
}