/**
 * Book VII Experiment 1: "Simple Flip-Flop" (page 12) — one relay + the section's
 * internal 500uF capacitor + the kit's 22 ohm resistor.
 *
 * Wire list from the manual (section 1): A/X B/- C/G E/Z F/- H/+ (J/R22, R22/X) Y/cap
 * (the optional E-to-F bias resistor is not needed in the simulator).
 *
 * State encoding per the manual: binary output light ON = 0, relay indicator ON = 1.
 * The capacitor charges through the 22 ohm resistor while the button is held, fires
 * the coil on release (pull-in), then the next press drains it through the binary
 * light and the empty capacitor swallows the coil current on release (drop-out).
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

const circuit = ['1A/1X', '1B/1-', '1C/1G', '1E/1Z', '1F/1-', '1H/1+', '1Y/1cap'];

function build(): MinivacSimulator {
  const m = new MinivacSimulator(circuit);
  m.addExternalResistor('1J', '1X', 22);
  m.initialize();
  return m;
}

function hold(m: MinivacSimulator, ms: number) {
  for (let t = 0; t < ms; t += 2) m.stepTime(2);
}

// storing 0 = binary output light ON, indicator OFF; storing 1 = the complement
function storedBit(m: MinivacSimulator): number {
  const s = m.getState();
  expect(s.lights[0]).not.toBe(s.relayIndicatorLights[0]); // lights are complements
  return s.relayIndicatorLights[0] ? 1 : 0;
}

function slowToggle(m: MinivacSimulator) {
  m.pressButton(1);
  hold(m, 100);
  m.releaseButton(1);
  hold(m, 100);
}

describe('Book VII Experiment 1: Simple Flip-Flop (capacitor)', () => {
  it('stores 0 at power on: binary light on, indicator off', () => {
    const m = build();
    expect(storedBit(m)).toBe(0);
  });

  it('toggles 0 -> 1 -> 0 -> 1 -> 0 when operated slowly', { timeout: 90000 }, () => {
    const m = build();
    for (const expected of [1, 0, 1, 0]) {
      slowToggle(m);
      expect(storedBit(m)).toBe(expected);
    }
  });

  it('charges the capacitor through the 22 ohm resistor while pressed', { timeout: 90000 }, () => {
    const m = build();
    m.pressButton(1);
    hold(m, 100);
    // ~11V: supply divided by the 22 ohm resistor against the parallel binary light
    expect(m.getCapVoltage(1)).toBeGreaterThan(10);
    expect(m.getCapVoltage(1)).toBeLessThan(12.5);
  });

  it('misses when operated too fast (manual step 6)', { timeout: 90000 }, () => {
    const m = build();
    m.pressButton(1);
    hold(m, 4); // not enough charge to reach relay pickup on release
    m.releaseButton(1);
    hold(m, 100);
    expect(storedBit(m)).toBe(0); // still storing 0 — the toggle was missed
  });
});
