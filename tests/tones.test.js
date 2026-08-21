import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DTMF_COL,
  DTMF_KEYS,
  DTMF_MAP,
  DTMF_ROW,
  MF_FREQ_SET,
  MF_TONES,
  SEIZURE_HZ,
  formatFreqs,
  mfBurstMs,
  parseSequence,
} from '../js/tones.js';

describe('MF tone table', () => {
  it('covers the full SS5 digit and supervisory set', () => {
    assert.deepEqual(
      Object.keys(MF_TONES).sort(),
      ['0', '1', '11', '12', '2', '3', '4', '5', '6', '7', '8', '9', 'KP', 'KP2', 'ST', 'STP'].sort()
    );
  });

  it('uses two in-set frequencies for every key', () => {
    for (const [key, pair] of Object.entries(MF_TONES)) {
      assert.equal(pair.length, 2, key);
      assert.notEqual(pair[0], pair[1], key);
      assert.ok(MF_FREQ_SET.includes(pair[0]), `${key} ${pair[0]}`);
      assert.ok(MF_FREQ_SET.includes(pair[1]), `${key} ${pair[1]}`);
    }
  });

  it('keeps ST prime and Code 12 on the same historical pair', () => {
    assert.deepEqual(MF_TONES.STP, MF_TONES['12']);
    assert.deepEqual(MF_TONES.STP, [900, 1700]);
  });

  it('uses a longer KP pulse than digit pulses', () => {
    assert.equal(mfBurstMs('KP'), 100);
    assert.equal(mfBurstMs('KP2'), 100);
    assert.equal(mfBurstMs('5'), 68);
    assert.equal(mfBurstMs('unknown'), 68);
  });
});

describe('DTMF tone table', () => {
  it('maps the full 4×4 keypad', () => {
    const keys = DTMF_KEYS.flat();
    assert.equal(keys.length, 16);
    assert.deepEqual(Object.keys(DTMF_MAP).sort(), keys.slice().sort());
    assert.deepEqual(DTMF_MAP['1'], [DTMF_ROW[0], DTMF_COL[0]]);
    assert.deepEqual(DTMF_MAP.D, [DTMF_ROW[3], DTMF_COL[3]]);
  });
});

describe('parseSequence', () => {
  it('accepts spaced and packed tokens, including aliases', () => {
    assert.deepEqual(parseSequence('KP 011 ST'), ['KP', '0', '1', '1', 'ST']);
    assert.deepEqual(parseSequence('kp011st'), ['KP', '0', '1', '1', 'ST']);
    assert.deepEqual(parseSequence('KP 11 ST'), ['KP', '11', 'ST']);
    assert.deepEqual(parseSequence("KP2 12 ST' C11"), ['KP2', '12', 'STP', '11']);
  });

  it('ignores unknown characters and non-strings', () => {
    assert.deepEqual(parseSequence('hello KP x ST'), ['KP', 'ST']);
    assert.deepEqual(parseSequence(''), []);
    assert.deepEqual(parseSequence(null), []);
  });
});

describe('helpers', () => {
  it('formats frequency lists', () => {
    assert.equal(formatFreqs([700, 900]), '700 Hz + 900 Hz');
    assert.equal(formatFreqs([SEIZURE_HZ]), '2600 Hz');
  });
});
