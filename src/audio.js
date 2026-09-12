// Short authored SFX are preferred; synthesized sounds remain as a fallback so
// a slow network or a missing optional asset never breaks gameplay audio.

import { CONFIG } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.enabled = false;
    this.buffers = new Map();
    this.loading = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
      this.loading = this._loadBuffers();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.value = m ? 0 : CONFIG.audio.masterVolume;
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  async _loadBuffers() {
    const sounds = {
      playerShot: 'assets/audio/gameplay/player_shot.ogg',
      enemyShot: 'assets/audio/gameplay/enemy_shot.ogg',
      heavyCharge: 'assets/audio/gameplay/heavy_charge.ogg',
      explosionSmall: 'assets/audio/gameplay/explosion_small.ogg',
      explosionLarge: 'assets/audio/gameplay/explosion_large.ogg',
      impactMetal: 'assets/audio/gameplay/impact_metal.ogg',
      forceCharge: 'assets/audio/gameplay/force_charge.ogg',
      forceDeflect: 'assets/audio/gameplay/force_deflect.ogg',
      engineBurst: 'assets/audio/gameplay/engine_burst.ogg',
      hyperspaceArrival: 'assets/audio/gameplay/hyperspace_arrival.ogg',
      menuConfirm: 'assets/audio/ui/menu_confirm.ogg',
      menuMove: 'assets/audio/ui/menu_move.ogg',
      cooldownReady: 'assets/audio/ui/cooldown_ready.ogg',
      warningLock: 'assets/audio/ui/warning_lock.ogg',
      groguEffort: 'assets/audio/characters/grogu_effort.ogg',
      groguTired: 'assets/audio/characters/grogu_tired.ogg',
      groguExhausted: 'assets/audio/characters/grogu_exhausted.ogg',
      mandoBreath: 'assets/audio/characters/mando_breath.ogg',
      mandoAlarm: 'assets/audio/characters/mando_alarm.ogg',
      mandoRadioCutoff: 'assets/audio/characters/mando_radio_cutoff.ogg',
      lukeRadioBeacon: 'assets/audio/characters/luke_radio_beacon.ogg',
      lukeArrivalSting: 'assets/audio/characters/luke_arrival_sting.ogg',
    };

    await Promise.all(
      Object.entries(sounds).map(async ([name, path]) => {
        try {
          const response = await fetch(path);
          if (!response.ok) return;
          this.buffers.set(name, await this.ctx.decodeAudioData(await response.arrayBuffer()));
        } catch {
          // The synthesized fallback below handles unavailable optional assets.
        }
      })
    );
  }

  _sample(name, { gain = 1, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return false;
    const buffer = this.buffers.get(name);
    if (!buffer) return false;
    const source = this.ctx.createBufferSource();
    const volume = this.ctx.createGain();
    const t = this._now() + delay;
    source.buffer = buffer;
    volume.gain.value = gain;
    source.connect(volume).connect(this.master);
    source.start(t);
    return true;
  }

  _tone({ type = 'sine', freq = 440, freq2, dur = 0.15, gain = 0.3, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this._now() + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.2, gain = 0.3, filter = 1200, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this._now() + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'fire':
        if (this._sample('playerShot', { gain: 0.7 })) break;
        this._tone({ type: 'square', freq: 900, freq2: 220, dur: 0.07, gain: 0.12 });
        break;
      case 'enemyFire':
        if (this._sample('enemyShot', { gain: 0.65 })) break;
        this._tone({ type: 'sawtooth', freq: 320, freq2: 140, dur: 0.09, gain: 0.1 });
        break;
      case 'ionFire':
        if (this._sample('heavyCharge', { gain: 0.75 })) break;
        this._tone({ type: 'sawtooth', freq: 140, freq2: 60, dur: 0.45, gain: 0.18 });
        this._tone({ type: 'square', freq: 70, freq2: 40, dur: 0.45, gain: 0.1, delay: 0.02 });
        break;
      case 'boltDown':
        if (this._sample('impactMetal', { gain: 0.65 })) break;
        this._tone({ type: 'triangle', freq: 1200, freq2: 400, dur: 0.08, gain: 0.12 });
        break;
      case 'explosion':
        if (this._sample('explosionSmall', { gain: 0.8 })) break;
        this._noise({ dur: 0.4, gain: 0.35, filter: 900 });
        this._tone({ type: 'sawtooth', freq: 120, freq2: 40, dur: 0.4, gain: 0.2 });
        break;
      case 'asteroidHit':
        if (this._sample('impactMetal', { gain: 0.8 })) break;
        this._noise({ dur: 0.25, gain: 0.3, filter: 500 });
        break;
      case 'forceOn':
        if (this._sample('forceCharge', { gain: 0.8 })) break;
        this._tone({ type: 'sine', freq: 180, freq2: 420, dur: 0.25, gain: 0.16 });
        break;
      case 'forceOff':
        if (this._sample('forceDeflect', { gain: 0.55 })) break;
        this._tone({ type: 'sine', freq: 420, freq2: 160, dur: 0.2, gain: 0.12 });
        break;
      case 'forceStop':
        if (this._sample('forceDeflect', { gain: 0.7 })) break;
        this._tone({ type: 'sine', freq: 700, freq2: 1500, dur: 0.18, gain: 0.14 });
        break;
      case 'forceEmpty':
        if (this._sample('cooldownReady', { gain: 0.7 })) break;
        this._tone({ type: 'square', freq: 180, freq2: 90, dur: 0.3, gain: 0.16 });
        break;
      case 'save1':
        if (this._sample('groguEffort', { gain: 0.85 })) {
          this._sample('mandoBreath', { gain: 0.65, delay: 0.35 });
          break;
        }
        this._tone({ type: 'sine', freq: 600, freq2: 1200, dur: 0.3, gain: 0.2 });
        this._tone({ type: 'sine', freq: 900, freq2: 1500, dur: 0.3, gain: 0.12, delay: 0.08 });
        break;
      case 'save2':
        if (this._sample('groguTired', { gain: 0.85 })) {
          this._sample('mandoAlarm', { gain: 0.7, delay: 0.4 });
          break;
        }
        this._tone({ type: 'sine', freq: 700, freq2: 300, dur: 0.5, gain: 0.2 });
        break;
      case 'save3':
        if (this._sample('groguExhausted', { gain: 0.9 })) {
          this._sample('mandoRadioCutoff', { gain: 0.75, delay: 0.55 });
          break;
        }
        this._tone({ type: 'sine', freq: 400, freq2: 120, dur: 1.0, gain: 0.22 });
        break;
      case 'victory':
        if (this._sample('lukeRadioBeacon', { gain: 0.65 })) break;
        [523, 659, 784, 1047].forEach((f, i) =>
          this._tone({ type: 'triangle', freq: f, dur: 0.35, gain: 0.18, delay: i * 0.16 })
        );
        break;
      case 'gameover':
        if (this._sample('mandoRadioCutoff', { gain: 0.7 })) break;
        [330, 262, 196, 147].forEach((f, i) =>
          this._tone({ type: 'sawtooth', freq: f, dur: 0.4, gain: 0.16, delay: i * 0.2 })
        );
        break;
      case 'uiClick':
        if (this._sample('menuConfirm', { gain: 0.65 })) break;
        this._tone({ type: 'square', freq: 600, freq2: 800, dur: 0.05, gain: 0.1 });
        break;
      case 'surge':
        if (this._sample('warningLock', { gain: 0.7 })) break;
        this._tone({ type: 'sawtooth', freq: 200, freq2: 500, dur: 0.6, gain: 0.14 });
        break;
      case 'lukeRadio':
        if (this._sample('lukeRadioBeacon', { gain: 0.7 })) break;
        this._tone({ type: 'square', freq: 880, freq2: 1040, dur: 0.16, gain: 0.1 });
        break;
      case 'lukeArrival':
        if (this._sample('hyperspaceArrival', { gain: 0.7 })) {
          this._sample('lukeArrivalSting', { gain: 0.75, delay: 0.25 });
          break;
        }
        this._tone({ type: 'sawtooth', freq: 200, freq2: 500, dur: 0.6, gain: 0.14 });
        break;
      case 'convoyExplosion':
        if (this._sample('explosionLarge', { gain: 0.9 })) break;
        this._noise({ dur: 0.8, gain: 0.4, filter: 700 });
        this._tone({ type: 'sawtooth', freq: 110, freq2: 32, dur: 0.8, gain: 0.24 });
        break;
      default:
        break;
    }
  }
}
