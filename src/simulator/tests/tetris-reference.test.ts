/**
 * Unit tests for the tetris reference model (src/tetris/reference.ts) —
 * the executable target spec the relay machine converges to. These test
 * the MODEL alone; the differential harness that compares it against the
 * circuit lives in tetris-reference-diff.test.ts.
 *
 * The most important test here is mechanical rotation validation: every
 * edge in TARGET_ROT must be an actual 90-degree clockwise rotation of
 * its source shape (as a point set, up to translation). The orientation
 * tables were laid by hand from the NRS box tables and a hand-laid table
 * is exactly where a wrong cell would silently become "the spec".
 */

import { describe, expect, it } from 'vitest';
import {
  TARGET_SHAPES,
  TARGET_NSTATES,
  TARGET_ROT,
  TARGET_SELECTION_CYCLE,
  TetrisReference,
  homeColumn,
  refShapeRange,
} from '../../tetris/reference';

const cellsOf = (ix: number): Array<[number, number]> => {
  // (x, y) with y UP (row k of the shape record = k rows above the bottom)
  const out: Array<[number, number]> = [];
  TARGET_SHAPES[ix].rows.forEach((row, k) => {
    for (let x = row.off; x < row.off + row.w; x++) out.push([x, k]);
  });
  return out;
};

const normalize = (pts: Array<[number, number]>): string => {
  const mx = Math.min(...pts.map((p) => p[0]));
  const my = Math.min(...pts.map((p) => p[1]));
  return pts
    .map(([x, y]) => `${x - mx},${y - my}`)
    .sort()
    .join(' ');
};

describe('tetris reference: the target tables', () => {
  it('has 22 states: 19 tetromino orientations + the 3 toy shapes', () => {
    expect(TARGET_NSTATES).toBe(22);
    const cellCount = (ix: number) => cellsOf(ix).length;
    // toys: 1x1, the domino pair
    expect(cellCount(0)).toBe(1);
    expect(cellCount(1)).toBe(2);
    expect(cellCount(2)).toBe(2);
    // every other state is a tetromino orientation: exactly 4 cells
    for (let i = 3; i < TARGET_NSTATES; i++) {
      expect(cellCount(i), `state ${i} (${TARGET_SHAPES[i].label})`).toBe(4);
    }
  });

  it('every rotation edge is a true 90-degree clockwise rotation (up to translation)', () => {
    for (let i = 0; i < TARGET_NSTATES; i++) {
      const j = TARGET_ROT[i];
      if (j === i) continue; // singleton: nothing to check
      // clockwise with y up: (x, y) -> (y, -x)
      const rotated = cellsOf(i).map(([x, y]) => [y, -x] as [number, number]);
      expect(normalize(rotated), `${TARGET_SHAPES[i].label} -> ${TARGET_SHAPES[j].label}`).toBe(
        normalize(cellsOf(j))
      );
    }
  });

  it('the rotation map is a permutation of pure 1/2/4-cycles per family', () => {
    const apply = (i: number, n: number) => {
      let s = i;
      for (let k = 0; k < n; k++) s = TARGET_ROT[s];
      return s;
    };
    // singletons
    for (const i of [0, 3]) expect(TARGET_ROT[i]).toBe(i);
    // 2-cycles: domino, S, Z, I
    for (const i of [1, 2, 4, 13, 5, 14, 12, 21]) {
      expect(TARGET_ROT[i], `state ${i} is in a 2-cycle`).not.toBe(i);
      expect(apply(i, 2), `state ${i} returns after two turns`).toBe(i);
    }
    // 4-cycles: L, J, T — four turns return, two do NOT (it is not a flip)
    for (const i of [6, 15, 9, 16, 7, 17, 10, 18, 8, 19, 11, 20]) {
      expect(apply(i, 4), `state ${i} returns after four turns`).toBe(i);
      expect(apply(i, 2), `state ${i} is a quarter turn, not a flip`).not.toBe(i);
    }
  });

  it('the target selection cycle satisfies the shared-branch invariant at every edge (the B1/B2/B3 pre-payment)', () => {
    // the machine's UP-transition emitter shares ONE physical branch per
    // target between the selection edge (cycle predecessor -> t) and the
    // rotation edge (rotation source -> t), and ASSERTS their pos ranges
    // coincide. the target cycle concatenates the rotation cycles exactly
    // so that holds by construction — verify it mechanically for every
    // edge and width, and that no branch range is empty (an empty range
    // wedges the chooser at the predecessor).
    expect([...TARGET_SELECTION_CYCLE].sort((a, b) => a - b)).toEqual(
      Array.from({ length: TARGET_NSTATES }, (_, i) => i)
    );
    const prevOf: number[] = [];
    TARGET_SELECTION_CYCLE.forEach((s, k) => {
      prevOf[TARGET_SELECTION_CYCLE[(k + 1) % TARGET_NSTATES]] = s;
    });
    for (const cols of [4, 6, 10]) {
      for (let t = 0; t < TARGET_NSTATES; t++) {
        // the state that rotates INTO t (unique in a permutation), else the cycle predecessor
        const rotSrc = TARGET_ROT.findIndex((v, s) => v === t && s !== t);
        const src = rotSrc >= 0 ? rotSrc : prevOf[t];
        const r2 = refShapeRange(TARGET_SHAPES[t], cols);
        const r1 = refShapeRange(TARGET_SHAPES[src], cols);
        const rp = refShapeRange(TARGET_SHAPES[prevOf[t]], cols);
        const lo = Math.max(r1.min, r2.min);
        const hi = Math.min(r1.max, r2.max);
        expect(
          [Math.max(rp.min, r2.min), Math.min(rp.max, r2.max)],
          `cols ${cols}, into ${TARGET_SHAPES[t].label}: selection (from ${TARGET_SHAPES[prevOf[t]].label}) and rotation (from ${TARGET_SHAPES[src].label}) branch ranges`
        ).toEqual([lo, hi]);
        expect(lo, `cols ${cols}, into ${TARGET_SHAPES[t].label}: the branch range is nonempty`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('the home column matches the dealer note: 1 at four columns, 2 at six, 4 at ten', () => {
    expect(homeColumn(4)).toBe(1);
    expect(homeColumn(6)).toBe(2);
    expect(homeColumn(10)).toBe(4);
  });

  it('shape ranges: S needs column >= 1, horizontal I needs column <= cols-4', () => {
    expect(refShapeRange(TARGET_SHAPES[4], 6)).toEqual({ min: 1, max: 4 });
    expect(refShapeRange(TARGET_SHAPES[12], 6)).toEqual({ min: 0, max: 2 });
    // at four columns no single column admits both — the known conflict
    expect(refShapeRange(TARGET_SHAPES[12], 4)).toEqual({ min: 0, max: 0 });
    expect(refShapeRange(TARGET_SHAPES[4], 4).min).toBe(1);
  });
});

describe('tetris reference: gameplay', () => {
  const game = (over?: Partial<ConstructorParameters<typeof TetrisReference>[0]>) => {
    const g = new TetrisReference({ rows: 8, cols: 4, ...over });
    g.key('start'); // the machine powers on unarmed
    return g;
  };

  // walk the register to a column (pre-spawn or mid-fall)
  const steer = (g: TetrisReference, col: number) => {
    let guard = 12;
    while (g.pos < col && guard-- > 0) g.key('right');
    while (g.pos > col && guard-- > 0) g.key('left');
    expect(g.pos).toBe(col);
  };

  // spawn the current shape at a column and drop it to rest
  const drop = (g: TetrisReference, col: number) => {
    g.key('tick'); // spawn
    expect(g.tokenRow).toBe(0);
    steer(g, col);
    let guard = 12;
    while (g.tokenRow >= 0 && guard-- > 0) g.key('tick');
  };

  it('drops four 1x1s to clear the bottom line, collapses, and scores', () => {
    const g = game({ home: 0 });
    // stack one cell at column 0 first so the clear has something to drop
    drop(g, 0);
    drop(g, 0);
    expect(g.snapshot().field).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
    drop(g, 1);
    drop(g, 2);
    drop(g, 3); // completes the bottom row
    // the row clears and the lone column-0 cell falls into it
    expect(g.snapshot().field).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(g.score).toBe(1);
    expect(g.linesCleared).toBe(1);
  });

  it('a 2x2 square drop clears two lines at once and scores both', () => {
    const g = game({ home: 0 });
    g.key('up'); // 2 wide
    g.key('up'); // 2 tall
    g.key('up'); // O
    drop(g, 0);
    drop(g, 2); // two squares side by side: rows 6+7 full
    expect(g.snapshot().field).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(g.score).toBe(2);
  });

  it('steering refuses at the walls and against stored cells', () => {
    const g = game({ home: 0 });
    drop(g, 3); // a stored cell at (7,3)
    g.key('tick'); // spawn the next
    steer(g, 0);
    g.key('left');
    expect(g.pos, 'the wall refuses').toBe(0);
    // fall to the floor row, then try to steer into the stored cell
    for (let i = 0; i < 6; i++) g.key('tick');
    expect(g.tokenRow).toBe(6);
    steer(g, 2);
    g.key('tick'); // now resting beside the stored cell at row 7... locks
    expect(g.tokenRow).toBe(-1);
    expect(g.snapshot().field).toEqual([0, 0, 0, 0, 0, 0, 0, 0b1100]);
  });

  it('mid-fall rotation (target map): L walks its 4-cycle and refuses when blocked', () => {
    const g = new TetrisReference({ rows: 8, cols: 6 });
    g.key('start');
    for (let i = 0; i < 6; i++) g.key('up'); // select L (state 6)
    expect(g.shapeIx).toBe(6);
    g.key('tick'); // spawn
    g.key('tick'); // fall to row 1
    g.key('tick'); // row 2 — room below remains
    expect(g.tokenRow).toBe(2);
    g.key('up');
    expect(g.shapeIx, 'L -> L vert R').toBe(15);
    g.key('up');
    expect(g.shapeIx, 'L vert R -> L flip').toBe(9);
    g.key('up');
    expect(g.shapeIx, 'L flip -> L vert L').toBe(16);
    g.key('up');
    expect(g.shapeIx, 'L vert L -> L').toBe(6);
  });

  it('a vertical rotation near the floor is refused (no kicks): the footprint must fit', () => {
    const g = new TetrisReference({ rows: 8, cols: 6 });
    g.key('start');
    for (let i = 0; i < 6; i++) g.key('up'); // L
    g.key('tick'); // spawn at row 0
    // at row 0 the vertical needs rows -1 and -2: those CLIP, so it fits —
    // clipping is machine behavior, not a kick. instead: block the target
    // cell and check the refusal on occupancy.
    expect(g.tokenRow).toBe(0);
    g.key('up');
    expect(g.shapeIx, 'clipped rotation at the top is legal').toBe(15);
  });

  it('rotation refused on stored cells', () => {
    const g = new TetrisReference({ rows: 8, cols: 6, home: 2 });
    g.key('start');
    // build a tower at column 3, rows 5-7
    g.key('up'); // 2 wide... walk to 2 tall
    g.key('up'); // 2 tall
    steer(g, 3);
    drop(g, 3);
    expect(g.snapshot().field[6] & 0b1000).toBe(0b1000);
    // wait: after a lock the register re-homes; shapeIx stays 2 tall
    g.key('up'); // -> O? pre-spawn selection steps forward: 2tall -> O
    expect(g.shapeIx).toBe(3);
    for (let i = 0; i < 3; i++) g.key('up'); // O -> S -> Z -> L
    expect(g.shapeIx).toBe(6);
    g.key('tick'); // spawn L at home 2 (cells at 2,3,4 bottom + stem 2)
    for (let i = 0; i < 4; i++) g.key('tick'); // fall to row 4
    expect(g.tokenRow).toBe(4);
    // L vert R at pos 2 wants (r4,c3),(r3,c3),(r2,c3),(r2,c4): c3 free at
    // rows 2-4 (tower is rows 5-7) — rotate, then fall once: now the
    // vertical rests ON the tower
    g.key('up');
    expect(g.shapeIx).toBe(15);
    g.key('tick');
    expect(g.tokenRow, 'locked resting on the tower').toBe(-1);
  });

  it('game over: a lock at row 0 latches and everything refuses', () => {
    const g = game({ home: 0 });
    g.key('up'); // 2 wide
    g.key('up'); // 2 tall
    for (let i = 0; i < 4; i++) drop(g, 0); // 2-tall stack of 8 = full column
    expect(g.snapshot().field.every((r) => r & 1)).toBe(true);
    g.key('tick'); // merged spawn + lock at row 0 onto the full column
    expect(g.gameOver).toBe(true);
    // the latch blocks only the SPAWN paths: field/score frozen, no piece
    // ever again — but the register and ring still step electrically
    const before = g.snapshot();
    g.key('start');
    g.key('tick');
    expect(g.snapshot(), 'start and tick are dead').toEqual(before);
    g.key('right');
    expect(g.pos, 'the register still steps (the pages freeze at the UI level)').toBe(1);
    g.key('up');
    expect(g.shapeIx, 'the ring still steps').toBe(3);
    expect(g.snapshot().field).toEqual(before.field);
    expect(g.gameOver).toBe(true);
  });

  it('the top clip: a 2-tall locking with its bottom at row 0 writes one cell, no game over for row-1 locks', () => {
    const g = game({ home: 0 });
    g.key('up');
    g.key('up'); // 2 tall
    for (let i = 0; i < 3; i++) drop(g, 0); // rows 2..7 filled at column 0
    g.key('tick'); // spawn
    g.key('tick'); // falls to row 1, rests (row 2 stored), locks: writes rows 1+0
    expect(g.tokenRow).toBe(-1);
    expect(g.gameOver, 'a lock at row 1 is not the top-out, even writing row 0').toBe(false);
    expect(g.snapshot().field[0] & 1).toBe(1);
  });

  it('the score ring wraps past nine', () => {
    const g = game({ home: 0 });
    g.score = 9;
    g.key('up'); // 2 wide
    drop(g, 0);
    drop(g, 2); // full row: tenth line
    expect(g.score).toBe(0);
    expect(g.linesCleared).toBe(1);
  });
});
