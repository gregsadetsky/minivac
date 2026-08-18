/**
 * Adder circuits from book 2-4 (Digital Computer Experiments), experiments 4-6.
 * Wire lists transcribed verbatim from the book pages 75-77.
 *
 * All three verified correct in the simulator on 2026-08-17 under both the old
 * guessed component values and the measured-device model. github issue #8
 * (three-bit adder "doesn't work") traced to a miswiring in the reproduction:
 * the book's 5Y/6V was replaced by 5Y/5V + 6Y/6V, which alone reproduces the
 * reported 42/64 wrong sums.
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';
import { fullAdderCircuit, halfAdderCircuit, threeBitAdderCircuit } from '../../circuits';

describe('Book 2-4 Experiment 4: Half-Adder with Carry', () => {
  for (let A = 0; A <= 1; A++) {
    for (let B = 0; B <= 1; B++) {
      it(`${A} + ${B} = sum ${A ^ B}, carry ${A & B}`, () => {
        const m = new MinivacSimulator(halfAdderCircuit.circuit);
        m.setSlide(6, A ? 'left' : 'right');
        m.initialize();
        if (B) m.pressButton(6);
        const s = m.getState();
        expect(s.lights[5]).toBe((A ^ B) === 1); // sum on light 6
        expect(s.lights[4]).toBe((A & B) === 1); // carry on light 5
      });
    }
  }
});

describe('Book 2-4 Experiment 5: Full Adder', () => {
  for (let cin = 0; cin <= 1; cin++) {
    for (let A = 0; A <= 1; A++) {
      for (let B = 0; B <= 1; B++) {
        const total = A + B + cin;
        it(`${A} + ${B} + carry-in ${cin} = sum ${total & 1}, carry ${total >> 1}`, () => {
          const m = new MinivacSimulator(fullAdderCircuit.circuit);
          m.setSlide(6, A ? 'left' : 'right');
          m.initialize();
          if (B) m.pressButton(6);
          if (cin) m.setRelayOverride(6, true); // "manually move relay 6"
          const s = m.getState();
          expect(s.lights[5]).toBe((total & 1) === 1); // sum on light 6
          expect(s.lights[4]).toBe(total >= 2);        // carry on light 5
        });
      }
    }
  }
});

describe('Book 2-4 Experiment 6: Three-Bit Adder', () => {
  function lightsValue(lights: boolean[]): number {
    return (lights[2] ? 8 : 0) + (lights[3] ? 4 : 0) + (lights[4] ? 2 : 0) + (lights[5] ? 1 : 0);
  }

  for (let a = 0; a <= 7; a++) {
    it(`adds ${a} + 0..7 correctly`, { timeout: 30000 }, () => {
      for (let b = 0; b <= 7; b++) {
        const m = new MinivacSimulator(threeBitAdderCircuit.circuit);
        m.setSlide(4, a & 4 ? 'left' : 'right');
        m.setSlide(5, a & 2 ? 'left' : 'right');
        m.setSlide(6, a & 1 ? 'left' : 'right');
        m.initialize();
        if (b & 4) m.pressButton(4);
        if (b & 2) m.pressButton(5);
        if (b & 1) m.pressButton(6);
        const s = m.getState();
        expect(s.alerts).toEqual([]);
        expect(lightsValue(s.lights), `${a} + ${b}`).toBe(a + b);
      }
    });
  }
});
