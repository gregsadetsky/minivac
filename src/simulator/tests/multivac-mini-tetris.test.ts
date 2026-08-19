/**
 * Multivac roadmap rung 7: MINI-TETRIS VERTICAL SLICE. 4-wide x 8-tall
 * field, gravity + stacking + line clear. Pure wiring — every game decision
 * is made by relay contacts. 145 relays across 25 machines (the top of the
 * roadmap's 15-25 estimate; the width is the price of tie-point-safe
 * private contacts — see the notes below). The piece is whatever COLUMN
 * MASK the slides raise: singles, dominoes, wider — the per-column private
 * contacts make any horizontal shape work with zero circuit changes
 * (rung 9). Vertical shapes/rotation need a second token row — future work.
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
import { tetrisCircuit, MACHINES, CELL, RING, PIECE, VMODE, TOPW } from '../../circuits/multivac-mini-tetris';

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
  // the "piece" is whatever set of column slides is raised: the lock feed
  // and the collision taps fan per-column through private contacts, so any
  // mask — single, domino, a full row — works with zero circuit changes
  const setMask = (mask: number) => {
    for (let k = 0; k < 4; k++) {
      const p = PIECE(k);
      m.setSlide((p % 6) + 1, (mask >> k) & 1 ? 'right' : 'left', Math.floor(p / 6));
    }
  };
  const setColumn = (j: number) => setMask(1 << j);
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
  return { m, field, row, tokenAt, setMask, setColumn, tick, pressStart, operatorWrite };
}

// drop one piece (any column MASK — a single, a domino, wider) from spawn
// to lock, model-checking every tick. The piece rests when ANY of its
// columns is blocked below, so a domino can overhang an empty cell.
//
// rhythm: on the tick that lands the token on its rest row, the collision
// relay fires MID-TICK (the token's new mirrors light the readback of the
// row below) and its transfer contact re-routes the still-held tick from
// the ring clock into the lock phase — landing and locking are one tick.
// Then one reset tick (token dies, SPAWN re-arms). A full-height drop is
// spawn + 7 falls + reset = 9 ticks.
function dropPiece(
  g: ReturnType<typeof makeGame>,
  mask: number,
  model: number[],
  label: string
) {
  // rest row: first row whose below blocks any column of the mask
  let rest = 7;
  for (let r = 0; r < 7; r++) {
    if (model[r + 1] & mask) {
      rest = r;
      break;
    }
  }
  g.setMask(mask);
  g.tick(); // spawn tick: token appears at row 0
  expect(g.tokenAt(), `${label}: spawned`).toEqual([0]);
  expect(g.field(), `${label}: spawn does not touch the field`).toEqual(model);
  for (let r = 1; r <= rest; r++) {
    g.tick();
    expect(g.tokenAt(), `${label}: token at ${r}`).toEqual([r]);
    if (r === rest) {
      model[r] |= mask;
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

describe('Multivac: mini-tetris vertical slice (25 machines)', () => {
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
    dropPiece(g, 0b0001, model, 'drop 1 (col 0)'); // -> rests on the floor, row 7
    expect(g.row(7)).toBe(0b0001);

    dropPiece(g, 0b0010, model, 'drop 2 (col 1)');
    dropPiece(g, 0b0100, model, 'drop 3 (col 2)');
    expect(g.row(7)).toBe(0b0111);

    // stacking: same column again -> must lock one row higher
    dropPiece(g, 0b0001, model, 'drop 4 (col 0 again)');
    expect(g.row(6)).toBe(0b0001);
    expect(g.row(7)).toBe(0b0111);

    // line clear: col 3 falls PAST row 6 (disjoint) to the floor, completes
    // row 7, and the same press writes the row back as zeros
    dropPiece(g, 0b1000, model, 'drop 5 (col 3, clears the line)');
    expect(g.row(7), 'line cleared').toBe(0);
    expect(g.row(6), 'row above stays (no collapse in this slice)').toBe(0b0001);

    // the game goes on: the floor is open again
    dropPiece(g, 0b0100, model, 'drop 6 (col 2)');
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
    dropPiece(g, 0b0001, model, 'the tetris drop'); // disjoint with 0b1110 -> floor
    expect(g.row(7), 'line cleared on lock').toBe(0);
  });

  // dominoes: a two-cell piece is just two raised column slides — the lock
  // feed and collision taps are per-column private contacts, so the circuit
  // supports any mask with zero changes. This proves it: floor landing, a
  // line completed by two dominoes, and an overhang (the piece rests when
  // ANY of its columns is blocked, leaving air beneath the other).
  it('dominoes: two-cell pieces, a two-domino line, and an overhang (sparse)', { timeout: 600000 }, () => {
    setSolverEngine('sparse');
    const g = makeGame();
    const model = Array(8).fill(0);
    g.pressStart();
    dropPiece(g, 0b0011, model, 'domino at 0-1');
    expect(g.row(7)).toBe(0b0011);
    dropPiece(g, 0b1100, model, 'domino at 2-3 completes the line');
    expect(g.row(7), 'two dominoes cleared the line').toBe(0);
    dropPiece(g, 0b0001, model, 'single at col 0');
    dropPiece(g, 0b0011, model, 'domino rests on it, col 1 overhangs air');
    expect(g.row(7)).toBe(0b0001);
    expect(g.row(6)).toBe(0b0011);
    dropPiece(g, 0b0010, model, 'single at col 1 lands ON the overhang');
    expect(g.row(5)).toBe(0b0010);
  });

  // seeded random gameplay, model-checked EVERY tick. This adds what the
  // scripted scenarios cannot: mid-fall steering (the collision target
  // changes while the piece falls), mid-fall RESHAPING (the piece mask is
  // just slides, so a single can become a domino mid-flight — the model
  // mirrors the machine, not tournament rules), spawns straight onto a tall
  // stack (merged spawn+lock), and whatever stack shapes the seed builds.
  it('random gameplay: seeded drops, steering, mixed piece widths (sparse)', { timeout: 900000 }, () => {
    setSolverEngine('sparse');
    const lcg = (seed: number) => {
      let s = seed >>> 0;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    };
    const rnd = lcg(20260819);
    const DROPS = parseInt(env.MINIVAC_TETRIS_DROPS || '14', 10);

    const g = makeGame();
    const model = Array(8).fill(0);
    let token = -1; // falling piece's row, -1 = none
    let mask = 0b0001;
    let resetPending = false; // the tick after a lock is always a reset
    let spawnArmed = false;
    let locks = 0;
    let clears = 0;
    let ticks = 0;

    const lockAt = (r: number) => {
      model[r] |= mask;
      if (model[r] === 15) {
        model[r] = 0; // CLEARP zeroes the row as the press releases
        clears++;
      }
      locks++;
      resetPending = true;
    };

    g.pressStart();
    spawnArmed = true;
    while (locks < DROPS) {
      if (rnd() < 0.45) {
        const width = rnd() < 0.35 ? 2 : 1;
        const pos = Math.floor(rnd() * (5 - width));
        mask = (width === 2 ? 0b11 : 0b1) << pos;
        g.setMask(mask);
      }
      // model what this tick must do, then let the relays do it. Landing
      // and locking are one tick (the mid-tick collide re-route); a PURE
      // lock tick only exists when steering put a block under an already
      // falling piece between ticks (collide pre-armed).
      const resting = () => token === 7 || (model[token + 1] & mask) !== 0;
      if (resetPending) {
        token = -1;
        resetPending = false;
        spawnArmed = true;
      } else if (token >= 0) {
        if (resting()) lockAt(token); // pre-armed collide: no movement
        else {
          token++;
          if (resting()) lockAt(token); // merged landing + lock
        }
      } else if (spawnArmed) {
        token = 0;
        spawnArmed = false;
        if (resting()) lockAt(0); // spawn straight onto the stack
      }
      g.tick();
      ticks++;
      expect(g.field(), `tick ${ticks} field (mask ${mask.toString(2)})`).toEqual(model);
      expect(g.tokenAt(), `tick ${ticks} token`).toEqual(token >= 0 ? [token] : []);
    }
    // the seed is fixed, so the run is deterministic; line-clear coverage
    // also lives in the scripted tests above. raise MINIVAC_TETRIS_DROPS
    // for longer random runs.
    console.log(`random gameplay: ${ticks} ticks, ${locks} locks, ${clears} line clears`);
    expect(locks).toBe(DROPS);
  });

  // rung 9b groundwork: the TOPW mirrors (one per row 1-7, a parallel coil
  // on each slave's mirror com) are the phase-2 row selectors — TOPW(r)
  // closed will route the top-cell write to row r-1. Before any routing
  // exists they must (a) track the token row exactly and (b) not disturb
  // the game: the extra coil on every slave com changes the hold-path load,
  // which is precisely the kind of change that can drop a relay below
  // pickup. A full drop with the mirrors watched pins both.
  it('vertical prep: TOPW mirrors track the token row, VMODE follows its slide (sparse)', { timeout: 600000 }, () => {
    setSolverEngine('sparse');
    const g = makeGame();
    const relayOn = (n: number) =>
      g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0;
    const topwState = () => Array.from({ length: 7 }, (_, i) => relayOn(TOPW(i + 1)));

    expect(relayOn(VMODE), 'VMODE starts off').toBe(0);
    g.m.setSlide((VMODE % 6) + 1, 'right', Math.floor(VMODE / 6));
    expect(relayOn(VMODE), 'VMODE follows its slide up').toBe(1);
    expect(topwState(), 'no token, no TOPW').toEqual([0, 0, 0, 0, 0, 0, 0]);

    const model = Array(8).fill(0);
    g.setColumn(0);
    g.pressStart();
    g.tick(); // spawn: token at row 0 — which has no TOPW
    expect(g.tokenAt()).toEqual([0]);
    expect(topwState(), 'token at 0: all TOPW open').toEqual([0, 0, 0, 0, 0, 0, 0]);
    for (let r = 1; r <= 7; r++) {
      g.tick();
      expect(g.tokenAt(), `token at ${r}`).toEqual([r]);
      expect(topwState(), `TOPW(${r}) alone tracks the token`).toEqual(
        Array.from({ length: 7 }, (_, i) => (i + 1 === r ? 1 : 0))
      );
    }
    // row 7 is the floor: that last tick was the merged landing + lock
    model[7] = 0b0001;
    expect(g.field(), 'lock wrote the bottom row as before').toEqual(model);
    g.tick(); // reset: token dies, mirrors must all drop
    expect(g.tokenAt()).toEqual([]);
    expect(topwState(), 'token gone, TOPW all open').toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(g.field()).toEqual(model);

    g.m.setSlide((VMODE % 6) + 1, 'left', Math.floor(VMODE / 6));
    expect(relayOn(VMODE), 'VMODE follows its slide down').toBe(0);
  });

  const heavy = MASS ? it : it.skip;
  heavy('short scenario under the dense oracle (MINIVAC_MASS=1)', { timeout: 3600000 }, () => {
    setSolverEngine('cktsim');
    const g = makeGame();
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b0110);
    model[7] = 0b0110;
    g.pressStart();
    dropPiece(g, 0b0001, model, 'dense drop');
    expect(g.row(7)).toBe(0b0111);
  });
});
