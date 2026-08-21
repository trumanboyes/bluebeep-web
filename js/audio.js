'use strict';

import { DTMF_MAP, MF_TONES, SEIZURE_HZ, mfBurstMs } from './tones.js';

const ATTACK_S = 0.004;
const RELEASE_S = 0.01;
const DEFAULT_GAIN = 0.35;

function AudioContextCtor() {
  return window.AudioContext || window.webkitAudioContext;
}

export class BlueBEEPAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.env = null;
    this.oscillators = [];
    this.activeFreqs = [];
    this.activeLabel = '';
    this.generation = 0;
    this.burstTimer = 0;
    this.volume = DEFAULT_GAIN;
    this.onToneStart = null;
    this.onToneStop = null;
  }

  _createGraph() {
    const Ctor = AudioContextCtor();
    if (!Ctor) return null;
    if (this.ctx) return this.ctx;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return this.ctx;
  }

  async ensureContext() {
    if (!this._createGraph()) {
      throw new Error('Web Audio API is not available in this browser.');
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.volume, now, 0.02);
    }
  }

  get isActive() {
    return this.oscillators.length > 0;
  }

  get isSeizure() {
    return this.isActive && this.activeFreqs.length === 1 && this.activeFreqs[0] === SEIZURE_HZ;
  }

  get currentFreqs() {
    return this.activeFreqs.slice();
  }

  getAnalyser() {
    return this.analyser;
  }

  playMFBurst(key) {
    const freqs = MF_TONES[key];
    if (!freqs) return;
    this._playFreqs(freqs, `MF ${key}`);
    this._armBurst(mfBurstMs(key));
  }

  playDTMF(key, { hold = false } = {}) {
    const freqs = DTMF_MAP[key];
    if (!freqs) return;
    this._playFreqs(freqs, `DTMF ${key}`);
    if (!hold) this._armBurst(120);
  }

  toggle2600() {
    if (this.isSeizure) {
      this.stop();
      return false;
    }
    this._playFreqs([SEIZURE_HZ], `SEIZURE ${SEIZURE_HZ}Hz`);
    return true;
  }

  stop() {
    const hadTone = this.isActive || this.activeLabel;
    this._stopVoices();
    if (hadTone && this.onToneStop) this.onToneStop();
  }

  _armBurst(ms) {
    this._clearBurstTimer();
    const gen = this.generation;
    this.burstTimer = window.setTimeout(() => {
      this.burstTimer = 0;
      if (this.generation === gen) this.stop();
    }, ms);
  }

  _clearBurstTimer() {
    if (this.burstTimer) {
      window.clearTimeout(this.burstTimer);
      this.burstTimer = 0;
    }
  }

  _playFreqs(freqs, label) {
    this._stopVoices();
    if (!this._createGraph()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + ATTACK_S);
    env.connect(this.master);

    const oscs = freqs.map((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(env);
      osc.start(now);
      return osc;
    });

    this.generation += 1;
    this.env = env;
    this.oscillators = oscs;
    this.activeFreqs = freqs.slice();
    this.activeLabel = label;
    if (this.onToneStart) this.onToneStart(this.activeFreqs, label);
  }

  _stopVoices() {
    this._clearBurstTimer();
    const oscs = this.oscillators;
    const env = this.env;
    const ctx = this.ctx;
    this.oscillators = [];
    this.env = null;
    this.activeFreqs = [];
    this.activeLabel = '';

    if (!ctx || oscs.length === 0) return;

    const now = ctx.currentTime;
    try {
      if (env) {
        env.gain.cancelScheduledValues(now);
        const current = env.gain.value;
        env.gain.setValueAtTime(current, now);
        env.gain.linearRampToValueAtTime(0, now + RELEASE_S);
      }
      oscs.forEach((osc) => {
        try { osc.stop(now + RELEASE_S + 0.002); } catch (_) { /* already stopped */ }
      });
    } catch (_) { /* context may be closing */ }

    window.setTimeout(() => {
      oscs.forEach((osc) => {
        try { osc.disconnect(); } catch (_) { /* ignore */ }
      });
      if (env) {
        try { env.disconnect(); } catch (_) { /* ignore */ }
      }
    }, Math.ceil((RELEASE_S + 0.02) * 1000));
  }
}
