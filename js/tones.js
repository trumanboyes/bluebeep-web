'use strict';

/**
 * CCITT / ITU-T Signaling System No. 5 multi-frequency pairs.
 * Each signal is two tones from {700, 900, 1100, 1300, 1500, 1700} Hz.
 *
 * ST' (STP) and Code 12 share 900 + 1700 Hz — that is how SS5 is defined.
 */
export const MF_FREQ_SET = Object.freeze([700, 900, 1100, 1300, 1500, 1700]);

export const MF_TONES = Object.freeze({
  '1':  Object.freeze([700,  900]),
  '2':  Object.freeze([700,  1100]),
  '3':  Object.freeze([900,  1100]),
  '4':  Object.freeze([700,  1300]),
  '5':  Object.freeze([900,  1300]),
  '6':  Object.freeze([1100, 1300]),
  '7':  Object.freeze([700,  1500]),
  '8':  Object.freeze([900,  1500]),
  '9':  Object.freeze([1100, 1500]),
  '0':  Object.freeze([1300, 1500]),
  '11': Object.freeze([700,  1700]),
  '12': Object.freeze([900,  1700]),
  KP:   Object.freeze([1100, 1700]),
  KP2:  Object.freeze([1300, 1700]),
  ST:   Object.freeze([1500, 1700]),
  STP:  Object.freeze([900,  1700]),
});

/** Typical SS5 pulse widths: KP/KP2 are sent longer than digit pulses. */
export const MF_BURST_MS = Object.freeze({
  KP: 100,
  KP2: 100,
  default: 68,
});

export const MF_INTERDIGIT_MS = 68;

export const DTMF_ROW = Object.freeze([697, 770, 852, 941]);
export const DTMF_COL = Object.freeze([1209, 1336, 1477, 1633]);
export const DTMF_KEYS = Object.freeze([
  ['1', '2', '3', 'A'],
  ['4', '5', '6', 'B'],
  ['7', '8', '9', 'C'],
  ['*', '0', '#', 'D'],
]);

export const DTMF_MAP = Object.freeze(
  Object.fromEntries(
    DTMF_KEYS.flatMap((row, r) =>
      row.map((key, c) => [key, Object.freeze([DTMF_ROW[r], DTMF_COL[c]])])
    )
  )
);

export const SEIZURE_HZ = 2600;

const TOKEN_ALIASES = Object.freeze({
  KP: 'KP',
  KP1: 'KP',
  KP2: 'KP2',
  ST: 'ST',
  STP: 'STP',
  "ST'": 'STP',
  ST1: 'STP',
  C11: '11',
  C12: '12',
});

const NAMED_TOKENS = Object.freeze([
  'KP2', 'KP1', 'STP', "ST'", 'ST1', 'C11', 'C12', 'KP', 'ST',
]);

export function mfBurstMs(key) {
  return MF_BURST_MS[key] ?? MF_BURST_MS.default;
}

export function formatFreqs(freqs) {
  return freqs.map((hz) => `${hz} Hz`).join(' + ');
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

/**
 * Tokenize a typed MF string into keys from MF_TONES.
 * Accepts spaced or packed input: "KP 011 ST" and "KP011ST".
 * Code 11 / 12 are recognized only as C11/C12 or as a 11/12 run
 * that is not adjacent to other digits (so "011" stays 0, 1, 1).
 */
export function parseSequence(input) {
  if (typeof input !== 'string') return [];
  const tokens = [];
  const src = input.toUpperCase();
  let i = 0;

  while (i < src.length) {
    if (/\s/.test(src[i])) {
      i += 1;
      continue;
    }

    const named = NAMED_TOKENS.find((token) => src.startsWith(token, i));
    if (named) {
      const key = TOKEN_ALIASES[named] ?? named;
      if (MF_TONES[key]) tokens.push(key);
      i += named.length;
      continue;
    }

    const pair = src.slice(i, i + 2);
    if ((pair === '11' || pair === '12') && !isDigit(src[i - 1]) && !isDigit(src[i + 2])) {
      tokens.push(pair);
      i += 2;
      continue;
    }

    if (isDigit(src[i])) {
      tokens.push(src[i]);
      i += 1;
      continue;
    }

    i += 1;
  }

  return tokens;
}
