/**
 * PROBE (B1 review finding T2): LINEDLY2 is live on the phase-3 tick —
 * its coil hangs on P2COL.G and P2COL rides p2gate, which is hot on BOTH
 * phase ticks. So a lock whose ONLY completed row is r-2 (phase 3's row)
 * may latch CLEARP2 as well as CLEARP3, and CLEARP2's pulse holds row
 * r-1's breakers to the reset: the incomplete row r-1 would be WIPED,
 * plus a spurious elevator seed at t-1.
 *
 * Reachable in main only with the V3 slide up (no page sets it), so if
 * real it is latent — but B1 (ring-driven verticals) makes it common.
 * This is the trace-before-fix probe; it becomes the pinned regression
 * if the mechanism is confirmed.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import { tetrisCircuit, TETRIS_IO, homeColumn } from '../../circuits/multivac-mini-tetris';

afterEach(() => setSolverEngine('sparse'));

describe('phase-3 line sense: an r-2-only completion must clear ONLY row r-2', () => {
  it('the incomplete row r-1 survives, its cells intact (fast)', { timeout: 600000 }, () => {
    setSolverEngine('fast');
    const ROWS = 8;
    const HOME = homeColumn(4);
    const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS);
    const m = new MinivacSimulator(wires, false, L.machines);
    m.initialize();
    const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
    const row = (r: number) =>
      rel(L.CELL(r, 0)) + 2 * rel(L.CELL(r, 1)) + 4 * rel(L.CELL(r, 2)) + 8 * rel(L.CELL(r, 3));
    const tok = () => {
      for (let i = 0; i < ROWS; i++) if (rel(L.RING(i, 2))) return i;
      return -1;
    };
    const score = () => {
      for (let d = 0; d < 10; d++) if (rel(L.SCR(d, 2))) return d;
      return -1;
    };
    const ow = (r: number, v: number) => {
      m.setSlide(TETRIS_IO.wid.slide, 'left', btnMachine);
      m.setSlide(1, r & 1 ? 'right' : 'left', 0);
      m.setSlide(2, r & 2 ? 'right' : 'left', 0);
      m.setSlide(3, r & 4 ? 'right' : 'left', 0);
      for (let j = 0; j < 4; j++) m.setSlide(j + 1, (v >> j) & 1 ? 'right' : 'left', 1);
      m.pressButton(4, 0);
      m.releaseButton(4, 0);
      for (let j = 0; j < 4; j++) m.setSlide(j + 1, 'left', 1);
    };

    // row 5 (= r-2 for the floor lock) is one hole short AT THE HOME
    // column; row 6 (= r-1) holds a marker that must SURVIVE and stays
    // incomplete after the piece's own cell joins it
    ow(5, 0b1111 & ~(1 << HOME));
    ow(6, 0b0100); // the marker at (6,2); HOME is 1, so no overlap
    // a 3-tall bar: the VMODE slide + the V3 slide, with the ring at its
    // boot 1x1 — the SLIDE compatibility path (toys-retire took the
    // 2-tall out of the chooser, but the boot state is exactly where
    // the legacy slide modes stay meaningful)
    m.setSlide((L.VMODE % 6) + 1, 'right', Math.floor(L.VMODE / 6));
    m.setSlide((L.V3M % 6) + 1, 'right', Math.floor(L.V3M / 6));
    m.pressButton(6, 1);
    m.releaseButton(6, 1);
    for (let t = 0; t < 50; t++) {
      m.setSlide(5, 'right', 1);
      m.setSlide(5, 'left', 1);
      if (t > 2 && tok() < 0 && !rel(L.LKS) && !rel(L.P2S) && !rel(L.LANE)) break;
    }
    // correct: ONLY row 5 completed and cleared (score 1); the collapse
    // walked rows 0-4 down one; rows 6 and 7 keep every cell the lock
    // and the marker gave them
    expect(m.getState().alerts).toEqual([]);
    // BOTH facets of the r-2-only case are pinned here: before P3LG the
    // field read [.,.,.,.,.,0,0,2] (row r-1 wiped); before CLEARPM3B the
    // digits read 1100000000 (SCBOOT never latched, two-hot ring)
    const hot = [...Array(10)].map((_, d) => rel(L.SCR(d, 2))).reduce((a: number, b) => a + b, 0);
    expect(hot, 'the score digit is one-hot').toBe(1);
    expect(rel(L.SCBOOT), 'the boot seed latched away on the phase-3-only clear').toBe(1);
    expect(score(), 'exactly one line scored').toBe(1);
    expect(row(7), 'the bottom row keeps its piece cell').toBe(1 << HOME);
    expect(row(6), 'row r-1 SURVIVES: marker + its piece cell').toBe(0b0100 | (1 << HOME));
    expect(row(5), 'the completed row cleared and nothing fell into it').toBe(0);
  });
});
