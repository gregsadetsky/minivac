/**
 * THE DIFFERENTIAL HARNESS: the relay machine vs the tetris reference
 * model (src/tetris/reference.ts), fed identical key sequences, full
 * state compared after EVERY settled key — field, token row, register
 * position, shape ring state, score digit, game-over latch.
 *
 * The old rules models (in multivac-mini-tetris.test.ts and the page
 * driver) verify the machine against its own spec; this file verifies it
 * against the TARGET spec. The reference's compat knobs mark the rungs
 * still to climb (rotation 4-cycles, center home, the vertical states);
 * as each rung lands, its knob here moves to the target value. When no
 * knob is left, the machine plays tetris.
 *
 * Also here: the TABLE LOCKSTEP test — the circuit's SHAPES/ROT_STATE
 * and the reference's TARGET tables are independent in origin (circuit:
 * grown rung by rung; reference: laid from the NRS rotation tables), so
 * this is where they are mechanically pinned to each other.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import {
  tetrisCircuit,
  MACHINES,
  CELL,
  RING,
  SCR,
  GAMEOVER,
  LKS,
  LANE,
  SHAPES,
  NSTATES,
  ROT_STATE,
  TETRIS_IO,
  SELECTION_NEXT,
  homeColumn as circuitHome,
} from '../../circuits/multivac-mini-tetris';
import {
  TARGET_SHAPES,
  TARGET_NSTATES,
  TARGET_ROT,
  TetrisReference,
  homeColumn,
  type RefKey,
} from '../../tetris/reference';

afterEach(() => setSolverEngine('sparse'));

const ROWS = 8;
const COLS = 4;

describe('table lockstep: the circuit tables are a prefix of the target tables', () => {
  it('every implemented shape matches the target geometry state for state', () => {
    expect(NSTATES).toBeLessThanOrEqual(TARGET_NSTATES);
    for (let i = 0; i < NSTATES; i++) {
      const c = SHAPES[i];
      const t = TARGET_SHAPES[i];
      expect(c.label, `state ${i}`).toBe(t.label);
      // since B1-0 both tables speak rows: compare them outright, and
      // pin the circuit's derived 2-row views against its own rows
      expect(c.rows, `state ${i} (${t.label}) rows`).toEqual(t.rows);
      expect({ off: c.bOff, w: c.bW }, `state ${i} derived bottom`).toEqual(c.rows[0]);
      expect({ off: c.tOff, w: c.tW }, `state ${i} derived top`).toEqual(c.rows[1] ?? { off: 0, w: 0 });
    }
  });

  it("the circuit's home column and the reference's derivation agree", () => {
    for (const cols of [4, 6, 10]) {
      expect(circuitHome(cols), `home at ${cols} columns`).toBe(
        homeColumn(cols, TARGET_SHAPES.slice(0, NSTATES))
      );
    }
    // and the dealer-note values hold
    expect(circuitHome(4)).toBe(1);
    expect(circuitHome(6)).toBe(2);
  });

  it("the circuit's rotation map is the target map with the unbuilt verticals shortcut", () => {
    for (let i = 0; i < NSTATES; i++) {
      const c = ROT_STATE(i);
      const t = TARGET_ROT[i];
      if (c === i) {
        // a circuit singleton must be a target singleton OR have its
        // partner among the states not built yet (S/Z/I verticals)
        expect(t === i || t >= NSTATES, `state ${i}: singleton only until state ${t} lands`).toBe(true);
      } else if (t === c) {
        // a true 2-cycle in both (the toy domino)
      } else {
        // the circuit's flip shortcuts the target 4-cycle: one circuit
        // turn = two target turns, through a vertical state not built yet
        expect(t, `state ${i}: the skipped vertical is unbuilt`).toBeGreaterThanOrEqual(NSTATES);
        expect(TARGET_ROT[t], `state ${i}: the flip is the target double turn`).toBe(c);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// the live differential

function makeRig() {
  setSolverEngine('fast'); // the page's engine; dense stays the oracle elsewhere
  const { wires } = tetrisCircuit();
  const m = new MinivacSimulator(wires, false, MACHINES);
  m.initialize();
  const rel = (n: number) => m.getMachineState(Math.floor(n / 6)).relays[n % 6];
  const relLoc = (l: { machine: number; index: number }) => m.getMachineState(l.machine).relays[l.index];

  const field = () =>
    Array.from({ length: ROWS }, (_, r) => {
      let mask = 0;
      for (let j = 0; j < COLS; j++) if (rel(CELL(r, j))) mask |= 1 << j;
      return mask;
    });
  const tokenRow = () => {
    for (let i = 0; i < ROWS; i++) if (rel(RING(i, 2))) return i;
    return -1;
  };
  const pos = () => {
    for (let j = 0; j < COLS; j++) if (relLoc(TETRIS_IO.posRelay(j))) return j;
    return -1;
  };
  const shapeIx = () => {
    for (let i = 0; i < NSTATES; i++) if (relLoc(TETRIS_IO.shapeRelay(i))) return i;
    return -1;
  };
  const score = () => {
    for (let d = 0; d < 10; d++) if (rel(SCR(d, 2))) return d;
    return -1;
  };
  const snapshot = () => ({
    field: field(),
    tokenRow: tokenRow(),
    pos: pos(),
    shapeIx: shapeIx(),
    score: score(),
    gameOver: rel(GAMEOVER),
  });

  const pressBtn = (b: { button: number; machine: number }) => {
    m.pressButton(b.button, b.machine);
    m.releaseButton(b.button, b.machine);
    expect(m.getState().alerts).toEqual([]);
  };
  const tickOnce = () => {
    m.setSlide(TETRIS_IO.tick.slide, 'right', TETRIS_IO.tick.machine);
    m.setSlide(TETRIS_IO.tick.slide, 'left', TETRIS_IO.tick.machine);
    expect(m.getState().alerts).toEqual([]);
  };
  // a user-level tick: the tick itself plus every tick the machine owes
  // itself afterwards (phase 2/3, reset, the collapse walk) — exactly the
  // page's runTick loop. comparisons happen only at settled states.
  const tickSettle = () => {
    tickOnce();
    let guard = 3 * ROWS + 12;
    while ((rel(LKS) || rel(LANE)) && guard-- > 0) tickOnce();
    expect(guard, 'the bookkeeping loop drained').toBeGreaterThan(0);
  };

  const key = (k: RefKey) => {
    if (k === 'tick') tickSettle();
    else if (k === 'start') pressBtn(TETRIS_IO.start);
    else if (k === 'left') pressBtn(TETRIS_IO.left);
    else if (k === 'right') pressBtn(TETRIS_IO.right);
    else pressBtn(TETRIS_IO.up);
  };

  return { m, snapshot, key };
}

function makePair() {
  const rig = makeRig();
  const ref = new TetrisReference({
    rows: ROWS,
    cols: COLS,
    shapes: NSTATES, // == TARGET_NSTATES since B3: all 22 states exist
    // B3 FLIPPED THE ROT KNOB: rot 'target' — the machine's map IS the
    // NES map now (12 <-> 21 was the last edge). this green run is the
    // "normal rotation" acceptance the whole ladder aimed at.
    rot: 'target',
    selectionNext: SELECTION_NEXT, // the circuit's own chooser map (its D-feed wiring)
    home: circuitHome(COLS), // CENTER SPAWN — at target since 2026-08-26
    // the ONE surviving asterisk: the tok-3 occupancy seam (declared,
    // receipted in multivac-vertical-pieces; the MIRCT3 rung deletes it)
    tok3Blind: true,
  });
  let n = 0;
  const play = (keys: RefKey[], label: string) => {
    for (const k of keys) {
      rig.key(k);
      ref.key(k);
      n++;
      expect(rig.snapshot(), `${label}: key #${n} (${k}) diverged`).toEqual(ref.snapshot());
    }
  };
  // convenience generators that consult the REFERENCE for control flow;
  // every generated key still goes through the diff
  const steer = (col: number, label: string) => {
    let guard = COLS + 2;
    while (ref.pos !== col && guard-- > 0) play([ref.pos < col ? 'right' : 'left'], label);
    expect(ref.pos, `${label}: steered to ${col}`).toBe(col);
  };
  const dropAt = (col: number, label: string) => {
    play(['tick'], label); // spawn
    steer(col, label);
    let guard = ROWS + 4;
    while (ref.tokenRow >= 0 && guard-- > 0) play(['tick'], label);
    expect(ref.tokenRow, `${label}: locked`).toBe(-1);
  };
  const selectShape = (ix: number, label: string) => {
    let guard = NSTATES + 2;
    while (ref.shapeIx !== ix && guard-- > 0) play(['up'], label);
    expect(ref.shapeIx, `${label}: selected ${TARGET_SHAPES[ix].label}`).toBe(ix);
  };
  return { rig, ref, play, steer, dropAt, selectShape };
}

describe('the differential: machine vs reference, every key compared', () => {
  it('scripted game: the rho entry, squares, refusals, rotations, clears, collapse, top-out (fast)', { timeout: 600000 }, () => {
    const { ref, play, steer, dropAt, selectShape } = makePair();

    // boot state agrees (register seeded home, ring at the boot 1x1, spawn armed)
    play(['start'], 'boot'); // idempotent on both

    // toys-retire: the FIRST UP is the one-way entry edge — the boot
    // 1x1 steps to the O and the ring never returns to the toys
    expect(ref.pos).toBe(circuitHome(COLS));
    play(['up'], 'the rho entry: 1x1 -> O');
    expect(ref.shapeIx).toBe(3);
    play(['left', 'left'], 'walk to the wall; the second left refuses'); // home 1 -> 0 -> refused
    // two squares complete BOTH bottom rows at four wide: the double
    // clear and its collapse, on tetrominoes alone
    dropAt(0, 'square at the wall');
    dropAt(2, 'square right — rows 6+7 complete together');
    expect(ref.score).toBe(2);

    // S needs column >= 1: the chooser refuses at pos 0, passes at home
    steer(0, 'walk to the wall');
    play(['up'], 'S refused at column 0'); // chooser stalls: state stays O
    expect(ref.shapeIx).toBe(3);
    steer(1, 'back to the home column');
    selectShape(4, 'S enters at the home column');
    play(['tick', 'left'], 'S spawned; left into its bound refused');
    expect(ref.pos).toBe(1);
    play(['up'], 'S rotates VERTICAL mid-fall since B1'); // conducts on both sides
    while (ref.tokenRow >= 0) play(['tick'], 'drop the S');

    // L: spawn, flip mid-fall, flip back. before center spawn the re-home
    // parked the register at 0, outside the S range, and every reshape
    // stalled there — the CENTER home is inside every range, so the
    // chooser proceeds straight from the re-home
    expect(ref.pos).toBe(circuitHome(COLS));
    selectShape(6, 'choose L');
    play(['tick'], 'spawn L');
    play(['up'], 'L -> L vert R mid-fall (a QUARTER turn since B2)');
    expect(ref.shapeIx).toBe(15);
    play(['up'], 'L vert R -> L flip');
    expect(ref.shapeIx).toBe(9);
    while (ref.tokenRow >= 0) play(['tick'], 'drop the L');

    // T with a flip left in place, dropped wherever it lands legally
    selectShape(8, 'choose T');
    play(['tick', 'up'], 'spawn T, flip to T flip');
    while (ref.tokenRow >= 0) play(['tick'], 'drop the T');

    // ride BEAMS into the top-out and verify the frozen machine (the
    // 2-tall toy retired; the I vert stacks four rows per drop). the
    // walk passes through the horizontal I, which only enters at column
    // 0 on the 4-wide well — steer first or the chooser refuses forever
    steer(0, 'walk left so the chooser can pass through I');
    selectShape(21, 'the beam');
    let guard = 12;
    while (!ref.gameOver && guard-- > 0) dropAt(1, 'stack the beams');
    expect(ref.gameOver, 'topped out').toBe(true);
    play(['tick', 'left', 'right', 'up', 'start', 'tick'], 'game over: everything refuses');
  });

  it('seeded random game: every key diffed until top-out or the key budget (fast)', { timeout: 600000 }, () => {
    const { ref, play } = makePair();
    // mulberry32 — the seed is part of the receipt
    let s = 0x20260826;
    const rand = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const KEYS: RefKey[] = ['tick', 'tick', 'tick', 'tick', 'left', 'right', 'up'];
    play(['start'], 'arm the first spawn');
    let n = 0;
    while (!ref.gameOver && n < 220) {
      play([KEYS[Math.floor(rand() * KEYS.length)]], `random #${n}`);
      n++;
    }
    // the run must have PLAYED, not stalled at the top
    expect(ref.linesCleared + ref.snapshot().field.filter((r) => r !== 0).length).toBeGreaterThan(0);
  });
});
