'use strict';

// ── Boot sequence ──────────────────────────────────────────────────────────────
const BOOT_LINES = [
  '',
  '  ██████╗ ██╗     ██╗   ██╗███████╗██████╗ ███████╗███████╗██████╗ ',
  '  ██╔══██╗██║     ██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗',
  '  ██████╔╝██║     ██║   ██║█████╗  ██████╔╝█████╗  █████╗  ██████╔╝',
  '  ██╔══██╗██║     ██║   ██║██╔══╝  ██╔══██╗██╔══╝  ██╔══╝  ██╔═══╝ ',
  '  ██████╔╝███████╗╚██████╔╝███████╗██████╔╝███████╗███████╗██║     ',
  '  ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚═════╝ ╚══════╝╚══════╝╚═╝     ',
  '',
  '        Blue Box Simulator  ─  Web Edition  ─  Educational Only',
  '        Based on BlueBEEP v2.1 by Stefan Scheytt (1993–1995)',
  '',
  '  Initializing audio subsystem...',
  '  Loading SS5 frequency tables...',
  '  Loading MF tone encoder...',
  '  Loading DTMF reference tables...',
  '  Building oscilloscope module...',
  '  All systems nominal.',
  '',
  '  ⚠  FOR EDUCATIONAL AND HISTORICAL PURPOSES ONLY.',
  '     Modern telephone networks are not vulnerable to blue boxing.',
  '',
  '  Press any key to continue...',
];

const bootEl   = document.getElementById('boot-text');
const bootScr  = document.getElementById('boot-screen');
const mainScr  = document.getElementById('main-screen');

let lineIdx = 0;
let charIdx = 0;
let bootDone = false;

function typeNextChar() {
  if (lineIdx >= BOOT_LINES.length) {
    bootDone = true;
    return;
  }
  const line = BOOT_LINES[lineIdx];
  if (charIdx < line.length) {
    bootEl.textContent += line[charIdx];
    charIdx++;
    setTimeout(typeNextChar, line.startsWith('  ██') ? 2 : 12);
  } else {
    bootEl.textContent += '\n';
    lineIdx++;
    charIdx = 0;
    const delay = BOOT_LINES[lineIdx - 1].includes('...') ? 180 : 30;
    setTimeout(typeNextChar, delay);
  }
}

function enterMain() {
  bootScr.classList.add('hidden');
  mainScr.classList.remove('hidden');
  initApp();
}

document.addEventListener('keydown', () => {
  if (bootDone) enterMain();
  else { lineIdx = BOOT_LINES.length; bootDone = true; bootEl.textContent = BOOT_LINES.join('\n') + '\n'; }
}, { once: false });
document.addEventListener('click', () => { if (bootDone) enterMain(); }, { once: true });

typeNextChar();

// ── App init ──────────────────────────────────────────────────────────────────
const audio = new BlueBEEPAudio();
let seizureActive = false;
let seizureStart  = null;
let durationTimer = null;
let signalCount   = 0;

function initApp() {
  setupSeizureButton();
  setupMFButtons();
  setupDTMFButtons();
  startOscilloscope();

  audio.onToneStart = (freqs, label) => {
    updateMonitor(freqs, label);
    logSignal(freqs, label);
    startDurationCount();
  };
  audio.onToneStop = () => {
    clearMonitor();
    stopDurationCount();
  };
}

// ── 2600 Hz seizure button ────────────────────────────────────────────────────
function setupSeizureButton() {
  const btn   = document.getElementById('btn-2600');
  const level = document.getElementById('seizure-level');

  btn.addEventListener('mousedown', () => {
    seizureActive = audio.toggle2600();
    if (seizureActive) {
      btn.classList.add('active');
      btn.textContent = '■ TRANSMITTING 2600 Hz...';
      level.textContent = '█████ ON';
      setStatus('Transmitting 2600 Hz trunk seizure tone...');
    } else {
      btn.classList.remove('active');
      btn.textContent = '▶ SEND 2600 Hz TONE';
      level.textContent = '─── OFF';
      setStatus('Tone stopped.');
    }
  });
}

// ── MF buttons ────────────────────────────────────────────────────────────────
function setupMFButtons() {
  document.querySelectorAll('.mf-btn').forEach(btn => {
    btn.addEventListener('mousedown', () => {
      const key = btn.dataset.mf;
      const freqs = MF_TONES[key];
      audio.playMFBurst(key);
      btn.classList.add('lit');
      setStatus(`MF ${key}: ${freqs.join(' Hz + ')} Hz`);
      setTimeout(() => btn.classList.remove('lit'), 200);
    });
  });
}

// ── DTMF buttons ──────────────────────────────────────────────────────────────
function setupDTMFButtons() {
  document.querySelectorAll('.dtmf-btn').forEach(btn => {
    btn.addEventListener('mousedown', () => {
      const key = btn.dataset.dtmf;
      const freqs = DTMF_MAP[key];
      audio.playDTMFBurst(key);
      btn.classList.add('lit');
      setStatus(`DTMF ${key}: ${freqs.join(' Hz + ')} Hz`);
      setTimeout(() => btn.classList.remove('lit'), 250);
    });
  });
}

// ── Oscilloscope ──────────────────────────────────────────────────────────────
function startOscilloscope() {
  const canvas  = document.getElementById('scope');
  const ctx     = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Resize canvas to match CSS
  const ro = new ResizeObserver(() => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  });
  ro.observe(canvas);

  const analyser  = audio.getAnalyser();
  const bufLen    = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufLen);

  let phase = 0; // for idle animation

  function draw() {
    requestAnimationFrame(draw);
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#0d2b0d';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 8) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += h / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (audio.isActive) {
      analyser.getByteTimeDomainData(dataArray);
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#00ff41';
      ctx.beginPath();
      const sliceW = w / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Idle flat line with slight noise
      ctx.strokeStyle = '#003a00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        const y = h / 2 + (Math.random() - 0.5) * 1.5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      phase += 0.02;
    }
  }
  draw();
}

// ── Frequency monitor ─────────────────────────────────────────────────────────
function updateMonitor(freqs, label) {
  document.getElementById('active-tones').textContent = freqs.map(f => f + ' Hz').join(' + ');
  document.getElementById('signal-type').textContent  = label;
}
function clearMonitor() {
  document.getElementById('active-tones').textContent = '─ NONE ─';
  document.getElementById('signal-type').textContent  = '─ IDLE ─';
  document.getElementById('signal-duration').textContent = '0 ms';
  document.getElementById('signal-duration').classList.remove('counting');
}

// ── Duration counter ──────────────────────────────────────────────────────────
function startDurationCount() {
  seizureStart = Date.now();
  const el = document.getElementById('signal-duration');
  el.classList.add('counting');
  clearInterval(durationTimer);
  durationTimer = setInterval(() => {
    el.textContent = (Date.now() - seizureStart) + ' ms';
  }, 50);
}
function stopDurationCount() {
  clearInterval(durationTimer);
}

// ── Signal log ────────────────────────────────────────────────────────────────
function logSignal(freqs, label) {
  const log  = document.getElementById('signal-log');
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  signalCount++;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML =
    `<span class="ts">[${time}]</span> ` +
    `<span class="sig">${label}</span> ` +
    `<span class="freqs">${freqs.map(f => f + 'Hz').join('+')} </span>`;
  log.prepend(entry);
  // Keep last 50 entries
  while (log.children.length > 50) log.removeChild(log.lastChild);
}

// ── Status bar ────────────────────────────────────────────────────────────────
function setStatus(msg) {
  document.getElementById('status-left').textContent = msg;
}
