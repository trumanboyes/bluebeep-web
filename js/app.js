'use strict';

import { BlueBEEPAudio } from './audio.js';
import { startBoot } from './boot.js';
import { startOscilloscope } from './scope.js';
import {
  DTMF_MAP,
  MF_INTERDIGIT_MS,
  MF_TONES,
  formatFreqs,
  mfBurstMs,
  parseSequence,
} from './tones.js';

const $ = (id) => document.getElementById(id);

const els = {
  bootText: $('boot-text'),
  bootScreen: $('boot-screen'),
  mainScreen: $('main-screen'),
  btn2600: $('btn-2600'),
  seizureLevel: $('seizure-level'),
  volume: $('volume'),
  volumeValue: $('volume-value'),
  activeTones: $('active-tones'),
  signalType: $('signal-type'),
  signalDuration: $('signal-duration'),
  signalLog: $('signal-log'),
  statusLeft: $('status-left'),
  statusRight: $('status-right'),
  scope: $('scope'),
  mfSequence: $('mf-sequence'),
  btnPulse: $('btn-pulse'),
  btnClearLog: $('btn-clear-log'),
  keyMode: $('key-mode'),
};

const MF_HOTKEYS = Object.freeze({
  k: 'KP',
  l: 'KP2',
  p: 'KP2',
  t: 'ST',
  y: 'STP',
  u: '11',
  i: '12',
});

const DTMF_LETTER_KEYS = Object.freeze({
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
});

const audio = new BlueBEEPAudio();
const state = {
  keyMode: 'mf',
  durationTimer: 0,
  toneStartedAt: 0,
  pulsing: false,
  abortPulse: false,
  heldDtmf: null,
  started: false,
};

function setStatus(msg) {
  els.statusLeft.textContent = msg;
}

function syncSeizureUI() {
  const on = audio.isSeizure;
  els.btn2600.classList.toggle('active', on);
  els.btn2600.setAttribute('aria-pressed', on ? 'true' : 'false');
  els.btn2600.textContent = on ? '■ TRANSMITTING 2600 Hz...' : '▶ SEND 2600 Hz TONE';
  els.seizureLevel.textContent = on ? '█████ ON' : '─── OFF';
}

function updateMonitor(freqs, label) {
  els.activeTones.textContent = formatFreqs(freqs);
  els.signalType.textContent = label;
}

function clearMonitor() {
  els.activeTones.textContent = '─ NONE ─';
  els.signalType.textContent = '─ IDLE ─';
  els.signalDuration.textContent = '0 ms';
  els.signalDuration.classList.remove('counting');
}

function startDurationCount() {
  state.toneStartedAt = Date.now();
  els.signalDuration.classList.add('counting');
  window.clearInterval(state.durationTimer);
  state.durationTimer = window.setInterval(() => {
    els.signalDuration.textContent = `${Date.now() - state.toneStartedAt} ms`;
  }, 50);
}

function stopDurationCount() {
  window.clearInterval(state.durationTimer);
  state.durationTimer = 0;
}

function logSignal(freqs, label) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const ts = document.createElement('span');
  ts.className = 'ts';
  ts.textContent = `[${time}]`;

  const sig = document.createElement('span');
  sig.className = 'sig';
  sig.textContent = label;

  const freq = document.createElement('span');
  freq.className = 'freqs';
  freq.textContent = freqs.map((hz) => `${hz}Hz`).join('+');

  entry.append(ts, ' ', sig, ' ', freq);
  els.signalLog.prepend(entry);
  while (els.signalLog.children.length > 50) {
    els.signalLog.removeChild(els.signalLog.lastChild);
  }
}

function flash(button) {
  if (!button) return;
  button.classList.add('lit');
  window.setTimeout(() => button.classList.remove('lit'), 180);
}

function mfButton(key) {
  return document.querySelector(`.mf-btn[data-mf="${CSS.escape(key)}"]`);
}

function dtmfButton(key) {
  return document.querySelector(`.dtmf-btn[data-dtmf="${CSS.escape(key)}"]`);
}

async function readyAudio() {
  try {
    await audio.ensureContext();
    return true;
  } catch (err) {
    setStatus(`Audio unavailable: ${err.message}`);
    return false;
  }
}

async function playMF(key) {
  if (!MF_TONES[key] || state.pulsing) return;
  if (!(await readyAudio())) return;
  audio.playMFBurst(key);
  flash(mfButton(key));
  setStatus(`MF ${key}: ${formatFreqs(MF_TONES[key])}`);
}

async function startDTMF(key) {
  if (!DTMF_MAP[key] || state.pulsing) return;
  state.heldDtmf = key;
  if (!(await readyAudio())) {
    if (state.heldDtmf === key) state.heldDtmf = null;
    return;
  }
  if (state.heldDtmf !== key) return;
  audio.playDTMF(key, { hold: true });
  dtmfButton(key)?.classList.add('lit');
  setStatus(`DTMF ${key}: ${formatFreqs(DTMF_MAP[key])}`);
}

function stopDTMF(key) {
  if (state.heldDtmf !== key) return;
  state.heldDtmf = null;
  dtmfButton(key)?.classList.remove('lit');
  if (audio.isActive && !audio.isSeizure) audio.stop();
}

async function toggleSeizure() {
  if (state.pulsing) return;
  if (!(await readyAudio())) return;
  const on = audio.toggle2600();
  syncSeizureUI();
  setStatus(on ? 'Transmitting 2600 Hz trunk seizure tone...' : 'Tone stopped.');
}

async function pulseSequence() {
  if (state.pulsing) return;
  const keys = parseSequence(els.mfSequence.value);
  if (keys.length === 0) {
    setStatus('No valid MF tokens. Example: KP 011 ST');
    return;
  }
  if (!(await readyAudio())) return;

  state.pulsing = true;
  state.abortPulse = false;
  els.btnPulse.disabled = true;
  els.mfSequence.disabled = true;
  setStatus(`Pulsing ${keys.length} MF signals...`);

  try {
    for (const key of keys) {
      if (state.abortPulse) {
        setStatus('Sequence aborted.');
        return;
      }
      audio.playMFBurst(key);
      flash(mfButton(key));
      setStatus(`MF ${key}: ${formatFreqs(MF_TONES[key])}`);
      await wait(mfBurstMs(key) + MF_INTERDIGIT_MS);
    }
    setStatus(`Sequence complete (${keys.join(' ')}).`);
  } finally {
    state.pulsing = false;
    els.btnPulse.disabled = false;
    els.mfSequence.disabled = false;
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function bindHoldButton(button, onDown, onUp) {
  const down = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    onDown();
  };
  const up = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    onUp();
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('lostpointercapture', up);
}

function setupPads() {
  els.btn2600.addEventListener('click', (event) => {
    event.preventDefault();
    toggleSeizure();
  });

  document.querySelectorAll('.mf-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      playMF(btn.dataset.mf);
    });
  });

  document.querySelectorAll('.dtmf-btn').forEach((btn) => {
    const key = btn.dataset.dtmf;
    bindHoldButton(btn, () => startDTMF(key), () => stopDTMF(key));
  });

  els.btnPulse.addEventListener('click', (event) => {
    event.preventDefault();
    pulseSequence();
  });

  els.mfSequence.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pulseSequence();
    }
  });

  els.btnClearLog.addEventListener('click', () => {
    els.signalLog.replaceChildren();
    setStatus('Signal log cleared.');
  });

  els.volume.addEventListener('input', () => {
    const pct = Number(els.volume.value);
    audio.setVolume(pct / 100);
    els.volumeValue.textContent = `${pct}%`;
  });

  els.keyMode.addEventListener('click', () => {
    state.keyMode = state.keyMode === 'mf' ? 'dtmf' : 'mf';
    els.keyMode.textContent = `KEYS: ${state.keyMode.toUpperCase()}`;
    els.keyMode.setAttribute('aria-pressed', state.keyMode === 'dtmf' ? 'true' : 'false');
    setStatus(`Keyboard mapped to ${state.keyMode.toUpperCase()} tones.`);
  });
}

function isTypingTarget(el) {
  return el instanceof HTMLElement && el.matches('input, textarea, select, [contenteditable="true"]');
}

function setupKeyboard() {
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey) return;
    if (isTypingTarget(event.target)) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      state.abortPulse = true;
      audio.stop();
      syncSeizureUI();
      setStatus('All tones stopped.');
      return;
    }

    if (event.code === 'Space') {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      toggleSeizure();
      return;
    }

    if (event.target instanceof HTMLButtonElement) return;

    const key = event.key;

    if (state.keyMode === 'mf') {
      if (MF_TONES[key]) {
        event.preventDefault();
        playMF(key);
        return;
      }
      const mapped = MF_HOTKEYS[key.toLowerCase()];
      if (mapped) {
        event.preventDefault();
        playMF(mapped);
      }
      return;
    }

    if (DTMF_MAP[key]) {
      event.preventDefault();
      startDTMF(key);
      return;
    }
    const letter = DTMF_LETTER_KEYS[key.toLowerCase()];
    if (letter) {
      event.preventDefault();
      startDTMF(letter);
    }
  });

  window.addEventListener('keyup', (event) => {
    if (state.keyMode !== 'dtmf' || isTypingTarget(event.target)) return;
    const key = DTMF_MAP[event.key] ? event.key : DTMF_LETTER_KEYS[event.key.toLowerCase()];
    if (key) stopDTMF(key);
  });
}

function initApp() {
  if (state.started) return;
  state.started = true;

  audio.setVolume(Number(els.volume.value) / 100);
  audio.onToneStart = (freqs, label) => {
    syncSeizureUI();
    updateMonitor(freqs, label);
    logSignal(freqs, label);
    startDurationCount();
  };
  audio.onToneStop = () => {
    syncSeizureUI();
    clearMonitor();
    stopDurationCount();
  };

  setupPads();
  setupKeyboard();
  startOscilloscope(els.scope, audio);
  readyAudio();
  setStatus('Ready. Click a pad, type a sequence, or use the keyboard.');
}

startBoot({
  bootText: els.bootText,
  bootScreen: els.bootScreen,
  mainScreen: els.mainScreen,
  onEnter: initApp,
});
