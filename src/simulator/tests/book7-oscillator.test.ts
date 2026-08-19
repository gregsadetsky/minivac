/**
 * Book VII Experiment 3: "Oscillator" (page 14) — the relay clock.
 *
 * Wire list (per section): C/H (C/Ω22, Ω22/E) E/cap F/- J/+
 * The capacitor charges through the resistor until the coil reaches pickup;
 * pulling in disconnects the relay's own supply (the arm's NO side is unwired),
 * the capacitor drains through the coil to drop-out, and the cycle repeats —
 * free-running, no user input.
 *
 * The manual's claims, tested here: it oscillates; section 6 runs slower
 * (1000uF vs 500uF); changing the resistor changes the frequency.
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

function build(section: number, ohms: number): MinivacSimulator {
  const s = section;
  const m = new MinivacSimulator([`${s}C/${s}H`, `${s}E/${s}cap`, `${s}F/${s}-`, `${s}J/${s}+`]);
  m.addExternalResistor(`${s}C`, `${s}E`, ohms);
  m.initialize();
  return m;
}

// run for `ms` simulated milliseconds; return relay on-events and mean period
function measure(m: MinivacSimulator, section: number, ms: number): { onEvents: number; periodMs: number } {
  let last = m.getState().relays[section - 1];
  let onEvents = 0;
  let firstOn = -1;
  let lastOn = -1;
  for (let t = 0; t < ms; t += 1) {
    m.stepTime(1);
    const now = m.getState().relays[section - 1];
    if (now !== last) {
      if (now) {
        onEvents++;
        if (firstOn < 0) firstOn = t;
        lastOn = t;
      }
      last = now;
    }
  }
  const periodMs = onEvents > 1 ? (lastOn - firstOn) / (onEvents - 1) : -1;
  return { onEvents, periodMs };
}

describe('Book VII Experiment 3: Oscillator', () => {
  it('free-runs with no input (section 1, 22 ohm)', { timeout: 90000 }, () => {
    const m = build(1, 22);
    const r = measure(m, 1, 400);
    expect(r.onEvents).toBeGreaterThan(10); // many full cycles in 400ms
    expect(r.periodMs).toBeGreaterThan(10);
    expect(r.periodMs).toBeLessThan(50);
  });

  it('runs about twice as slowly on section 6 (1000uF vs 500uF)', { timeout: 90000 }, () => {
    const sec1 = measure(build(1, 22), 1, 400);
    const sec6 = measure(build(6, 22), 6, 400);
    const ratio = sec6.periodMs / sec1.periodMs;
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(2.6);
  });

  it('changes frequency when the resistor value changes', { timeout: 90000 }, () => {
    const r22 = measure(build(1, 22), 1, 400);
    const r47 = measure(build(1, 47), 1, 400);
    expect(r47.periodMs).toBeGreaterThan(r22.periodMs);
  });
});
