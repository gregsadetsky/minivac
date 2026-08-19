/**
 * Book IV pages 68-69: single-input flip-flop — the SIMULATION-ERRATA circuit,
 * resolved 2026-08-18 by wiring it on a real Minivac 601.
 *
 * Verified device behavior, which this test encodes:
 * - power on: relay 5 picks up, light 6 off (storing 0)
 * - press/release: relay 5 drops, relay 6 + light 6 latch on (storing 1) — no buzz
 * - next press: relay 6 PHYSICALLY CHATTERS while held (its coil is permanently tied
 *   to light 6 via 6G/6F + 6G/6A; dropping re-picks it through the light at ~80mA);
 *   the buzzing armature never seats its latch, so release lands OFF (storing 0)
 * - pattern repeats: nobuzz-buzz-nobuzz-buzz, toggling correctly throughout
 *
 * The sim reports the buzz as a RELAY OSCILLATION alert and resolves chattering
 * relays to de-energized. Measured cross-check: 172mA through the 5N/6E wire during
 * the buzz on the device vs 158mA simulated for the same point.
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

const circuit = ('5+/5H 6G/6F 5H/6H 5C/6C 5G/5F 6C/6- 6H/6Y 6X/5L 5K/6F ' +
  '5N/6E 6Z/6L 6K/5E 6N/5F 6G/6A 6B/6-').split(' ');

describe('Book IV: Single-Input Flip-Flop (device-verified)', () => {
  it('powers on storing 0: relay 5 latched, light 6 off', () => {
    const m = new MinivacSimulator(circuit);
    m.initialize();
    const s = m.getState();
    expect(s.relays[4]).toBe(true);
    expect(s.relays[5]).toBe(false);
    expect(s.lights[5]).toBe(false);
  });

  it('toggles on every press, buzzing on exactly every second press', { timeout: 30000 }, () => {
    const m = new MinivacSimulator(circuit);
    m.initialize();
    for (let cycle = 1; cycle <= 4; cycle++) {
      m.pressButton(6);
      const pressed = m.getState();
      const buzzing = pressed.alerts.some(a => a.includes('OSCILLATION'));
      expect(buzzing, `buzz during press ${cycle}`).toBe(cycle % 2 === 0);

      m.releaseButton(6);
      const released = m.getState();
      const storingOne = cycle % 2 === 1;
      expect(released.lights[5], `light 6 after cycle ${cycle}`).toBe(storingOne);
      expect(released.relays[5], `relay 6 after cycle ${cycle}`).toBe(storingOne);
      expect(released.relays[4], `relay 5 after cycle ${cycle}`).toBe(!storingOne);
    }
  });
});
