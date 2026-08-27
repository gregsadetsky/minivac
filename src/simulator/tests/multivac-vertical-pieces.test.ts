/**
 * B1 — VERTICAL S AND Z: the first three-row ring states, driving the
 * phase-3 engine (B1b/B1c). The trace battery, in the house order:
 * rails and fans per state x position first, then the four-tick lock
 * writing three DIFFERENT row masks, then rotation (S <-> S vert is the
 * first REAL mid-fall rotation of a stagger family), then steering
 * legality, then the declared limits (T7: a 3-tall lock at row 1 clips
 * its top with no game-over; the tok-2 steering/rotation seam is the
 * page guard's).
 *
 * Design + adversarial review: _notes/tall-pieces.md ("B1 CONCRETE
 * WIRING PLAN" + "B1 REVIEW VERDICT"). The selection cycle is
 * ... O -> S -> S vert -> Z -> Z vert -> L ... (SELECTION_CYCLE), so
 * every new edge's selection predecessor is its rotation source and the
 * emitter's shared-branch invariant holds with the mux pool unchanged.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import {
  tetrisCircuit,
  MACHINES,
  CELL,
  RING,
  LKS,
  LANE,
  P2S,
  VMODE,
  WIDM,
  STAGM,
  PIECE,
  PIECET,
  GAMEOVER,
  SCR,
  SHAPES,
  NSTATES,
  SELECTION_NEXT,
  shapeRange,
  ringPart,
  homeColumn,
  TETRIS_IO,
} from '../../circuits/multivac-mini-tetris';

afterEach(() => setSolverEngine('sparse'));

const HOME = homeColumn(4);

function rig() {
  setSolverEngine('fast');
  const { wires, layout: L } = tetrisCircuit();
  const m = new MinivacSimulator(wires, false, MACHINES);
  m.initialize();
  const rel = (n: number) => (m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
  const row = (r: number) => rel(CELL(r, 0)) + 2 * rel(CELL(r, 1)) + 4 * rel(CELL(r, 2)) + 8 * rel(CELL(r, 3));
  const field = () => Array.from({ length: 8 }, (_, r) => row(r));
  const tok = () => {
    for (let i = 0; i < 8; i++) if (rel(RING(i, 2))) return i;
    return -1;
  };
  const shapeAt = () => {
    const hot: number[] = [];
    for (let i = 0; i < NSTATES; i++) if (rel(ringPart(L, i, 2))) hot.push(i);
    expect(hot.length, `one-hot ring (got [${hot.join(',')}])`).toBe(1);
    return hot[0];
  };
  const posAt = () => {
    for (let j = 0; j < 4; j++) if (rel(L.POSS(j))) return j;
    return -1;
  };
  const press = (b: { button: number; machine: number }) => {
    m.pressButton(b.button, b.machine);
    m.releaseButton(b.button, b.machine);
    expect(m.getState().alerts).toEqual([]);
  };
  const tick = () => {
    m.setSlide(5, 'right', 1);
    m.setSlide(5, 'left', 1);
    expect(m.getState().alerts).toEqual([]);
  };
  const start = () => press(TETRIS_IO.start);
  const up = () => press(TETRIS_IO.up);
  const left = () => press(TETRIS_IO.left);
  const right = () => press(TETRIS_IO.right);
  const steer = (col: number) => {
    let guard = 8;
    while (posAt() !== col && guard-- > 0) press(posAt() < col ? TETRIS_IO.right : TETRIS_IO.left);
    expect(posAt(), `steered to ${col}`).toBe(col);
  };
  // walk the chooser to a state along SELECTION_CYCLE, clamping the
  // register into each target's fit range (the operator's presses)
  const select = (want: number) => {
    let guard = 3 * NSTATES;
    while (shapeAt() !== want && guard-- > 0) {
      const next = SELECTION_NEXT(shapeAt());
      const r = shapeRange(SHAPES[next], 4);
      steer(Math.min(r.max, Math.max(r.min, posAt())));
      up();
    }
    expect(shapeAt(), `selected ${SHAPES[want].label}`).toBe(want);
  };
  const banks = (acc: (j: number) => number) =>
    rel(acc(0)) + 2 * rel(acc(1)) + 4 * rel(acc(2)) + 8 * rel(acc(3));
  const settle = () => {
    let guard = 40;
    while ((rel(LKS) || rel(LANE) || rel(P2S)) && guard-- > 0) tick();
    expect(guard).toBeGreaterThan(0);
  };
  return { m, L, rel, row, field, tok, shapeAt, posAt, press, tick, start, up, left, right, steer, select, banks, settle };
}

describe('B1: vertical S and Z', () => {
  it('the 15-state walk: rails and all three fans per state (fast)', { timeout: 1800000 }, () => {
    const g = rig();
    // the chooser now runs ... O -> S -> S VERT -> Z -> Z VERT -> L ...
    g.select(4); // S (via 1x1, 2wide, 2tall, O)
    g.steer(1);
    g.up();
    expect(g.shapeAt(), 'S steps into S vert').toBe(13);
    // S vert at pos 1: bottom {1}, mid {1,2}, top {2}
    expect(g.rel(WIDM), 'S vert: not wide').toBe(0);
    expect(g.rel(VMODE), 'S vert: tall (phase 2 exists)').toBe(1);
    expect(g.rel(STAGM), 'S vert: staggered (phase 2 reads the T fan)').toBe(1);
    expect(g.rel(g.L.V3M), 'S vert: THREE rows (phase 3 exists)').toBe(1);
    expect(g.banks(PIECE), 'S vert bottom at pos 1').toBe(0b0010);
    expect(g.banks(PIECET), 'S vert mid at pos 1').toBe(0b0110);
    expect(g.banks(g.L.PIECET2), 'S vert top at pos 1').toBe(0b0100);
    g.steer(2);
    expect(g.banks(PIECE), 'the fans follow the register').toBe(0b0100);
    expect(g.banks(PIECET)).toBe(0b1100);
    expect(g.banks(g.L.PIECET2)).toBe(0b1000);
    g.steer(1);
    g.up();
    expect(g.shapeAt(), 'S vert steps into Z').toBe(5);
    g.up();
    expect(g.shapeAt(), 'Z steps into Z vert').toBe(14);
    // Z vert at pos 1: bottom {2} (the OFFSET single — WIDB tap, base cut),
    // mid {1,2}, top {1}
    expect(g.rel(WIDM), 'Z vert: rides the WIDB net (the T2 tap mechanism)').toBe(1);
    expect(g.rel(VMODE)).toBe(1);
    expect(g.rel(STAGM)).toBe(1);
    expect(g.rel(g.L.V3M)).toBe(1);
    expect(g.banks(PIECE), 'Z vert bottom at pos 1: the offset single').toBe(0b0100);
    expect(g.banks(PIECET), 'Z vert mid at pos 1').toBe(0b0110);
    expect(g.banks(g.L.PIECET2), 'Z vert top at pos 1').toBe(0b0010);
    g.up();
    expect(g.shapeAt(), 'Z vert steps into L').toBe(6);
    // the rest of the cycle is the pre-B1 walk; ride it around the wrap
    g.select(0);
    expect(g.banks(PIECE), 'back at 1x1').toBe(1 << g.posAt());
    expect(g.rel(g.L.V3M), 'V3 died with the vertical states').toBe(0);
    expect(g.rel(VMODE)).toBe(0);
  });

  it('the four-tick lock: three DIFFERENT row masks, then the reset (fast)', { timeout: 1800000 }, () => {
    const g = rig();
    g.start();
    g.select(13); // S vert
    g.steer(1);
    g.tick(); // spawn
    expect(g.tok()).toEqual(0);
    for (let r = 1; r <= 7; r++) g.tick(); // fall; the floor lock (press)
    expect(g.tok(), 'locked at the floor').toBe(7);
    expect(g.field(), 'the press wrote the BOTTOM row only').toEqual([0, 0, 0, 0, 0, 0, 0, 0b0010]);
    g.tick(); // phase 2: the MID row through the T fan
    expect(g.field(), 'phase 2 wrote the mid pair').toEqual([0, 0, 0, 0, 0, 0, 0b0110, 0b0010]);
    expect(g.tok(), 'the token survives phase 2').toBe(7);
    g.tick(); // phase 3: the TOP row through the T2 fan
    expect(g.field(), 'phase 3 wrote the top single').toEqual([0, 0, 0, 0, 0, 0b0100, 0b0110, 0b0010]);
    expect(g.tok(), 'the token survives phase 3 too').toBe(7);
    g.tick(); // the reset, two ticks late
    expect(g.tok(), 'reset killed the token').toBe(-1);
    expect(g.posAt(), 'reset re-homed').toBe(HOME);
    expect(g.field()).toEqual([0, 0, 0, 0, 0, 0b0100, 0b0110, 0b0010]);

    // the Z vert on top: spawn at home 1 -> bottom {2} rests on the S
    // vert's stack... steer to keep it clear instead: pos 1 keeps its
    // bottom at col 2, which sits on the stack at (5,2) — rest there
    g.select(14);
    g.steer(1);
    g.tick(); // spawn (SPAWN re-armed on the reset)
    expect(g.tok()).toBe(0);
    for (let r = 1; r <= 4; r++) g.tick(); // falls; rests at 4 (below: (5,2))
    expect(g.tok(), 'Z vert rested on the stack').toBe(4);
    expect(g.row(4), 'its bottom single wrote beside nothing').toBe(0b0100);
    g.tick(); // phase 2
    expect(g.row(3), 'its mid pair').toBe(0b0110);
    g.tick(); // phase 3
    expect(g.row(2), 'its top single — the OTHER column than S vert').toBe(0b0010);
    g.tick(); // reset
    expect(g.tok()).toBe(-1);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('rotation: S <-> S vert mid-fall, with a reachable occupancy refusal (fast)', { timeout: 1800000 }, () => {
    const g = rig();
    g.start();
    g.select(4); // S
    g.steer(1);
    g.tick(); // spawn S at pos 1
    g.tick();
    g.tick(); // token 2, clear air
    expect(g.tok()).toBe(2);
    g.up();
    expect(g.shapeAt(), 'S turned vertical mid-fall').toBe(13);
    expect(g.banks(PIECE), 'the bottom narrowed').toBe(0b0010);
    g.up();
    expect(g.shapeAt(), 'and back').toBe(4);

    // the occupancy refusal has to be STEERED INTO: the turn's delta
    // cell is (tok-1, p+1), and a falling S sweeps columns p-1..p+1 —
    // so the floater sits at column p+2 of the FALL position and the
    // piece steps right underneath it. the right step itself reads
    // (tok, c+1) and (tok-1, c) — NOT the floater's cell — so the step
    // conducts and only the TURN refuses. derived, then traced.
    const g2 = rig();
    g2.start();
    g2.m.setSlide(1, 'left', 0);
    g2.m.setSlide(2, 'left', 0);
    g2.m.setSlide(3, 'right', 0); // row 4
    g2.m.setSlide(4, 'right', 1); // col 3 data
    g2.m.pressButton(4, 0);
    g2.m.releaseButton(4, 0);
    g2.m.setSlide(4, 'left', 1);
    expect(g2.row(4)).toBe(0b1000);
    g2.select(4);
    g2.steer(1); // S at pos 1: sweep = bottom {1,2}, top {0,1} — misses col 3
    g2.tick(); // spawn
    for (let r = 1; r <= 5; r++) g2.tick();
    expect(g2.tok()).toBe(5);
    g2.right(); // pos 2: reads (5,3) and (4,2), both free — conducts
    expect(g2.posAt()).toBe(2);
    g2.up();
    expect(g2.shapeAt(), 'the turn into S vert refused: its mid would take (4,3)').toBe(4);
    g2.tick(); // token 6: the floater sits at tok-2 now — the TOP row's cell
    g2.up();
    // B2-0: the tok-2 occupancy bank (MIRCT2/LEGINVT3) closes what was
    // B1's declared seam — the turn's TOP cell (4,3) is read in contacts
    // now. this assertion was RED before the bank landed (the turn
    // conducted through the unread row) and is the increment's receipt.
    expect(g2.shapeAt(), 'the turn refused on the TOP cell too (the old seam)').toBe(4);
    // a floor-bound piece has no steerable tok-7 moment (merged lock),
    // so the conducts-proof moves SIDEWAYS out from under the floater
    g2.left(); // back to pos 1: every delta cell is clear there
    expect(g2.posAt()).toBe(1);
    g2.up();
    expect(g2.shapeAt(), 'clear of it the turn conducts').toBe(13);
    expect(g2.m.getState().alerts).toEqual([]);
  });

  it('steering: Z vert refuses its TRUE bottom cell and skips the false d0 check (fast)', { timeout: 1800000 }, () => {
    // (a) the TRUE refusal — reachable only in the rest-to-lock window:
    // a stored cell in the mid's columns rests the piece (the mid
    // collision term), and a left press in that window would move the
    // OFFSET bottom into the stored cell if the d1 read were missing
    // (the review's T4).
    const g = rig();
    g.start();
    g.m.setSlide(1, 'right', 0);
    g.m.setSlide(2, 'left', 0);
    g.m.setSlide(3, 'right', 0); // row 5
    g.m.setSlide(2, 'right', 1); // col 1 data
    g.m.pressButton(4, 0);
    g.m.releaseButton(4, 0);
    g.m.setSlide(2, 'left', 1);
    expect(g.row(5)).toBe(0b0010);
    g.select(14); // Z vert at pos 1: bottom {2}, mid {1,2}
    g.steer(1);
    g.tick(); // spawn
    for (let r = 1; r <= 5; r++) g.tick(); // rests at 5: the mid reads (5,1)
    expect(g.tok(), 'the mid term rested the piece on the stored cell').toBe(5);
    g.left(); // the rest-to-lock window: target bottom = (5,1) = stored
    expect(g.posAt(), 'Z vert left into its true bottom cell: refused').toBe(1);
    g.settle();
    expect(g.row(5) & 0b0010, 'the stored cell survived').toBe(0b0010);

    // (b) the FALSE d0 refusal is dead: a stored cell at (tok, 0) is in
    // no cell Z vert's left step enters (its bottom lands at col 1) —
    // the old shared check would have refused; the bypass conducts.
    const g2 = rig();
    g2.start();
    g2.m.setSlide(1, 'right', 0);
    g2.m.setSlide(2, 'left', 0);
    g2.m.setSlide(3, 'right', 0); // row 5
    g2.m.setSlide(1, 'right', 1); // col 0 data
    g2.m.pressButton(4, 0);
    g2.m.releaseButton(4, 0);
    g2.m.setSlide(1, 'left', 1);
    expect(g2.row(5)).toBe(0b0001);
    g2.select(14);
    g2.steer(1);
    g2.tick(); // spawn; bottom col 2 and mid {1,2} never touch col 0
    for (let r = 1; r <= 5; r++) g2.tick();
    expect(g2.tok(), 'no rest: the stored cell is outside the piece').toBe(5);
    g2.left();
    expect(g2.posAt(), 'the false d0 refusal died: the step conducts past (5,0)').toBe(0);
    expect(g2.m.getState().alerts).toEqual([]);
  });

  it('T7 declared limit: a 3-tall lock at row 1 clips its top, no game-over (fast)', { timeout: 1800000 }, () => {
    const g = rig();
    g.start();
    // stack col 2 from row 2 down so the piece rests at row 1
    for (let r = 2; r <= 7; r++) {
      g.m.setSlide(1, r & 1 ? 'right' : 'left', 0);
      g.m.setSlide(2, r & 2 ? 'right' : 'left', 0);
      g.m.setSlide(3, r & 4 ? 'right' : 'left', 0);
      g.m.setSlide(3, 'right', 1);
      g.m.pressButton(4, 0);
      g.m.releaseButton(4, 0);
      g.m.setSlide(3, 'left', 1);
    }
    g.select(13); // S vert: bottom at p — steer so the bottom falls on the stack
    g.steer(2);
    g.tick(); // spawn
    g.tick(); // token 1: below (2,2) is stored -> merged land+lock at 1
    expect(g.tok(), 'locked at row 1').toBe(1);
    g.settle(); // phase 2 (row 0), phase 3 (row -1: CLIPPED), reset
    expect(g.row(1) & 0b0100, 'the bottom wrote').toBe(0b0100);
    expect(g.row(0), 'phase 2 wrote row 0 (mid {2,3})').toBe(0b1100);
    expect(g.rel(GAMEOVER), 'a lock at row 1 is NOT the top-out (documented limit: the top clipped silently)').toBe(0);
    // and at row 0 the top-out latches as ever
    expect(g.m.getState().alerts).toEqual([]);
  });
});

describe('B2: the L/J/T verticals — rotation is a true 4-cycle', () => {
  it('the L family walks its 4-cycle mid-fall, all three fans per state (fast)', { timeout: 1800000 }, () => {
    const g = rig();
    g.start();
    g.select(6); // L, through the full B1 stretch of the chooser
    g.steer(1);
    g.tick(); // spawn
    g.tick();
    g.tick(); // token 2, clear air
    expect(g.tok()).toBe(2);
    // clockwise: L -> L vert R -> L flip -> L vert L -> L
    g.up();
    expect(g.shapeAt(), 'L turned to L vert R').toBe(15);
    expect(g.banks(PIECE), 'bottom: the offset single').toBe(0b0100);
    expect(g.banks(PIECET), 'mid: the same column').toBe(0b0100);
    expect(g.banks(g.L.PIECET2), 'top: the WIDE pair — the cut bank writes this').toBe(0b1100);
    g.up();
    expect(g.shapeAt(), 'quarter turn two: L flip').toBe(9);
    g.up();
    expect(g.shapeAt(), 'quarter turn three: L vert L').toBe(16);
    expect(g.banks(PIECE), 'bottom: the wide pair at p').toBe(0b0110);
    expect(g.banks(PIECET), 'mid: the single at p+1').toBe(0b0100);
    expect(g.banks(g.L.PIECET2), 'top: the single at p+1').toBe(0b0100);
    g.up();
    expect(g.shapeAt(), 'and home: four turns is the identity').toBe(6);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('an L vert R lock: the 2-column top writes through the cut bank, no fifth cell (fast)', { timeout: 1800000 }, () => {
    const g = rig();
    g.start();
    g.select(15);
    g.steer(1); // bottom/mid col 2, top cols 2-3
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick(); // floor lock
    expect(g.tok()).toBe(7);
    expect(g.field(), 'press: the bottom single').toEqual([0, 0, 0, 0, 0, 0, 0, 0b0100]);
    g.tick(); // phase 2 (the T fan: ALL verticals ride STAG — the T-A fix)
    expect(g.field(), 'phase 2: the mid single').toEqual([0, 0, 0, 0, 0, 0, 0b0100, 0b0100]);
    g.tick(); // phase 3: the WIDE top through CUTC7 — and ONLY those two
    // columns: the severed T fan must not bridge a fifth cell in
    expect(g.field(), 'phase 3: the wide top, exactly two cells').toEqual([0, 0, 0, 0, 0, 0b1100, 0b0100, 0b0100]);
    g.tick(); // reset
    expect(g.tok()).toBe(-1);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('LEGBT does real work now: J vert L rests its top on stored content (fast)', { timeout: 1800000 }, () => {
    // J vert L's top {p, p+1} exceeds its mid {p+1}: the (tok-1, p)
    // entry is the first REACHABLE firing of the top-collision term
    // (belt-and-braces since B1, the review's item-6 receipt)
    const g = rig();
    g.start();
    g.m.setSlide(1, 'left', 0);
    g.m.setSlide(2, 'left', 0);
    g.m.setSlide(3, 'right', 0); // row 4
    g.m.setSlide(2, 'right', 1); // col 1 data
    g.m.pressButton(4, 0);
    g.m.releaseButton(4, 0);
    g.m.setSlide(2, 'left', 1);
    expect(g.row(4)).toBe(0b0010);
    g.select(18); // J vert L at pos 1: bottom/mid col 2, top {1,2}
    g.steer(1);
    g.tick(); // spawn; the fall sweeps col 2 (and col 1 only via the top)
    for (let r = 1; r <= 5; r++) g.tick();
    expect(g.tok(), 'rested: the TOP would enter the stored (4,1)').toBe(5);
    g.settle(); // the lock runs where it rests
    expect(g.row(5), 'bottom wrote beside nothing').toBe(0b0100);
    expect(g.row(4), 'mid joined the stored cell').toBe(0b0110);
    expect(g.row(3), 'the top pair above').toBe(0b0110);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('the 22-state chooser wraps; the I ROTATES now (the B3 flip)', { timeout: 1800000 }, () => {
    const g = rig();
    g.start();
    g.select(20); // T vert L — then through the I, the I-vert and the wrap
    g.select(0);
    expect(g.shapeAt()).toBe(0);
    // B3 flipped this receipt: "the I is a singleton until B3" held from
    // 3b-4d through B2 — now UP mid-fall walks 12 -> 21 -> 12 in the
    // contacts (the last rotation edge; NSTATES == TARGET_NSTATES)
    g.select(12);
    g.steer(0);
    g.tick(); // spawn the I
    g.tick();
    g.up();
    expect(g.shapeAt(), 'the I stands up').toBe(21);
    g.up();
    expect(g.shapeAt(), 'and lies back down').toBe(12);
    expect(g.m.getState().alerts).toEqual([]);
  });
});

describe('B3: the vertical I — the last state', () => {
  it('the FIVE-tick lock writes four cells in one column (fast)', { timeout: 1800000 }, () => {
    // press (tok) + phase 2 (tok-1) + phase 3 (tok-2) + phase 4 (tok-3)
    // + reset: the first four-row write. un-steered at pos 0 the column
    // is p+2 = 2 (WID3 tap alone, base cut — L2's bottom pattern).
    const g = rig();
    g.start();
    g.select(21);
    g.steer(0);
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick(); // fall to the floor
    expect(g.tok()).toBe(7);
    g.settle();
    for (let r = 4; r <= 7; r++) expect(g.row(r), `row ${r}: the beam's cell`).toBe(0b0100);
    for (let r = 0; r <= 3; r++) expect(g.row(r), `row ${r}: empty`).toBe(0);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('a 3-tall lock NEVER raises ROW3 (the equivalence receipt)', { timeout: 1800000 }, () => {
    // the whole phase-4 block is dead for the eight 3-tall states — V4
    // down opens ROW3X's feed, so ROW3M can never arm. watched through
    // a full S-vert drop and lock, tick by tick.
    const g = rig();
    g.start();
    g.select(13);
    g.steer(1);
    g.tick();
    for (let n = 0; n < 30 && (g.tok() >= 0 || g.rel(LKS) || g.rel(LANE)); n++) {
      expect(g.rel(g.L.ROW3), 'ROW3 stays down for a 3-tall lock').toBe(0);
      g.tick();
    }
    expect(g.row(7), 'S vert bottom').toBe(0b0010);
    expect(g.row(6), 'S vert mid').toBe(0b0110);
    expect(g.row(5), 'S vert top').toBe(0b0100);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('THE QUAD: four rows clear at once and score four (fast)', { timeout: 1800000 }, () => {
    // tetris's namesake move, and the four-hot elevator probe the
    // review demanded (the three-hot walk was probed at B1c; this
    // walks FOUR seeds through the real CLEARP/2/3/4 latches).
    const g = rig();
    g.start();
    // operator-fill rows 4..7 at columns {0,1,3} — column 2 stays open
    const addr: Array<['left' | 'right', 'left' | 'right', 'left' | 'right']> = [
      ['left', 'left', 'right'], // row 4
      ['right', 'left', 'right'], // row 5
      ['left', 'right', 'right'], // row 6
      ['right', 'right', 'right'], // row 7
    ];
    for (const [s1, s2, s3] of addr) {
      g.m.setSlide(1, s1, 0);
      g.m.setSlide(2, s2, 0);
      g.m.setSlide(3, s3, 0);
      g.m.setSlide(1, 'right', 1); // col 0
      g.m.setSlide(2, 'right', 1); // col 1
      g.m.setSlide(4, 'right', 1); // col 3
      g.m.pressButton(4, 0);
      g.m.releaseButton(4, 0);
      g.m.setSlide(1, 'left', 1);
      g.m.setSlide(2, 'left', 1);
      g.m.setSlide(4, 'left', 1);
    }
    for (let r = 4; r <= 7; r++) expect(g.row(r)).toBe(0b1011);
    g.select(21);
    g.steer(0); // the beam's column is 2 — the one hole in all four rows
    g.tick();
    for (let r = 1; r <= 7; r++) g.tick();
    expect(g.tok()).toBe(7);
    g.settle(); // lock -> four full rows -> four latches -> four seeds -> the walk
    for (let r = 0; r <= 7; r++) expect(g.row(r), `row ${r} after the quad`).toBe(0);
    // the score stepped FOUR: press pulse + phase-2 pulse + the gated
    // phase-3 pulse + the new phase-4 pulse, one clock cycle each
    const digit = Array.from({ length: 10 }, (_, i) => g.rel(SCR(i, 2))).findIndex((v) => v === 1);
    expect(digit, 'the score ring').toBe(4);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('a low rest clips rows above the top, game over only at row 0 (T7 one deeper)', { timeout: 1800000 }, () => {
    // column 2 filled to row 4: the beam rests at tok 3 and its lock
    // writes rows 3,2,1,0 — INTO row 0 with NO game over (the machine's
    // rule: only a lock whose BOTTOM is row 0 latches; the reference
    // clips and agrees). TOPW3 starts at row 3, so a tok-2 rest would
    // clip the fourth write exactly like TOPW2's row-1 clip.
    const g = rig();
    g.start();
    const addr: Array<['left' | 'right', 'left' | 'right', 'left' | 'right']> = [
      ['left', 'left', 'right'], // row 4
      ['right', 'left', 'right'], // row 5
      ['left', 'right', 'right'], // row 6
      ['right', 'right', 'right'], // row 7
    ];
    for (const [s1, s2, s3] of addr) {
      g.m.setSlide(1, s1, 0);
      g.m.setSlide(2, s2, 0);
      g.m.setSlide(3, s3, 0);
      g.m.setSlide(3, 'right', 1); // col 2
      g.m.pressButton(4, 0);
      g.m.releaseButton(4, 0);
      g.m.setSlide(3, 'left', 1);
    }
    g.select(21);
    g.steer(0);
    g.tick();
    for (let r = 1; r <= 3; r++) g.tick();
    expect(g.tok(), 'rested on the column stack').toBe(3);
    g.settle();
    for (let r = 0; r <= 7; r++) expect(g.row(r), `row ${r}`).toBe(0b0100);
    expect(g.rel(GAMEOVER), 'no game over: the bottom locked at row 3').toBe(0);
    expect(g.m.getState().alerts).toEqual([]);
  });

  it('the tok-3 cell is THE DECLARED SEAM: a right step under an overhang', { timeout: 1800000 }, () => {
    // the one cell the contacts cannot read (no tok-3 occupancy bank):
    // steering the beam sideways enters (tok..tok-3, q+2), and the
    // banks cover three of the four. an overhang cell exactly three
    // above the token is invisible — the machine ALLOWS a step the
    // reference refuses (its diff knob tok3Blind models exactly this).
    // when the MIRCT3 rung lands, THIS assertion flips red -> green
    // inverted: the step must refuse.
    const g = rig();
    g.start();
    // the overhang: a single stored cell at (2, 3) with rows 3..7 of
    // column 3 empty (in play, an L2/T2 lock leaves exactly this shape)
    g.m.setSlide(1, 'left', 0);
    g.m.setSlide(2, 'right', 0);
    g.m.setSlide(3, 'left', 0); // row 2
    g.m.setSlide(4, 'right', 1); // col 3
    g.m.pressButton(4, 0);
    g.m.releaseButton(4, 0);
    g.m.setSlide(4, 'left', 1);
    expect(g.row(2)).toBe(0b1000);
    g.select(21);
    g.steer(0); // the beam falls in column 2
    g.tick();
    for (let r = 1; r <= 5; r++) g.tick();
    expect(g.tok()).toBe(5); // piece at (5,4,3,2) x col 2; (2,3) is tok-3, q+2
    g.right();
    expect(g.posAt(), 'the contacts allow the step — the tok-3 seam').toBe(1);
    expect(g.m.getState().alerts).toEqual([]);
  });
});
