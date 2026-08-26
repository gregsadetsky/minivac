/**
 * Multivac roadmap rungs 7+9+9b+10 + the piece register: MINI-TETRIS.
 * 4-wide x 8-tall field, gravity + stacking + line clear WITH row
 * collapse, and the piece's column held IN THE MACHINE (a one-hot ring
 * stepped by LEFT/RIGHT buttons). Pure wiring — every game decision is
 * made by relay contacts. 289 relays across 50 machines (the width is the
 * price of tie-point-safe private contacts — see the notes below). The
 * piece is whatever COLUMN MASK the slides raise — singles, dominoes,
 * wider, with zero circuit changes (rung 9) — and with the VMODE slide up
 * it is TWO CELLS TALL (rung 9b): the bottom cell is the token (collision
 * is unchanged — the bottom leads), the press writes the token row exactly
 * as before, and a PHASE-2 tick then writes the row above:
 *
 * VERTICAL = THREE TICKS (press, phase 2, reset). A vertical press also
 * latches P2M (tick-high AND press AND VMODE, dead-ending at +); its slave
 * P2S — clocked by TICKM2 like LKS by TICKM — re-routes the next tick's
 * reset rail into the phase-2 power chain: P2GATE (a second READGATE)
 * powers private gate/breaker trigger rails routed by the TOPW mirror bank
 * (one parallel coil per ring slave 1-7) into row r-1's EXISTING write
 * group, P2COL (a second RAILGATE2) re-feeds the column rails, and the
 * P2CUT bank (in series with PRESSCUT) drops the collision mirrors so the
 * row below the token stays off the rails. The press rails stay dark, so
 * the token row's own readback never re-fires — the top write sees only
 * the mask and row r-1's own content. P2CLR breaks P2M during phase 2;
 * the reset (which RESETM/RSTM/RSTM2 sit out during phase 2, keeping the
 * token, LKM and any CLEARP latch alive) runs one tick late. At row 0 the
 * top cell is CLIPPED (no TOPW(0)); a line completed by the TOP write does
 * NOT clear (the clear machinery is token-row-addressed and the LINE chain
 * is press-rooted) — a documented limit of this rung, pinned below; the
 * field-scaling rung's row collapse replaces the clear machinery anyway.
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
 * chain fires CPSET, whose private contact latches CLEARP when a lock
 * completes the row. The full line is visible while the press is held —
 * the flash — and from the release on CLEARP alone powers the breaker-
 * trigger rail: the row's holds stay broken with the gates and column feed
 * dark, all four cells drop out, and the next (reset) tick's RSTM2 breaks
 * the latch to re-arm the row.
 *
 * ROW COLLAPSE (rung 10, "the elevator"): the reset tick of a clearing lock
 * doubles as a seed-transfer clock — CLEARPM gates + through the one-hot
 * token's SEEDM mirror into the elevator chain (the ring pattern chained in
 * REVERSE; stage t = "the hole is at row t"). From then until the chain
 * drains off stage 1, LANE (a branch slave between LKS and COLLIDE — any
 * deeper and collapse ticks would clock the ring and spawn mid-collapse)
 * owns the ticks, and a two-bit phase ring (TGM/TGS, TG2M/TG2S) deals them
 * out in THREES: ALPHA fires the source row's and the hole row's GATES
 * ONLY — the source's content leaks onto the rails backward through its
 * own closed gates (contacts are bidirectional) and the hole latches an
 * exact copy; no holds break, nothing can strand. BETA fires the source's
 * breakers alone (the clear shape — the row just copied down drops out).
 * GAMMA steps the chain with every rail dark: stepping during a hot-rail
 * tick fired the freshly hot stage's routing mid-tick and killed the row
 * above before its copy (a per-tick trace caught it). Three ticks per row;
 * the armed SPAWN waits (the ring clock stays dark, so SPAWNCLR never
 * consumes it) and fires on the first tick after the lane releases. Rows
 * 1-6 are both sources and destinations and their gate-trigger nodes ran
 * out of holes: they extend through JUNCTION COMS (spare sections' com
 * jacks as 4-hole junction boxes). The phase masters' between-tick
 * self-holds keep the decode nodes (and the held gates) alive through the
 * inter-tick gaps — idempotent re-latches — which is why the CUTC bank
 * cuts BOTH rail-to-rail bridges (the piece gates' colFan tie and the
 * collision taps' collideNode tie) for the WHOLE collapse: the mask is
 * just slides, may change mid-collapse, and two raised columns would
 * otherwise cross-write the moving rows (both bridges were caught live —
 * one by the acceptance probe's own setup, one by the instrumented random
 * run).
 *
 * THE LINE SENSOR'S FALSE WINDOW (found by the vertical rung's tests): for
 * a press's first waves — before PRESSCUT's cut lands — the collision
 * readback of the row BELOW the token still holds the rails. If that row
 * is FULL, a chain feed that arrives with rail A latches CLEARP through
 * the stale LINE contacts and the clear machinery erases the row being
 * WRITTEN. Unreachable before rung 9b (a full row could never persist —
 * every full row cleared at its own lock; now a top-completed line stays),
 * so the chain's feed is DELAYED one relay past the press rails (LINEDLY,
 * off RAILGATE2's spare set — still press-only, so operator writes still
 * cannot trigger it): by the wave it arrives, the rails carry only the
 * mask and the token row's own readback — the true line state.
 *
 * A RESET tick (the tick after any lock; after the phase-2 tick when the
 * lock was vertical): resetrail breaks every ring
 * slave's hold through private reset-mirror contacts (the token dies), sets
 * the SPAWN latch, and RSTM clears LOCKED mid-tick. The next tick is a
 * normal fall tick: the ring clock fires, master 0 has sampled SPAWN while
 * the clock was low, the token reappears at row 0, and SPAWNCLR (a ring-
 * clock mirror) drops the SPAWN latch. So a piece lands-and-locks, then one
 * reset tick, then the next piece enters — a full-height drop is spawn +
 * 7 falls + reset = 9 ticks.
 *
 * Sparse-pinned: at 38 machines a cktsim tick costs tens of seconds, so the
 * dense-oracle equivalence rides on the per-rung tests below this one (all
 * dense-validated) plus the 5000-random-circuit sweep. Set MINIVAC_MASS=1
 * to run the short scenario under cktsim too.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import { tetrisCircuit, MACHINES, CELL, RING, PIECE, VMODE, TOPW, P2M, P2S, LKS, ELEVSL, POSS, POSA, GAMEOVER, SCR, LEFTBTN, TETRIS_IO, WIDM, STAGM, PIECET, SHAPES, shapeRange, NSTATES, ROT_STATE, ringPart, homeColumn } from '../../circuits/multivac-mini-tetris';

// the register's home column — the CENTER since 2026-08-26 (center spawn):
// 1 on the classic 4-wide well. power-on seeds here, every reset re-homes here.
const HOME = homeColumn(4);

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
  // the piece register: position is MACHINE state (a one-hot ring stepped
  // by the LEFT/RIGHT buttons; seeded at the home column from power-on),
  // width is the WID slide. setMask survives as sugar for the legal
  // shapes only — a register piece is 1-2 ADJACENT columns.
  const posAt = () => {
    for (let j = 0; j < 4; j++) {
      const r = TETRIS_IO.posRelay(j);
      if (m.getMachineState(r.machine).relays[r.index]) return j;
    }
    return -1;
  };
  const pressBtn = (b: { button: number; machine: number }) => {
    m.pressButton(b.button, b.machine);
    m.releaseButton(b.button, b.machine);
  };
  const setMask = (mask: number) => {
    const wide = mask === 0b0011 || mask === 0b0110 || mask === 0b1100;
    const single = mask === 1 || mask === 2 || mask === 4 || mask === 8;
    expect(wide || single, `mask ${mask.toString(2)} is not a register piece`).toBe(true);
    const p = Math.log2(mask & -mask); // lowest set bit = the position
    m.setSlide(TETRIS_IO.wid.slide, wide ? 'right' : 'left', TETRIS_IO.wid.machine);
    let guard = 8;
    while (posAt() < p && guard-- > 0) pressBtn(TETRIS_IO.right);
    while (posAt() > p && guard-- > 0) pressBtn(TETRIS_IO.left);
    expect(posAt(), `walked the register to ${p}`).toBe(p);
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
    // narrow the piece first: a wide pair's two closed gates would bridge
    // the driven rails through the colFan node (CUTC is rightly idle
    // outside collapses; a single closed gate bridges nothing)
    m.setSlide(TETRIS_IO.wid.slide, 'left', TETRIS_IO.wid.machine);
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
  return { m, field, row, tokenAt, setMask, setColumn, tick, pressStart, operatorWrite, posAt, pressBtn };
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
  let cleared = -1;
  for (let r = 1; r <= rest; r++) {
    g.tick();
    expect(g.tokenAt(), `${label}: token at ${r}`).toEqual([r]);
    if (r === rest) {
      model[r] |= mask;
      // a completed line flashes only within the press: CLEARP holds the
      // row's breakers up from the release on, so the cells are gone by the
      // time the tick is back low
      if (model[r] === 15) {
        model[r] = 0;
        cleared = r;
      }
    }
    expect(g.field(), `${label}: field after tick to ${r}`).toEqual(model);
  }
  g.tick(); // reset tick: token dies, SPAWN re-arms, CLEARP un-latches
  expect(g.tokenAt(), `${label}: token gone`).toEqual([]);
  expect(g.field(), `${label}: field after reset`).toEqual(model);
  collapseTicks(g, cleared, model, label);
}

// rung 10: a clearing lock is followed by 3*row collapse ticks — the
// elevator walks the hole to the top, three ticks per stage, while the
// tick lane defers the next spawn: alpha copies the row above the hole
// down into it (gates only, both rows), beta drops the source
// (breakers only), gamma steps the chain with every rail dark.
// Model-checked at EVERY tick, so a leak on any phase shows immediately.
// A clear at row 0 has nothing above it: the chain never seeds and play
// resumes at once.
function collapseTicks(
  g: ReturnType<typeof makeGame>,
  clearedRow: number,
  model: number[],
  label: string
) {
  if (clearedRow < 0) return;
  for (let t = clearedRow; t >= 1; t--) {
    g.tick(); // alpha: row t := row t-1 (the hole is empty, |= is exact)
    model[t] |= model[t - 1];
    expect(g.tokenAt(), `${label}: alpha at stage ${t} defers the spawn`).toEqual([]);
    expect(g.field(), `${label}: field after the stage-${t} move`).toEqual(model);
    g.tick(); // beta: the source drops
    model[t - 1] = 0;
    expect(g.tokenAt(), `${label}: beta at stage ${t} defers the spawn`).toEqual([]);
    expect(g.field(), `${label}: field after the stage-${t} clear`).toEqual(model);
    g.tick(); // gamma: the hole walks up, rails dark
    expect(g.tokenAt(), `${label}: gamma at stage ${t} defers the spawn`).toEqual([]);
    expect(g.field(), `${label}: field still after the stage-${t} step`).toEqual(model);
  }
}

// vertical drop (VMODE up): the bottom cell is the token, so the fall and
// the bottom-row write are dropPiece's rhythm exactly; then one extra tick —
// phase 2 — writes row rest-1 through the TOPW mirrors while the token
// still selects the row, and the reset runs a tick late. A line completed
// by the BOTTOM write clears as usual; one completed by the TOP write
// clears too since the double-clear rung (CLEARP2 senses the phase-2
// rails and holds the p2break rail through the release).
function dropVertical(
  g: ReturnType<typeof makeGame>,
  mask: number,
  model: number[],
  label: string
) {
  let rest = 7;
  for (let r = 0; r < 7; r++) {
    if (model[r + 1] & mask) {
      rest = r;
      break;
    }
  }
  expect(rest, `${label}: the helper needs a mid-field rest row`).toBeGreaterThan(0);
  g.setMask(mask);
  g.tick();
  expect(g.tokenAt(), `${label}: spawned`).toEqual([0]);
  expect(g.field(), `${label}: spawn does not touch the field`).toEqual(model);
  let cleared = -1;
  for (let r = 1; r <= rest; r++) {
    g.tick();
    expect(g.tokenAt(), `${label}: token at ${r}`).toEqual([r]);
    if (r === rest) {
      model[r] |= mask;
      if (model[r] === 15) {
        model[r] = 0; // bottom-write clear, as ever
        cleared = r;
      }
    }
    expect(g.field(), `${label}: field after tick to ${r}`).toEqual(model);
  }
  g.tick(); // phase 2: the top write; the token survives to select the row
  model[rest - 1] |= mask;
  let topCleared = -1;
  if (model[rest - 1] === 15) {
    // the double-clear rung: a completed top row's flash ends at the
    // phase-2 RELEASE (symmetric with the bottom clear's press flash)
    model[rest - 1] = 0;
    topCleared = rest - 1;
  }
  expect(g.tokenAt(), `${label}: token survives phase 2`).toEqual([rest]);
  expect(g.field(), `${label}: top row after phase 2`).toEqual(model);
  g.tick(); // reset, one tick late
  expect(g.tokenAt(), `${label}: token gone`).toEqual([]);
  expect(g.field(), `${label}: field after reset`).toEqual(model);
  if (cleared >= 0 && topCleared >= 0) collapseTicksDouble(g, cleared, model, label);
  else if (topCleared >= 0) collapseTicks(g, topCleared, model, label);
  else collapseTicks(g, cleared, model, label);
}

// the TWO-HOT walk (both rows of a vertical lock cleared): the pair
// {t, t-1} moves rows down by TWO per stage — alpha duplicates row t-2
// into both holes, beta kills the duplicate and the source, gamma
// shifts the pair; it drains through a no-op single stage at the top.
function collapseTicksDouble(
  g: ReturnType<typeof makeGame>,
  bottomHole: number,
  model: number[],
  label: string
) {
  for (let t = bottomHole; t >= 2; t--) {
    g.tick(); // alpha: both holes take row t-2's content
    model[t] |= model[t - 2];
    model[t - 1] |= model[t - 2];
    expect(g.field(), `${label}: double alpha at ${t}`).toEqual(model);
    g.tick(); // beta: the source and the duplicate drop
    model[t - 1] = 0;
    model[t - 2] = 0;
    expect(g.field(), `${label}: double beta at ${t}`).toEqual(model);
    g.tick(); // gamma: the pair walks up
    expect(g.field(), `${label}: double gamma at ${t}`).toEqual(model);
  }
  for (let k = 0; k < 4; k++) {
    g.tick(); // the residual single stage drains without touching rows
    expect(g.field(), `${label}: drain ${k} is a no-op`).toEqual(model);
    if (g.tokenAt().length > 0) break; // respawn = the walk fully drained
  }
}

describe('Multivac: mini-tetris (85 machines at the classic 8 rows)', () => {
  it('gravity, stacking, and a line clear (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
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
    // row 7 — and the collapse walks the stacked cell down into the hole
    dropPiece(g, 0b1000, model, 'drop 5 (col 3, clears the line)');
    expect(g.row(7), 'the stacked cell fell into the cleared line').toBe(0b0001);
    expect(g.row(6), 'its old row emptied (rung 10)').toBe(0);

    // the game goes on, on top of the fallen cell
    dropPiece(g, 0b0100, model, 'drop 6 (col 2)');
    expect(g.row(7)).toBe(0b0101);
  });

  it('operator setup + one drop completes a line (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
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
  it('dominoes: two-cell pieces, a two-domino line, and an overhang (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
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
  // changes while the piece falls), mid-fall RESHAPING (the piece mask and
  // tallness are just slides, so shapes morph mid-flight — the model
  // mirrors the machine, not tournament rules), spawns straight onto a tall
  // stack (merged spawn+lock), vertical locks interleaved with horizontal
  // ones, and whatever stack shapes the seed builds. The machine samples
  // tallness at the press (P2M latches) and the mask again at the phase-2
  // tick (the slides feed the rails live) — the model does exactly that.
  // Runs under BOTH gameplay engines: sparse (the suite default) and fast
  // (what /tetris/ actually plays on — a live-play glitch report is exactly
  // where an engine-specific divergence would hide).
  function runRandomGameplay(engine: 'sparse' | 'fast', seed: number, drops: number) {
    setSolverEngine(engine);
    const lcg = (s0: number) => {
      let s = s0 >>> 0;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    };
    const rnd = lcg(seed);
    const DROPS = drops;

    let g = makeGame();
    let model = Array(8).fill(0);
    let games = 1;
    let token = -1; // falling piece's row, -1 = none
    let mask = 0b0001 << HOME; // the register wakes at the center home
    let wideNow = false; // the WID slide, as the model last set it
    let vertical = false; // the VMODE slide, as the model last set it
    let phase2Pending = false; // a vertical lock happened: next tick = top write
    let resetPending = false; // then the tick after that is the reset
    let spawnArmed = false;
    let locks = 0;
    let vlocks = 0;
    let clears = 0;
    let ticks = 0;

    let clearedRow = -1; // a clearing lock queues 2*row collapse ticks
    let collapseLeft = 0;
    let gameOver = false;
    const lockAt = (r: number) => {
      if (r === 0) gameOver = true; // the top-out: GAMEOVER latches on this press
      model[r] |= mask;
      if (model[r] === 15) {
        model[r] = 0; // CLEARP zeroes the row as the press releases
        clears++;
        clearedRow = r;
      }
      locks++;
      if (vertical) {
        phase2Pending = true; // sampled at the press, like P2M
        vlocks++;
      } else {
        resetPending = true;
      }
    };

    g.pressStart();
    spawnArmed = true;
    while (locks < DROPS) {
      if (rnd() < 0.45) {
        const width = rnd() < 0.35 ? 2 : 1;
        const pos = Math.floor(rnd() * (5 - width));
        // walk toward the wanted column with real button presses; the
        // legality contacts may refuse any step (stored cells beside the
        // token). Accept wherever the register actually lands and model
        // THAT — partial walks are the machine's honest answer.
        wideNow = width === 2;
        g.m.setSlide(TETRIS_IO.wid.slide, width === 2 ? 'right' : 'left', TETRIS_IO.wid.machine);
        let guard = 8;
        for (;;) {
          const at = g.posAt();
          if (at === pos || guard-- <= 0) break;
          g.pressBtn(at < pos ? TETRIS_IO.right : TETRIS_IO.left);
          if (g.posAt() === at) break; // refused: stop pushing
        }
        // clip to the field: a refused left walk can strand the register
        // WIDE at column 3, where the machine's PIECE degrades to the
        // edge column alone (there is no wide tap off the last slave)
        mask = ((width === 2 ? 0b11 : 0b1) << g.posAt()) & 0b1111;
      }
      if (rnd() < 0.3) {
        vertical = !vertical;
        g.m.setSlide((VMODE % 6) + 1, vertical ? 'right' : 'left', Math.floor(VMODE / 6));
      }
      // model what this tick must do, then let the relays do it. Landing
      // and locking are one tick (the mid-tick collide re-route); a PURE
      // lock tick only exists when steering put a block under an already
      // falling piece between ticks (collide pre-armed).
      const resting = () => token === 7 || (model[token + 1] & mask) !== 0;
      if (collapseLeft > 0) {
        // the elevator owns the tick: alpha moves the row above the hole
        // down, beta drops the source, gamma steps the chain; the spawn
        // stays deferred throughout
        const stage = Math.ceil(collapseLeft / 3);
        if (collapseLeft % 3 === 0) model[stage] |= model[stage - 1];
        else if (collapseLeft % 3 === 2) model[stage - 1] = 0;
        collapseLeft--;
      } else if (phase2Pending) {
        // the top write: current mask, one row above the still-alive token;
        // clipped at row 0; NEVER clears (top-full stays — the pinned limit)
        if (token >= 1) model[token - 1] |= mask;
        phase2Pending = false;
        resetPending = true;
      } else if (resetPending) {
        token = -1;
        resetPending = false;
        spawnArmed = true;
        if (clearedRow > 0) collapseLeft = 3 * clearedRow; // row-0 clears never seed
        clearedRow = -1;
        // the reset tick re-homes the position register to the CENTER
        // column (the WID slide is untouched): the machine's piece mask
        // snaps home. wideness must come from the tracked slide, not the
        // mask bits — a wall-degraded wide mask (0b1000) looks single-bit
        mask = (wideNow ? 0b0011 : 0b0001) << HOME;
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
      if (env.MINIVAC_TETRIS_DEBUG === '1') {
        console.log(
          `tick ${ticks} mask=${mask.toString(2)} tok=${token} clp=${collapseLeft} p2=${phase2Pending} rst=${resetPending} model=${model.join(',')} field=${g.field().join(',')}`
        );
      }
      expect(g.field(), `tick ${ticks} field (mask ${mask.toString(2)})`).toEqual(model);
      expect(g.tokenAt(), `tick ${ticks} token`).toEqual(token >= 0 ? [token] : []);
      if (gameOver) {
        const go = g.m.getMachineState(Math.floor(GAMEOVER / 6)).relays[GAMEOVER % 6];
        expect(go, 'the machine latched the top-out too').toBe(true);
        g.tick(); // the pending bookkeeping (phase 2 if the lock was tall...)
        g.tick(); // ...then the reset
        g.pressStart();
        g.tick();
        expect(g.tokenAt(), 'no spawn after a random top-out').toEqual([]);
        console.log(
          `random gameplay [${engine}, seed ${seed}]: game ${games} topped out after ${locks} locks — power cycle`
        );
        // a power cycle is the machine's own new-game story: fresh build,
        // fresh field, the model resets with it; the rnd stream continues
        g = makeGame();
        model = Array(8).fill(0);
        games++;
        token = -1;
        mask = (wideNow ? 0b0011 : 0b0001) << HOME; // fresh build seeds at the center
        phase2Pending = false;
        resetPending = false;
        clearedRow = -1;
        collapseLeft = 0;
        gameOver = false;
        g.m.setSlide(TETRIS_IO.wid.slide, wideNow ? 'right' : 'left', TETRIS_IO.wid.machine);
        g.m.setSlide((VMODE % 6) + 1, vertical ? 'right' : 'left', Math.floor(VMODE / 6));
        g.pressStart();
        spawnArmed = true;
      }
    }
    // the seed is fixed, so the run is deterministic; line-clear coverage
    // also lives in the scripted tests above.
    console.log(
      `random gameplay [${engine}, seed ${seed}]: ${ticks} ticks, ${locks} locks (${vlocks} vertical), ${clears} line clears, ${games} game(s)`
    );
    expect(locks).toBe(DROPS);
    expect(vlocks, 'the seed must actually exercise vertical locks').toBeGreaterThan(2);
  }

  it('random gameplay: seeded drops, steering, morphing shapes, vertical locks (fast)', { timeout: 1800000 }, () => {
    runRandomGameplay('fast', 20260819, parseInt(env.MINIVAC_TETRIS_DROPS || '14', 10));
  });

  // the fast engine plays ~16x quicker, so its run goes much longer — this
  // is the closest thing to a long human session on the live page
  it('random gameplay under the fast engine: long run, fresh seed', { timeout: 1800000 }, () => {
    runRandomGameplay('fast', 20260820, parseInt(env.MINIVAC_TETRIS_DROPS_FAST || '40', 10));
  });

  // rung 9b groundwork: the TOPW mirrors (one per row 1-7, a parallel coil
  // on each slave's mirror com) are the phase-2 row selectors — TOPW(r)
  // closed will route the top-cell write to row r-1. Before any routing
  // exists they must (a) track the token row exactly and (b) not disturb
  // the game: the extra coil on every slave com changes the hold-path load,
  // which is precisely the kind of change that can drop a relay below
  // pickup. A full drop with the mirrors watched pins both.
  it('vertical prep: TOPW mirrors track the token row, VMODE follows its slide (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) =>
      g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0;
    const topwState = () => Array.from({ length: 7 }, (_, i) => relayOn(TOPW(i + 1)));

    expect(relayOn(VMODE), 'VMODE starts off').toBe(0);
    g.m.setSlide((VMODE % 6) + 1, 'right', Math.floor(VMODE / 6));
    expect(relayOn(VMODE), 'VMODE follows its slide up').toBe(1);
    expect(topwState(), 'no token, no TOPW').toEqual([0, 0, 0, 0, 0, 0, 0]);
    // park it again: with vmode up a lock takes an extra (phase-2) tick,
    // which is the sequencer test's subject — this one watches the mirrors
    // through the classic two-tick rhythm
    g.m.setSlide((VMODE % 6) + 1, 'left', Math.floor(VMODE / 6));
    expect(relayOn(VMODE), 'VMODE follows its slide down').toBe(0);

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
  });

  // rung 9b sequencing: with VMODE up, a lock is THREE ticks — press (P2M
  // latches), phase 2 (the reset rail stays dark: the token, LKM and LKS
  // survive one extra tick, and the top write lands; P2CLR breaks P2M so
  // the sequence self-limits), then the normal reset. The latch states are
  // this test's subject; then a vmode-off lock in the same game proves the
  // 2-tick rhythm is untouched.
  it('vertical prep: the phase-2 sequencer adds exactly one tick to a lock (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) =>
      g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0;
    const vmode = (on: boolean) =>
      g.m.setSlide((VMODE % 6) + 1, on ? 'right' : 'left', Math.floor(VMODE / 6));

    const model = Array(8).fill(0);
    vmode(true);
    g.setColumn(0);
    g.pressStart();
    g.tick(); // spawn
    expect(g.tokenAt()).toEqual([0]);
    expect(relayOn(P2M), 'no press yet, P2M off').toBe(0);
    for (let r = 1; r <= 7; r++) g.tick(); // fall; row 7 = merged landing+lock
    model[7] = 0b0001;
    expect(g.field(), 'press wrote the bottom row').toEqual(model);
    expect(relayOn(P2M), 'the vertical press latched P2M').toBe(1);
    expect(relayOn(P2S), 'P2S copied P2M after the release').toBe(1);

    g.tick(); // phase 2: the top write lands; the reset rail stays dark
    model[6] = 0b0001;
    expect(g.tokenAt(), 'token survives phase 2').toEqual([7]);
    expect(g.field(), 'phase 2 wrote the top row').toEqual(model);
    expect(relayOn(P2M), 'P2CLR broke P2M during phase 2').toBe(0);
    expect(relayOn(P2S), 'P2S copied the low master').toBe(0);
    expect(relayOn(LKS), 'LKM survived phase 2, so LKS is still up').toBe(1);

    g.tick(); // the real reset, one tick late
    expect(g.tokenAt(), 'reset killed the token').toEqual([]);
    expect(relayOn(LKS), 'reset cleared LKM, LKS followed').toBe(0);
    expect(g.field()).toEqual(model);

    g.tick(); // SPAWN was armed on the reset tick: the next piece enters
    expect(g.tokenAt(), 'spawn re-armed through the extra tick').toEqual([0]);

    // same game, vmode DOWN mid-fall: mode is sampled at the press, so this
    // lock (onto the vertical piece's top cell, at row 5) is the classic
    // two-tick rhythm. the reset re-homed the register to the CENTER, so
    // steer back over the col-0 stack first
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'steered back over the stack').toBe(0);
    vmode(false);
    for (let r = 1; r <= 5; r++) g.tick();
    model[5] = 0b0001;
    expect(g.field(), 'horizontal lock landed on the stack').toEqual(model);
    expect(relayOn(P2M), 'vmode down: no P2M latch').toBe(0);
    g.tick(); // must be the reset immediately
    expect(g.tokenAt(), 'two-tick rhythm intact with vmode down').toEqual([]);
    g.tick();
    expect(g.tokenAt(), 'and the next spawn still works').toEqual([0]);
  });

  // THE vertical acceptance bar: pollution. During phase 2 the write rails
  // may carry ONLY the mask and the top row's own readback. The two leak
  // classes get disjoint bit signatures:
  // - floor flavor: the token row's mirrorA re-firing (its readback would
  //   put the just-written bottom row on the rails) -> top shows col 2.
  // - stack flavor: the collision mirrors surviving phase 2 (the row BELOW
  //   the token on the rails) -> top shows row 6's cols 0/3; the token
  //   row's rebound -> top shows col 3 from row 5. Correct = mask alone.
  it('vertical pieces: both rows written, no pollution, squares stack (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) =>
      g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0;
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b0100);
    model[7] = 0b0100;
    g.operatorWrite(6, 0b1010);
    model[6] = 0b1010;
    g.m.setSlide((VMODE % 6) + 1, 'right', Math.floor(VMODE / 6));
    g.pressStart();

    // floor pollution test: col 0 is open all the way down (row 7 holds
    // col 2, but a cell only blocks the row above it)
    dropVertical(g, 0b0001, model, 'v-floor');
    expect(g.row(7), 'bottom = old | mask').toBe(0b0101);
    expect(g.row(6), 'top = old | mask — no bottom-row leak').toBe(0b1011);

    // stack pollution test: col 1 collides at row 5 (row 6 holds col 1);
    // row 5 pre-loaded with col 3 so a token-row rebound has a signature
    g.operatorWrite(5, 0b1000);
    model[5] = 0b1000;
    dropVertical(g, 0b0010, model, 'v-stack');
    expect(g.row(6), 'the row below the token is untouched').toBe(0b1011);
    expect(g.row(5), 'bottom = old | mask').toBe(0b1010);
    expect(g.row(4), 'top = mask alone — no leak from rows 5 or 6').toBe(0b0010);

    // a 2-wide mask with VMODE up is a 2x2 square: rests on row 5's col 3
    dropVertical(g, 0b1100, model, 'v-square');
    expect(g.row(4)).toBe(0b1110);
    expect(g.row(3)).toBe(0b1100);
    expect(relayOn(P2M), 'sequencer idle again').toBe(0);
    expect(relayOn(P2S)).toBe(0);
  });

  it('vertical pieces: bottom-write clears, top-write clears too, row-0 clip (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const vmode = (on: boolean) =>
      g.m.setSlide((VMODE % 6) + 1, on ? 'right' : 'left', Math.floor(VMODE / 6));
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b1110);
    model[7] = 0b1110;
    vmode(true);
    g.pressStart();

    // the bottom write completes row 7 -> clears as ever; the top write
    // still lands — and the collapse then walks that fresh top cell down
    // into the hole it sits above
    dropVertical(g, 0b0001, model, 'v-clear');
    expect(g.row(7), 'the surviving top cell fell into its own clear').toBe(0b0001);
    expect(g.row(6)).toBe(0);
    {
      // a vertical BOTTOM-only clear scores exactly once (the raw-P2SM
      // pulse race scored it twice; caught by the driver's scripted game)
      const scoreDigit = (() => {
        for (let i = 0; i < 10; i++)
          if (g.m.getMachineState(Math.floor(SCR(i, 2) / 6)).relays[SCR(i, 2) % 6]) return i;
        return -1;
      })();
      expect(scoreDigit, 'one clear, one step').toBe(1);
    }

    // the TOP write completes row 6 -> the DOUBLE-CLEAR rung senses it on
    // the phase-2 rails and clears it (the old 'documented limit' was the
    // permanence bug: nothing can ever lock inside a full row again)
    g.operatorWrite(6, 0b0111);
    model[6] = 0b0111;
    dropVertical(g, 0b1000, model, 'v-topfull');
    model[6] = 0; // the completed top row cleared; nothing above to fall
    expect(g.row(7), "the bottom keeps its own cells").toBe(0b1001);
    expect(g.row(6), 'the top-completed line CLEARED').toBe(0);

    // stack col 0 to the ceiling: rests at 6+5, then 4+3, then 2+1
    dropVertical(g, 0b0001, model, 'v-stack-1'); // rows 6+5
    dropVertical(g, 0b0001, model, 'v-stack-2'); // rows 4+3
    dropVertical(g, 0b0001, model, 'v-stack-3'); // rows 2+1
    expect(g.row(1)).toBe(0b0001);
    expect(g.row(0), 'row 0 stays empty — one lower than the junk-row era').toBe(0);

    // row-0 clip: row 1 now holds col 0, so the next col-0 spawn collides
    // at row 0 immediately — a merged spawn+press. Phase 2 finds no TOPW(0)
    // and writes nothing (the top cell is clipped at the edge); then reset.
    g.setColumn(0);
    g.tick(); // spawn straight into the press at row 0
    model[0] = 0b0001; // (already set) bottom write is idempotent here
    expect(g.tokenAt(), 'clip: merged spawn+lock at row 0').toEqual([0]);
    expect(g.field()).toEqual(model);
    g.tick(); // phase 2: clipped — nothing above row 0
    expect(g.tokenAt(), 'clip: token survives the no-op phase 2').toEqual([0]);
    expect(g.field(), 'clip: nothing written above the field').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);
    expect(g.field()).toEqual(model);

    // a lock AT row 0 is the top-out (the game-over rung): the latch is
    // up and no spawn can arm again — the clip case doubles as the
    // vertical top-out receipt
    const go = g.m.getMachineState(Math.floor(GAMEOVER / 6)).relays[GAMEOVER % 6];
    expect(go, 'the clip lock topped the stack out').toBe(true);
    vmode(false);
    g.pressStart();
    g.tick();
    expect(g.tokenAt(), 'no spawn after the vertical top-out').toEqual([]);
    expect(g.field(), 'the frozen field').toEqual(model);
  });

  // THE rung-10 acceptance: content above a cleared line FALLS. Distinct
  // row patterns prove the moves are exact copies (no OR-mixing between
  // rows, no leaks into untouched rows), and a second clear immediately
  // after proves the machinery re-arms.
  it('row collapse: the stack falls into a cleared line, repeatedly (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const model = Array(8).fill(0);
    // distinct patterns, and the dropping column (0) free the whole way
    // down — an occupied column would rest the piece early and clear
    // nothing (this test's first draft did exactly that)
    g.operatorWrite(7, 0b1110);
    model[7] = 0b1110;
    g.operatorWrite(6, 0b0110);
    model[6] = 0b0110;
    g.operatorWrite(5, 0b0010);
    model[5] = 0b0010;
    g.pressStart();
    dropPiece(g, 0b0001, model, 'completes the floor');
    expect(g.row(7), 'row 6 fell to the floor').toBe(0b0110);
    expect(g.row(6), 'row 5 fell one down').toBe(0b0010);
    expect(g.row(5)).toBe(0);
    // second clear: register pieces are 1-2 ADJACENT columns, so 0110
    // completes via two singles (cols 0 then 3)
    dropPiece(g, 0b0001, model, 'first corner');
    dropPiece(g, 0b1000, model, 'second corner completes the fallen row');
    expect(g.row(7), 'the second collapse landed the next row').toBe(0b0010);
    expect(g.row(6)).toBe(0);
  });

  // the rail-bridge probe. A pair cannot FALL past a source bit in its own
  // columns (collision blocks it), but the register can be walked right
  // after the lock — so the pair straddles an asymmetric source row DURING
  // the collapse. Without the CUTC cuts the two closed piece relays tie
  // rail 0 to rail 1 through BOTH fan nodes (colFan on the gate side,
  // collideNode on the tap side) and the moving row's col-0 bit would leak
  // into col 1 (row 7 = 0011 instead of 0001).
  it('row collapse: a mid-collapse pair swap cannot bridge the rails (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b0111);
    model[7] = 0b0111;
    g.operatorWrite(6, 0b0001); // col 0 on, col 1 OFF: the asymmetry
    model[6] = 0b0001;
    g.pressStart();
    g.setMask(0b1000); // a single at col 3 completes the floor
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick();
    model[7] = 0;
    expect(g.field(), 'probe: line cleared').toEqual(model);
    g.tick(); // reset; the chain seeds
    expect(g.tokenAt()).toEqual([]);
    g.setMask(0b0011); // the swap: the wide pair walks home mid-collapse
    for (let t = 7; t >= 1; t--) {
      g.tick(); // alpha
      model[t] |= model[t - 1];
      expect(g.field(), `probe: no rail bridge at stage ${t}`).toEqual(model);
      g.tick(); // beta
      model[t - 1] = 0;
      expect(g.field(), `probe: stage ${t} cleared`).toEqual(model);
      g.tick(); // gamma
      expect(g.field(), `probe: stage ${t} stepped`).toEqual(model);
    }
    expect(g.row(7), 'the pair did not bridge the rails').toBe(0b0001);
    expect(g.row(6)).toBe(0);
  });

  // the piece register (increment 1): the column is MACHINE state. A
  // one-hot slave ring steps once per LEFT/RIGHT press — sample-on-press
  // (the target master latches; the slaves hold, so the piece never
  // flickers and the still-armed direction taps can't re-sample a moved
  // ring), commit-on-release (a one-wave transfer window). Edge presses
  // self-loop; the reset tick re-homes to the CENTER column; the very first START
  // seeds the dark ring. The PIECE column coils re-feed from the ring
  // (single = pos; wide adds pos+1 via the WIDM taps).
  it('the position register: one step per press, edges self-loop, reset re-homes (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) => (g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const ring = () => Array.from({ length: 4 }, (_, j) => relayOn(POSS(j)));
    const pieces = () => Array.from({ length: 4 }, (_, j) => relayOn(PIECE(j)));
    const quiet = () => expect(g.m.getState().alerts).toEqual([]);

    const oneHot = (j: number) => Array.from({ length: 4 }, (_, k) => (k === j ? 1 : 0));

    // power-on: the ring wakes already seeded at the home column — the
    // CENTER since 2026-08-26 (BOOTL's NC feeds the home slave until the
    // first press latches the seed line dead)
    expect(g.posAt(), 'power-on: the home column').toBe(HOME);
    expect(ring()).toEqual(oneHot(HOME));
    expect(pieces(), 'PIECE follows the ring').toEqual(oneHot(HOME));
    quiet();

    // START arms the spawn latch; the register must not care
    g.pressStart();
    expect(ring(), 'START leaves the register alone').toEqual(oneHot(HOME));
    quiet();

    // one full press, held: the ring must NOT move during the press (the
    // master samples; a mid-press step would let the still-closed direction
    // taps re-sample the moved ring and cascade to the edge)
    g.m.pressButton(TETRIS_IO.right.button, TETRIS_IO.right.machine);
    expect(ring(), 'held press: the slaves hold').toEqual(oneHot(HOME));
    expect(relayOn(POSA(HOME + 1)), 'held press: the target master latched').toBe(1);
    expect(relayOn(POSA(HOME + 2)), 'held press: no cascade into the next master').toBe(0);
    g.m.releaseButton(TETRIS_IO.right.button, TETRIS_IO.right.machine);
    expect(ring(), 'release commits exactly one step').toEqual(oneHot(HOME + 1));
    expect(relayOn(POSA(HOME + 1)), 'the master unwound').toBe(0);
    quiet();

    // walk to the right edge and lean on it (from HOME+1 = 2 at 4 wide)
    g.pressBtn(TETRIS_IO.right);
    expect(ring()).toEqual(oneHot(3));
    g.pressBtn(TETRIS_IO.right);
    expect(ring(), 'right edge self-loops').toEqual(oneHot(3));
    quiet();

    // and back to the left edge
    for (const want of [
      oneHot(2),
      oneHot(1),
      oneHot(0),
      oneHot(0), // the edge self-loop again
    ]) {
      g.pressBtn(TETRIS_IO.left);
      expect(ring()).toEqual(want);
    }
    quiet();

    // wide mode: PIECE(pos+1) joins through the WIDM taps
    g.m.setSlide(TETRIS_IO.wid.slide, 'right', TETRIS_IO.wid.machine);
    expect(pieces(), 'wide at 0').toEqual([1, 1, 0, 0]);
    g.pressBtn(TETRIS_IO.right);
    g.pressBtn(TETRIS_IO.right);
    expect(pieces(), 'wide at 2').toEqual([0, 0, 1, 1]);
    g.pressBtn(TETRIS_IO.right);
    // pos 3 wide has no column 4: the WIDM4 wall gate refuses the step in
    // contacts (a degraded PIECE(3)-only state is reachable only by
    // slide-narrowing at 3 then re-widening — the reshape seam the page
    // guard owns; buttons can't get there)
    expect(g.posAt(), 'wide into the wall is refused by the contacts').toBe(2);
    expect(pieces(), 'the wide pair holds at 2').toEqual([0, 0, 1, 1]);
    quiet();
    g.pressBtn(TETRIS_IO.left);
    g.m.setSlide(TETRIS_IO.wid.slide, 'left', TETRIS_IO.wid.machine);
    expect(ring()).toEqual([0, 1, 0, 0]);
    expect(pieces(), 'narrow again at 1').toEqual([0, 1, 0, 0]);

    // steer mid-fall, then the lock's reset tick re-homes the ring
    const model = Array(8).fill(0);
    g.tick(); // spawn (START above also armed the SPAWN latch)
    expect(g.tokenAt()).toEqual([0]);
    g.tick();
    expect(g.tokenAt()).toEqual([1]);
    g.pressBtn(TETRIS_IO.right); // steer mid-fall: the register moves, the game doesn't
    expect(g.posAt()).toBe(2);
    expect(g.tokenAt(), 'steering does not tick the game').toEqual([1]);
    for (let r = 2; r <= 7; r++) g.tick(); // to the floor; the last is the lock
    model[7] = 0b0100;
    expect(g.field(), 'locked at the steered column').toEqual(model);
    expect(g.posAt(), 'the register holds through the lock tick').toBe(2);
    g.tick(); // the reset tick: the token dies AND the ring re-homes
    expect(g.tokenAt()).toEqual([]);
    expect(g.field()).toEqual(model);
    expect(ring(), 'reset re-homes the register to the CENTER').toEqual(oneHot(HOME));
    quiet();
  });

  // the piece register (increment 2): lateral LEGALITY in contacts. The
  // step's D-tap runs through LEGINV(target) — a coil reading "target
  // column occupied at the token's own row" off a MIRC-gated occupancy
  // rail. The contact set is a CHANGEOVER, not a plain gate: blocked
  // re-routes the sample into the CURRENT master (an electrically forced
  // no-op step) — a plain block would latch NO master and the release
  // window would then break every slave hold with nothing to transfer:
  // one refused press would wipe the ring. Wide right-steps also check
  // the right edge's target column (LEGINV2 second-read bank) and the
  // wall gate makes "wide into column 3" a refusal in contacts — geometry
  // the page used to clamp in JS. No token selected (pre-spawn, or the
  // post-lock row 7) = rails dark = every step legal, so free steering
  // and the next-spawn pre-positioning keep working.
  it('lateral legality: contacts refuse steps into stored cells (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) => (g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const ring = () => Array.from({ length: 4 }, (_, j) => relayOn(POSS(j)));
    const quiet = () => expect(g.m.getState().alerts).toEqual([]);
    const wid = (on: boolean) =>
      g.m.setSlide(TETRIS_IO.wid.slide, on ? 'right' : 'left', TETRIS_IO.wid.machine);

    const model = Array(8).fill(0);
    g.operatorWrite(3, 0b1000); // the wide-edge block at (3,3)
    model[3] = 0b1000;
    g.operatorWrite(5, 0b0100); // the narrow block at (5,2)
    model[5] = 0b0100;
    g.operatorWrite(6, 0b0001); // the left block at (6,0)
    model[6] = 0b0001;

    g.pressStart();
    g.tick(); // spawn at row 0, home column
    expect(g.tokenAt()).toEqual([0]);
    // the CENTER home is pos 1 — the descent column (never blocked)
    expect(g.posAt()).toBe(1);
    g.tick();
    g.tick();
    g.tick(); // token at row 3
    expect(g.tokenAt()).toEqual([3]);

    // wide right-step at row 3: cols 1,2 -> 2,3 puts the right edge on the
    // stored (3,3). The contacts must refuse; the ring must SURVIVE the
    // refused press's release window intact (the changeover, not a block)
    wid(true);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'wide step into the stored right edge refused').toBe(1);
    expect(ring(), 'the refused press left the one-hot intact').toEqual([0, 1, 0, 0]);
    quiet();
    // narrow: the same target column is free at this row
    wid(false);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'narrow step to column 2 is legal at row 3').toBe(2);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'and back').toBe(1);
    quiet();

    g.tick(); // row 4 — nothing stored anywhere on it
    expect(g.tokenAt()).toEqual([4]);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt()).toBe(2);
    // the wall in contacts: wide at pos 2 has no column 4 to enter
    wid(true);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'wide into the wall refused by the contacts').toBe(2);
    expect(ring()).toEqual([0, 0, 1, 0]);
    quiet();
    wid(false);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'narrow into column 3 is legal on a clean row').toBe(3);
    g.pressBtn(TETRIS_IO.left);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt()).toBe(1);
    quiet();

    g.tick(); // row 5: (5,2) blocks the right step now
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'narrow step into the stored (5,2) refused').toBe(1);
    expect(ring()).toEqual([0, 1, 0, 0]);
    quiet();

    g.tick(); // row 6: (6,0) blocks the left step
    expect(g.tokenAt()).toEqual([6]);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'left step into the stored (6,0) refused').toBe(1);
    quiet();

    g.tick(); // row 7: merged landing + lock at (7,1)
    model[7] = 0b0010;
    expect(g.field(), 'the survivor locks where it was steered').toEqual(model);
    // post-lock, pre-reset: the register is FROZEN now, and the old
    // assertion here ('steps stay free — a step only pre-positions the
    // next piece') was wrong on its own terms: the reset re-homes the
    // register two lines below, so such a step never pre-positioned
    // anything. it was not harmless either — a lock is three ticks and
    // phase 2 writes the row ABOVE, so a step in this window moved where
    // that row landed and an L came down as '.X....' over 'XXX...', four
    // cells with the stem over the middle, which is a T. the piece here
    // is flat so nothing visible changes; the gate is what makes that
    // true for every piece.
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'a lock freezes the register: the step is refused').toBe(1);
    quiet();
    g.tick(); // reset re-homes (which is why the step bought nothing anyway)
    expect(g.tokenAt()).toEqual([]);
    expect(g.posAt()).toBe(HOME);
    expect(g.field()).toEqual(model);
    quiet();
  });

  // the /tetris/ page runs the 'fast' engine; until this rung no tetris
  // game test did. A short scenario keeps the page's engine covered on the
  // full composed circuit: a line-clearing horizontal drop WITH a collapse
  // plus a vertical drop. (fast is oracle-validated on 5000 random circuits
  // and the whole suite elsewhere; this is the composition smoke.)
  it('short scenario under the fast engine (what /tetris/ runs)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b1110);
    model[7] = 0b1110;
    g.operatorWrite(6, 0b0110);
    model[6] = 0b0110;
    g.pressStart();
    dropPiece(g, 0b0001, model, 'fast drop'); // clears row 7; row 6 falls
    expect(g.row(7)).toBe(0b0110);
    expect(g.row(6)).toBe(0);
    g.operatorWrite(3, 0b0010);
    model[3] = 0b0010;
    g.m.setSlide((VMODE % 6) + 1, 'right', Math.floor(VMODE / 6));
    dropVertical(g, 0b0010, model, 'fast vertical'); // rests at 2: rows 2+1
    expect(g.row(2)).toBe(0b0010);
    expect(g.row(1)).toBe(0b0010);
  });

  // the live-play report (2026-08-20): a piece steered sideways INTO an
  // already-placed cell "seems to work", then later a whole row disappears.
  // This reproduces that sequence under both gameplay engines. The overlap
  // is real and benign: sideways collision does not exist (the token only
  // senses the row BELOW it) and the lock write is an OR, so overlapping
  // cells are absorbed. The only way a row vanishes is completing it — and
  // with no row collapse in this rung the rows above stay floating, which
  // is easy to read as a glitch on the page.
  // increment 3a: the TALL piece's TOP cell refuses too. A second
  // occupancy read (MIRCT gates riding the same cell-com nodes through
  // the MIRC arm jacks' spare holes, "token at r" reading row r-1) feeds
  // LEGINVT coils, and every D-tap tree gains a VMODEM-forked tall stage:
  // flat skips it, tall checks the top target (and the 2x2's wide branch
  // checks the top of the right edge via LEGINVT2). Token at row 0 has no
  // top row (the write clips there too) and row 7/no-token stay unmapped:
  // dark rails default legal, as ever.
  it('tall legality: the top row refuses too (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const quiet = () => expect(g.m.getState().alerts).toEqual([]);
    const vmode = (on: boolean) =>
      g.m.setSlide(TETRIS_IO.vmode.slide, on ? 'right' : 'left', TETRIS_IO.vmode.machine);
    const wid = (on: boolean) =>
      g.m.setSlide(TETRIS_IO.wid.slide, on ? 'right' : 'left', TETRIS_IO.wid.machine);

    const model = Array(8).fill(0);
    g.operatorWrite(1, 0b1000); // the 2x2's top-right-edge block at (1,3)
    model[1] = 0b1000;
    g.operatorWrite(4, 0b0101); // tall-top blocks: (4,0) left, (4,2) right
    model[4] = 0b0101;

    g.pressStart();
    g.tick(); // spawn at row 0, the CENTER home = column 1: the descent column
    expect(g.posAt()).toBe(1);
    // steering AT row 0 with vmode up: there is no top row — must be legal
    vmode(true);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'tall at row 0: no top row, the step is legal').toBe(0);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt()).toBe(1);
    quiet();

    g.tick();
    g.tick(); // token at row 2
    expect(g.tokenAt()).toEqual([2]);
    // 2x2 right-step: bottoms (2,2),(2,3) free; top-right (1,3) stored —
    // only the LEGINVT2 branch (top of the right edge) can refuse this
    wid(true);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), '2x2 into a stored top-right edge refused').toBe(1);
    quiet();
    vmode(false); // wide but flat: the same step is legal
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'flat wide pair steps once the top check is off').toBe(2);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt()).toBe(1);
    wid(false);
    vmode(true);
    quiet();

    g.tick();
    g.tick();
    g.tick(); // token at row 5
    expect(g.tokenAt()).toEqual([5]);
    // tall right-step: bottom (5,2) free, top (4,2) stored
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'tall step under a stored overhang refused').toBe(1);
    // tall left-step: bottom (5,0) free, top (4,0) stored
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'tall left step under the other overhang refused').toBe(1);
    quiet();
    vmode(false);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'flat, the same step is legal — the top check did it').toBe(2);
    g.pressBtn(TETRIS_IO.left);
    vmode(true);
    quiet();

    g.tick(); // token at row 6: the overhang is two rows up now
    expect(g.tokenAt()).toEqual([6]);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'tall step is legal once the top row cleared it').toBe(2);
    quiet();

    g.tick(); // merged landing + lock at the floor (tall: rows 7 and 6, col 2)
    model[7] = 0b0100;
    g.tick(); // phase 2: the top write
    model[6] = 0b0100;
    expect(g.field(), 'the tall survivor locked where steered').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);
    expect(g.posAt(), 'reset re-homed to the CENTER').toBe(HOME);
    // no token + vmode up: steps stay free (dark rails default legal)
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'no-token steering unaffected by vmode').toBe(HOME + 1);
    vmode(false);
    quiet();
  });

  // the live-play report (2026-08-20) was a piece steered sideways INTO an
  // already-placed cell, absorbed by the OR-write. That exact move is now
  // REFUSED BY THE CONTACTS (the increment-2 legality changeovers) — the
  // report's scenario survives here as the refusal receipt. The ONE
  // remaining overlap seam is the WID slide reshape (a slide cannot be
  // electrically refused; the page guards it): its overlap is absorbed by
  // the OR-write, and rows still vanish only by completion.
  it('steer-into-overlap: refused by the contacts; the reshape seam still ORs (fast)', { timeout: 1800000 }, () => {
    for (const engine of ['fast'] as const) {
      setSolverEngine(engine);
      const g = makeGame();
      const model = Array(8).fill(0);
      g.operatorWrite(7, 0b0100); // (7,2): the floor the widened pair rests on
      model[7] = 0b0100;
      g.operatorWrite(6, 0b0100); // (6,2): the stored cell the reshape overlaps
      model[6] = 0b0100;
      g.pressStart();

      // the reshape seam first, on the clean columns: hover a narrow piece
      // at row 6 (nothing below col 1), widen the WID slide (no contact
      // can refuse a slide) — the pre-armed collide locks the pair IN
      // PLACE through the stored (6,2), and the OR-write absorbs it
      g.setColumn(1);
      g.tick(); // spawn
      expect(g.tokenAt()).toEqual([0]);
      for (let r = 1; r <= 6; r++) g.tick();
      expect(g.tokenAt(), `${engine}: hovering at the seam row`).toEqual([6]);
      g.m.setSlide(TETRIS_IO.wid.slide, 'right', TETRIS_IO.wid.machine); // widen: cols 1,2
      g.tick(); // (7,2) blocks the pair: pure lock at 6, 0b0110 over the stored 0b0100
      model[6] |= 0b0110;
      expect(g.field(), `${engine}: the reshape overlap is absorbed by the OR-write`).toEqual(model);
      g.tick(); // reset (re-homes the register)
      g.m.setSlide(TETRIS_IO.wid.slide, 'left', TETRIS_IO.wid.machine);
      expect(g.tokenAt()).toEqual([]);

      // the reported live-play move: a piece beside stored content steered
      // INTO it — now refused by the legality changeovers
      dropPiece(g, 0b0001, model, `${engine}: col 0 to the floor`);
      dropPiece(g, 0b0001, model, `${engine}: col 0 stacks`); // row 6 now 0b0111
      g.setColumn(3);
      g.tick(); // spawn
      for (let r = 1; r <= 6; r++) g.tick();
      expect(g.tokenAt(), `${engine}: hovering beside the stored row`).toEqual([6]);
      g.pressBtn(TETRIS_IO.left); // into (6,2) — the reported move
      expect(g.posAt(), `${engine}: the reported move is refused in contacts`).toBe(3);
      expect(g.field(), `${engine}: the refusal changed nothing`).toEqual(model);
      expect(g.m.getState().alerts).toEqual([]);
      g.tick(); // merged landing + lock at the floor, still col 3
      model[7] |= 0b1000;
      expect(g.field(), `${engine}: locked where the contacts left it`).toEqual(model);
      g.tick(); // reset
      expect(g.tokenAt()).toEqual([]);
      expect(g.row(6), `${engine}: nothing vanished without completion`).toBe(0b0111);

      // completion is still the only way a row dies: (7,3) is stored now,
      // so a col-3 drop rests at row 6 and completes it; clear + collapse
      dropPiece(g, 0b1000, model, `${engine}: completes row 6`);
      expect(g.row(6), `${engine}: row 6 vanished by completion`).toBe(0);
      expect(g.row(7), `${engine}: floor row survives the clear above it`).toBe(0b1101);
    }
  });

  // rung 10 sequencing, watched stage by stage on an EMPTY stack: after a
  // clearing lock's reset seeds the chain at the cleared row, the lane owns
  // the ticks — alpha moves ripple empty rows, beta steps the one-hot up,
  // the armed spawn WAITS — and when the chain drains off stage 1 the lane
  // releases and the deferred piece finally enters. Ordinary play must
  // never engage any of it. (Real content falling is the acceptance test
  // below; this one pins the sequencing observables.)
  it('collapse prep: the lane owns the ticks, the chain walks, spawns wait (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) =>
      g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0;
    const elev = () => Array.from({ length: 7 }, (_, i) => relayOn(ELEVSL(i + 1)));
    const oneHotAt = (t: number) =>
      Array.from({ length: 7 }, (_, i) => (i + 1 === t ? 1 : 0));
    const model = Array(8).fill(0);
    g.pressStart();

    dropPiece(g, 0b0001, model, 'c2 drop 1');
    dropPiece(g, 0b0010, model, 'c2 drop 2');
    dropPiece(g, 0b0100, model, 'c2 drop 3');
    expect(elev(), 'chain dark through non-clearing locks').toEqual(oneHotAt(0));

    // the clearing drop, run by hand so the stages stay observable
    g.setMask(0b1000);
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick(); // fall; the floor press completes row 7
    model[7] = 0;
    expect(g.field(), 'line cleared').toEqual(model);
    g.tick(); // reset: the token dies and its row seeds the chain
    expect(g.tokenAt()).toEqual([]);
    expect(elev(), 'seeded at stage 7').toEqual(oneHotAt(7));

    // 7 alpha/beta/gamma triples: the hole walks to the top while spawns wait
    for (let step = 7; step >= 1; step--) {
      expect(elev(), `stage ${step} holds before its triple`).toEqual(oneHotAt(step));
      g.tick(); // alpha — the move tick (empty copies empty here)
      expect(g.tokenAt(), 'alpha defers the spawn').toEqual([]);
      expect(elev(), 'alpha does not step the chain').toEqual(oneHotAt(step));
      g.tick(); // beta — the clear tick
      expect(g.tokenAt(), 'beta defers the spawn').toEqual([]);
      expect(elev(), 'beta does not step the chain either').toEqual(oneHotAt(step));
      g.tick(); // gamma — the step, with every rail dark
      expect(g.tokenAt(), 'gamma defers the spawn').toEqual([]);
      expect(g.field(), 'empty rows ripple down — the field stays clear').toEqual(model);
    }
    expect(elev(), 'chain drained off the top').toEqual(oneHotAt(0));

    // the clearing lock's reset re-homed the register to column 0 — walk
    // it back out so the deferred piece falls where the scenario wants it
    g.setMask(0b1000);

    // the lane released: the spawn that waited fires on the very next tick
    g.tick();
    expect(g.tokenAt(), 'the deferred piece finally spawns').toEqual([0]);
    for (let r = 1; r <= 7; r++) g.tick(); // and plays out normally
    model[7] = 0b1000;
    expect(g.field(), 'the waiting piece locks as ever').toEqual(model);
    g.tick(); // its (ordinary, non-clearing) reset
    expect(g.tokenAt()).toEqual([]);
    expect(elev(), 'ordinary resets leave the drained chain dark').toEqual(oneHotAt(0));
  });

  // rung 11: the generator is ROWS-parameterized (columns stay 4 — the
  // register/legality/LINE machinery is per-column and scales on its own
  // rung). At rows=8 the wire list is electrically identical to the
  // hand-laid classic (verified by diff: the only changes are hole
  // assignments within chained — single-net — rail groups). This is the
  // first taller well: every mechanism at 12 rows — spawn, gravity to the
  // deep floor, merged locks, the operator-free floor line (deep rows are
  // game-writable only: the 3-bit op-write decoder covers rows 0-7), the
  // clear, the full 33-tick collapse (11 stages x alpha/beta/gamma), the
  // register's re-home and mid-well steering.
  // the game-over latch: any LOCK AT ROW 0 means the stack topped out.
  // GAMEOVER latches (set = the lock-press rail through GOM, a "token at
  // row 0" mirror) and its NC sits in the START button's arm path, so no
  // further spawn can ever arm — a power cycle starts the next game. The
  // documented simplification: a row-0 CLEARING lock also tops out.
  it('game over: a lock at row 0 latches and blocks every spawn (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) => (g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const model = Array(8).fill(0);
    // the stack builds in the HOME column, where the un-steered spawn lands
    for (let r = 1; r <= 7; r++) {
      g.operatorWrite(r, 1 << HOME);
      model[r] = 1 << HOME;
    }
    expect(relayOn(GAMEOVER), 'alive while the stack builds').toBe(0);
    g.pressStart();
    g.tick(); // merged spawn + lock AT ROW 0: the top-out
    model[0] = 1 << HOME;
    expect(g.field(), 'the topping lock still writes').toEqual(model);
    expect(relayOn(GAMEOVER), 'the top-out latched').toBe(1);
    g.tick(); // the ordinary reset still runs
    expect(g.tokenAt()).toEqual([]);
    // START can never arm again: the latch broke the button's path
    g.pressStart();
    g.tick();
    expect(g.tokenAt(), 'no spawn after game over').toEqual([]);
    expect(g.field(), 'the field is frozen history').toEqual(model);
    expect(relayOn(GAMEOVER), 'latched for good').toBe(1);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // staggered pieces (shapes 3b-1): S and Z. The phase-2 top write always
  // sampled the mask live; now it can sample a DIFFERENT mask — the
  // TOPMASK slide bank (PIECET) behind STAGM's changeover, whose fan
  // conducts only during a staggered phase 2 (the audit caught both a
  // bottom-press leak through dual-mask columns and a symmetric-phase-2
  // bridge before any test ran). Collision/legality still read the B
  // mask: a staggered top cell can overhang, absorbed by the OR-write
  // (documented; the top collision term is the next increment).
  it('staggered pieces: S and Z write their two rows (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const bm = LEFTBTN.machine;
    const setTop = (mask: number) => {
      for (let j = 0; j < 4; j++) g.m.setSlide(j + 1, (mask >> j) & 1 ? 'right' : 'left', bm);
    };
    const stag = (on: boolean) => g.m.setSlide(6, on ? 'right' : 'left', bm);
    const vmode = (on: boolean) =>
      g.m.setSlide((VMODE % 6) + 1, on ? 'right' : 'left', Math.floor(VMODE / 6));

    const model = Array(8).fill(0);
    g.pressStart();
    // the S: bottom pair at cols 1-2, top pair at cols 0-1
    vmode(true);
    stag(true);
    setTop(0b0011);
    g.setMask(0b0110);
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick(); // merged landing + lock at the floor
    model[7] = 0b0110;
    expect(g.field(), 'S: the bottom row wrote the B mask').toEqual(model);
    g.tick(); // phase 2: the TOP mask, not the B mask
    model[6] = 0b0011;
    expect(g.field(), 'S: the top row wrote the TOPMASK').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);

    // the Z on the other side: bottom 0-1, top 1-2 — resting ON the S
    setTop(0b0110);
    g.setMask(0b0011);
    g.tick(); // spawn
    for (let r = 1; r <= 5; r++) g.tick(); // rests at 5 ((6,0) is empty but (6,1) stored)
    model[5] = 0b0011;
    expect(g.field(), 'Z: bottom at its rest row').toEqual(model);
    g.tick(); // phase 2
    model[4] = 0b0110;
    expect(g.field(), 'Z: top staggered right').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);

    // regression inside the same game: STAG off = the classic symmetric
    // tall piece, TOPMASK slides ignored even though they are still up
    stag(false);
    setTop(0b1111); // deliberately hostile: must be ignored
    g.setMask(0b1000);
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick();
    model[7] |= 0b1000;
    g.tick(); // phase 2: symmetric — the B mask again
    model[6] |= 0b1000;
    expect(g.field(), 'symmetric tall unchanged with STAG off').toEqual(model);
    g.tick(); // reset
    setTop(0);
    vmode(false);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-2: the top collision term. A staggered notch (a TOPMASK column
  // outside the B mask) rests ON stored content instead of burying it —
  // a private +-fed branch (PIECET AND occupied-at-token-row via the LEGB
  // second reads) pre-arms COLLIDE continuously, the same mechanism a
  // between-ticks steer under a block uses. The tap-side press gates
  // (CUTP) keep that idle + off the data rails.
  it('staggered collision: the notch rests on stored content (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const bm = LEFTBTN.machine;
    const setTop = (mask: number) => {
      for (let j = 0; j < 4; j++) g.m.setSlide(j + 1, (mask >> j) & 1 ? 'right' : 'left', bm);
    };
    const vmode = (on: boolean) =>
      g.m.setSlide((VMODE % 6) + 1, on ? 'right' : 'left', Math.floor(VMODE / 6));
    const model = Array(8).fill(0);
    g.operatorWrite(5, 0b0001); // the block under the S's notch column
    model[5] = 0b0001;
    g.pressStart();
    vmode(true);
    g.m.setSlide(6, 'right', bm); // STAG
    setTop(0b0011);
    g.setMask(0b0110); // the S again: notch = column 0
    g.tick(); // spawn
    for (let r = 1; r <= 5; r++) g.tick(); // arrives at 5: the notch senses (5,0)
    model[5] |= 0b0110; // merged lock ON arrival — the bottom write
    expect(g.field(), 'the notch rested the piece a row early').toEqual(model);
    expect(g.tokenAt(), 'locked at 5, not fallen through').toEqual([5]);
    g.tick(); // phase 2
    model[4] = 0b0011;
    expect(g.field(), 'the top write above the rest row').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);

    // the negative: with T == B (no notch) the bottom term owns the rest
    // row exactly as ever — a staggered-mode column-3 piece rides down
    // the clean side and stops on the (3,3) block by the ordinary sense
    g.operatorWrite(3, 0b1000);
    model[3] = 0b1000;
    setTop(0b1000);
    g.setMask(0b1000);
    g.tick(); // spawn
    g.tick(); // token 1
    expect(g.tokenAt(), 'the clean side falls freely').toEqual([1]);
    g.tick(); // token 2: (3,3) below -> merged lock by the bottom term
    model[2] = 0b1000;
    expect(g.field(), 'the bottom term still owns its cases').toEqual(model);
    g.tick(); // phase 2
    model[1] = 0b1000;
    expect(g.field()).toEqual(model);
    g.tick(); // reset
    g.m.setSlide(6, 'left', bm);
    setTop(0);
    vmode(false);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-3a: the SHAPE RING. The shape itself becomes machine state — a
  // 6-state one-hot ring (1x1, 2wide, 2tall, O, S, Z) stepped by the UP
  // button (the score-ring pattern; SHBOOT seeds 1x1 at power-on). The
  // ring DERIVES the mode rails the operator slides drive, wiring into
  // the SAME coil nets (compatibility-OR), so these tests never touch a
  // slide: WID/VMODE/STAG and the whole TOPMASK bank follow the ring and
  // the live position register.
  it('the shape ring: UP walks the full cycle and derives every mode rail (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const rel = (idx: number) => (g.m.getMachineState(Math.floor(idx / 6)).relays[idx % 6] ? 1 : 0);
    const shapeAt = () => {
      const hot: number[] = [];
      for (let i = 0; i < SHAPES.length; i++) {
        const r = TETRIS_IO.shapeRelay(i);
        if (g.m.getMachineState(r.machine).relays[r.index]) hot.push(i);
      }
      expect(hot.length, 'the ring is one-hot').toBe(1);
      return hot[0];
    };
    const rails = () => [rel(WIDM), rel(VMODE), rel(STAGM)];
    const topBank = () =>
      rel(PIECET(0)) + 2 * rel(PIECET(1)) + 4 * rel(PIECET(2)) + 8 * rel(PIECET(3));
    const botBank = () =>
      rel(PIECE(0)) + 2 * rel(PIECE(1)) + 4 * rel(PIECE(2)) + 8 * rel(PIECE(3));
    const up = () => g.pressBtn(TETRIS_IO.up);

    // power-on: state 0 (1x1), every rail down, the T bank dark
    expect(shapeAt()).toBe(0);
    expect(rails()).toEqual([0, 0, 0]);
    expect(topBank()).toBe(0);

    // the register wakes at the CENTER home now — walk to pos 0 first so
    // the fit-range refusal choreography below stays exactly as designed
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt()).toBe(0);

    up(); // 2 wide
    expect(shapeAt()).toBe(1);
    expect(rails(), '2wide: WIDM only').toEqual([1, 0, 0]);
    up(); // 2 tall
    expect(shapeAt()).toBe(2);
    expect(rails(), '2tall: VMODE only').toEqual([0, 1, 0]);
    expect(topBank(), 'symmetric shapes never feed the T bank').toBe(0);
    up(); // O
    expect(shapeAt()).toBe(3);
    expect(rails(), 'O: wide and tall').toEqual([1, 1, 0]);
    expect(topBank()).toBe(0);

    // 3b-3c: entering S at pos 0 is OUT OF ITS FIT RANGE — the transition
    // network has no into-S branch there, so the UP simply does not clock
    up();
    expect(shapeAt(), 'S at pos 0 refused in contacts: the ring held').toBe(3);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt()).toBe(1);
    up(); // S: the top pair = the bottom pair shifted LEFT, from the LIVE register
    expect(shapeAt()).toBe(4);
    expect(rails(), 'S: wide, tall, staggered').toEqual([1, 1, 1]);
    expect(topBank(), 'S at pos 1: top pair 0-1').toBe(0b0011);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt()).toBe(2);
    expect(topBank(), 'S at pos 2: top pair 1-2').toBe(0b0110);

    up(); // S -> Z at pos 2: Z's range ends at pos 1 — refused too
    expect(shapeAt(), 'Z at pos 2 refused in contacts').toBe(4);
    g.pressBtn(TETRIS_IO.left);
    up(); // Z: shifted RIGHT
    expect(shapeAt()).toBe(5);
    expect(rails(), 'Z: wide, tall, staggered').toEqual([1, 1, 1]);
    expect(topBank(), 'Z at pos 1: top pair 2-3').toBe(0b1100);
    g.pressBtn(TETRIS_IO.left);
    expect(topBank(), 'Z at pos 0: top pair 1-2').toBe(0b0110);

    // 3b-4a: the ring continues into the upright triples. Z -> L1 (the
    // delta cells read dark pre-spawn, and pos 0 is in every range here)
    up();
    expect(shapeAt(), 'Z steps into L1 now, not home').toBe(6);
    expect(rails(), 'L1: wide, tall, T-fan phase 2').toEqual([1, 1, 1]);
    expect(botBank(), 'L1 bottom: the triple at pos 0').toBe(0b0111);
    expect(topBank(), 'L1 top: the stem on the left').toBe(0b0001);
    // 3b-4b: triples STEER — the trees read their true footprint now
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'a triple steps right').toBe(1);
    expect(botBank(), 'the triple followed').toBe(0b1110);
    expect(topBank()).toBe(0b0010);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'the triple bound: pos 2 refused in contacts').toBe(1);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt()).toBe(0);
    up(); // L1 -> J1: the stem moves to the right end
    expect(shapeAt()).toBe(7);
    expect(botBank()).toBe(0b0111);
    expect(topBank(), 'J1 top: the stem on the right').toBe(0b0100);
    up(); // J1 -> T1: the stem centers
    expect(shapeAt()).toBe(8);
    expect(botBank()).toBe(0b0111);
    expect(topBank(), 'T1 top: the stem centered').toBe(0b0010);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'the left edge self-loops as ever').toBe(0);
    // 3b-4c: the OVERHANG trio — 3-wide TOPS over offset single bottoms
    up(); // T1 -> L2: the base column is CUT, the bottom rides WID3 alone
    expect(shapeAt(), 'T1 steps into L2 now, not home').toBe(9);
    expect(rails(), 'L2: NOT wide-paired, tall, T-fan phase 2').toEqual([0, 1, 1]);
    expect(botBank(), 'L2 bottom: the single at p+2').toBe(0b0100);
    expect(topBank(), 'L2 top: the triple').toBe(0b0111);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'an overhang steps right').toBe(1);
    expect(botBank(), 'the bottom followed to col 3').toBe(0b1000);
    expect(topBank()).toBe(0b1110);
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'the 3-wide TOP bound: pos 2 refused').toBe(1);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt()).toBe(0);
    up(); // L2 -> J2: the bottom moves to the base column
    expect(shapeAt()).toBe(10);
    expect(rails(), 'J2: plain base bottom').toEqual([0, 1, 1]);
    expect(botBank(), 'J2 bottom: the single at p').toBe(0b0001);
    expect(topBank()).toBe(0b0111);
    up(); // J2 -> T2: the bottom centers (the WIDM tap with the base cut)
    expect(shapeAt()).toBe(11);
    expect(rails(), 'T2: rides the wide tap').toEqual([1, 1, 1]);
    expect(botBank(), 'T2 bottom: the single at p+1').toBe(0b0010);
    expect(topBank()).toBe(0b0111);
    // 3b-4d: the horizontal I — four wide and FLAT. it joins the same
    // wide rails the 2- and 3-wide bottoms use (the fan's offsets 1 and
    // 2) plus its own offset-3 rail, and never touches VMODE or STAG.
    up(); // T2 -> I
    expect(shapeAt(), 'T2 steps into the I now, not home').toBe(12);
    expect(rails(), 'I: wide, not tall, not staggered').toEqual([1, 0, 0]);
    expect(botBank(), 'I bottom: four columns from p').toBe(0b1111);
    expect(topBank(), 'a flat piece never feeds the T bank').toBe(0);
    up(); // I -> 1x1: the wrap (the I's bottom already covers col p, so
    // this edge carries no delta check at all — the one the T2 wrap had)
    expect(shapeAt()).toBe(0);
    expect(rails()).toEqual([0, 0, 0]);
    expect(topBank()).toBe(0);
    expect(botBank(), 'back to the single').toBe(0b0001);

    // compatibility: the operator slides still work (union semantics) —
    // hardware and ring feed the same coil nets
    g.m.setSlide(TETRIS_IO.wid.slide, 'right', TETRIS_IO.wid.machine);
    expect(rel(WIDM), 'a raised WID slide ORs with the ring').toBe(1);
    g.m.setSlide(TETRIS_IO.wid.slide, 'left', TETRIS_IO.wid.machine);
    expect(rel(WIDM)).toBe(0);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // ...and the ring PLAYS: a Z then an S lock their staggered rows with
  // NO slide touched — shape = UP presses, column = LEFT/RIGHT, the T
  // bank re-computes from the register on every step.
  it('the ring plays: a Z and an S lock with no slides touched (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const up = () => g.pressBtn(TETRIS_IO.up);
    const model = Array(8).fill(0);
    // the CENTER home is pos 1 — already inside S's fit range, which the
    // cycle passes through (the transition network refuses out-of-range)
    expect(g.posAt()).toBe(1);
    for (let k = 0; k < 5; k++) up(); // 1x1 -> ... -> Z at pos 1
    g.pressBtn(TETRIS_IO.left); // Z's floor drop happens at pos 0
    g.pressStart();
    // Z at the home column: bottom 0-1, top 1-2
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick(); // merged landing + lock at the floor
    model[7] = 0b0011;
    expect(g.field(), 'Z: the bottom pair').toEqual(model);
    g.tick(); // phase 2
    model[6] = 0b0110;
    expect(g.field(), 'Z: the top pair staggered right').toEqual(model);
    g.tick(); // reset (re-homes the register)
    expect(g.tokenAt()).toEqual([]);

    // the S next: wrap the ring all the way around. the cycle passes
    // the upright triples, the overhang trio AND the I now, and at FOUR
    // columns no single column admits the whole ring any more — S needs
    // column >= 1 and the I's 4-wide bottom fits only at column 0 — so
    // the walk steers into each next shape's fit range, which is what a
    // player does. then to pos 2: bottom 2-3, top 1-2, and the bottom
    // pair senses the Z's top at (6,2)
    const ringAt = () => {
      for (let i = 0; i < SHAPES.length; i++) {
        const r = TETRIS_IO.shapeRelay(i);
        if (g.m.getMachineState(r.machine).relays[r.index]) return i;
      }
      return -1;
    };
    let wrap = 0;
    while (ringAt() !== 4 && wrap++ < 3 * SHAPES.length) {
      const r = shapeRange(SHAPES[(ringAt() + 1) % SHAPES.length], 4);
      let st = 0;
      while (g.posAt() < r.min && st++ < 6) g.pressBtn(TETRIS_IO.right);
      while (g.posAt() > r.max && st++ < 6) g.pressBtn(TETRIS_IO.left);
      up();
    }
    expect(ringAt(), 'the ring wrapped back to S').toBe(4);
    let guard = 4;
    while (g.posAt() < 2 && guard-- > 0) g.pressBtn(TETRIS_IO.right);
    expect(g.posAt()).toBe(2);
    g.tick(); // spawn
    for (let r = 1; r <= 5; r++) g.tick(); // rests at 5 on the stored (6,2)
    model[5] = 0b1100;
    expect(g.field(), 'S: the bottom pair rested on the Z').toEqual(model);
    g.tick(); // phase 2
    model[4] = 0b0110;
    expect(g.field(), 'S: the top pair staggered left').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-3b: the legality trees read the TRUE target top columns. LEGINVT
  // checks are NOT-Z-gated (correct for symmetric AND S, false only for
  // Z), LEGINVT2 NOT-S-gated; LTS/LTZ add the mode-only columns as series
  // hops; SBND/ZBND refuse the out-of-range positions in contacts. The
  // page's staggered steering guard dies with this.
  it('staggered steering: the trees follow the shifted top pair (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    // an S: its top pair rides one column LEFT of the bottom pair.
    // operator writes happen BEFORE selecting the shape: with a ring-wide
    // state up the union keeps WIDM closed and a write would bridge rails
    // through the piece gates (operatorWrite's slide-narrowing can't
    // override the ring).
    let g = makeGame();
    const up = () => g.pressBtn(TETRIS_IO.up);
    g.operatorWrite(4, 0b0001); // stored at (4,0): S-left's target top col
    // the CENTER home is pos 1 — already in the S entry's range (3b-3c)
    for (let k = 0; k < 4; k++) up(); // -> S
    g.pressBtn(TETRIS_IO.right); // S at pos 2 (bottom 2-3, top 1-2)
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // spawn + fall to token row 5
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.left); // target pos 1: top set {0,1} hits (4,0)
    expect(g.posAt(), 'S left into the stored top column: refused').toBe(2);
    g.pressBtn(TETRIS_IO.right); // pos 3 would put the bottom past the wall
    expect(g.posAt(), 'the wide wall still refuses').toBe(2);
    for (let t = 6; t <= 7; t++) g.tick(); // rest on the floor
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(7), 'S bottom 2-3').toBe(0b1100);
    expect(g.row(6), 'S top 1-2').toBe(0b0110);
    // bounds: a fresh S may never ENTER pos 0 — contacts, empty board
    // (the reset re-homed the register to the CENTER pos 1 already)
    g.tick(); // spawn (the reset re-armed SPAWN)
    g.tick(); // token at 1, far from the stack
    expect(g.tokenAt()).toEqual([1]);
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'the S bound: pos 0 refused in contacts').toBe(1);
    g.pressBtn(TETRIS_IO.right); // pos 2 is clean up here
    expect(g.posAt(), 'a legal S step still goes').toBe(2);
    for (let t = 2; t <= 4; t++) g.tick(); // fall to token 4
    expect(g.tokenAt()).toEqual([4]);
    g.tick(); // into 5 — (6,2) below: merged lock on arrival
    expect(g.tokenAt(), 'locked on the stack').toEqual([5]);
    g.tick(); // phase 2: top {1,2} onto row 4 (joining the operator block)
    g.tick(); // reset
    expect(g.row(5), 'second S bottom merged').toBe(0b1100);
    expect(g.row(4), 'second S top + the stored block').toBe(0b0111);
    expect(g.m.getState().alerts).toEqual([]);

    // a Z beside a left tower: the OLD symmetric check refused a left
    // step whenever the TARGET pos column was stored one row up — but Z's
    // top pair lives one column RIGHT of the bottom. The refusal death is
    // the receipt. (One tower per game: each tower sits in the OTHER
    // position's fall path.)
    g = makeGame();
    g.operatorWrite(4, 0b0001); // the tower at (4,0); pos-1 fall path clear
    // the CENTER home is pos 1: in range for every entry on the cycle
    for (let k = 0; k < 5; k++) g.pressBtn(TETRIS_IO.up); // -> Z at pos 1 (bottom 1-2, top 2-3)
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // token 5, beside the tower
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.right); // pos 2 is out of Z range
    expect(g.posAt(), 'the Z bound: pos 2 refused in contacts').toBe(1);
    g.pressBtn(TETRIS_IO.left); // target 0: top set {1,2} — (4,0) is NOT in it
    expect(g.posAt(), 'the false refusal died: Z steps under the tower').toBe(0);
    g.pressBtn(TETRIS_IO.right); // back to 1: everything clear up here
    expect(g.posAt()).toBe(1);
    for (let t = 6; t <= 7; t++) g.tick(); // rest on the floor at pos 1
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(7), 'Z bottom 1-2').toBe(0b0110);
    expect(g.row(6), 'Z top 2-3').toBe(0b1100);
    expect(g.row(4), 'the tower kept').toBe(0b0001);
    expect(g.m.getState().alerts).toEqual([]);

    // ...and the far top column (c+2): a right tower the old trees never
    // looked at now refuses a Z right step in contacts.
    g = makeGame();
    g.operatorWrite(4, 0b1000); // the tower at (4,3); pos-0 fall path clear
    // the CENTER home is pos 1 for the cycle...
    for (let k = 0; k < 5; k++) g.pressBtn(TETRIS_IO.up); // -> Z
    g.pressBtn(TETRIS_IO.left); // ...then home to 0 for the drop
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // token 5 (top {1,2} clears col 3)
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.right); // target 1: top set {2,3} DOES hit (4,3)
    expect(g.posAt(), 'the far top column refuses in contacts').toBe(0);
    for (let t = 6; t <= 7; t++) g.tick(); // rest on the floor at pos 0
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(7), 'Z bottom 0-1').toBe(0b0011);
    expect(g.row(6), 'Z top 1-2').toBe(0b0110);
    expect(g.row(4), 'the tower kept').toBe(0b1000);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-4a: the upright triples PLAY — L, J and T lock a 3-wide bottom
  // and their offset stem through the T fan, stacked into a tower; and
  // entering a triple mid-fall reads the delta cells (a stored cell
  // where L1's third column would land refuses the UP).
  it('the triples lock: L, J and T write their rows (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    let g = makeGame();
    const up = () => g.pressBtn(TETRIS_IO.up);
    const model = Array(8).fill(0);
    // the cycle transits S/Z — the CENTER home pos 1 is already in range
    // (the triples steer freely since 4b, but these drops stay put)
    for (let k = 0; k < 6; k++) up(); // -> L1 at pos 1
    g.pressStart();
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick(); // floor lock
    model[7] = 0b1110;
    expect(g.field(), 'L: the triple bottom').toEqual(model);
    g.tick(); // phase 2 rides the T fan (the STAG rail includes triples)
    model[6] = 0b0010;
    expect(g.field(), 'L: the stem on the left end').toEqual(model);
    g.tick(); // reset re-homes the register to the CENTER (pos 1)
    up(); // -> J1 at pos 1 (entry checks are dark pre-spawn)
    expect(g.posAt()).toBe(1);
    g.tick(); // spawn (J1 drops at the home column)
    for (let r = 1; r <= 5; r++) g.tick(); // rests at 5 on the L's stem (6,1)
    model[5] = 0b1110;
    expect(g.field(), 'J: the triple bottom on the stack').toEqual(model);
    g.tick(); // phase 2
    model[4] = 0b1000;
    expect(g.field(), 'J: the stem on the right end').toEqual(model);
    g.tick(); // reset
    up(); // -> T1 at the re-homed pos 1
    g.tick(); // spawn
    for (let r = 1; r <= 3; r++) g.tick(); // rests at 3 on the J's stem (4,3)
    model[3] = 0b1110;
    expect(g.field(), 'T: the triple bottom').toEqual(model);
    g.tick(); // phase 2
    model[2] = 0b0100;
    expect(g.field(), 'T: the stem centered').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);
    expect(g.m.getState().alerts).toEqual([]);

    // mid-fall entry checks: a Z falling beside a stored cell where L1's
    // third bottom column would land — the UP refuses in contacts
    g = makeGame();
    g.operatorWrite(6, 0b0100); // stored at (6,2)
    // the CENTER home pos 1 is in range for the whole walk
    for (let k = 0; k < 5; k++) up(); // -> Z at pos 1
    g.pressBtn(TETRIS_IO.left); // home to 0
    g.pressStart();
    // Z's own notch ({2} = top minus bottom) rests it ON the stored cell:
    // merged lock on arrival at 6 — the rails are live at the token row
    for (let t = 0; t <= 6; t++) g.tick();
    expect(g.tokenAt()).toEqual([6]);
    expect(g.row(6), 'the notch rested the Z; bottom merged').toBe(0b0111);
    g.pressBtn(TETRIS_IO.up); // L1's third column reads the stored row
    const hot: number[] = [];
    for (let i = 0; i < 9; i++) {
      const r = TETRIS_IO.shapeRelay(i);
      if (g.m.getMachineState(r.machine).relays[r.index]) hot.push(i);
    }
    expect(hot, 'L1 onto the stored cell: the ring held Z').toEqual([5]);
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(6)).toBe(0b0111);
    expect(g.row(5), 'Z top 1-2 above the rest row').toBe(0b0110);
    expect(g.row(7), 'the floor stayed empty').toBe(0);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-4b: TRIPLE STEERING — the trees read the true 3-wide footprint:
  // the entering bottom column 3 (LTB3), J1's shifted stem (LTJ), L1's
  // stem through the re-gated point-1 check, and the pos-2 bound. (T1's
  // stems and several J1 legs are unreachable in play — the piece's own
  // body just vacated those cells — but the checks stand, belt and
  // braces.)
  it('triple steering: the trees read the stems and the third column (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const walkTo = (g: ReturnType<typeof makeGame>, ups: number) => {
      // the CENTER home pos 1 transits S in range — no walk needed
      for (let k = 0; k < ups; k++) g.pressBtn(TETRIS_IO.up);
    };

    // L1 right: the triple's ENTERING bottom column is col 3
    let g = makeGame();
    g.operatorWrite(5, 0b1000); // the tower at (5,3)
    walkTo(g, 6); // L1 at pos 1
    g.pressBtn(TETRIS_IO.left); // home to 0 (free pre-spawn)
    expect(g.posAt()).toBe(0);
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // token 5, beside the tower
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'the third column senses the tower: refused').toBe(0);
    g.tick(); // token 6: the row beside is clear
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'a row later the same step goes').toBe(1);
    g.tick(); // floor lock at 7
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(7), 'L bottom followed the steer').toBe(0b1110);
    expect(g.row(6), 'L stem at its column').toBe(0b0010);
    expect(g.row(5), 'the tower kept').toBe(0b1000);
    expect(g.m.getState().alerts).toEqual([]);

    // J1 right: the stem lands one row up at col 3
    g = makeGame();
    g.operatorWrite(4, 0b1000); // the floater at (4,3)
    walkTo(g, 7); // J1 at pos 1
    g.pressBtn(TETRIS_IO.left);
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // token 5: stem target (4,3)
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'J1 stem onto the floater: refused').toBe(0);
    g.tick(); // token 6
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'clear of it the step goes').toBe(1);
    g.tick(); // floor lock
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(7), 'J bottom').toBe(0b1110);
    expect(g.row(6), 'J stem at the right end').toBe(0b1000);
    expect(g.row(4), 'the floater kept').toBe(0b1000);
    expect(g.m.getState().alerts).toEqual([]);

    // L1 left: the stem target reads through the re-gated point-1 check
    g = makeGame();
    g.operatorWrite(4, 0b0001); // the tower at (4,0)
    walkTo(g, 6); // L1 at pos 1 (falls in cols 1-3, clear of the tower)
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // token 5: stem target (4,0)
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'L1 stem under the tower: refused').toBe(1);
    g.tick(); // token 6
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'clear of it the step goes').toBe(0);
    g.tick(); // floor lock
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(7), 'L bottom at home').toBe(0b0111);
    expect(g.row(6), 'L stem at col 0').toBe(0b0001);
    expect(g.row(4), 'the tower kept').toBe(0b0001);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-4c: the OVERHANG TRIO PLAYS — L2/J2/T2 lock a single offset
  // bottom cell under a 3-wide top; the notch machinery (3b-2) rests
  // their wide tops on stored content; and their steering reads the true
  // footprint (the OVR bypass skips the false base-column check, the
  // LTOB/T2B hops read the real bottoms).
  it('the overhangs lock: offset bottoms under triple tops (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    let g = makeGame();
    const up = () => g.pressBtn(TETRIS_IO.up);
    const model = Array(8).fill(0);
    // L2 at pos 0 (the CENTER home pos 1 transits S in range; walk left for the drop)
    for (let k = 0; k < 9; k++) up(); // -> L2
    g.pressBtn(TETRIS_IO.left);
    g.pressStart();
    g.tick(); // spawn
    for (let r = 1; r <= 7; r++) g.tick(); // floor lock
    model[7] = 0b0100;
    expect(g.field(), 'L2: the single bottom at p+2').toEqual(model);
    g.tick(); // phase 2: the triple top
    model[6] = 0b0111;
    expect(g.field(), 'L2: the triple top').toEqual(model);
    g.tick(); // reset
    up(); // -> J2 at the re-homed CENTER (pos 1)
    g.tick(); // spawn
    // J2's bottom (col 1) rests by the ordinary bottom term on the L2's
    // top at (6,1)
    for (let r = 1; r <= 5; r++) g.tick(); // merged lock at 5
    model[5] = 0b0010;
    expect(g.field(), 'J2: the single bottom on the stack').toEqual(model);
    g.tick(); // phase 2
    model[4] = 0b1110;
    expect(g.field(), 'J2: the triple top above').toEqual(model);
    g.tick(); // reset
    expect(g.tokenAt()).toEqual([]);
    expect(g.m.getState().alerts).toEqual([]);

    // T2 steering: the OVR bypass skips the FALSE base-column check, and
    // the shared point-1 top check (correct for every triple top) refuses
    // on the true target. (T2's bottom-column check exists too but is
    // unreachable in play: a stored cell there notch-rests the piece
    // first — belt and braces.)
    g = makeGame();
    g.operatorWrite(4, 0b0001); // the tower at (4,0): left-target top col 0
    // the CENTER home IS pos 1
    for (let k = 0; k < 11; k++) up(); // -> T2 at pos 1 (bottom col 2, top 1-3)
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // token 5, beside the tower
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.left); // target pos 0: the triple top would hit (4,0)
    expect(g.posAt(), 'T2 left under the tower: refused').toBe(1);
    g.tick(); // token 6
    g.pressBtn(TETRIS_IO.left);
    expect(g.posAt(), 'a row later the step goes').toBe(0);
    g.tick(); // floor lock at 7 (bottom col 1)
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(7), 'T2 bottom at p+1').toBe(0b0010);
    expect(g.row(6), 'T2 triple top').toBe(0b0111);
    expect(g.row(4), 'the tower kept').toBe(0b0001);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-3c: UP-TRANSITION legality — the ring's clock conducts only when
  // the target shape's NEW cells are free at the current spot (checked on
  // the occupancy rails through the energized next-master's branch). A
  // blocked UP simply never clocks: the ring, register and field hold.
  // The fit-range refusals are covered in the ring-walk test; these are
  // the five occupancy cases, each blocked then allowed a row later.
  it('reshape legality: a blocked UP never clocks the ring (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const shapeAt = (g: ReturnType<typeof makeGame>) => {
      for (let i = 0; i < 6; i++) {
        const r = TETRIS_IO.shapeRelay(i);
        if (g.m.getMachineState(r.machine).relays[r.index]) return i;
      }
      return -1;
    };
    const shapeAt6 = (g: ReturnType<typeof makeGame>) => {
      for (let i = 0; i < NSTATES; i++) {
        const r = TETRIS_IO.shapeRelay(i);
        if (g.m.getMachineState(r.machine).relays[r.index]) return i;
      }
      return -1;
    };

    // 2tall -> 2wide (the domino's rotation): the new bottom cell at
    // (tok, p+1) is stored. since the rotation rung a falling piece's
    // UP turns it inside its own family, so the mid-fall probe is the
    // ROTATION 2tall <-> 2wide rather than the old chooser step — the
    // refusal physics under test is identical (a delta cell is taken).
    let g = makeGame();
    g.operatorWrite(5, 0b0010); // the tower at (5,1)
    g.pressBtn(TETRIS_IO.up); // 2wide
    g.pressBtn(TETRIS_IO.up); // 2tall, pre-spawn (the chooser)
    expect(shapeAt(g), 'chose the tall domino before spawning').toBe(2);
    g.pressBtn(TETRIS_IO.left); // off the CENTER home, down column 0
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // 2tall at pos 0, token 5
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt(g), 'rotating flat onto the tower: refused').toBe(2);
    expect(g.posAt(), 'the register held through the refusal').toBe(0);
    g.tick(); // token 6: the row beside is clear now
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt(g), 'a row later the same UP conducts').toBe(1);
    expect(g.m.getState().alerts).toEqual([]);

    // 2wide -> 2tall: slid UNDER an overhang, the new top cell is stored
    g = makeGame();
    g.operatorWrite(7, 0b0110); // the floor stack
    g.operatorWrite(4, 0b0001); // the overhang cell at (4,0)
    g.pressBtn(TETRIS_IO.up); // 2wide (the CENTER home is pos 1 already)
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // token 5, beside the overhang
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.left); // flat pieces slide under overhangs freely
    expect(g.posAt()).toBe(0);
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt(g), 'growing tall under the overhang: refused').toBe(1);
    g.pressBtn(TETRIS_IO.right); // step back out
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt(g), 'out from under it the UP conducts').toBe(2);
    g.tick(); // merged lock at 6 on the floor stack
    g.tick(); // phase 2
    g.tick(); // reset
    expect(g.row(6), '2tall bottom on the stack').toBe(0b0010);
    expect(g.row(5), '2tall top').toBe(0b0010);
    expect(g.row(4), 'the overhang kept').toBe(0b0001);
    expect(g.m.getState().alerts).toEqual([]);

    // the chooser-only edges (2tall->O, O->S, S->Z) can no longer be
    // taken mid-fall at all — since the rotation rung UP turns a
    // falling piece inside its family — so their delta checks are
    // unreachable in play and there is nothing left to assert about
    // them here. What IS reachable is the rest of the rotation family.
    // NOTE which DIRECTION is testable: turning L1 -> L2 adds top cells
    // in the very columns L1's bottom occupies, so any cell that could
    // block it would have stopped the fall first (the provably
    // unreachable class). The reverse is reachable precisely because
    // the overhang falls PAST a stack: L2's bottom is one column, so
    // cells beside it never stop the fall, and turning back to L1 needs
    // exactly those cells.
    // the L family refuses on the same physics, with one wrinkle worth
    // recording: for a 3-wide top over a 1-wide bottom, EVERY cell that
    // could block the turn also sits where the piece's own top would
    // land one row down — so the piece is already resting (and written)
    // by the time the turn is asked for. There is no "refused now,
    // allowed a row later" for it; the isolated occupancy refusal with
    // an escape is the overhang case above. So: blocked here, and the
    // same geometry conducting on a clear field.
    g = makeGame();
    g.operatorWrite(5, 0b0001); // the stack at (5,0)
    // the CENTER home pos 1 carries the chooser past S
    for (let k = 0; k < 9; k++) g.pressBtn(TETRIS_IO.up); // L2, pre-spawn
    expect(shapeAt6(g), 'chose the L flip before spawning').toBe(9);
    g.pressBtn(TETRIS_IO.left); // back to pos 0
    g.pressStart();
    for (let t = 0; t <= 5; t++) g.tick(); // rests on the stack at row 5
    expect(g.tokenAt()).toEqual([5]);
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt6(g), 'turning back over occupied cells: refused').toBe(9);
    expect(g.posAt(), 'the register held through the refusal').toBe(0);
    expect(g.m.getState().alerts).toEqual([]);

    // the same turn, same columns, on a clear field: it conducts
    g = makeGame();
    for (let k = 0; k < 9; k++) g.pressBtn(TETRIS_IO.up); // L2 (home transits S)
    g.pressBtn(TETRIS_IO.left); // pos 0
    g.pressStart();
    for (let t = 0; t <= 3; t++) g.tick(); // still falling, nothing stored
    expect(g.tokenAt()).toEqual([3]);
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt6(g), 'over empty cells the same turn conducts').toBe(6);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // 3b-5: THE MACHINE TICKS ITSELF — a two-relay slow-release oscillator
  // on the real capacitor bank drives the tick net under stepTime. The
  // transition solve BUZZES (a real relay oscillator buzzes; chatter
  // pins de-energized and the game machinery rides through it, the
  // device-verified class), leaving one clean tick-LOW step per cycle.
  // the DOUBLE clear (live-game bug, 2026-08-20): a vertical lock writes
  // TWO rows; when both complete, the machine must clear both and score
  // twice. the sensing is rail-borne and the clear is token-selected, so
  // the top row needs its own latch (sensed in the phase-2 waves) and
  // its clear must run FIRST (clearing bottom-first compacts the still-
  // full top row down one and the second clear would miss it). without
  // this, the leftover full row is PERMANENT: nothing can ever lock
  // inside a full row, so it never becomes the token row again.
  // ROTATION (the rotation-groups rung): UP means two things and the
  // MACHINE picks which. The successor lives in the ring's D-feeds —
  // each master's coil com is fed through its predecessor slave's set2
  // — so NOTOK ("no token anywhere", an NC-series chain over the
  // ring-slave mirrors) re-aims those wires: energized pre-spawn they
  // point at the selection successor (the full 0..11 chooser cycle),
  // de-energized mid-fall they point at the ROTATION partner (1<->2,
  // and i<->i+3 across the L/J/T pairs). A shape with one orientation
  // has its mux NC wired NOWHERE, so mid-fall no master is fed at all
  // and the clock has no branch to conduct: 1x1/O/S/Z refuse rotation
  // exactly the way an out-of-range bound refuses.
  it('rotation: UP turns the piece mid-fall, picks the shape pre-spawn (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const shapeAt = () => {
      for (let i = 0; i < NSTATES; i++) {
        const r = TETRIS_IO.shapeRelay(i);
        if (g.m.getMachineState(r.machine).relays[r.index]) return i;
      }
      return -1;
    };
    const up = () => g.pressBtn(TETRIS_IO.up);
    // every chooser step keeps the register inside the NEXT shape's fit
    // range: a transition out of range simply has no branch. at four
    // columns that is no longer satisfiable by one column — S needs
    // column >= 1, the I's 4-wide bottom fits only at column 0 — so the
    // walk steers, exactly as a player would.
    const stepChooser = () => {
      const r = shapeRange(SHAPES[(shapeAt() + 1) % NSTATES], 4);
      let st = 0;
      while (g.posAt() < r.min && st++ < 6) g.pressBtn(TETRIS_IO.right);
      while (g.posAt() > r.max && st++ < 6) g.pressBtn(TETRIS_IO.left);
      up();
    };
    const walkTo = (target: number) => {
      let guard = 0;
      while (shapeAt() !== target && guard++ < 3 * NSTATES) stepChooser();
      expect(shapeAt(), `walked the chooser to ${target}`).toBe(target);
    };
    // PRE-SPAWN the chooser still walks every state
    const cycle: number[] = [];
    for (let k = 0; k < NSTATES; k++) {
      stepChooser();
      cycle.push(shapeAt());
    }
    expect(cycle, 'the pre-spawn chooser cycles all thirteen').toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]);

    // MID-FALL the same button rotates: L1 <-> L2, both directions
    walkTo(6);
    g.pressStart();
    for (let t = 0; t < 10 && g.tokenAt().length === 0; t++) g.tick();
    g.tick();
    expect(g.tokenAt().length, 'a piece is falling').toBe(1);
    up();
    expect(shapeAt(), 'L1 rotates to its flip').toBe(9);
    up();
    expect(shapeAt(), 'and back again').toBe(6);
    // it is ROTATION, not the chooser: the selection successor (7 = J)
    // is never reachable from a falling L
    for (let k = 0; k < 4; k++) up();
    expect([6, 9], 'UP mid-fall stays inside the L family').toContain(shapeAt());

    // ONE-ORIENTATION shapes refuse mid-fall (no master is fed at all)
    for (let t = 0; t < 30 && g.tokenAt().length > 0; t++) g.tick();
    walkTo(3); // O
    g.pressStart();
    for (let t = 0; t < 10 && g.tokenAt().length === 0; t++) g.tick();
    g.tick();
    const held = shapeAt();
    up();
    up();
    expect(shapeAt(), 'the square has one orientation: the ring holds').toBe(held);
    expect(g.m.getState().alerts, 'a refused rotation is quiet').toEqual([]);
  });

  // the mux flip under both clock phases: NOTOK re-aims the ring's
  // D-feeds the instant a token appears or dies, and that can happen
  // while UP is HELD (shape clock high). The masters are pinned by
  // their own holds while the clock is high, so a flip mid-press
  // cannot smear the ring — it re-samples on release. Invariants, not
  // a hand-derived value: one-hot, quiet, and still steppable after.
  it('rotation: the D-feed mux flips safely under a held UP (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const shapeAt = () => {
      const on: number[] = [];
      for (let i = 0; i < NSTATES; i++) {
        const r = TETRIS_IO.shapeRelay(i);
        if (g.m.getMachineState(r.machine).relays[r.index]) on.push(i);
      }
      return on;
    };
    const holdUp = (body: () => void) => {
      g.m.pressButton(TETRIS_IO.up.button, TETRIS_IO.up.machine);
      body();
      g.m.releaseButton(TETRIS_IO.up.button, TETRIS_IO.up.machine);
    };
    // (a) a token APPEARS while UP is held: NOTOK drops mid-press
    g.pressBtn(TETRIS_IO.right); // pos 1, clear of the S bound
    g.pressStart();
    holdUp(() => g.tick()); // the spawn tick lands inside the press
    expect(shapeAt().length, 'one-hot across a spawn under a held UP').toBe(1);
    expect(g.m.getState().alerts, 'quiet across the flip').toEqual([]);
    expect(g.tokenAt().length, 'the piece still spawned').toBe(1);
    // the ring still steps afterwards (now as a rotation: 1x1 holds, so
    // walk the falling piece's own family instead — any legal press)
    const mid = shapeAt()[0];
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt().length, 'still one-hot after').toBe(1);
    expect([mid, ROT_STATE(mid)], 'UP mid-fall stays in the family').toContain(shapeAt()[0]);
    // (b) the token DIES while UP is held: NOTOK rises mid-press
    for (let t = 0; t < 30 && g.tokenAt().length > 0; t++) {
      if (t === 12) break;
      g.tick();
    }
    holdUp(() => {
      for (let t = 0; t < 20 && g.tokenAt().length > 0; t++) g.tick();
    });
    expect(shapeAt().length, 'one-hot across a lock under a held UP').toBe(1);
    expect(g.m.getState().alerts, 'quiet across the second flip').toEqual([]);
    // and the chooser works again now that the field is clear of pieces
    // (the lock re-homes the register to column 0, where entering S has
    // no branch — the operator steps back into range first, as ever)
    g.pressBtn(TETRIS_IO.right);
    const after = shapeAt()[0];
    g.pressBtn(TETRIS_IO.up);
    expect(shapeAt().length, 'one-hot after the chooser step').toBe(1);
    expect(shapeAt()[0], 'the chooser advances pre-spawn').not.toBe(after);
  });

  it('the double clear: one lock completes both its rows (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) => (g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const scoreAt = () => {
      for (let i = 0; i < 10; i++) if (relayOn(SCR(i, 2))) return i;
      return -1;
    };
    // rows 6 and 7 hold cols 2-3: a 2x2 square at cols 0-1 completes BOTH
    g.operatorWrite(7, 0b1100);
    g.operatorWrite(6, 0b1100);
    for (let k = 0; k < 3; k++) g.pressBtn(TETRIS_IO.up); // 1x1 -> ... -> 2x2
    g.pressBtn(TETRIS_IO.left); // off the CENTER home: the square drops at 0-1
    g.pressStart();
    for (let t = 0; t < 10 && g.tokenAt().length === 0; t++) g.tick();
    // fall to the merged land+lock at rows 6+7, then the owed bookkeeping
    for (let t = 0; t < 40; t++) {
      g.tick();
      if (
        g.tokenAt().length === 0 &&
        !g.m.getMachineState(TETRIS_IO.lockedRelay.machine).relays[TETRIS_IO.lockedRelay.index] &&
        !g.m.getMachineState(TETRIS_IO.collapseRelay.machine).relays[TETRIS_IO.collapseRelay.index]
      )
        break;
    }
    expect(g.row(7), 'the bottom row cleared').toBe(0);
    expect(g.row(6), 'the top row cleared too — no permanent junk').toBe(0);
    expect(scoreAt(), 'both clears scored').toBe(2);
  });

  // the top-ONLY completion (the cross-review's catch): a vertical lock
  // can complete r-1 without completing r — the same permanence class.
  // row 6 pre-holds every column but HOME; the un-steered 2-tall locks
  // bottom (7,HOME) and top (6,HOME): the top row completes alone. it
  // must clear AND the bottom row's own bit must SURVIVE (the
  // opposite-case assertion).
  it('the top-only clear: the lock completes just its top row (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) => (g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const scoreAt = () => {
      for (let i = 0; i < 10; i++) if (relayOn(SCR(i, 2))) return i;
      return -1;
    };
    g.operatorWrite(6, 0b1111 & ~(1 << HOME));
    for (let k = 0; k < 2; k++) g.pressBtn(TETRIS_IO.up); // 1x1 -> 2wide -> 2tall
    g.pressStart();
    for (let t = 0; t < 10 && g.tokenAt().length === 0; t++) g.tick();
    for (let t = 0; t < 40; t++) {
      g.tick();
      if (
        g.tokenAt().length === 0 &&
        !g.m.getMachineState(TETRIS_IO.lockedRelay.machine).relays[TETRIS_IO.lockedRelay.index] &&
        !g.m.getMachineState(TETRIS_IO.collapseRelay.machine).relays[TETRIS_IO.collapseRelay.index]
      )
        break;
    }
    expect(g.row(6), 'the completed top row cleared').toBe(0);
    expect(g.row(7), "the bottom row KEEPS the piece's own cell").toBe(1 << HOME);
    expect(scoreAt(), 'the top-only clear scored once').toBe(1);
  });

  it('the machine ticks itself: capacitor gravity (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const auto = (on: boolean) =>
      g.m.setSlide(TETRIS_IO.auto.slide, on ? 'right' : 'left', TETRIS_IO.auto.machine);
    g.pressStart();
    // AUTO off: time passes, nothing ticks, no token ever spawns
    for (let t = 0; t < 10; t++) g.m.stepTime(100);
    expect(g.tokenAt(), 'no oscillator, no ticks').toEqual([]);
    // AUTO on: the piece falls, locks, runs its own bookkeeping, and the
    // next piece spawns — hands off (START was pressed once, above)
    auto(true);
    let steered = false;
    for (let t = 0; t < 140 && g.row(7) === 0; t++) {
      g.m.stepTime(100);
      // steer mid-fall once, during self-play
      if (!steered && g.tokenAt().length === 1 && g.tokenAt()[0] >= 2) {
        g.pressBtn(TETRIS_IO.right);
        steered = true;
        expect(g.posAt(), 'steering works during self-play').toBe(HOME + 1);
      }
    }
    expect(g.row(7), 'the steered piece locked one right of home, hands off').toBe(1 << (HOME + 1));
    // keep time flowing until the SECOND piece lands on the floor too
    for (let t = 0; t < 200 && g.row(7) === 1 << (HOME + 1); t++) g.m.stepTime(100);
    expect(g.row(7) & (1 << HOME), 'the re-homed second piece landed at the center').toBe(1 << HOME);
    // AUTO off freezes gravity (the current token, if any, hangs forever)
    auto(false);
    const frozen = g.tokenAt();
    for (let t = 0; t < 15; t++) g.m.stepTime(100);
    expect(g.tokenAt(), 'no oscillator, no gravity').toEqual(frozen);
    expect(g.m.getState().alerts).toEqual([]);
  });

  // the oscillator's operating rules, machine-level (the page encodes them
  // as operator guards). Under stepTime the cycle is: one buzz solve
  // (chatter-pinned, TDRV reads low, cap recharged to ~12V) then a few
  // beats of slow release with TDRV holding the tick line HIGH until the
  // cap falls below dropout. Two consequences, both verified on the sim:
  // a START pressed into the held-high line dissipates (the arm needs a
  // low line to survive to the next rising edge — same physics as
  // pressing START while holding the tick slide), and taking the AUTO
  // slide back mid-release freezes the line high forever (time stops, the
  // cap never drains) — manual ticks and STARTs are all dead against it.
  // the wider well: the same circuit generator at cols=6. every fan mask
  // is checked against the geometry (SHAPES/shapeRange are the single
  // source of truth the emitters compile from), including the staggered
  // seam, the triples spanning the new columns, both overhang forms, and
  // a bound refusal at T2's six-col maximum. the 2026-08-20 bring-up
  // caught four collision classes here: per-row contact-set fans capped
  // at 4 (MIRB/MIRC/MIRCT/the cut families), a composite take with baked
  // per-column offsets (PIECET/LEGB), a hand splice entering a chain's
  // 4-col tail (VMODEM), and the topmask slides overflowing onto the WID
  // slide's section (a slide T jack is a permanent tie).
  it('the six-wide well: fans, overhangs and bounds from the geometry (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const COLS6 = 6;
    const { wires, layout: L, btnMachine } = tetrisCircuit(8, COLS6);
    // physical buildability: the hole budget holds at SIX columns too
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, L.machines);
    m.initialize();
    const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
    const pos6 = () => {
      for (let j = 0; j < COLS6; j++) if (rel(L.POSS(j))) return j;
      return -1;
    };
    const shape6 = () => {
      for (let i = 0; i < SHAPES.length; i++) {
        if (rel(ringPart(L, i, 2))) return i;
      }
      return -1;
    };
    const press6 = (b: number, mm: number) => {
      m.pressButton(b, mm);
      m.releaseButton(b, mm);
    };
    const tick6 = () => {
      m.setSlide(5, 'right', 1);
      m.setSlide(5, 'left', 1);
    };
    const bank = (acc: (j: number) => number) => [...Array(COLS6)].map((_, j) => rel(acc(j))).join('');
    const expectMask = (ix: number, p: number, kind: 'b' | 't') => {
      const sh = SHAPES[ix];
      const a = Array(COLS6).fill('0');
      const [off, wd] = kind === 'b' ? [sh.bOff, sh.bW] : [sh.tOff, sh.tW];
      for (let k = 0; k < wd; k++) if (p + off + k >= 0 && p + off + k < COLS6) a[p + off + k] = '1';
      return a.join('');
    };
    const walkTo = (ix: number, tp: number) => {
      let g = 0;
      while (shape6() !== ix && g++ < 30) {
        const r = shapeRange(SHAPES[(shape6() + 1) % SHAPES.length], COLS6);
        let g2 = 0;
        while (pos6() < r.min && g2++ < 8) press6(4, btnMachine);
        while (pos6() > r.max && g2++ < 8) press6(3, btnMachine);
        press6(2, btnMachine);
      }
      let g3 = 0;
      while (pos6() < tp && g3++ < 8) press6(4, btnMachine);
      while (pos6() > tp && g3++ < 8) press6(3, btnMachine);
      expect(shape6(), `walked to state ${ix}`).toBe(ix);
      expect(pos6(), `walked to pos ${tp}`).toBe(tp);
    };
    // the chooser walk runs PRE-SPAWN: since the rotation rung UP means
    // "rotate" while a piece falls, and the fans read shape+pos with or
    // without a token, so the masks are the same either way
    for (const [ix, p, label] of [
      [4, 2, 'S at the seam'], [4, 4, 'S in the new columns'], [6, 3, 'L1 spanning 3-5'],
      [8, 3, 'T1 at 3'], [9, 3, 'L2 overhang'], [11, 3, 'T2 at its max'],
    ] as [number, number, string][]) {
      walkTo(ix, p);
      expect(bank(L.PIECE), `${label}: B fan`).toBe(expectMask(ix, p, 'b'));
      expect(bank(L.PIECET), `${label}: T fan`).toBe(expectMask(ix, p, 't'));
    }
    // the bound: T2's top spans p..p+2, so pos 4 must refuse at 6 cols
    press6(4, btnMachine);
    expect(pos6(), 'T2 refused past its six-col maximum').toBe(3);
    // and the overhang writes through the new columns (spawn it now)
    press6(6, 1);
    for (let t = 0; t < 20; t++) {
      tick6();
      let live = false;
      for (let i = 0; i < 8; i++) if (rel(L.RING(i, 2))) live = true;
      if (!live) break;
    }
    const row6 = (r: number) => [...Array(COLS6)].map((_, j) => rel(L.CELL(r, j))).join('');
    expect(row6(7), 'T2 bottom at p+1').toBe('000010');
    expect(row6(6), 'T2 top across p..p+2').toBe('000111');
    expect(m.getState().alerts).toEqual([]);

    // the six-wide CLEAR, fresh machine: three 2-row pieces stack rows
    // 6-7 at {0,1,2,4,5}, a 1x1 at col 3 completes row 7 -> it clears,
    // row 6 falls in, and the register stays ONE-HOT through every
    // reset. pins the two 6-col bring-up bugs: POSRST's re-home NCs
    // read past the bank at j>=4 (slaves survived resets, the register
    // went multi-hot -> all-columns pieces and mid-air locks) and the
    // collapse beta trigger fired W(t-1,2) — breaker-0 only at 4 cols.
    const m2 = new MinivacSimulator(wires, false, L.machines);
    m2.initialize();
    const rel2 = (i: number) => (m2.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
    const poss2 = () => [...Array(COLS6)].map((_, j) => rel2(L.POSS(j))).join('');
    const shape2 = () => {
      for (let i = 0; i < SHAPES.length; i++) {
        if (rel2(ringPart(L, i, 2))) return i;
      }
      return -1;
    };
    const pos2 = () => poss2().indexOf('1');
    const press2 = (b: number, mm: number) => {
      m2.pressButton(b, mm);
      m2.releaseButton(b, mm);
    };
    const tick2 = () => {
      m2.setSlide(5, 'right', 1);
      m2.setSlide(5, 'left', 1);
    };
    const live2 = () => {
      for (let i = 0; i < 8; i++) if (rel2(L.RING(i, 2))) return true;
      return false;
    };
    const drop2 = (ix: number, p: number) => {
      let g = 0;
      while (shape2() !== ix && g++ < 30) {
        const r = shapeRange(SHAPES[(shape2() + 1) % SHAPES.length], COLS6);
        let g2 = 0;
        while (pos2() < r.min && g2++ < 8) press2(4, btnMachine);
        while (pos2() > r.max && g2++ < 8) press2(3, btnMachine);
        press2(2, btnMachine);
      }
      press2(6, 1);
      tick2();
      let g3 = 0;
      while (pos2() < p && g3++ < 8) press2(4, btnMachine);
      while (pos2() > p && g3++ < 8) press2(3, btnMachine);
      for (let t = 0; t < 45; t++) {
        tick2();
        if (!live2() && !rel2(L.LKS) && !rel2(L.LANE)) break;
      }
      // the reset re-homes to the CENTER (homeColumn(6) = 2) and stays one-hot
      const homeHot = [...Array(COLS6)].map((_, j) => (j === homeColumn(COLS6) ? '1' : '0')).join('');
      expect(poss2(), `one-hot register after the drop at ${p}`).toBe(homeHot);
    };
    drop2(2, 0); // 2tall at 0
    drop2(3, 1); // 2x2 at 1-2
    drop2(3, 4); // 2x2 at 4-5
    drop2(0, 3); // the 1x1 completes row 7
    const row2 = (r: number) => [...Array(COLS6)].map((_, j) => rel2(L.CELL(r, j))).join('');
    expect(row2(7), 'row 7 cleared and row 6 fell in').toBe('111011');
    expect(row2(6), 'row 6 emptied by the collapse').toBe('000000');
    expect(m2.getState().alerts).toEqual([]);
  });

  // 3b-4d — THE HORIZONTAL I, the seventh tetromino. Flat, so it needs
  // no new write phase, no new collision term and no new occupancy row:
  // a 13th ring state, a fourth bottom-fan offset, and the cols-4 bound
  // class the geometry-derived unions produce on their own. Its rotation
  // partner is the VERTICAL I, which wants a four-row write engine, so
  // until that exists the I is a singleton and UP refuses it mid-fall.
  it('the horizontal I: four wide, its own bound, a rotation singleton (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const COLS = 6;
    const { wires, layout: L, btnMachine } = tetrisCircuit(12, COLS);
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, L.machines);
    m.initialize();
    const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
    const SH = (i: number, p: number) => ringPart(L, i, p);
    const shape = () => {
      for (let i = 0; i < SHAPES.length; i++) if (rel(SH(i, 2))) return i;
      return -1;
    };
    const pos = () => {
      for (let j = 0; j < COLS; j++) if (rel(L.POSS(j))) return j;
      return -1;
    };
    const tok = () => {
      for (let i = 0; i < 12; i++) if (rel(L.RING(i, 2))) return i;
      return -1;
    };
    const bmask = () => [...Array(COLS)].map((_, j) => rel(L.PIECE(j))).join('');
    const tmask = () => [...Array(COLS)].map((_, j) => rel(L.PIECET(j))).join('');
    const row = (r: number) => [...Array(COLS)].map((_, j) => rel(L.CELL(r, j))).join('');
    const press = (b: number) => {
      m.pressButton(b, btnMachine);
      m.releaseButton(b, btnMachine);
    };
    const tick = () => {
      m.setSlide(5, 'right', 1);
      m.setSlide(5, 'left', 1);
    };

    // the I is the LAST ring state, so the chooser reaches it in twelve
    // steps — keeping the register inside each next shape's fit range,
    // because a transition out of range simply has no branch
    let guard = 0;
    while (shape() !== 12 && guard++ < 40) {
      const r = shapeRange(SHAPES[(shape() + 1) % SHAPES.length], COLS);
      let g2 = 0;
      while (pos() < r.min && g2++ < 8) press(4);
      while (pos() > r.max && g2++ < 8) press(3);
      press(2);
    }
    expect(shape(), 'the chooser reaches the I').toBe(12);
    expect(shapeRange(SHAPES[12], COLS), 'a 4-wide bottom fits at three columns of six').toEqual({
      min: 0,
      max: 2,
    });
    let lg = 0;
    while (pos() > 0 && lg++ < 8) press(3);
    expect(pos()).toBe(0);

    m.pressButton(6, 1);
    m.releaseButton(6, 1);
    expect(shape(), 'the spawn keeps the chosen shape').toBe(12);
    expect(bmask(), 'the bottom fan lights four columns').toBe('111100');
    expect(tmask(), 'the top bank stays dark: the I is flat').toBe('000000');

    // the cols-4 bound: two steps right, then the contacts refuse
    press(4);
    expect(pos()).toBe(1);
    expect(bmask(), 'the mask follows the register').toBe('011110');
    press(4);
    expect(pos()).toBe(2);
    expect(bmask()).toBe('001111');
    press(4);
    expect(pos(), 'RIGHT refused at max = cols - 4').toBe(2);

    // rotation: no partner state, so no branch, so no clock (the same
    // refusal the square gives, arrived at the same way)
    tick();
    const before = shape();
    press(2);
    expect(shape(), 'mid-fall UP refuses: the I is a rotation singleton').toBe(before);

    let t = 0;
    while (tok() >= 0 && t++ < 40) tick();
    expect(t, 'the piece reached the floor and locked').toBeLessThan(40);
    for (let k = 0; k < 3; k++) tick();
    expect(row(11), 'four cells written in one row').toBe('001111');
    expect(row(10), 'and nothing above them').toBe('000000');
    expect(m.getState().alerts).toEqual([]);
  });

  // A LOCK MUST FREEZE THE SHAPE. A lock is three ticks — press (the
  // bottom write, and the piece's own row goes into the field), phase 2
  // (the row above), reset — and the TOKEN stays alive through all of
  // them, so NOTOK keeps the ring's D-feeds aimed at the rotation
  // partner. Before the gate, an UP landing between the lock press and
  // phase 2 re-aimed the T fan and phase 2 wrote the ROTATED shape's
  // top over the already-written bottom: an L locked as SIX cells
  // instead of four. The page's key queue drains at every settle,
  // including the settles between a lock's phases, so this was
  // reachable in ordinary play. LKM2 (the lock-master mirror) is up for
  // exactly that window — measured: high on the lock tick and phase 2,
  // low on every falling tick and after the reset — so the UP clock's +
  // rides its NC.
  it('a lock freezes the shape AND the column: neither UP nor a step can deform the piece (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const COLS = 6;
    const { wires, layout: L, btnMachine } = tetrisCircuit(12, COLS);
    const play = (pressUpMidLock: boolean, stepMidLock = false) => {
      const m = new MinivacSimulator(wires, false, L.machines);
      m.initialize();
      const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
      const SH = (i: number, p: number) =>
        i < 6 ? L.SHR(i, p) : i < 9 ? L.SHR2(i, p) : i < 12 ? L.SHR3(i, p) : L.SHR4(i, p);
      const shape = () => {
        for (let i = 0; i < SHAPES.length; i++) if (rel(SH(i, 2))) return i;
        return -1;
      };
      const pos = () => {
        for (let j = 0; j < COLS; j++) if (rel(L.POSS(j))) return j;
        return -1;
      };
      const tok = () => {
        for (let i = 0; i < 12; i++) if (rel(L.RING(i, 2))) return i;
        return -1;
      };
      const press = (b: number) => {
        m.pressButton(b, btnMachine);
        m.releaseButton(b, btnMachine);
      };
      const tick = () => {
        m.setSlide(5, 'right', 1);
        m.setSlide(5, 'left', 1);
      };
      // the L (state 6): a 3-wide bottom with a stem on the left, whose
      // rotation partner is the L flip — a 1-wide bottom under a 3-wide
      // top, so a wrong phase-2 write is unmistakable
      let g = 0;
      while (shape() !== 6 && g++ < 40) {
        const r = shapeRange(SHAPES[(shape() + 1) % SHAPES.length], COLS);
        let g2 = 0;
        while (pos() < r.min && g2++ < 8) press(4);
        while (pos() > r.max && g2++ < 8) press(3);
        press(2);
      }
      expect(shape(), 'chose the L').toBe(6);
      let lg = 0;
      while (pos() > 0 && lg++ < 8) press(3);
      m.pressButton(6, 1);
      m.releaseButton(6, 1);
      let t = 0;
      while (t++ < 40) {
        tick();
        if (rel(L.LKM) || tok() < 0) break; // the tick that locked it
      }
      const posAtLock = pos();
      if (pressUpMidLock) press(2); // <-- between the lock press and phase 2
      if (stepMidLock) press(4); // <-- RIGHT, in the same window
      const shapeAfter = shape();
      const posAfter = pos();
      tick(); // phase 2
      tick(); // reset
      tick();
      return {
        shapeAfter,
        posAtLock,
        posAfter,
        rows: [10, 11].map((r) => [...Array(COLS)].map((_, j) => (rel(L.CELL(r, j)) ? 'X' : '.')).join('')),
        cells: [...Array(12)].reduce(
          (n, _, r) => n + [...Array(COLS)].filter((__, j) => rel(L.CELL(r, j))).length,
          0
        ),
      };
    };
    const quiet = play(false);
    const poked = play(true);
    expect(quiet.rows, 'the L writes its stem over its triple').toEqual(['X.....', 'XXX...']);
    expect(quiet.cells, 'four cells, which is what an L is').toBe(4);
    expect(poked.shapeAfter, 'the ring HELD: a lock refuses the rotation clock').toBe(6);
    expect(poked.rows, 'and the field is identical').toEqual(quiet.rows);
    expect(poked.cells, 'no cells materialized').toBe(4);

    // ...and the COLUMN, which is the other half. LEFT/RIGHT reached the
    // button mirrors with no lock gate, so a step in the same window
    // moved the register and phase 2 wrote the top row one column over:
    // the L landed as '.X....' over 'XXX...' — four cells, but the stem
    // over the MIDDLE, which is a T. the gate goes on the mirror COILS,
    // because their set 2 feeds ANYBM, which breaks the register's
    // one-hot hold: gate only the step path and the break still happens,
    // leaving the register holding no position at all.
    const shoved = play(false, true);
    expect(shoved.posAfter, 'the register HELD: a lock refuses the step').toBe(shoved.posAtLock);
    expect(shoved.rows, 'the top row landed over the bottom, not beside it').toEqual(quiet.rows);
    expect(shoved.cells, 'still an L, not a T').toBe(4);
  });

  // B1a/B1b-i — the write-row changeover STAYS INERT WITH THE V3 SLIDE
  // DOWN. ROW2 has a coil now (B1b-i), so "it can never rise" is no
  // longer the contract; "it never rises unless an operator asks for a
  // 3-tall piece" is, and that is the assertion that keeps every
  // existing behaviour where it was. The third write row is a changeover
  // on ONE phase rail rather than a second rail, because a second rail
  // takes the depth-1 cut bank DARK while the new write rails are hot
  // (the cut bank's coils hang on p2railA) and those coils cannot be
  // shared — a coil jack is a permanent tie, so the wire would just
  // short the two rails together.
  it('the write-row changeover is inert with the V3 slide down: ROW2 never rises and phase 2 is unchanged (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const COLS = 6;
    const { wires, layout: L, btnMachine } = tetrisCircuit(12, COLS);
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, L.machines);
    m.initialize();
    const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
    const tok = () => {
      for (let i = 0; i < 12; i++) if (rel(L.RING(i, 2))) return i;
      return -1;
    };
    const press = (b: number) => {
      m.pressButton(b, btnMachine);
      m.releaseButton(b, btnMachine);
    };
    const tick = () => {
      m.setSlide(5, 'right', 1);
      m.setSlide(5, 'left', 1);
    };
    const row = (r: number) => [...Array(COLS)].map((_, j) => (rel(L.CELL(r, j)) ? 'X' : '.')).join('');
    let everUp = false;
    const watch = () => {
      if (rel(L.ROW2)) everUp = true;
    };
    // a STAGGERED piece, so the lock actually exercises phase 2's top
    // write — the very path ROW2 now sits in
    press(2); // 2 wide
    press(3); // left off the center home to pos 1 (S's minimum column)
    press(2); // 2 tall
    press(2); // 2x2 square
    press(2); // S
    watch();
    m.pressButton(6, 1);
    m.releaseButton(6, 1);
    watch();
    let t = 0;
    while (t++ < 40) {
      tick();
      watch();
      if (tok() < 0 && t > 2) break;
    }
    for (let k = 0; k < 4; k++) {
      tick();
      watch();
    }
    expect(everUp, 'with the V3 slide down ROW2 must never rise').toBe(false);
    expect(row(11), "the S's bottom pair landed at columns 1-2").toBe('.XX...');
    expect(row(10), 'and phase 2 still wrote its top pair, staggered LEFT').toBe('XX....');
    expect(m.getState().alerts).toEqual([]);
  });

  // B1b — THE THIRD WRITE ROW.
  //
  // With the V3 slide up a vertical lock is FOUR ticks instead of three,
  // and the fourth writes row r-2 through the TOPW2 bank on ROW2's NO
  // sides. The risky part is not the extra row, it is the extra tick:
  // ROW2 is a changeover sitting in the write-trigger path, and a
  // changeover that MOVES while the triggers are live is the exact
  // failure LKS and P2S exist to prevent. What this case pins:
  //   - the fourth tick exists and the reset is one tick later
  //   - it writes ONE more row, directly above the other two, and the
  //     rest of the field is untouched
  //   - ROW2 is DOWN through the phase-2 write and UP through the third
  //   - ROW2 never changes state during a tick-HIGH solve, i.e. it moves
  //     only while p2gate/p2break are cold (break before make)
  //   - with the slide DOWN nothing moves and nothing changes
  // NOT yet true, and deliberately not asserted as if it were: the third
  // row repeats the SECOND row's column mask, because the fan that would
  // give it its own mask is a later increment. A 3-tall bar is a routing
  // receipt, not a tetromino.
  // The first cut of this wiring hung the gate chain on p2railA and the
  // machine WEDGED: ROW2M's latch backfed through its own set path into
  // the rail and held phase 2 on forever. The chain is +-sourced now,
  // like P2M's, and that is what this test would catch again.
  it('B1b: the V3 slide adds a fourth phase tick that writes a third row (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const COLS = 4;
    const ROWS = 8;
    const drop = (v3: boolean) => {
      const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS, COLS);
      assertJackCapacity(wires);
      const m = new MinivacSimulator(wires, false, L.machines);
      m.initialize();
      const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
      const tok = () => {
        for (let i = 0; i < ROWS; i++) if (rel(L.RING(i, 2))) return i;
        return -1;
      };
      if (v3) m.setSlide((L.V3M % 6) + 1, 'right', Math.floor(L.V3M / 6));
      for (let k = 0; k < 2; k++) {
        m.pressButton(2, btnMachine);
        m.releaseButton(2, btnMachine);
      }
      m.pressButton(6, 1);
      m.releaseButton(6, 1);
      // half-tick resolution: the write triggers are live only tick-HIGH
      const half: Array<{ hi: boolean; row2: number; p2clr: number; tok: number }> = [];
      let ticks = 0;
      for (let t = 0; t < ROWS + 8; t++) {
        m.setSlide(5, 'right', 1);
        half.push({ hi: true, row2: rel(L.ROW2), p2clr: rel(L.P2CLR), tok: tok() });
        m.setSlide(5, 'left', 1);
        half.push({ hi: false, row2: rel(L.ROW2), p2clr: rel(L.P2CLR), tok: tok() });
        ticks = t + 1;
        if (t > 3 && tok() < 0 && !rel(L.LKS) && !rel(L.P2S)) break;
      }
      const field = [...Array(ROWS)].map((_, r) =>
        [...Array(COLS)].map((_, j) => (rel(L.CELL(r, j)) ? 'X' : '.')).join('')
      );
      return { half, field, ticks, alerts: m.getState().alerts };
    };

    const off = drop(false);
    const on = drop(true);

    // the lock is one tick longer, and it writes exactly one more row
    expect(on.ticks, 'the V3 slide makes the lock a tick longer').toBe(off.ticks + 1);
    const filled = (f: string[]) => f.map((r, i) => [i, r] as const).filter(([, r]) => r.includes('X'));
    const offRows = filled(off.field);
    const onRows = filled(on.field);
    expect(offRows.length, 'a 2-tall piece writes two rows').toBe(2);
    expect(onRows.length, 'and with the V3 slide up, three').toBe(3);
    // the two the 2-tall lock wrote are untouched, and the new one sits
    // directly above them
    expect(onRows.slice(1), 'the first two rows are exactly the 2-tall lock').toEqual(offRows);
    expect(onRows[0][0], 'the third row is directly above them').toBe(offRows[0][0] - 1);
    // every row the lock did NOT write must still be empty
    on.field.forEach((r, i) => {
      if (!onRows.some(([k]) => k === i)) expect(r, `row ${i} must be untouched`).toBe('.'.repeat(COLS));
    });

    // ROW2 rises for exactly one tick-high window, and it is not the one
    // that carries the phase-2 write
    const highs = on.half.filter((h) => h.hi);
    const upHighs = highs.filter((h) => h.row2 === 1);
    expect(upHighs.length, 'ROW2 is up for exactly one tick-HIGH solve').toBe(1);
    const phase3 = highs.indexOf(upHighs[0]);
    expect(highs[phase3 - 1].row2, 'and DOWN for the phase-2 write before it').toBe(0);
    expect(highs[phase3 - 1].p2clr, 'P2CLR is inhibited on the phase-2 tick').toBe(0);
    expect(upHighs[0].p2clr, 'and fires on the phase-3 tick, ending the phase').toBe(1);

    // BREAK BEFORE MAKE: ROW2 must never change during a tick-HIGH solve
    for (let i = 1; i < on.half.length; i++) {
      if (!on.half[i].hi) continue;
      expect(
        on.half[i].row2,
        `ROW2 changed state during a tick-HIGH solve (half-step ${i}) — the write triggers are live there`
      ).toBe(on.half[i - 1].row2);
    }
    // and with the slide down it never moves at all
    expect(off.half.some((h) => h.row2 === 1), 'slide down: ROW2 stays put').toBe(false);
    expect(on.alerts).toEqual([]);
    expect(off.alerts).toEqual([]);
  });

  // THE TOP CLEAR MUST NOT FOLLOW THE WRITE'S DIVERSION.
  //
  // CLEARP2's clear pulse used to inject into p2break. That was fine
  // until B1a put ROW2's changeover downstream of that whole rail: with
  // ROW2 up, the clear followed the phase-3 write to row r-2 and WIPED
  // it, destroying cells that could never complete a line. Traced to one
  // wire and fixed by injecting at ROW2's NC jack instead, which is on
  // the row2break net directly — identical while ROW2 is down, still
  // aimed at row r-1 when it is up.
  //
  // The case: rows 6 and 7 complete and clear; row 5 holds '.XX.', which
  // cannot complete. Slide down, those two cells survive and collapse to
  // the floor. Slide up, they must survive too — plus the phase-3 write
  // adds its own cell. Before the fix: zero cells.
  it('the top clear stays on row r-1 when ROW2 diverts the write (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const ROWS = 8;
    const COLS = 4;
    const survivors = (v3: boolean) => {
      const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS, COLS);
      const m = new MinivacSimulator(wires, false, L.machines);
      m.initialize();
      const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
      const tok = () => {
        for (let i = 0; i < ROWS; i++) if (rel(L.RING(i, 2))) return i;
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
      // rows 6 and 7 complete on the lock (the notch sits at the HOME
      // column, where the un-steered piece falls); row 5's two cells cannot
      ow(7, 0b1111 & ~(1 << HOME));
      ow(6, 0b1111 & ~(1 << HOME));
      ow(5, 0b0101); // cols 0 and 2 — the phase-3 write adds col HOME=1
      if (v3) m.setSlide((L.V3M % 6) + 1, 'right', Math.floor(L.V3M / 6));
      for (let k = 0; k < 2; k++) {
        m.pressButton(2, btnMachine);
        m.releaseButton(2, btnMachine);
      }
      m.pressButton(6, 1);
      m.releaseButton(6, 1);
      for (let t = 0; t < 40; t++) {
        m.setSlide(5, 'right', 1);
        m.setSlide(5, 'left', 1);
        if (t > 2 && tok() < 0 && !rel(L.LKS) && !rel(L.P2S) && !rel(L.LANE)) break;
      }
      return [...Array(ROWS)]
        .map((_, r) => [...Array(COLS)].map((_, j) => (rel(L.CELL(r, j)) ? 'X' : '.')).join(''))
        .filter((row) => row.includes('X'));
    };
    // slide down: the two uncompletable cells collapse to the floor
    expect(survivors(false), 'slide down: X.X. survives the clear').toEqual(['X.X.']);
    // slide up: the SAME two survive, and the phase-3 write adds the home
    // column. before the fix this was [] — the clear had wiped the row.
    expect(survivors(true), 'slide up: they survive, plus the third row cell').toEqual(['XXX.']);
  });

  // B1c — THE THIRD LINE SENSE, and the third collapse seed.
  //
  // A row the phase-3 write COMPLETES used to be sensed by nothing: rows
  // r and r-1 cleared on their own latches and the third stayed full
  // forever as permanent junk. It needed a LINE3(j) mirror bank off
  // LINE(j).E — LINE(j)'s own two sets are spent changeovers, measured,
  // so a third chain has nowhere to go — plus LINEDLY3/CPSET3/CLEARP3,
  // an RSTM3 mirror so CLEARP3's latch has its own break contact, and
  // CLEARPM3 driving a third elevator seed through SEEDM2's free set.
  //
  // This case pins the whole chain: three completed rows all clear, and
  // the stack above them walks down by THREE, not two.
  it('B1c: a third row completed by phase 3 clears, and the stack walks three (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const ROWS = 8;
    const COLS = 4;
    const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS, COLS);
    const m = new MinivacSimulator(wires, false, L.machines);
    m.initialize();
    const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
    const tok = () => {
      for (let i = 0; i < ROWS; i++) if (rel(L.RING(i, 2))) return i;
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
    // all three rows the 3-tall lock touches will complete (the notch at
    // the HOME column, where the un-steered piece falls), and a marker
    // sits two rows above them in a column the piece never occupies
    ow(7, 0b1111 & ~(1 << HOME));
    ow(6, 0b1111 & ~(1 << HOME));
    ow(5, 0b1111 & ~(1 << HOME));
    ow(2, 0b0100);
    m.setSlide((L.V3M % 6) + 1, 'right', Math.floor(L.V3M / 6));
    for (let k = 0; k < 2; k++) {
      m.pressButton(2, btnMachine);
      m.releaseButton(2, btnMachine);
    }
    m.pressButton(6, 1);
    m.releaseButton(6, 1);
    for (let t = 0; t < 40; t++) {
      m.setSlide(5, 'right', 1);
      m.setSlide(5, 'left', 1);
      if (t > 2 && tok() < 0 && !rel(L.LKS) && !rel(L.P2S) && !rel(L.LANE)) break;
    }
    const rows = [...Array(ROWS)].map((_, r) =>
      [...Array(COLS)].map((_, j) => (rel(L.CELL(r, j)) ? 'X' : '.')).join('')
    );
    // all three completed rows clear: only the marker is left standing.
    // before B1c this was ['..X.', 'XXXX'] — a full row of junk.
    expect(rows.filter((r) => r.includes('X')), 'nothing survives but the marker').toEqual(['..X.']);
    // and the elevator walked a THREE-hot hole: the marker fell 2 -> 5,
    // not 2 -> 4. a shift register walks an N-hot hole as N.
    expect(rows.indexOf('..X.'), 'the stack above fell by three rows').toBe(5);
  });

  // THE SCORE'S THIRD STEP. The ring steps once per clock CYCLE, and
  // CLEARPM2 used to hold the clock high from the phase-2 tick straight
  // through the phase-3 tick, so CLEARPM3 rising inside that window was
  // not a new cycle and a triple scored two.
  //
  // Gating the top pulse live on ROW2 fixes the triple and then OVER-
  // counts: ROW2 falls again at the phase-3 release, the pulse re-rises,
  // and a double scores three. So the cut is LATCHED — ROW2Y mirrors
  // ROW2 with its arm at + (ROW2's own contacts hang off tick-high rails
  // and are dead at the tick-low where it moves) and ROW2Z holds the cut
  // to the reset. This case checks EVERY depth, in both slide positions,
  // because the failure mode was an over-count on the shallow ones.
  it('the score counts every clear depth, slide up or down (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const ROWS = 8;
    const COLS = 4;
    const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS, COLS);
    const m = new MinivacSimulator(wires, false, L.machines);
    m.initialize();
    const rel = (i: number) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
    const tok = () => {
      for (let i = 0; i < ROWS; i++) if (rel(L.RING(i, 2))) return i;
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
    void ow;
    void tok;
    void rel;
    void m;
    const depth = (pre: Array<[number, number]>, v3: boolean) => {
      const b = tetrisCircuit(ROWS, COLS);
      const sim = new MinivacSimulator(b.wires, false, b.layout.machines);
      sim.initialize();
      const r2 = (i: number) => (sim.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
      const tk = () => {
        for (let i = 0; i < ROWS; i++) if (r2(b.layout.RING(i, 2))) return i;
        return -1;
      };
      const write = (row: number, v: number) => {
        sim.setSlide(TETRIS_IO.wid.slide, 'left', b.btnMachine);
        sim.setSlide(1, row & 1 ? 'right' : 'left', 0);
        sim.setSlide(2, row & 2 ? 'right' : 'left', 0);
        sim.setSlide(3, row & 4 ? 'right' : 'left', 0);
        for (let j = 0; j < 4; j++) sim.setSlide(j + 1, (v >> j) & 1 ? 'right' : 'left', 1);
        sim.pressButton(4, 0);
        sim.releaseButton(4, 0);
        for (let j = 0; j < 4; j++) sim.setSlide(j + 1, 'left', 1);
      };
      for (const [row, v] of pre) write(row, v);
      if (v3) sim.setSlide((b.layout.V3M % 6) + 1, 'right', Math.floor(b.layout.V3M / 6));
      for (let k = 0; k < 2; k++) {
        sim.pressButton(2, b.btnMachine);
        sim.releaseButton(2, b.btnMachine);
      }
      sim.pressButton(6, 1);
      sim.releaseButton(6, 1);
      for (let t = 0; t < 50; t++) {
        sim.setSlide(5, 'right', 1);
        sim.setSlide(5, 'left', 1);
        if (t > 2 && tk() < 0 && !r2(b.layout.LKS) && !r2(b.layout.P2S) && !r2(b.layout.LANE)) break;
      }
      for (let i = 0; i < 10; i++) if (r2(b.layout.SCR(i, 2))) return i;
      return -1;
    };
    // the notch the un-steered 2-tall falls into sits at the HOME column
    // (the CENTER since the center-spawn rung — it was column 0 before)
    const FILL = 0b1111 & ~(1 << HOME);
    const TRIPLE: Array<[number, number]> = [[7, FILL], [6, FILL], [5, FILL]];
    const DOUBLE: Array<[number, number]> = [[7, FILL], [6, FILL]];
    const SINGLE: Array<[number, number]> = [[7, FILL]];
    const TOPONLY: Array<[number, number]> = [[6, FILL]];
    // the slide DOWN is the shipped game and must not move at all
    expect(
      [depth(TRIPLE, false), depth(DOUBLE, false), depth(SINGLE, false), depth(TOPONLY, false)],
      'slide down: a 2-tall lock clears at most its own two rows'
    ).toEqual([2, 2, 1, 1]);
    // and with it up, the triple counts three without inflating the rest.
    // before the latch these read [3, 3, 1, 2] — the triple right and the
    // double and top-only over-counted.
    expect(
      [depth(TRIPLE, true), depth(DOUBLE, true), depth(SINGLE, true), depth(TOPONLY, true)],
      'slide up: three for a triple, and no inflation below it'
    ).toEqual([3, 2, 1, 1]);
  });

  it('the oscillator gaps: START and the AUTO slide need the tick-low beat (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const auto = (g: ReturnType<typeof makeGame>, on: boolean) =>
      g.m.setSlide(TETRIS_IO.auto.slide, on ? 'right' : 'left', TETRIS_IO.auto.machine);
    const drv = (g: ReturnType<typeof makeGame>) =>
      g.m.getMachineState(TETRIS_IO.oscRelay.machine).relays[TETRIS_IO.oscRelay.index] ? 1 : 0;
    const stepTo = (g: ReturnType<typeof makeGame>, want: number) => {
      let n = 0;
      while (drv(g) !== want && n++ < 30) g.m.stepTime(65);
      expect(drv(g), `found a beat settled tick-${want ? 'high' : 'low'}`).toBe(want);
    };
    const g = makeGame();
    auto(g, true);
    // (1) a START pressed into the held-high line dissipates — and leaves
    // NO latent arm behind (no surprise spawn beats later)
    stepTo(g, 1);
    g.pressStart();
    for (let t = 0; t < 30; t++) g.m.stepTime(100);
    expect(g.tokenAt(), 'the arm dissipated, nothing latent').toEqual([]);
    // (2) the same machine spawns from a beat that settled tick-low
    stepTo(g, 0);
    g.pressStart();
    let spawned = false;
    for (let t = 0; t < 10 && !spawned; t++) {
      g.m.stepTime(100);
      spawned = g.tokenAt().length === 1;
    }
    expect(spawned, 'a tick-low START spawns').toBe(true);
    // (3) steering is level-read, not edge-consumed: a press into the
    // high line still lands, and nothing corrupts
    stepTo(g, 1);
    const p = g.posAt();
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'the tick-high step landed').toBe(p + 1);
    expect(g.tokenAt().length, 'the token survived the tick-high press').toBe(1);
    // (4) the WRONG way to stop: cutting the feed at a tick-high beat and
    // freezing time right there wedges the line high — no manual tick can
    // make an edge against it, so the mid-fall token hangs forever
    stepTo(g, 1);
    auto(g, false);
    const hung = g.tokenAt();
    for (let i = 0; i < 3; i++) {
      g.m.setSlide(5, 'right', 1); // raw slide cycles: tick()'s clean-run
      g.m.setSlide(5, 'left', 1); // asserts are not the contract here
    }
    expect(g.tokenAt(), 'tick line frozen high: manual ticks are dead').toEqual(hung);
    expect(drv(g), 'the driver relay is stuck up').toBe(1);
    // (5) AUTO off the right way, on a fresh machine: cut the feed FIRST,
    // keep time flowing until the driver relay stays down (the cap drains
    // through the coil in a couple of beats), and only then stop the
    // clock — manual play works from there
    const h = makeGame();
    auto(h, true);
    stepTo(h, 1);
    auto(h, false);
    let low = 0;
    for (let i = 0; i < 20 && low < 2; i++) {
      h.m.stepTime(65);
      low = drv(h) ? 0 : low + 1;
    }
    expect(low, 'the cap drained; the driver relay stays down').toBe(2);
    h.pressStart();
    h.tick();
    expect(h.tokenAt(), 'the drained machine spawns manually').toEqual([0]);
    h.tick();
    expect(h.tokenAt(), 'and ticks manually').toEqual([1]);
  });

  // ...and the oscillator itself is engine-exact: the standalone pair
  // produces identical edges and cap voltages under sparse and fast.
  it('the oscillator: sparse and fast agree edge for edge', { timeout: 600000 }, () => {
    const wires = [
      'm0.1+/m0.1S', 'm0.1T/m0.2H', 'm0.2J/m0.1E', 'm0.1F/m0.1-',
      'm0.1E/m0.1cap',
      'm0.1+/m0.1H', 'm0.1G/m0.2E', 'm0.2F/m0.2-',
    ];
    const run = (engine: 'sparse' | 'fast') => {
      setSolverEngine(engine);
      const m = new MinivacSimulator(wires, false, 1);
      m.initialize();
      m.setSlide(1, 'right', 0);
      const edges: string[] = [];
      let last = m.getMachineState(0).relays[1];
      for (let t = 0; t < 80; t++) {
        m.stepTime(25);
        const d = m.getMachineState(0).relays[1];
        if (d !== last) {
          edges.push(`${t}:${d ? 1 : 0}:${m.getCapVoltage(1).toFixed(3)}`);
          last = d;
        }
      }
      return edges;
    };
    const sparse = run('sparse');
    const fast = run('fast');
    expect(sparse.length, 'it oscillates').toBeGreaterThan(10);
    expect(fast, 'edge-for-edge parity').toEqual(sparse);
  });

  // the score ring: a one-hot decimal digit stepped once per line clear
  // (the token-ring pattern with CLEARP as the clock; digit 0 seeded at
  // power-on through SCBOOT, which latches away on the first clear). The
  // cheap clear pattern: a block at (2,0) rests the piece at row 1, the
  // lock completes row 1, and a row-1 clear runs a single 3-tick collapse
  // stage. Eleven clears prove every step INCLUDING the 9 -> 0 wrap.
  it('the score ring: one step per clear, wrapping past nine (fast)', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) => (g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const score = () => {
      const hot: number[] = [];
      for (let i = 0; i < 10; i++) if (relayOn(SCR(i, 2))) hot.push(i);
      expect(hot.length, `one-hot digit (got ${hot.join(',')})`).toBe(1);
      return hot[0];
    };
    expect(score(), 'power-on: zero').toBe(0);
    const model = Array(8).fill(0);
    g.pressStart();
    for (let n = 1; n <= 11; n++) {
      g.operatorWrite(2, 0b0001);
      model[2] = 0b0001;
      g.operatorWrite(1, 0b1110);
      model[1] = 0b1110;
      dropPiece(g, 0b0001, model, `scoring clear ${n}`);
      expect(score(), `after clear ${n}`).toBe(n % 10);
    }
  });

  function runTallWell(engine: 'fast' | 'cktsim') {
    setSolverEngine(engine);
    const ROWS = 12;
    const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS);
    assertJackCapacity(wires);
    const m = new MinivacSimulator(wires, false, L.machines);
    m.initialize();
    const on = (n: number) => (m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const row = (r: number) =>
      on(L.CELL(r, 0)) + 2 * on(L.CELL(r, 1)) + 4 * on(L.CELL(r, 2)) + 8 * on(L.CELL(r, 3));
    const field = () => Array.from({ length: ROWS }, (_, r) => row(r));
    const tokenAt = () => {
      const hot: number[] = [];
      for (let i = 0; i < ROWS; i++) if (on(L.RING(i, 2))) hot.push(i);
      return hot;
    };
    const posAt = () => {
      for (let j = 0; j < 4; j++) if (on(L.POSS(j))) return j;
      return -1;
    };
    const tick = () => {
      m.setSlide(5, 'right', 1);
      m.setSlide(5, 'left', 1);
      expect(m.getState().alerts).toEqual([]);
    };
    const press = (btn: number) => {
      m.pressButton(btn, btnMachine);
      m.releaseButton(btn, btnMachine);
    };
    const start = () => {
      m.pressButton(6, 1);
      m.releaseButton(6, 1);
    };

    expect(posAt(), 'power-on seed reaches the tall well (CENTER home)').toBe(HOME);
    const model = Array(ROWS).fill(0);
    // four drops complete the floor row — no operator writes: rows 8-11
    // are beyond the 3-bit decoder, the game itself is the only writer
    for (let col = 0; col < 4; col++) {
      start();
      let gsteer = 6;
      while (posAt() < col && gsteer-- > 0) press(4); // walk out from the re-homed CENTER
      while (posAt() > col && gsteer-- > 0) press(3);
      expect(posAt(), `walked to ${col}`).toBe(col);
      tick(); // spawn
      expect(tokenAt(), `drop ${col} spawned`).toEqual([0]);
      for (let r = 1; r <= ROWS - 1; r++) tick(); // to the floor (merged lock)
      if (col < 3) {
        model[ROWS - 1] |= 1 << col;
        expect(field(), `drop ${col} locked deep`).toEqual(model);
        tick(); // reset: re-homes the register
        expect(tokenAt()).toEqual([]);
        expect(posAt(), 'reset re-homes').toBe(HOME);
      }
    }
    // the 4th drop completed the floor: cleared on the lock press
    model[ROWS - 1] = 0;
    expect(field(), 'the deep floor line cleared').toEqual(model);
    tick(); // reset seeds the elevator at stage 11
    expect(tokenAt()).toEqual([]);
    // the full collapse: 11 stages x 3 ticks, spawns deferred throughout
    for (let t = ROWS - 1; t >= 1; t--) {
      tick();
      tick();
      tick();
      expect(tokenAt(), `stage ${t} defers the spawn`).toEqual([]);
      expect(field(), `stage ${t} ripples empty rows`).toEqual(model);
    }
    start();
    tick();
    expect(tokenAt(), 'the well plays on after the drain').toEqual([0]);
    for (let r = 1; r <= 5; r++) tick();
    press(4); // steering mid-well, far above the classic 8 rows
    expect(posAt(), 'mid-well steering works').toBe(HOME + 1);
    for (let r = 6; r <= ROWS - 1; r++) tick();
    model[ROWS - 1] = 1 << (HOME + 1);
    expect(field(), 'the steered piece locked at the floor').toEqual(model);
    tick(); // its reset
    expect(tokenAt()).toEqual([]);
    expect(posAt()).toBe(HOME);
  }

  it('a 12-row well: the whole game generalizes (fast)', { timeout: 1800000 }, () => {
    runTallWell('fast');
  });

  const heavy = MASS ? it : it.skip;
  heavy('the 12-row well under the dense oracle (MINIVAC_MASS=1)', { timeout: 7200000 }, () => {
    runTallWell('cktsim');
  });
  heavy('short scenario under the dense oracle (MINIVAC_MASS=1)', { timeout: 7200000 }, () => {
    setSolverEngine('cktsim');
    const g = makeGame();
    const model = Array(8).fill(0);
    g.operatorWrite(7, 0b0110);
    model[7] = 0b0110;
    g.pressStart();
    dropPiece(g, 0b0001, model, 'dense drop');
    expect(g.row(7)).toBe(0b0111);
    // one short vertical under the oracle too: rests at row 1 (row 2
    // pre-filled), so it is spawn + one fall + phase 2 + reset
    g.operatorWrite(2, 0b0010);
    model[2] = 0b0010;
    g.m.setSlide((VMODE % 6) + 1, 'right', Math.floor(VMODE / 6));
    dropVertical(g, 0b0010, model, 'dense vertical');
    expect(g.row(1)).toBe(0b0010);
    expect(g.row(0)).toBe(0b0010);
    // and one collapse under the oracle — kept SHORT (a dense tick costs
    // minutes at 38 machines; a row-7 clear's 21 collapse ticks blew the
    // hour budget): rest the piece at row 2 on an op-set block, complete
    // the row there, and let the 6 collapse ticks walk the two stacked
    // rows above it down. Same machinery end to end — seed, lane, all
    // three phases, drain — at a fraction of the cost.
    g.m.setSlide((VMODE % 6) + 1, 'left', Math.floor(VMODE / 6));
    g.operatorWrite(3, 0b1000); // the col-3 rest block
    model[3] = 0b1000;
    g.operatorWrite(2, 0b0101); // fill row 2 to one hole (with its 0b0010)
    model[2] |= 0b0101;
    dropPiece(g, 0b1000, model, 'dense clear + collapse at row 2');
    expect(g.row(3), 'the block below is untouched').toBe(0b1000);
    expect(g.row(2), 'row 1 fell into the cleared row').toBe(0b0010);
    expect(g.row(1), 'row 0 fell one down').toBe(0b0010);
    expect(g.row(0)).toBe(0);
  });
});
