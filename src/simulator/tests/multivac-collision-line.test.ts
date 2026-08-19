/**
 * Multivac roadmap rung 6: COLLISION and LINE-FULL logic, standalone
 * exhaustive version (2 machines, 8 relays, 256 input combinations).
 *
 * line-full = series-contact AND: + runs through every field relay's set-2
 * NO contact in a chain; the light at the end burns only when all 4 bits are
 * set. collision = OR-reduction of (piece AND field): per bit, a series pair
 * of private contacts (piece set 1 -> field set 1); the four branches join
 * on a 6-hole M10 group feeding the collision light. Branch join is
 * tie-point safe: a live branch's current can only re-enter another branch
 * through that branch's field contact and then dead-ends at its open piece
 * contact (or joins the + rail it came from).
 *
 * Runs under the ambient suite engine (comparator/adder convention): sparse
 * in every `npm run check`, dense in the MINIVAC_SOLVER=dense oracle pass.
 * The composed version — detectors reading STORED register-file rows — lives
 * in multivac-register-file.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

// real hardware: 2 holes per jack, 4 on COMMON, 6 on matrix groups 10/11
function assertJackCapacity(wires: string[]) {
  const uses = new Map<string, number>();
  for (const w of wires) for (const t of w.split('/')) uses.set(t, (uses.get(t) || 0) + 1);
  for (const [jack, n] of uses) {
    const cap = jack.endsWith('com') ? 4 : /M1[01]$/.test(jack) ? 6 : 2;
    expect(n, `jack ${jack} used ${n}x (capacity ${cap})`).toBeLessThanOrEqual(cap);
  }
}

function collisionLineCircuit(): string[] {
  const w: string[] = [];
  for (let j = 0; j < 4; j++) {
    w.push(`m0.${j + 1}+/m0.${j + 1}S`, `m0.${j + 1}T/m0.${j + 1}E`, `m0.${j + 1}F/m0.${j + 1}-`); // field
    w.push(`m1.${j + 1}+/m1.${j + 1}S`, `m1.${j + 1}T/m1.${j + 1}E`, `m1.${j + 1}F/m1.${j + 1}-`); // piece
    // collision branch j: + -> piece contact -> field contact -> join node
    w.push(`m1.${j + 1}+/m1.${j + 1}H`, `m1.${j + 1}G/m0.${j + 1}H`, `m0.${j + 1}G/m0.M10`);
  }
  w.push('m0.M10/m0.6A', 'm0.6B/m0.6-'); // collision light
  // line-full chain through the field relays' second sets
  w.push('m0.1+/m0.1L', 'm0.1K/m0.2L', 'm0.2K/m0.3L', 'm0.3K/m0.4L', 'm0.4K/m0.5A', 'm0.5B/m0.5-');
  return w;
}

describe('Multivac: collision + line-full logic (2 machines)', () => {
  it('all 256 field x piece combinations', { timeout: 600000 }, () => {
    const wires = collisionLineCircuit();
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, 2);
    m.initialize();
    for (let F = 0; F < 16; F++) {
      for (let j = 0; j < 4; j++) m.setSlide(j + 1, (F >> j) & 1 ? 'right' : 'left', 0);
      for (let P = 0; P < 16; P++) {
        for (let j = 0; j < 4; j++) m.setSlide(j + 1, (P >> j) & 1 ? 'right' : 'left', 1);
        const lights = m.getMachineState(0).lights;
        expect(lights[4] ? 1 : 0, `line-full F=${F}`).toBe(F === 15 ? 1 : 0);
        expect(lights[5] ? 1 : 0, `collision F=${F} P=${P}`).toBe((F & P) !== 0 ? 1 : 0);
        expect(m.getState().alerts).toEqual([]);
      }
    }
  });
});
