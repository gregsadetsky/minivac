/**
 * The tetris REFERENCE MODEL — the executable target spec.
 *
 * This is what the relay machine is converging TO, written as plain
 * TypeScript with no knowledge of relays. The differential harness
 * (src/simulator/tests/tetris-reference-diff.test.ts) feeds identical key
 * sequences to this model and to the real circuit and diffs the full
 * state after every settled key. The driver's old rules model verified
 * the machine against ITSELF; this one verifies it against tetris.
 *
 * The target ruleset is NES-style (Nintendo Rotation System), because
 * that is the sane spec for relay-era hardware:
 *   - 4 orientations for L/J/T, 2 for S/Z/I, 1 for O, no wall kicks —
 *     a rotation whose footprint is blocked or out of bounds is refused,
 *     the piece does not shift to make room.
 *   - column placement per orientation follows the NRS box tables
 *     (anchored at the register column); the one deliberate deviation is
 *     VERTICAL anchoring: the machine's token row IS the piece's bottom
 *     row and rotation cannot clock the fall ring, so pieces rotate
 *     "sitting on their bottom row" instead of inside a fixed box.
 *   - spawn at the home column = the center of the window every shape
 *     can occupy (dealer.md's derivation: 1 at four columns, 2 at six,
 *     4 at ten).
 *
 * COMPAT KNOBS (RefConfig): each one marks a rung the circuit has not
 * climbed yet. The distance between the knobs' current values and their
 * target values IS the machine's remaining distance to tetris:
 *   - shapes: how much of the ring exists (13 today, 22 at target —
 *     19 tetromino orientations + the 3 toy shapes the tests are built on)
 *   - rot: 'current' = the machine's 180-degree-flip map,
 *     'target' = the NES 4-cycles
 *   - home: the spawn/re-home column (0 today, homeColumn(cols) at target)
 * When every knob sits at its target value and the diff stays green, the
 * machine plays tetris.
 *
 * Shape indices 0..12 mirror the circuit's SHAPES table exactly (asserted
 * in the diff test — the two tables are independent in origin but
 * mechanically locked). Labels follow the machine's existing ones, which
 * are swapped relative to standard names for S/Z and L/J (the machine's
 * "S" is the standard Z tile and vice versa; its "L" is the standard J).
 * Renaming would touch every test, page and driver for zero behavior.
 */

// one oriented shape: rows bottom-first, each row = {off, w} — the row's
// cells sit at columns pos+off .. pos+off+w-1; row k sits k rows ABOVE the
// token row. (The circuit's 2-row {bOff,bW,tOff,tW} records are the
// rows.length <= 2 special case of this.)
export interface RefShape {
  label: string;
  rows: ReadonlyArray<{ off: number; w: number }>;
}

// The full target ring, selection order = index order (UP pre-spawn steps
// +1 with wraparound, exactly like the machine's chooser cycle). States
// 0..12 are the circuit's ring today; 13..21 are the vertical orientations
// the tall-piece rungs add. ASCII art is drawn top row first.
export const TARGET_SHAPES: readonly RefShape[] = [
  { label: '1x1', rows: [{ off: 0, w: 1 }] },
  { label: '2 wide', rows: [{ off: 0, w: 2 }] },
  { label: '2 tall', rows: [{ off: 0, w: 1 }, { off: 0, w: 1 }] },
  { label: '2x2 square', rows: [{ off: 0, w: 2 }, { off: 0, w: 2 }] },
  // XX.
  // .XX
  { label: 'S', rows: [{ off: 0, w: 2 }, { off: -1, w: 2 }] },
  // .XX
  // XX.
  { label: 'Z', rows: [{ off: 0, w: 2 }, { off: 1, w: 2 }] },
  // X..
  // XXX
  { label: 'L', rows: [{ off: 0, w: 3 }, { off: 0, w: 1 }] },
  // ..X
  // XXX
  { label: 'J', rows: [{ off: 0, w: 3 }, { off: 2, w: 1 }] },
  // .X.
  // XXX
  { label: 'T', rows: [{ off: 0, w: 3 }, { off: 1, w: 1 }] },
  // XXX
  // ..X
  { label: 'L flip', rows: [{ off: 2, w: 1 }, { off: 0, w: 3 }] },
  // XXX
  // X..
  { label: 'J flip', rows: [{ off: 0, w: 1 }, { off: 0, w: 3 }] },
  // XXX
  // .X.
  { label: 'T flip', rows: [{ off: 1, w: 1 }, { off: 0, w: 3 }] },
  { label: 'I', rows: [{ off: 0, w: 4 }] },
  // ---- target-only vertical orientations, IN LANDING ORDER: rung B1
  // adds the S/Z verticals first, B2 the L/J/T verticals, B3 the I —
  // and the lockstep test requires the circuit's ring to stay a PREFIX
  // of this table, so the order here IS the build order ----
  // .X
  // XX
  // X.
  { label: 'S vert', rows: [{ off: 0, w: 1 }, { off: 0, w: 2 }, { off: 1, w: 1 }] },
  // X.
  // XX
  // .X
  { label: 'Z vert', rows: [{ off: 1, w: 1 }, { off: 0, w: 2 }, { off: 0, w: 1 }] },
  // .XX
  // .X.
  // .X.
  { label: 'L vert R', rows: [{ off: 1, w: 1 }, { off: 1, w: 1 }, { off: 1, w: 2 }] },
  // .X.
  // .X.
  // XX.
  { label: 'L vert L', rows: [{ off: 0, w: 2 }, { off: 1, w: 1 }, { off: 1, w: 1 }] },
  // .X.
  // .X.
  // .XX
  { label: 'J vert R', rows: [{ off: 1, w: 2 }, { off: 1, w: 1 }, { off: 1, w: 1 }] },
  // XX.
  // .X.
  // .X.
  { label: 'J vert L', rows: [{ off: 1, w: 1 }, { off: 1, w: 1 }, { off: 0, w: 2 }] },
  // .X.
  // .XX
  // .X.
  { label: 'T vert R', rows: [{ off: 1, w: 1 }, { off: 1, w: 2 }, { off: 1, w: 1 }] },
  // .X.
  // XX.
  // .X.
  { label: 'T vert L', rows: [{ off: 1, w: 1 }, { off: 0, w: 2 }, { off: 1, w: 1 }] },
  // ..X.
  // ..X.
  // ..X.
  // ..X.
  { label: 'I vert', rows: [{ off: 2, w: 1 }, { off: 2, w: 1 }, { off: 2, w: 1 }, { off: 2, w: 1 }] },
] as const;

export const TARGET_NSTATES = TARGET_SHAPES.length; // 22

// The target mid-fall rotation map (UP = one clockwise quarter turn, NES
// style). A state mapping to itself refuses rotation (1x1, O). The NES
// cycle direction for the 4-cycles: up -> right -> down -> left -> up,
// where the circuit's existing horizontal pairs are the "up" and "down"
// orientations.
export const TARGET_ROT: readonly number[] = (() => {
  const m = Array.from({ length: TARGET_NSTATES }, (_, i) => i);
  m[1] = 2; m[2] = 1; // the toy domino keeps its flip
  m[4] = 13; m[13] = 4; // S <-> S vert
  m[5] = 14; m[14] = 5; // Z <-> Z vert
  m[6] = 15; m[15] = 9; m[9] = 16; m[16] = 6; // L: up -> R -> down -> L -> up
  m[7] = 17; m[17] = 10; m[10] = 18; m[18] = 7; // J
  m[8] = 19; m[19] = 11; m[11] = 20; m[20] = 8; // T
  m[12] = 21; m[21] = 12; // I <-> I vert
  return m;
})();

// legal register positions for a shape: every row's cells must fit
export function refShapeRange(s: RefShape, cols: number): { min: number; max: number } {
  let min = 0;
  let max = cols - 1;
  for (const r of s.rows) {
    min = Math.max(min, -r.off);
    max = Math.min(max, cols - r.off - r.w);
  }
  return { min, max };
}

// the home (spawn) column: the middle of the window every shape can
// occupy, per _notes/dealer.md — 1 at four columns, 2 at six, 4 at ten.
// A shape whose own range cannot intersect the running window is skipped
// (at four columns the horizontal I fits only at column 0 while S needs
// column >= 1 — no single column admits both, and the window follows the
// majority).
export function homeColumn(cols: number, shapes: readonly RefShape[] = TARGET_SHAPES): number {
  let lo = 0;
  let hi = cols - 1;
  for (const s of shapes) {
    const r = refShapeRange(s, cols);
    if (r.min > r.max) continue; // the shape fits nowhere at this width
    if (Math.max(lo, r.min) > Math.min(hi, r.max)) continue; // would empty the window
    lo = Math.max(lo, r.min);
    hi = Math.min(hi, r.max);
  }
  return Math.ceil((lo + hi) / 2);
}

export type RefKey = 'left' | 'right' | 'up' | 'tick' | 'start';

export interface RefConfig {
  rows: number;
  cols: number;
  /** how many ring states exist (13 = the circuit today, 22 = target) */
  shapes?: number;
  /** mid-fall UP map: the machine's current flips, or the NES 4-cycles */
  rot?: 'current' | 'target';
  /** custom rotation map for rot: 'current' (the circuit's ROT_STATE, passed in by the harness so the reference itself never imports circuit code) */
  currentRot?: (i: number) => number;
  /** spawn/re-home column; defaults to homeColumn(cols). the machine today homes at 0 */
  home?: number;
}

export interface RefSnapshot {
  field: number[]; // row bitmasks, row 0 = top (bit j = column j)
  tokenRow: number; // -1 = no falling piece
  pos: number;
  shapeIx: number;
  score: number; // the decimal score ring: lines cleared mod 10
  gameOver: boolean;
}

/**
 * The reference game. Semantics mirror the machine's settled, user-level
 * contract (what you observe BETWEEN ticks once all bookkeeping ticks ran):
 * - tick: spawn if armed and no piece; else fall one row; landing and
 *   locking are one tick; a lock writes the footprint (rows above the top
 *   clip), clears full rows, collapses, scores, re-homes the register,
 *   re-arms the spawn. All of that is atomic here — the harness runs the
 *   machine's owed bookkeeping/collapse ticks before comparing.
 * - left/right: one column, refused on bounds or occupancy (contact-decided
 *   in the machine; pre-spawn only bounds refuse — no token, dark rails).
 * - up: pre-spawn = the selection cycle (+1 wrap), mid-fall = the rotation
 *   map; refused when the target state's footprint is out of range or
 *   overlaps stored cells. Singletons refuse by mapping to themselves.
 * - start: arms the spawn latch; refused after game over. (A start with a
 *   piece falling is undefined in the circuit — the pages guard the key —
 *   so the harness never sends it and the reference treats it as a no-op.)
 * - game over: any lock whose BOTTOM row is row 0 latches; everything but
 *   a power cycle is dead from then on (the machine's rule — note a tall
 *   piece locking at row 1 writes into row 0 WITHOUT game over).
 */
export class TetrisReference {
  readonly rows: number;
  readonly cols: number;
  readonly nShapes: number;
  readonly home: number;
  private readonly rot: (i: number) => number;
  field: boolean[][]; // [row][col], row 0 = top
  shapeIx = 0;
  pos: number;
  tokenRow = -1;
  armed = false; // the machine powers on UNARMED: the first spawn needs START
  score = 0;
  linesCleared = 0;
  gameOver = false;

  constructor(cfg: RefConfig) {
    this.rows = cfg.rows;
    this.cols = cfg.cols;
    this.nShapes = cfg.shapes ?? TARGET_NSTATES;
    this.home = cfg.home ?? homeColumn(cfg.cols, TARGET_SHAPES.slice(0, this.nShapes));
    if (cfg.rot === 'current') {
      const cur = cfg.currentRot;
      if (!cur) throw new Error("rot: 'current' needs currentRot (pass the circuit's ROT_STATE)");
      this.rot = cur;
    } else {
      this.rot = (i) => TARGET_ROT[i];
    }
    this.pos = this.home;
    this.field = Array.from({ length: this.rows }, () => Array<boolean>(this.cols).fill(false));
  }

  shape(ix = this.shapeIx): RefShape {
    return TARGET_SHAPES[ix];
  }

  // the footprint's cells at (pos, bottomRow); rows above the top clip
  cells(ix: number, pos: number, bottomRow: number): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    this.shape(ix).rows.forEach((row, k) => {
      const r = bottomRow - k;
      if (r < 0) return; // clipped at the top, like the machine's missing TOPW(0)
      for (let c = pos + row.off; c < pos + row.off + row.w; c++) out.push([r, c]);
    });
    return out;
  }

  // in bounds and not overlapping stored cells (clipped rows don't count)
  private fits(ix: number, pos: number, bottomRow: number): boolean {
    const { min, max } = refShapeRange(this.shape(ix), this.cols);
    if (pos < min || pos > max) return false;
    if (bottomRow >= this.rows) return false;
    return this.cells(ix, pos, bottomRow).every(([r, c]) => !this.field[r][c]);
  }

  key(k: RefKey): void {
    // GAME OVER blocks only the spawn paths (both START and the reset
    // tick's re-arm enter through the latch's one NC): the register and
    // the shape ring still step electrically — the pages freeze at the
    // UI level, but the diff compares the MACHINE
    switch (k) {
      case 'start':
        if (this.tokenRow < 0 && !this.gameOver) this.armed = true;
        return;
      case 'left':
      case 'right': {
        const np = this.pos + (k === 'left' ? -1 : 1);
        if (this.tokenRow >= 0) {
          if (this.fits(this.shapeIx, np, this.tokenRow)) this.pos = np;
        } else {
          // pre-spawn: occupancy rails are dark, only the fit bounds
          // refuse — and they gate the TARGET position (the ring's entry
          // gates), so a register re-homed OUTSIDE the current shape's
          // range can still step back into it
          const { min, max } = refShapeRange(this.shape(), this.cols);
          if (np >= min && np <= max) this.pos = np;
        }
        return;
      }
      case 'up': {
        const next = this.tokenRow >= 0 ? this.rot(this.shapeIx) : (this.shapeIx + 1) % this.nShapes;
        if (next === this.shapeIx) return; // singleton refusal
        if (next >= this.nShapes) return; // partner not built yet (compat)
        if (this.tokenRow >= 0) {
          if (this.fits(next, this.pos, this.tokenRow)) this.shapeIx = next;
        } else {
          // a chooser branch exists only where the position is legal for
          // BOTH endpoints (the machine's shared entering branches cover
          // range(source) INTERSECT range(target)) — so a register parked
          // outside the CURRENT shape's range refuses every reshape until
          // it is steered back in
          const s = refShapeRange(this.shape(), this.cols);
          const t = refShapeRange(this.shape(next), this.cols);
          const lo = Math.max(s.min, t.min);
          const hi = Math.min(s.max, t.max);
          if (this.pos >= lo && this.pos <= hi) this.shapeIx = next;
        }
        return;
      }
      case 'tick': {
        if (this.tokenRow < 0) {
          if (this.armed) {
            this.tokenRow = 0;
            this.armed = false;
            // a spawn that lands already resting is a MERGED spawn+lock:
            // the collide contact re-routes the still-held spawn tick into
            // the lock phase (pinned by the machine's game-over test —
            // "merged spawn + lock AT ROW 0")
            if (!this.fits(this.shapeIx, this.pos, this.tokenRow + 1)) this.lock();
          }
          return;
        }
        // fall one row; landing and locking are one tick
        if (this.fits(this.shapeIx, this.pos, this.tokenRow + 1)) {
          this.tokenRow += 1;
          if (!this.fits(this.shapeIx, this.pos, this.tokenRow + 1)) this.lock();
        } else {
          this.lock(); // spawned resting (or steered to rest): lock in place
        }
        return;
      }
    }
  }

  private lock(): void {
    for (const [r, c] of this.cells(this.shapeIx, this.pos, this.tokenRow)) this.field[r][c] = true;
    if (this.tokenRow === 0) this.gameOver = true;
    // clear full rows, collapse (rows above shift down), score
    const keep = this.field.filter((row) => !row.every(Boolean));
    const cleared = this.rows - keep.length;
    if (cleared > 0) {
      this.field = [
        ...Array.from({ length: cleared }, () => Array<boolean>(this.cols).fill(false)),
        ...keep,
      ];
      this.linesCleared += cleared;
      this.score = (this.score + cleared) % 10;
    }
    this.tokenRow = -1;
    this.pos = this.home; // the reset tick re-homes the register
    if (!this.gameOver) this.armed = true; // and re-arms the spawn
  }

  snapshot(): RefSnapshot {
    return {
      field: this.field.map((row) => row.reduce((m, v, j) => m | (v ? 1 << j : 0), 0)),
      tokenRow: this.tokenRow,
      pos: this.pos,
      shapeIx: this.shapeIx,
      score: this.score,
      gameOver: this.gameOver,
    };
  }
}
