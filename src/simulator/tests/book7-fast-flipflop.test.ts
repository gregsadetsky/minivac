/**
 * Book VII Experiment 2: "Fast Flip-Flop" (page 13) — a BIASED relay as the
 * bi-stable element. A bias resistor (selected per relay via the book's page 8-9
 * procedure) holds the coil between drop-out and pickup; the capacitor provides
 * the pull-in surge and swallows the coil current for drop-out. Both charge and
 * discharge go through the 22 ohm resistor, so unlike experiment 1 it can be
 * operated fast without missing.
 *
 * Wire list (section 1): A/C B/+ C/H E/- E/G F/Z (F/ΩB,ΩB/J) (H/Ω22,Ω22/X) J/+ Y/cap
 * ΩB = 220 ohm here: the sim relay's valid bias range is ~135-385 ohm
 * (dropout 30mA to pickup 70mA across coil + bias from 13.3V).
 *
 * State encoding (inverted vs experiment 1): binary light ON = 1, indicator ON = 0.
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

const fastCircuit = ['1A/1C', '1B/1+', '1C/1H', '1E/1-', '1E/1G', '1F/1Z', '1J/1+', '1Y/1cap'];
const slowCircuit = ['1A/1X', '1B/1-', '1C/1G', '1E/1Z', '1F/1-', '1H/1+', '1Y/1cap']; // exp 1

function buildFast(): MinivacSimulator {
  const m = new MinivacSimulator(fastCircuit);
  m.addExternalResistor('1F', '1J', 220); // bias resistor ΩB
  m.addExternalResistor('1H', '1X', 22);  // Ω22
  m.initialize();
  return m;
}

function hold(m: MinivacSimulator, ms: number) {
  for (let t = 0; t < ms; t += 2) m.stepTime(2);
}

function cycle(m: MinivacSimulator, holdMs: number) {
  m.pressButton(1);
  hold(m, holdMs);
  m.releaseButton(1);
  hold(m, holdMs);
}

describe('Book VII Experiment 2: Fast Flip-Flop (biased relay)', () => {
  it('stores 0 at power on, with bias current between drop-out and pickup', { timeout: 30000 }, () => {
    const m = buildFast();
    hold(m, 50);
    const s = m.getState();
    expect(s.relays[0]).toBe(false);
    expect(s.lights[0]).toBe(false);              // binary light off = 0
    expect(s.relayIndicatorLights[0]).toBe(true); // indicator on = 0
    expect(s.relayCurrents[0]).toBeGreaterThan(30); // biased above drop-out...
    expect(s.relayCurrents[0]).toBeLessThan(70);    // ...but below pickup
  });

  it('toggles 0 -> 1 -> 0 -> 1 -> 0 through the book procedure', { timeout: 30000 }, () => {
    const m = buildFast();
    hold(m, 50);
    for (const expected of [true, false, true, false]) {
      cycle(m, 50);
      expect(m.getState().lights[0]).toBe(expected);
    }
  });

  it('does not miss when operated fast (30ms holds, ~16 presses/sec)', { timeout: 30000 }, () => {
    const m = buildFast();
    hold(m, 50);
    const bits: number[] = [];
    for (let i = 0; i < 6; i++) {
      cycle(m, 30);
      bits.push(m.getState().lights[0] ? 1 : 0);
    }
    expect(bits).toEqual([1, 0, 1, 0, 1, 0]);
  });

  it('experiment 1, by contrast, DOES miss at the same speed', { timeout: 30000 }, () => {
    const m = new MinivacSimulator(slowCircuit);
    m.addExternalResistor('1J', '1X', 22);
    m.initialize();
    const bits: number[] = [];
    for (let i = 0; i < 6; i++) {
      cycle(m, 30);
      bits.push(m.getState().relayIndicatorLights[0] ? 1 : 0); // exp 1 encoding
    }
    // the manual: "if the flip-flop is operated too fast ... it will begin to miss"
    expect(bits).not.toEqual([1, 0, 1, 0, 1, 0]);
  });
});
