'use strict';

const GRID = '#0d2b0d';
const TRACE = '#00ff41';
const IDLE = '#003a00';

export function startOscilloscope(canvas, audio) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dataArray = null;
  let rafId = 0;
  let width = 0;
  let height = 0;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const nextW = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const nextH = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (nextW === canvas.width && nextH === canvas.height) return;
    canvas.width = nextW;
    canvas.height = nextH;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const drawGrid = () => {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      const x = (width * i) / 8;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let i = 1; i < 4; i++) {
      const y = (height * i) / 4;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  };

  const draw = () => {
    rafId = requestAnimationFrame(draw);
    if (!width || !height) resize();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawGrid();

    const analyser = audio.getAnalyser();
    if (audio.isActive && analyser) {
      if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteTimeDomainData(dataArray);

      ctx.strokeStyle = TRACE;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = TRACE;
      ctx.beginPath();
      const slice = width / dataArray.length;
      for (let i = 0; i < dataArray.length; i++) {
        const y = (dataArray[i] / 128) * (height / 2);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * slice, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      return;
    }

    ctx.strokeStyle = IDLE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const mid = height / 2;
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();
  };

  draw();

  return () => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
  };
}
