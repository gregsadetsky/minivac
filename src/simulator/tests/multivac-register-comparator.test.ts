/**
 * Multivac rung 2: a 4-bit REGISTER with parallel load (4 machines) and a 4-bit
 * RIPPLE-BORROW COMPARATOR (2 machines). Pure wiring, analog-simulated.
 *
 * Register: master-slave per bit, ONE clock relay per bit (coils in parallel from
 * the LOAD slide) so every gated path has a private contact — a contact jack with
 * two consumers is a tie point that bridges them when the contact is open.
 * Master samples D while LOAD is high; slave copies on the falling edge.
 *
 * Comparator: per stage, A's transfer contact selects between two B-contact
 * branches — A>B kills the borrow, A<B generates it (connects +), A==B propagates
 * borrow-in. Borrow-out of the MSB stage lights "A < B".
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

function assertJackCapacity(wires: string[]) {
  const uses = new Map<string, number>();
  for (const w of wires) for (const t of w.split('/')) uses.set(t, (uses.get(t) || 0) + 1);
  for (const [jack, n] of uses) {
    const cap = jack.endsWith('com') ? 4 : /M1[01]$/.test(jack) ? 6 : 2;
    expect(n, `jack ${jack} used ${n}x (capacity ${cap})`).toBeLessThanOrEqual(cap);
  }
}

function registerCircuit(): string[] {
  const w: string[] = [
    'c.5+/c.5S', 'c.5T/c.5com', 'c.5com/c.1E', 'c.5com/c.2E', 'c.5com/c.3com',
    'c.3com/c.3E', 'c.3com/c.4E',
    'c.1F/c.1-', 'c.2F/c.2-', 'c.3F/c.3-', 'c.4F/c.4-',
  ];
  for (let i = 0; i < 4; i++) {
    const c = `c.${i + 1}`;
    const mach = i < 2 ? 'a' : 'b';
    const M = `${mach}.${(i % 2) * 2 + 1}`;
    const S = `${mach}.${(i % 2) * 2 + 2}`;
    w.push(
      `${c}+/${c}H`, `${c}+/${c}L`,
      `${c}G/d.${i + 1}S`, `d.${i + 1}T/${M}com`, `${M}com/${M}E`, `${M}F/${M}-`, // M := D while LOAD high
      `${c}J/${M}H`, `${M}G/${M}com`,                                            // M holds while LOAD low
      `${c}N/${M}L`, `${M}K/${S}com`, `${S}com/${S}E`, `${S}F/${S}-`,            // S := M while LOAD low
      `${c}K/${S}H`, `${S}G/${S}com`,                                            // S holds while LOAD high
      `${S}+/${S}L`, `${S}K/${S}A`, `${S}B/${S}-`,                               // output light via S set 2
    );
  }
  return w;
}

function comparatorCircuit(): string[] {
  const w: string[] = [];
  for (let i = 1; i <= 4; i++) {
    w.push(`a.${i}+/a.${i}S`, `a.${i}T/a.${i}E`, `a.${i}F/a.${i}-`);
    w.push(`b.${i}+/b.${i}S`, `b.${i}T/b.${i}E`, `b.${i}F/b.${i}-`);
    w.push(`a.${i}G/b.${i}H`);   // A=1 branch
    w.push(`a.${i}J/b.${i}L`);   // A=0 branch
    w.push(`b.${i}+/b.${i}K`);   // generate (A=0, B=1): connect +
    if (i > 1) {
      w.push(`a.${i - 1}H/b.${i}com`, `b.${i}com/b.${i}G`, `b.${i}com/b.${i}N`);
    }
  }
  w.push('a.4H/b.5A', 'b.5B/b.5-');
  return w;
}

describe('Multivac: 4-bit register with parallel load (4 machines)', () => {
  it('loads values on the LOAD pulse and holds them against D changes', { timeout: 240000 }, () => {
    const wires = registerCircuit();
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, 4);
    m.initialize();
    const q = () => {
      const a = m.getMachineState(0), b = m.getMachineState(1);
      return (a.relays[1] ? 1 : 0) + (a.relays[3] ? 2 : 0) + (b.relays[1] ? 4 : 0) + (b.relays[3] ? 8 : 0);
    };
    const qLights = () => {
      const a = m.getMachineState(0), b = m.getMachineState(1);
      return (a.lights[1] ? 1 : 0) + (a.lights[3] ? 2 : 0) + (b.lights[1] ? 4 : 0) + (b.lights[3] ? 8 : 0);
    };
    const setD = (v: number) => {
      for (let i = 0; i < 4; i++) m.setSlide(i + 1, (v >> i) & 1 ? 'right' : 'left', 3);
    };
    const pulseLoad = () => { m.setSlide(5, 'right', 2); m.setSlide(5, 'left', 2); };

    expect(q()).toBe(0);
    for (const v of [0b1010, 0b0101, 0b1111, 0b0000, 6, 9, 3, 12]) {
      setD(v);
      pulseLoad();
      expect(q(), `loaded ${v}`).toBe(v);
      expect(qLights(), `lights for ${v}`).toBe(v);
    }
    // hold: D changes without LOAD must not affect the register
    setD(0b1111);
    expect(q(), 'held against D wiggle').toBe(12);
    setD(0);
    expect(q(), 'held against another D wiggle').toBe(12);
  });
});

describe('Multivac: 4-bit ripple-borrow comparator (2 machines)', () => {
  it('computes A < B for all 256 input pairs', { timeout: 600000 }, () => {
    const wires = comparatorCircuit();
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, 2);
    m.initialize();
    for (let A = 0; A < 16; A++) {
      for (let B = 0; B < 16; B++) {
        for (let i = 0; i < 4; i++) {
          m.setSlide(i + 1, (A >> i) & 1 ? 'right' : 'left', 0);
          m.setSlide(i + 1, (B >> i) & 1 ? 'right' : 'left', 1);
        }
        expect(m.getMachineState(1).lights[4] ? 1 : 0, `A=${A} B=${B}`).toBe(A < B ? 1 : 0);
      }
    }
  });
});
