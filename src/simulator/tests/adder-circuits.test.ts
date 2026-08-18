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

// experiment 4, p75: half-adder with carry. slide 6 = A (left=1), button 6 = B.
// light 6 = sum, light 5 = carry out.
const halfAdderCircuit = '5A/6U 5B/5- 6A/6S 6B/6- 6R/6Z 6T/6X 6T/6V 6Y/6+'.split(' ');

// experiment 5, p76: full adder. adds relay 6 as carry-in (moved manually).
const fullAdderCircuit = ('5A/6U 5B/5- 5C/6S 5F/5- 5G/6J 5H/5+ 5J/6G 6A/6H 6B/6- ' +
  '6J/6L 6K/6U 6R/6Z 6T/6X 6T/6V 6Y/6+').split(' ');

// experiment 6, p77: three-bit adder. slides 4-6 = first number (left=1),
// buttons 4-6 = second number, answer on lights 3(MSB),4,5,6(LSB).
const threeBitAdderCircuit = ('2C/3G 2F/3F 2G/4S 2H/4Y 2K/4W 2L/2+ 2N/4U 3A/M10 3B/3- ' +
  '3C/4G 3F/4E 3G/3N 3H/4Z 3J/4T 3K/4R 3K/M10 3L/4X 4A/4V 4B/4- 4E/5F 4F/5S 4G/5U ' +
  '4H/4N 4K/5Z 4L/5A 4N/5X 4Y/5Y 5B/5- 5C/6K 5F/6E 5G/6S 5H/5+ 5K/6W 5L/6A 5N/6U ' +
  '5R/6T 5T/6R 5T/5V 5Y/6V 6B/6- 6E/6- 6G/6R 6H/6X 6J/6K 6L/6Z 6N/6T 6V/6Y 6Y/6+').split(' ');

describe('Book 2-4 Experiment 4: Half-Adder with Carry', () => {
  for (let A = 0; A <= 1; A++) {
    for (let B = 0; B <= 1; B++) {
      it(`${A} + ${B} = sum ${A ^ B}, carry ${A & B}`, () => {
        const m = new MinivacSimulator(halfAdderCircuit);
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
          const m = new MinivacSimulator(fullAdderCircuit);
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
        const m = new MinivacSimulator(threeBitAdderCircuit);
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
