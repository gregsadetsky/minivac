/**
 * Multivac roadmap rung 5: GAME-TICK SEQUENCER — a 5-state one-hot ring
 * counter (spawn -> fall -> collide? -> lock -> line-clear -> wrap). Pure
 * wiring, 3 machines, both engines.
 *
 * Topology: the rung-2 shift register bent into a ring. 5 master-slave DFF
 * stages, one clock-mirror relay per bit (tie-point law), stage 4's slave
 * feeding stage 0's D path. State i hot = slave i energized; the canvas/test
 * reads relay states directly, so no lights are spent.
 *
 * Seeding: relays all start released, so the ring powers up with zero
 * tokens. The START button feeds master 0's com through its own private
 * contact — but a master only FOLLOWS its D path while CLK is low (its hold
 * path lives behind the clock's NO contact), so the operator holds START
 * through one clock rise: press (master 0 energizes), raise CLK (master
 * latches via its hold path, slave 0 copies), release, lower CLK. One token
 * then circulates indefinitely.
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

const STATES = 5; // spawn, fall, collide?, lock, line-clear

function ringCircuit(): string[] {
  // stage i: machine floor(i/2), sections (1,2,3) or (4,5,6) = (clk, master, slave)
  const w: string[] = ['m0.3+/m0.1S', 'm0.1T/m0.1com']; // clock slide -> clock rail
  const machines = Math.ceil(STATES / 2);
  for (let k = 1; k < machines; k++) w.push(`m${k - 1}.1com/m${k}.1com`);

  const slaveOf = (i: number) => `m${Math.floor(i / 2)}.${i % 2 === 0 ? 3 : 6}`;
  for (let i = 0; i < STATES; i++) {
    const k = Math.floor(i / 2);
    const [c, a, s] = i % 2 === 0 ? [1, 2, 3] : [4, 5, 6];
    const j = (sec: number, jack: string) => `m${k}.${sec}${jack}`;

    w.push(`m${k}.1com/${j(c, 'E')}`, `${j(c, 'F')}/${j(c, '-')}`); // clock mirror coil
    w.push(`${j(a, 'com')}/${j(a, 'E')}`, `${j(a, 'F')}/${j(a, '-')}`); // master coil
    w.push(`${j(s, 'com')}/${j(s, 'E')}`, `${j(s, 'F')}/${j(s, '-')}`); // slave coil
    w.push(`${j(c, '+')}/${j(c, 'H')}`, `${j(c, '+')}/${j(c, 'L')}`); // both clock arms

    // D path (live while CLK low): clk NC -> previous slave's contact -> master com;
    // the ring wraps: stage 0's predecessor is stage 4
    const prev = slaveOf((i + STATES - 1) % STATES);
    w.push(`${j(c, 'J')}/${prev}L`, `${prev}K/${j(a, 'com')}`);
    w.push(`${j(c, 'G')}/${j(a, 'H')}`, `${j(a, 'G')}/${j(a, 'com')}`); // master holds while CLK high
    w.push(`${j(c, 'K')}/${j(a, 'L')}`, `${j(a, 'K')}/${j(s, 'com')}`); // slave := master while CLK high
    w.push(`${j(c, 'N')}/${j(s, 'H')}`, `${j(s, 'G')}/${j(s, 'com')}`); // slave holds while CLK low
  }

  // START: a private button contact into master 0's com (its 4th and last hole)
  w.push('m0.2+/m0.2Y', 'm0.2X/m0.2com');
  return w;
}

describe('Multivac: 5-state ring game-tick sequencer (3 machines), both engines', () => {
  for (const engine of ['sparse', 'cktsim'] as SolverEngine[]) {
    it(`circulates exactly one token (${engine})`, { timeout: 600000 }, () => {
      setSolverEngine(engine);
      const wires = ringCircuit();
      assertJackCapacity(wires);
      const m = new MinivacSimulator(wires, false, 3);
      m.initialize();

      const q = (i: number) =>
        m.getMachineState(Math.floor(i / 2)).relays[i % 2 === 0 ? 2 : 5] ? 1 : 0;
      const state = () => Array.from({ length: STATES }, (_, i) => q(i)).join('');
      const clockTo = (dir: 'right' | 'left') => {
        m.setSlide(1, dir, 0);
        expect(m.lastRelaxationIterations).toBeLessThanOrEqual(10);
        expect(m.getState().alerts).toEqual([]);
      };

      expect(state(), 'powers up with no token').toBe('00000');

      // seed: hold START through one clock rise
      m.pressButton(2, 0);
      clockTo('right');
      m.releaseButton(2, 0);
      clockTo('left');
      expect(state(), 'seeded at spawn').toBe('10000');

      // 12 ticks = 2.4 laps; exactly one hot state, advancing each tick
      for (let tick = 1; tick <= 12; tick++) {
        clockTo('right');
        clockTo('left');
        const expected = Array.from({ length: STATES }, (_, i) =>
          i === tick % STATES ? 1 : 0
        ).join('');
        expect(state(), `after tick ${tick}`).toBe(expected);
      }
    });
  }
});
