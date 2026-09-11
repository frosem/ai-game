// WebAudio synthesized SFX only. No music files. Starts muted; the UI exposes
// an obvious unmute control (voters often play in offices).

import { CONFIG } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = true;
    this.enabled = false;
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
        this._tone({ type: 'square', freq: 900, freq2: 220, dur: 0.07, gain: 0.12 });
        break;
      case 'enemyFire':
        this._tone({ type: 'sawtooth', freq: 320, freq2: 140, dur: 0.09, gain: 0.1 });
        break;
      case 'ionFire':
        this._tone({ type: 'sawtooth', freq: 140, freq2: 60, dur: 0.45, gain: 0.18 });
        this._tone({ type: 'square', freq: 70, freq2: 40, dur: 0.45, gain: 0.1, delay: 0.02 });
        break;
      case 'boltDown':
        this._tone({ type: 'triangle', freq: 1200, freq2: 400, dur: 0.08, gain: 0.12 });
        break;
      case 'explosion':
        this._noise({ dur: 0.4, gain: 0.35, filter: 900 });
        this._tone({ type: 'sawtooth', freq: 120, freq2: 40, dur: 0.4, gain: 0.2 });
        break;
      case 'asteroidHit':
        this._noise({ dur: 0.25, gain: 0.3, filter: 500 });
        break;
      case 'forceOn':
        this._tone({ type: 'sine', freq: 180, freq2: 420, dur: 0.25, gain: 0.16 });
        break;
      case 'forceOff':
        this._tone({ type: 'sine', freq: 420, freq2: 160, dur: 0.2, gain: 0.12 });
        break;
      case 'forceStop':
        this._tone({ type: 'sine', freq: 700, freq2: 1500, dur: 0.18, gain: 0.14 });
        break;
      case 'forceEmpty':
        this._tone({ type: 'square', freq: 180, freq2: 90, dur: 0.3, gain: 0.16 });
        break;
      case 'save1':
        this._tone({ type: 'sine', freq: 600, freq2: 1200, dur: 0.3, gain: 0.2 });
        this._tone({ type: 'sine', freq: 900, freq2: 1500, dur: 0.3, gain: 0.12, delay: 0.08 });
        break;
      case 'save2':
        this._tone({ type: 'sine', freq: 700, freq2: 300, dur: 0.5, gain: 0.2 });
        break;
      case 'save3':
        this._tone({ type: 'sine', freq: 400, freq2: 120, dur: 1.0, gain: 0.22 });
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) =>
          this._tone({ type: 'triangle', freq: f, dur: 0.35, gain: 0.18, delay: i * 0.16 })
        );
        break;
      case 'gameover':
        [330, 262, 196, 147].forEach((f, i) =>
          this._tone({ type: 'sawtooth', freq: f, dur: 0.4, gain: 0.16, delay: i * 0.2 })
        );
        break;
      case 'uiClick':
        this._tone({ type: 'square', freq: 600, freq2: 800, dur: 0.05, gain: 0.1 });
        break;
      case 'surge':
        this._tone({ type: 'sawtooth', freq: 200, freq2: 500, dur: 0.6, gain: 0.14 });
        break;
      default:
        break;
    }
  }
}