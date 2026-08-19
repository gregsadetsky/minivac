/**
 * Multivac roadmap rung 3: 4-bit RIPPLE-CARRY ADDER (3 machines, 15 relays).
 * Pure wiring, 256 input pairs exhaustive, green under both engines.
 *
 * Per stage i: input relays A_i (m0), B_i (m1), a B' mirror (m2, coil in
 * parallel with B — B's own two contact sets are consumed by the sum ladder),
 * and for stages 1-3 a carry relay C_i energized by the incoming carry.
 *
 * SUM = XOR3 as a transfer-contact parity ladder: A's set 1 splits + into
 * even/odd rails, B's two sets swap them, C's two sets swap again; the
 * odd-parity terminal is the sum light. The light's own A jack is the 2-hole
 * merge node, so the ladder needs only two com jacks per stage.
 *
 * CARRY = the comparator's kill/generate/propagate trick, roles rearranged:
 * carry-out is A's set-2 ARM. A=1 selects a B' contact that either connects +
 * (generate, B=1) or the carry-in node (propagate, B=0); A=0 selects the
 * mirror-image branch (propagate if B=1, dead-end kill if B=0). Every
 * potential sneak path dead-ends at the complementary open contact — audited
 * against the tie-point law. The carry-in com node carries exactly 4 wires:
 * upstream arm, C_i coil, and the two propagate branches.
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

// carry relay homes: C_1 = m0.5, C_2 = m0.6, C_3 = m1.5 (m1.5's light shows carry-out)
const CARRY = ['', 'm0.5', 'm0.6', 'm1.5'];

function adderCircuit(): string[] {
  const w: string[] = [];
  for (let i = 0; i < 4; i++) {
    const A = `m0.${i + 1}`, B = `m1.${i + 1}`, Bp = `m2.${i + 1}`;
    const C = CARRY[i]; // carry-in relay of THIS stage ('' for bit 0)

    // input relays: A from its slide; B from its slide with B' mirror in parallel
    w.push(`${A}+/${A}S`, `${A}T/${A}E`, `${A}F/${A}-`);
    w.push(`${B}+/${B}S`, `${B}T/${B}com`, `${B}com/${B}E`, `${B}F/${B}-`);
    w.push(`${B}com/${Bp}E`, `${Bp}F/${Bp}-`);

    // sum ladder: + -> A set 1 -> even/odd rails -> B DPDT swap -> L2 nodes
    w.push(`${A}+/${A}H`);
    w.push(`${A}J/${B}H`, `${A}G/${B}L`); // A=0 rail -> B set 1 arm, A=1 rail -> B set 2 arm
    // L2_1 node (A xor B = 1) always exists on Bp's com
    w.push(`${B}G/${Bp}com`, `${B}N/${Bp}com`);
    if (C) {
      // L2_0 node (A xor B = 0) on A's free com; C swaps once more into the light
      w.push(`${B}J/${A}com`, `${B}K/${A}com`);
      w.push(`${A}com/${C}H`, `${Bp}com/${C}L`);
      w.push(`${C}G/${Bp}A`, `${C}N/${Bp}A`, `${Bp}B/${Bp}-`); // sum light = odd parity
    } else {
      // bit 0 has no carry-in: sum = A xor B, L2_0 stays unwired (kill)
      w.push(`${Bp}com/${Bp}A`, `${Bp}B/${Bp}-`);
    }

    // carry-out = A set-2 arm; kill/generate/propagate via B' contacts
    w.push(`${A}K/${Bp}H`, `${A}N/${Bp}L`); // A=1 -> B' set 1, A=0 -> B' set 2
    w.push(`${Bp}+/${Bp}G`); // generate: A=1, B=1 connects +
    if (C) {
      w.push(`${Bp}J/${C}com`, `${Bp}K/${C}com`); // propagate branches join carry-in node
      w.push(`${C}com/${C}E`, `${C}F/${C}-`); // carry relay coil hangs on the node
      w.push(`m0.${i}L/${C}com`); // upstream: previous stage's carry-out arm
    }
    // (B'2.NC stays unwired: A=0, B=0 kills the carry)
  }
  w.push('m0.4L/m1.5A', 'm1.5B/m1.5-'); // final carry-out light
  return w;
}

// runs under the ambient suite engine, like the register/comparator tests:
// exhaustive under sparse in every `npm run check`, exhaustive under the dense
// oracle in the MINIVAC_SOLVER=dense pass (2026-08-19: both verified green;
// an in-test engine loop would add ~190s of cktsim to every suite run).
describe('Multivac: 4-bit ripple-carry adder (3 machines)', () => {
  it('computes A + B for all 256 input pairs', { timeout: 600000 }, () => {
    const wires = adderCircuit();
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, 3);
    m.initialize();
    for (let A = 0; A < 16; A++) {
      for (let B = 0; B < 16; B++) {
        for (let i = 0; i < 4; i++) {
          m.setSlide(i + 1, (A >> i) & 1 ? 'right' : 'left', 0);
          m.setSlide(i + 1, (B >> i) & 1 ? 'right' : 'left', 1);
        }
        const sum = m.getMachineState(2);
        const got =
          (sum.lights[0] ? 1 : 0) + (sum.lights[1] ? 2 : 0) +
          (sum.lights[2] ? 4 : 0) + (sum.lights[3] ? 8 : 0) +
          (m.getMachineState(1).lights[4] ? 16 : 0);
        expect(got, `A=${A} B=${B}`).toBe(A + B);
        expect(m.lastRelaxationIterations).toBeLessThanOrEqual(10);
        expect(m.getState().alerts).toEqual([]);
      }
    }
  });
});
