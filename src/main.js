// Boot, fixed-timestep RAF loop and the game state machine.
// Per-tick order: input -> player -> convoy -> enemies -> bolts -> asteroids
// -> force -> collisions -> score/combo -> spawn -> dialog -> particles -> hud.

import { CONFIG, clamp, difficultyAt } from './config.js';
import { STRINGS } from './strings.js?v=leaderboard-2';
import { Input } from './input.js?v=leaderboard-2';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js?v=leaderboard-2';
import { Cinematic } from './cinematic.js';
import { loadAssets } from './assets.js';
import { Player } from './entities/player.js';
import { Convoy } from './entities/convoy.js';
import { EnemySystem } from './entities/enemy.js';
import { BoltSystem } from './entities/bolt.js';
import { AsteroidSystem } from './entities/asteroid.js';
import { ParticleSystem } from './entities/particle.js';
import { SpawnDirector } from './systems/spawn.js';
import { ForceSystem } from './systems/force.js';
import { Score } from './systems/score.js';
import { DialogSystem } from './systems/dialog.js';
import { handleCollisions } from './systems/collision.js';
import { Leaderboard } from './leaderboard.js?v=leaderboard-2';

const STEP = 1 / 60;
const MAX_FRAME = 0.05; // 50 ms cap so alt-tab cannot tunnel collisions

const State = {
  BOOT: 'BOOT',
  TITLE: 'TITLE',
  CINEMATIC: 'CINEMATIC',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER_PLAYER: 'GAMEOVER_PLAYER',
  GAMEOVER_CONVOY: 'GAMEOVER_CONVOY',
  VICTORY: 'VICTORY',
};

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.flags = parseFlags();
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.ui = new UI();
    this.cinematic = new Cinematic();
    this.score = new Score();

    this.player = new Player();
    this.convoy = new Convoy();
    this.enemies = new EnemySystem();
    this.bolts = new BoltSystem();
    this.asteroids = new AsteroidSystem();
    this.particles = new ParticleSystem();
    this.spawn = new SpawnDirector();
    this.force = new ForceSystem();
    this.dialog = new DialogSystem();
    this.leaderboard = new Leaderboard();

    const self = this;
    this.fx = {
      greenFlash: 0,
      redTint: 0,
      surgePulse: 0,
      addShake(amount) {
        self.renderer.addShake(amount);
      },
    };

    this.state = {
      name: State.BOOT,
      elapsed: 0,
      god: !!this.flags.god,
      finalSurge: false,
      lastIonFireAt: null,
      countdown: 0,
      groguTired: false,
      groguSpent: false,
      savedOnce: false,
      pendingConvoyDeath: false,
      slowmo: 0,
    };

    this.world = {
      config: CONFIG,
      strings: STRINGS,
      renderer: this.renderer,
      input: this.input,
      audio: this.audio,
      ui: this.ui,
      score: this.score,
      dialog: this.dialog,
      force: this.force,
      player: this.player,
      convoy: this.convoy,
      enemies: this.enemies,
      bolts: this.bolts,
      asteroids: this.asteroids,
      particles: this.particles,
      spawn: this.spawn,
      fx: this.fx,
      state: this.state,
      leaderboard: this.leaderboard,
    };

    this.acc = 0;
    this.last = performance.now();
    this.raf = 0;
    this.frameMs = 16;
    this._pauseHeld = false;
    this._skipPrev = false;
    this.cinematicSeen = false;
    this._bindAudioUnlock();
  }

  _bindAudioUnlock() {
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async boot() {
    await loadAssets();
    if (this.flags.skipintro) {
      this.startMatch();
    } else {
      this.state.name = State.TITLE;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    const frameMs = dt * 1000;
    this.frameMs += (frameMs - this.frameMs) * 0.1;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    this.step(dt);
    this.render(dt);
  }

  step(dt) {
    const s = this.state;
    this.handleGlobalInput();

    if (s.name === State.TITLE) {
      this.stepTitle();
      return;
    }
    if (s.name === State.CINEMATIC) {
      const advanceKey = this.input.isDown('Space') || this.input.isDown('Enter');
      const keyEdge = advanceKey && !this._skipPrev;
      this._skipPrev = advanceKey;
      if (this.input.consumeClick() || keyEdge) {
        this.audio.play('uiClick');
        this.cinematic.skip();
      }
      this.cinematic.update(dt, this.world);
      if (this.cinematic.finished) this.startMatch();
      return;
    }
    if (s.name === State.PAUSED) {
      return;
    }
    if (
      s.name === State.GAMEOVER_PLAYER ||
      s.name === State.GAMEOVER_CONVOY ||
      s.name === State.VICTORY
    ) {
      this.particles.update(dt);
      this.dialog.update(dt);
      this.decayFx(dt);
      return;
    }
    if (s.name !== State.PLAYING) return;

    // --- slow-motion third save: everything else freezes ---
    if (s.pendingConvoyDeath) {
      s.slowmo -= dt;
      this.particles.update(dt * 0.3);
      this.dialog.update(dt);
      this.decayFx(dt);
      if (s.slowmo <= 0) {
        this.explodeConvoy();
        this.endMatch(State.GAMEOVER_CONVOY);
      }
      return;
    }

    // fixed-timestep accumulator
    this.acc += dt;
    let guard = 0;
    while (this.acc >= STEP && guard < 5) {
      this.tick(STEP);
      this.acc -= STEP;
      guard++;
    }
    if (guard >= 5) this.acc = 0;
  }

  tick(dt) {
    const w = this.world;
    const s = this.state;
    s.elapsed += dt;
    const difficulty = difficultyAt(s.elapsed);

    // input -> player
    this.player.update(dt, this.input, w);
    // -> convoy
    this.convoy.update(dt);
    // -> enemies
    this.enemies.update(dt, w);
    // -> bolts
    this.bolts.update(dt);
    // -> asteroids
    this.asteroids.update(dt);
    // -> force field
    this.force.update(dt, w);
    // -> collisions
    handleCollisions(w);
    // -> score / combo
    this.score.survival(dt);
    this.score.update(dt);
    // -> spawn director
    this.spawn.update(dt, w, difficulty);
    // -> dialog
    this.dialog.update(dt);
    // -> particles
    this.particles.update(dt);
    // -> fx decay
    this.decayFx(dt);
    if (s.countdown > 0) s.countdown -= dt;

    if (s.finalSurge) this.fx.surgePulse = 0.5 + Math.sin(s.elapsed * 8) * 0.5;

    // --- end conditions ---
    if (!this.player.alive) {
      this.endMatch(State.GAMEOVER_PLAYER);
      return;
    }
    if (s.elapsed >= CONFIG.MATCH_SECONDS) {
      this.endMatch(State.VICTORY);
    }
  }

  decayFx(dt) {
    const f = this.fx;
    if (f.greenFlash > 0) f.greenFlash = Math.max(0, f.greenFlash - dt * 1.6);
    if (f.redTint > 0 && !this.state.groguTired) {
      f.redTint = Math.max(0, f.redTint - dt * 0.8);
    } else if (this.state.groguTired) {
      f.redTint = Math.min(0.55, f.redTint + dt * 0.8);
    }
  }

  handleGlobalInput() {
    const s = this.state;
    // pause toggle on rising edge
    const paused = this.input.pausePressed();
    if (paused && !this._pauseHeld) {
      if (s.name === State.PLAYING) s.name = State.PAUSED;
      else if (s.name === State.PAUSED) s.name = State.PLAYING;
    }
    this._pauseHeld = paused;

    if (s.name === State.TITLE) return;

    if (this.input.restartPressed()) {
      if (
        s.name === State.GAMEOVER_PLAYER ||
        s.name === State.GAMEOVER_CONVOY ||
        s.name === State.VICTORY ||
        s.name === State.PAUSED
      ) {
        this.startMatch();
      }
    }

    // gameover: click to restart
    if (
      (s.name === State.GAMEOVER_PLAYER ||
        s.name === State.GAMEOVER_CONVOY ||
        s.name === State.VICTORY) &&
      this.input.consumeClick()
    ) {
      this.startMatch();
      return;
    }

    // mute button
    if (
      (s.name === State.PLAYING || s.name === State.PAUSED) &&
      this.input.consumeClick()
    ) {
      const m = this.ui.muteRect;
      if (this.ui.hit(m, this.input.mouse.x, this.input.mouse.y)) {
        this.audio.toggleMute();
        this.audio.play('uiClick');
      }
    }
  }

  stepTitle() {
    const click = this.input.consumeClick();
    const advance = this.input.isDown('Space') || this.input.isDown('Enter');
    const m = this.input.mouse;
    if (click) {
      if (this.ui.hit(this.ui.storyRect, m.x, m.y)) {
        this.audio.play('uiClick');
        this.cinematicSeen = true;
        this._skipPrev = this.input.isDown('Space') || this.input.isDown('Enter');
        this.cinematic.reset();
        this.state.name = State.CINEMATIC;
        return;
      }
      if (this.ui.hit(this.ui.leaderboardRect, m.x, m.y)) {
        this.leaderboard.showBoard();
        return;
      }
      this.beginFromTitle();
      return;
    }
    if (advance) this.beginFromTitle();
  }

  beginFromTitle() {
    if (!this.leaderboard.getName()) {
      this.leaderboard.requestName(() => this.beginFromTitle());
      return;
    }
    this.audio.play('uiClick');
    this._skipPrev = this.input.isDown('Space') || this.input.isDown('Enter');
    if (!this.cinematicSeen) {
      this.cinematicSeen = true;
      this.cinematic.reset();
      this.state.name = State.CINEMATIC;
    } else {
      this.startMatch();
    }
  }

  startMatch() {
    if (!this.leaderboard.getName()) {
      if (this._namePromptPending) return;
      this._namePromptPending = true;
      this.leaderboard.requestName(() => {
        this._namePromptPending = false;
        this.startMatch();
      });
      return;
    }
    // reset pooled state in place; no reload, no cinematic
    this.player.reset();
    this.convoy.reset();
    this.enemies.reset();
    this.bolts.reset();
    this.asteroids.reset();
    this.particles.reset();
    this.spawn.reset();
    this.force.reset();
    this.dialog.reset();
    this.score.reset();

    const s = this.state;
    s.elapsed = this.flags.t || 0;
    s.god = !!this.flags.god;
    s.finalSurge = false;
    s.lastIonFireAt = null;
    s.countdown = 1.4;
    s.groguTired = false;
    s.groguSpent = false;
    s.savedOnce = false;
    s.pendingConvoyDeath = false;
    s.slowmo = 0;
    s.name = State.PLAYING;
    this.audio.play('engineBurst');

    this.fx.greenFlash = 0;
    this.fx.redTint = 0;
    this.fx.surgePulse = 0;
    this.acc = 0;
    this.last = performance.now();
  }

  explodeConvoy() {
    this.particles.burst(this.convoy.x, this.convoy.y, 60, '#ffd166', 520, 1.0, 7);
    this.particles.burst(this.convoy.x, this.convoy.y, 40, '#ff7a5a', 380, 0.9, 6);
    this.particles.explode(this.convoy.x, this.convoy.y, 'fx_explosion_big', 2.4, 16);
    this.fx.addShake(34);
    this.audio.play('convoyExplosion');
  }

  endMatch(result) {
    const s = this.state;
    if (s.name === State.GAMEOVER_CONVOY || s.name === State.GAMEOVER_PLAYER || s.name === State.VICTORY) {
      return;
    }
    s.name = result;
    s.pendingConvoyDeath = false;
    if (result === State.VICTORY) {
      this.score.finish(this.player.hearts, this.convoy.hearts);
      this.audio.play('victory');
    } else {
      this.score.finishLoss();
      this.audio.play('gameover');
    }
    void this.leaderboard.submitScore(this.score.score);
  }

  // -------------------------------------------------------------------------
  render(dt) {
    const r = this.renderer;
    const s = this.state;
    const timeScale = s.slowmo > 0 ? 0.3 : 1;
    r.begin(dt, timeScale);
    this.input.setView(r.scale, r.padX, r.padY);

    if (s.name === State.CINEMATIC || s.name === State.TITLE) {
      if (s.name === State.CINEMATIC) this.cinematic.draw(r.ctx, this.world);
      r.end();
    } else {
      this.drawWorld(r.ctx);
      r.end();
    }

    // screen-space fx
    if (this.fx.greenFlash > 0) {
      r.wholeTint('rgba(90,240,150,1)', this.fx.greenFlash * 0.35);
    }
    if (this.fx.redTint > 0) {
      r.edgeTint('rgba(190,20,30,0.85)', this.fx.redTint);
    }
    if (s.pendingConvoyDeath) {
      r.wholeTint('rgba(0,0,0,1)', 0.25 * (1 - clamp(s.slowmo / CONFIG.slowmo.convoySave3Seconds, 0, 1)));
    }

    // HUD / screens
    r.hudBegin();
    if (
      s.name === State.PLAYING ||
      s.name === State.PAUSED ||
      s.name === State.GAMEOVER_PLAYER ||
      s.name === State.GAMEOVER_CONVOY ||
      s.name === State.VICTORY
    ) {
      this.ui.drawHUD(r.ctx, this.world);
      this.ui.drawCountdown(r.ctx, s);
      this.dialog.draw(r.ctx);
    }
    if (s.name === State.TITLE) this.ui.drawTitle(r.ctx, this.world);
    if (s.name === State.PAUSED) this.ui.drawPaused(r.ctx, this.world);
    if (s.name === State.GAMEOVER_PLAYER) this.ui.drawGameOver(r.ctx, this.world, 'player');
    if (s.name === State.GAMEOVER_CONVOY) this.ui.drawGameOver(r.ctx, this.world, 'convoy');
    if (s.name === State.VICTORY) this.ui.drawGameOver(r.ctx, this.world, 'victory');

    if (this.flags.fps) {
      r.ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
      r.ctx.font = 'bold 16px monospace';
      r.ctx.textAlign = 'left';
      r.ctx.fillStyle = '#8fe3ff';
      r.ctx.fillText(`${(1000 / Math.max(1, this.frameMs)).toFixed(0)} fps`, r.cssW - 90, r.cssH - 14);
    }
    r.hudEnd();
  }

  drawWorld(ctx) {
    const s = this.state;
    // convoy
    this.convoy.draw(ctx);
    // asteroids
    this.asteroids.draw(ctx);
    // enemies
    this.enemies.draw(ctx);
    // telegraphs
    this.enemies.drawTelegraphs(ctx, this.convoy);
    // bolts
    this.bolts.draw(ctx);
    // particles
    this.particles.draw(ctx);
    // player + cannons
    this.player.draw(ctx);
    // force field
    this.force.draw(ctx, this.player, this.input);
    // reticle
    if (s.name === State.PLAYING) {
      this.player.drawReticle(ctx, this.input, this.player.forceActive);
    }

    if (this.flags.hitbox) this.drawHitboxes(ctx);
  }

  drawHitboxes(ctx) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00ff88';
    circle(ctx, this.player.x, this.player.y, this.player.hitRadius);
    ctx.strokeStyle = '#00ccff';
    circle(ctx, this.convoy.x, this.convoy.y, this.convoy.hitRadius);
    ctx.strokeStyle = '#ff00ff';
    for (let i = 0; i < this.bolts.cap; i++) {
      const b = this.bolts.pool[i];
      if (b.active) circle(ctx, b.x, b.y, b.r);
    }
    ctx.strokeStyle = '#ff5555';
    for (let i = 0; i < this.enemies.cap; i++) {
      const e = this.enemies.pool[i];
      if (e.active) circle(ctx, e.x, e.y, e.hitRadius);
    }
    ctx.strokeStyle = '#ffff00';
    for (let i = 0; i < this.asteroids.cap; i++) {
      const a = this.asteroids.pool[i];
      if (a.active) circle(ctx, a.x, a.y, a.r);
    }
    ctx.restore();
  }
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function parseFlags() {
  const params = new URLSearchParams(window.location.search);
  const num = params.get('t');
  return {
    skipintro: params.get('skipintro') === '1',
    hitbox: params.get('hitbox') === '1',
    fps: params.get('fps') === '1',
    god: params.get('god') === '1',
    t: num !== null && !Number.isNaN(parseFloat(num)) ? parseFloat(num) : 0,
  };
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.game = game; // dev console access
game.boot();
