'use strict';

export const BOOT_LINES = Object.freeze([
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
  '  Press any key or click to continue...',
]);

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function startBoot({ bootText, bootScreen, mainScreen, onEnter }) {
  let lineIdx = 0;
  let charIdx = 0;
  let typing = true;
  let entered = false;
  let timer = 0;

  const showFull = () => {
    window.clearTimeout(timer);
    typing = false;
    bootText.textContent = BOOT_LINES.join('\n') + '\n';
  };

  const typeNext = () => {
    if (!typing) return;
    if (lineIdx >= BOOT_LINES.length) {
      typing = false;
      return;
    }
    const line = BOOT_LINES[lineIdx];
    if (charIdx < line.length) {
      bootText.textContent += line[charIdx];
      charIdx += 1;
      timer = window.setTimeout(typeNext, line.startsWith('  ██') ? 2 : 12);
      return;
    }
    bootText.textContent += '\n';
    lineIdx += 1;
    charIdx = 0;
    const prev = BOOT_LINES[lineIdx - 1] || '';
    timer = window.setTimeout(typeNext, prev.includes('...') ? 180 : 30);
  };

  const enter = () => {
    if (entered) return;
    entered = true;
    window.clearTimeout(timer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onPointer);
    bootScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    onEnter();
  };

  const onKey = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (typing) {
      event.preventDefault();
      showFull();
      return;
    }
    event.preventDefault();
    enter();
  };

  const onPointer = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (typing) {
      showFull();
      return;
    }
    enter();
  };

  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer);

  if (prefersReducedMotion()) showFull();
  else typeNext();

  return { skip: showFull, enter };
}
