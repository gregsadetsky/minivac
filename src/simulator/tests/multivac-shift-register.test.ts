/**
 * Multivac roadmap rung 2: 8-bit SIPO SHIFT REGISTER (serial in, parallel out)
 * across 4 machines — this is tetris gravity. Pure wiring, both engines.
 *
 * Structure: 8 chained master-slave D flip-flops (the proven multivac.test.ts
 * DFF), D_i = Q_{i-1}, D_0 = a slide switch. ONE clock-mirror relay per bit
 * (coils in parallel on a clock rail daisy-chained through com jacks): both of
 * a clock relay's contact sets serve ONLY its own bit, because a contact jack
 * with two consumers is a tie point that bridges them when the contact opens.
 *
 * Phasing (same as the proven DFF): while CLK is low, each master follows the
 * previous slave (which is holding); on the rise, masters freeze and slaves
 * copy them — the register shifts exactly one position per full clock pulse,
 * with no shoot-through, because masters are latched the whole time slaves
 * are transparent.
 *
 * Layout: bit i lives on machine floor(i/2), sections (1,2,3) or (4,5,6) =
 * (clock mirror, master, slave). 24 relays, all 6 sections of 4 machines.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine, type SolverEngine } from '../minivac-simulator';

afterEach(() => setSolverEngine('sparse'));

// real hardware: 2 holes per jack, 4 on COMMON, 6 on matrix groups 10/11
function assertJackCapacity(wires: string[]) {
  const uses = new Map<string, number>();
  for (const w of wires) for (const t of w.split('/')) uses.set(t, (uses.get(t) || 0) + 1);
  for (const [jack, n] of uses) {
    const cap = jack.endsWith('com') ? 4 : /M1[01]$/.test(jack) ? 6 : 2;
    expect(n, `jack ${jack} used ${n}x (capacity ${cap})`).toBeLessThanOrEqual(cap);
  }
}

function shiftRegisterCircuit(bits: number): string[] {
  // clock source: slide 1 on machine 0 energizes one clock-mirror relay per
  // bit; the rail runs through the (otherwise unused) section-1 com jacks:
  // each carries chain-in, two local coil feeds, chain-out = 4 holes exactly.
  const w: string[] = ['m0.3+/m0.1S', 'm0.1T/m0.1com'];
  const machines = Math.ceil(bits / 2);
  for (let k = 1; k < machines; k++) w.push(`m${k - 1}.1com/m${k}.1com`);

  for (let i = 0; i < bits; i++) {
    const k = Math.floor(i / 2);
    const [c, a, s] = i % 2 === 0 ? [1, 2, 3] : [4, 5, 6]; // clock, master, slave
    const j = (sec: number, jack: string) => `m${k}.${sec}${jack}`;

    w.push(`m${k}.1com/${j(c, 'E')}`, `${j(c, 'F')}/${j(c, '-')}`); // clock mirror coil
    w.push(`${j(a, 'com')}/${j(a, 'E')}`, `${j(a, 'F')}/${j(a, '-')}`); // master coil
    w.push(`${j(s, 'com')}/${j(s, 'E')}`, `${j(s, 'F')}/${j(s, '-')}`); // slave coil
    w.push(`${j(c, '+')}/${j(c, 'H')}`, `${j(c, '+')}/${j(c, 'L')}`); // both clock arms

    // D path, live while CLK low: + -> clk NC -> (serial slide | prev Q contact) -> master
    if (i === 0) {
      w.push(`${j(c, 'J')}/m0.2S`, `m0.2T/${j(a, 'com')}`);
    } else {
      const pk = Math.floor((i - 1) / 2);
      const ps = (i - 1) % 2 === 0 ? 3 : 6;
      w.push(`${j(c, 'J')}/m${pk}.${ps}L`, `m${pk}.${ps}K/${j(a, 'com')}`);
    }
    w.push(`${j(c, 'G')}/${j(a, 'H')}`, `${j(a, 'G')}/${j(a, 'com')}`); // master holds while CLK high
    w.push(`${j(c, 'K')}/${j(a, 'L')}`, `${j(a, 'K')}/${j(s, 'com')}`); // slave := master while CLK high
    w.push(`${j(c, 'N')}/${j(s, 'H')}`, `${j(s, 'G')}/${j(s, 'com')}`); // slave holds while CLK low
  }

  // parallel-out demo: the last slave's free contact set drives a light
  const lk = Math.floor((bits - 1) / 2);
  const ls = (bits - 1) % 2 === 0 ? 3 : 6;
  w.push(`m${lk}.${ls}+/m${lk}.${ls}L`, `m${lk}.${ls}K/m${lk}.${ls}A`, `m${lk}.${ls}B/m${lk}.${ls}-`);
  return w;
}

describe('Multivac: 8-bit SIPO shift register across 4 machines, both engines', () => {
  for (const engine of ['sparse', 'cktsim'] as SolverEngine[]) {
    it(`shifts a pattern through and out (${engine})`, { timeout: 600000 }, () => {
      setSolverEngine(engine);
      const BITS = 8;
      const wires = shiftRegisterCircuit(BITS);
      assertJackCapacity(wires);
      const m = new MinivacSimulator(wires, false, 4);
      m.initialize();

      // bit i's value = its slave relay; bit 0 is the input end
      const q = (i: number) =>
        m.getMachineState(Math.floor(i / 2)).relays[i % 2 === 0 ? 2 : 5] ? 1 : 0;
      const reg = () => Array.from({ length: BITS }, (_, i) => q(i)).join('');
      const setD = (v: number) => m.setSlide(2, v ? 'right' : 'left', 0);
      const clock = () => {
        m.setSlide(1, 'right', 0);
        const riseIters = m.lastRelaxationIterations;
        m.setSlide(1, 'left', 0);
        expect(Math.max(riseIters, m.lastRelaxationIterations)).toBeLessThanOrEqual(10);
        expect(m.getState().alerts).toEqual([]);
      };

      expect(reg()).toBe('00000000');

      // shift in 10110001, newest bit at position 0
      const pattern = [1, 0, 1, 1, 0, 0, 0, 1];
      for (let n = 0; n < BITS; n++) {
        setD(pattern[n]);
        clock();
        const expected = pattern.slice(0, n + 1).reverse().concat(Array(BITS - n - 1).fill(0));
        expect(reg(), `after clock ${n + 1}`).toBe(expected.join(''));
      }

      // parallel out: all 8 bits observable at once; the demo light shows bit 7
      expect(reg()).toBe('10001101');
      expect(m.getMachineState(3).lights[5] ? 1 : 0, 'light mirrors bit 7').toBe(q(7));
      expect(q(7)).toBe(1);

      // D wiggles without a clock edge must not move the register
      setD(0); setD(1); setD(0);
      expect(reg(), 'immune to D wiggles').toBe('10001101');

      // drain: 8 zero shifts empty the register, watching bit 7 on the way out
      const drain: number[] = [];
      setD(0);
      for (let n = 0; n < BITS; n++) {
        clock();
        drain.push(q(7));
      }
      // bit 7 replays the pattern oldest-first as it falls off the end
      expect(drain.join(''), 'serial out replays the pattern').toBe('10001101'.slice(0, 7).split('').reverse().join('') + '0');
      expect(reg()).toBe('00000000');
      expect(m.getMachineState(3).lights[5] ? 1 : 0).toBe(0);
    });
  }
});
