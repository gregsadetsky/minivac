/**
 * Multivac roadmap rung 7: MINI-TETRIS VERTICAL SLICE. 4-wide x 8-tall
 * field, 1x1 piece, gravity + stacking + line clear. Pure wiring — every
 * game decision is made by relay contacts. 145 relays across 25 machines
 * (the top of the roadmap's 15-25 estimate; the width is the price of
 * tie-point-safe private contacts — see the notes below).
 *
 * Composition (each part is a proven rung):
 * - FIELD = the rung-4 8x4 register file, verbatim: decoder + write groups
 *   + latching cells. The operator/decoder write path stays available for
 *   board setup; the game's LOCK path drives the same W groups through the
 *   spare 4th hole of each write group's second com.
 * - PIECE ROW = a rung-5 token ring without wraparound: the token IS the
 *   falling piece. Slaves carry three parallel-coil mirror relays each
 *   (mirrorA: the two W triggers; mirrorB + mirrorB2: four PRIVATE per-cell
 *   collision feeds, their coils gated by PRESSCUT so the sense contacts
 *   open during a write).
 * - COLLISION (rung 6) is computed continuously BETWEEN ticks: the token
 *   row's mirrorB/B2 contacts put the row BELOW onto the data rails through
 *   each cell's own readback contact; the piece-column relay's second
 *   contact taps its rail into the collision relay's coil. The bottom row's
 *   mirrorB feeds the collision node directly (the floor).
 * - TICK BRANCH: one tick slide; transfer contacts route it. LKS.G ->
 *   reset phase, LKS.J -> collision relay; collide.G -> lock phase,
 *   collide.J -> the ring clock (a normal fall).
 *
 * A LOCK: on the tick that lands the token on its rest row, the collision
 * relay fires mid-tick and its transfer contact re-routes the still-held
 * tick from the ring clock into the lock phase — landing and locking are
 * one tick. Collide holds through the press on COLLIDEM's contact (so the
 * write survives its own sense being cut), the depth-aligned power chain
 * (rail A -> READGATE -> the trigger rails -> RAILGATE2 -> the column feed)
 * fires the token row's W group via mirrorA, and the write is old-row OR
 * piece: each live cell keeps itself alive through its own breaker-arm
 * readback contact -> data rail -> its own write gate while its hold is
 * broken. LKM (the LOCKED master) latches; its slave LKS — the actual
 * branch contact — only picks the change up between ticks (two-phase, like
 * the ring itself: a branch contact that moved mid-press would re-route the
 * live tick and unwind its own source).
 *
 * LINE CLEAR: the 4 LINE relays hang on the data rails and their series
 * chain (fed from rail A, so operator writes never trigger it) fires CPSET,
 * whose private contact latches CLEARP when a lock completes the row. The
 * full line is visible while the press is held — the flash — and from the
 * release on CLEARP alone powers the breaker-trigger rail: the row's holds
 * stay broken with the gates and column feed dark, all four cells drop out,
 * and the next (reset) tick's RSTM2 breaks the latch to re-arm the row.
 * Rows above do NOT collapse in this slice; that is the field-scaling
 * rung's work.
 *
 * A RESET tick (the tick after any lock): resetrail breaks every ring
 * slave's hold through private reset-mirror contacts (the token dies), sets
 * the SPAWN latch, and RSTM clears LOCKED mid-tick. The next tick is a
 * normal fall tick: the ring clock fires, master 0 has sampled SPAWN while
 * the clock was low, the token reappears at row 0, and SPAWNCLR (a ring-
 * clock mirror) drops the SPAWN latch. So a piece lands-and-locks, then one
 * reset tick, then the next piece enters — a full-height drop is spawn +
 * 7 falls + reset = 9 ticks.
 *
 * Sparse-pinned: at 25 machines a cktsim tick costs tens of seconds, so the
 * dense-oracle equivalence rides on the per-rung tests below this one (all
 * dense-validated) plus the 5000-random-circuit sweep. Set MINIVAC_MASS=1
 * to run the short scenario under cktsim too.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import { tetrisCircuit, MACHINES, CELL, RING, PIECE } from '../../circuits/multivac-mini-tetris';

afterEach(() => setSolverEngine('sparse'));

const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env || {};
const MASS = env.MINIVAC_MASS === '1';

// real hardware: 2 holes per jack, 4 on COMMON, 6 on matrix groups 10/11
function assertJackCapacity(wires: string[]) {
  const uses = new Map<string, number>();
  for (const w of wires) for (const t of w.split('/')) uses.set(t, (uses.get(t) || 0) + 1);
  for (const [jack, n] of uses) {
    const cap = jack.endsWith('com') ? 4 : /M1[01]$/.test(jack) ? 6 : 2;
    expect(n, `jack ${jack} used ${n}x (capacity ${cap})`).toBeLessThanOrEqual(cap);
  }
}

// The circuit generator, relay allocation map, and TETRIS_IO live in
// src/circuits/multivac-mini-tetris.ts — shared with the /tetris/ browser
// page. This file owns the game-behavior tests.

function makeGame() {
  const { wires } = tetrisCircuit();
  assertJackCapacity(wires);
  const m = new MinivacSimulator(wires, false, MACHINES);
  m.initialize();
  const cellState = (r: number, j: number) => {
    const c = CELL(r, j);
    return m.getMachineState(Math.floor(c / 6)).relays[c % 6] ? 1 : 0;
  };
  const row = (r: number) =>
    cellState(r, 0) + 2 * cellState(r, 1) + 4 * cellState(r, 2) + 8 * cellState(r, 3);
  const field = () => Array.from({ length: 8 }, (_, r) => row(r));
  const tokenAt = () => {
    const hot: number[] = [];
    for (let i = 0; i < 8; i++) {
      const s = RING(i, 2);
      if (m.getMachineState(Math.floor(s / 6)).relays[s % 6]) hot.push(i);
    }
    return hot;
  };
  const setColumn = (j: number) => {
    for (let k = 0; k < 4; k++) {
      const p = PIECE(k);
      m.setSlide((p % 6) + 1, k === j ? 'right' : 'left', Math.floor(p / 6));
    }
  };
  const tick = () => {
    m.setSlide(5, 'right', 1);
    const rise = m.lastRelaxationIterations;
    m.setSlide(5, 'left', 1);
    expect(Math.max(rise, m.lastRelaxationIterations)).toBeLessThanOrEqual(15);
    expect(m.getState().alerts).toEqual([]);
  };
  const pressStart = () => {
    m.pressButton(6, 1);
    m.releaseButton(6, 1);
  };
  const operatorWrite = (r: number, v: number) => {
    m.setSlide(1, r & 1 ? 'right' : 'left', 0);
    m.setSlide(2, r & 2 ? 'right' : 'left', 0);
    m.setSlide(3, r & 4 ? 'right' : 'left', 0);
    for (let j = 0; j < 4; j++) m.setSlide(j + 1, (v >> j) & 1 ? 'right' : 'left', 1);
    m.pressButton(4, 0);
    m.releaseButton(4, 0);
    // park the data slides: a raised slide feeds its data rail permanently,
    // which the collision network would read as a phantom piece
    for (let j = 0; j < 4; j++) m.setSlide(j + 1, 'left', 1);
  };
  return { m, field, row, tokenAt, setColumn, tick, pressStart, operatorWrite };
}

// drop one piece in column j from spawn to lock, model-checking every tick.
//
// rhythm: on the tick that lands the token on its rest row, the collision
// relay fires MID-TICK (the token's new mirrors light the readback of the
// row below) and its transfer contact re-routes the still-held tick from
// the ring clock into the lock phase — landing and locking are one tick.
// Then one reset tick (token dies, SPAWN re-arms). A full-height drop is
// spawn + 7 falls + reset = 9 ticks.
function dropPiece(
  g: ReturnType<typeof makeGame>,
  j: number,
  model: number[],
  label: string
) {
  // rest row: first row whose below is the floor or an occupied cell
  let rest = 7;
  for (let r = 0; r < 7; r++) {
    if (model[r + 1] & (1 << j)) {
      rest = r;
      break;
    }
  }
  g.setColumn(j);
  g.tick(); // spawn tick: token appears at row 0
  expect(g.tokenAt(), `${label}: spawned`).toEqual([0]);
  expect(g.field(), `${label}: spawn does not touch the field`).toEqual(model);
  for (let r = 1; r <= rest; r++) {
    g.tick();
    expect(g.tokenAt(), `${label}: token at ${r}`).toEqual([r]);
    if (r === rest) {
      model[r] |= 1 << j;
      // a completed line flashes only within the press: CLEARP holds the
      // row's breakers up from the release on, so the cells are gone by the
      // time the tick is back low
      if (model[r] === 15) model[r] = 0;
    }
    expect(g.field(), `${label}: field after tick to ${r}`).toEqual(model);
  }
  g.tick(); // reset tick: token dies, SPAWN re-arms, CLEARP un-latches
  expect(g.tokenAt(), `${label}: token gone`).toEqual([]);
  expect(g.field(), `${label}: field after reset`).toEqual(model);
}

describe('Multivac: mini-tetris vertical slice (22 machines)', () => {
  it('gravity, stacking, and a line clear (sparse)', { timeout: 600000 }, () => {
    setSolverEngine('sparse');
    const g = makeGame();
    const model = Array(8).fill(0);
    expect(g.field()).toEqual(model);
    expect(g.tokenAt()).toEqual([]);

    // idle ticks with no token and no spawn must do nothing
    g.tick();
    g.tick();
    expect(g.field()).toEqual(model);
    expect(g.tokenAt()).toEqual([]);

    g.pressStart();
    dropPiece(g, 0, model, 'drop 1 (col 0)'); // -> rests on the floor, row 7
    expect(g.row(7)).toBe(0b0001);

    dropPiece(g, 1, model, 'drop 2 (col 1)');
    dropPiece(g, 2, model, 'drop 3 (col 2)');
    expect(g.row(7)).toBe(0b0111);

    // stacking: same column again -> must lock one row higher
    dropPiece(g, 0, model, 'drop 4 (col 0 again)');
    expect(g.row(6)).toBe(0b0001);
    expect(g.row(7)).toBe(0b0111);

    // line clear: col 3 falls PAST row 6 (disjoint) to the floor, completes
    // row 7, and the same press writes the row back as zeros
    dropPiece(g, 3, model, 'drop 5 (col 3, clears the line)');
    expect(g.row(7), 'line cleared').toBe(0);
    expect(g.row(6), 'row above stays (no collapse in this slice)').toBe(0b0001);

    // the game goes on: the floor is open again
    dropPiece(g, 2, model, 'drop 6 (col 2)');
    expect(g.row(7)).toBe(0b0100);
  });

  it('operator setup + one drop completes a line (sparse)', { timeout: 600000 }, () => {
    setSolverEngine('sparse');
    const g = makeGame();
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b1110);
    model[7] = 0b1110;
    expect(g.field()).toEqual(model);
    g.pressStart();
    dropPiece(g, 0, model, 'the tetris drop'); // disjoint with 0b1110 -> floor
    expect(g.row(7), 'line cleared on lock').toBe(0);
  });

  const heavy = MASS ? it : it.skip;
  heavy('short scenario under the dense oracle (MINIVAC_MASS=1)', { timeout: 3600000 }, () => {
    setSolverEngine('cktsim');
    const g = makeGame();
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b0110);
    model[7] = 0b0110;
    g.pressStart();
    dropPiece(g, 0, model, 'dense drop');
    expect(g.row(7)).toBe(0b0111);
  });
});
