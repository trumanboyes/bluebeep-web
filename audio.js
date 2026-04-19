'use strict';

// ── MF (Multi-Frequency) tone pairs — CCITT SS5 ──────────────────────────────
// Each digit is composed of 2 frequencies from the set: 700, 900, 1100, 1300, 1500, 1700 Hz
const MF_TONES = {
  '1':  [700,  900],
  '2':  [700,  1100],
  '3':  [900,  1100],
  '4':  [700,  1300],
  '5':  [900,  1300],
  '6':  [1100, 1300],
  '7':  [700,  1500],
  '8':  [900,  1500],
  '9':  [1100, 1500],
  '0':  [1300, 1500],
  '11': [700,  1700],  // C11
  '12': [900,  1700],  // C12
  'KP': [1100, 1700],  // Key Pulse — start of pulsing
  'KP2':[1300, 1700],  // Key Pulse 2
  'ST': [1500, 1700],  // Start — end of pulsing
  'STP':[900,  1700],  // ST prime (alternate)
};

// ── DTMF tone pairs ───────────────────────────────────────────────────────────
const DTMF_ROW = [697, 770, 852, 941];
const DTMF_COL = [1209, 1336, 1477, 1633];
const DTMF_MAP = {
  '1': [DTMF_ROW[0], DTMF_COL[0]], '2': [DTMF_ROW[0], DTMF_COL[1]],
  '3': [DTMF_ROW[0], DTMF_COL[2]], 'A': [DTMF_ROW[0], DTMF_COL[3]],
  '4': [DTMF_ROW[1], DTMF_COL[0]], '5': [DTMF_ROW[1], DTMF_COL[1]],
  '6': [DTMF_ROW[1], DTMF_COL[2]], 'B': [DTMF_ROW[1], DTMF_COL[3]],
  '7': [DTMF_ROW[2], DTMF_COL[0]], '8': [DTMF_ROW[2], DTMF_COL[1]],
  '9': [DTMF_ROW[2], DTMF_COL[2]], 'C': [DTMF_ROW[2], DTMF_COL[3]],
  '*': [DTMF_ROW[3], DTMF_COL[0]], '0': [DTMF_ROW[3], DTMF_COL[1]],
  '#': [DTMF_ROW[3], DTMF_COL[2]], 'D': [DTMF_ROW[3], DTMF_COL[3]],
};

class BlueBEEPAudio {
  constructor() {
    this.ctx = null;
    this.gainNode = null;
    this.oscillators = [];
    this.analyser = null;
    this.activeFreqs = [];
    this.onToneStart = null;
    this.onToneStop = null;
  }

  _ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  _stopAll() {
    this.oscillators.forEach(o => {
      try { o.stop(); o.disconnect(); } catch (_) {}
    });
    this.oscillators = [];
    this.activeFreqs = [];
  }

  _playFreqs(freqs, label, type = 'sine') {
    this._ensureContext();
    this._stopAll();
    this.activeFreqs = freqs;

    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(this.gainNode);
      osc.start();
      this.oscillators.push(osc);
    });

    if (this.onToneStart) this.onToneStart(freqs, label);
  }

  // Play a short MF burst (like pressing a key)
  playMFBurst(key) {
    const freqs = MF_TONES[key];
    if (!freqs) return;
    this._playFreqs(freqs, `MF ${key}`);
    setTimeout(() => this.stop(), key === 'KP' || key === 'KP2' ? 100 : 60);
  }

  // Play DTMF (brief burst)
  playDTMFBurst(key) {
    const freqs = DTMF_MAP[key];
    if (!freqs) return;
    this._playFreqs(freqs, `DTMF ${key}`);
    setTimeout(() => this.stop(), 120);
  }

  // Toggle 2600 Hz — returns true if now active
  toggle2600() {
    if (this.oscillators.length > 0 && this.activeFreqs[0] === 2600) {
      this.stop();
      return false;
    }
    this._playFreqs([2600], 'SEIZURE 2600Hz');
    return true;
  }

  stop() {
    const freqs = [...this.activeFreqs];
    this._stopAll();
    if (this.onToneStop) this.onToneStop(freqs);
  }

  getAnalyser() {
    this._ensureContext();
    return this.analyser;
  }

  get isActive() { return this.oscillators.length > 0; }
  get currentFreqs() { return this.activeFreqs; }
}

window.BlueBEEPAudio = BlueBEEPAudio;
window.MF_TONES = MF_TONES;
window.DTMF_MAP = DTMF_MAP;
