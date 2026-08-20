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
import { tetrisCircuit, MACHINES, CELL, RING, PIECE, VMODE, TOPW, P2M, P2S, LKS, ELEVSL, POSS, POSA, GAMEOVER, SCR, LEFTBTN, TETRIS_IO } from '../../circuits/multivac-mini-tetris';

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
// by the BOTTOM write clears as usual; one completed by the TOP write does
// NOT (the clear machinery is token-row-addressed and the LINE chain is
// rail-A-rooted) — a documented limit of this rung, pinned by the tests;
// the field-scaling rung's row collapse replaces the clear machinery anyway.
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
  model[rest - 1] |= mask; // NO clear here even at 15 (top-full stays)
  expect(g.tokenAt(), `${label}: token survives phase 2`).toEqual([rest]);
  expect(g.field(), `${label}: top row written`).toEqual(model);
  g.tick(); // reset, one tick late
  expect(g.tokenAt(), `${label}: token gone`).toEqual([]);
  expect(g.field(), `${label}: field after reset`).toEqual(model);
  collapseTicks(g, cleared, model, label);
}

describe('Multivac: mini-tetris (50 machines)', () => {
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
    let mask = 0b0001;
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
        // the reset tick re-homes the position register to column 0 (the
        // WID slide is untouched): the machine's piece mask snaps home.
        // wideness must come from the tracked slide, not the mask bits —
        // a wall-degraded wide mask (0b1000) looks single-bit
        mask = wideNow ? 0b0011 : 0b0001;
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
        mask = wideNow ? 0b0011 : 0b0001;
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
    // two-tick rhythm
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

  it('vertical pieces: bottom-write clears, top-full stays, row-0 clip (fast)', { timeout: 1500000 }, () => {
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

    // the TOP write completes row 6 -> must NOT clear (token-row-addressed
    // clear machinery; documented limit)
    g.operatorWrite(6, 0b0111);
    model[6] = 0b0111;
    dropVertical(g, 0b1000, model, 'v-topfull');
    expect(g.row(7)).toBe(0b1001);
    expect(g.row(6), 'top-completed line stays full').toBe(0b1111);

    // the game continues over the full row; stack col 0 to the ceiling:
    // rests at 5, then 3, then 1 — each vertical drop eats two rows
    dropVertical(g, 0b0001, model, 'v-stack-1'); // rows 5+4
    dropVertical(g, 0b0001, model, 'v-stack-2'); // rows 3+2
    dropVertical(g, 0b0001, model, 'v-stack-3'); // rows 1+0 (top at the edge)
    expect(g.row(1)).toBe(0b0001);
    expect(g.row(0)).toBe(0b0001);

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
  // self-loop; the reset tick re-homes to column 0; the very first START
  // seeds the dark ring. The PIECE column coils re-feed from the ring
  // (single = pos; wide adds pos+1 via the WIDM taps).
  it('the position register: one step per press, edges self-loop, reset re-homes (fast)', { timeout: 1500000 }, () => {
    setSolverEngine('fast');
    const g = makeGame();
    const relayOn = (n: number) => (g.m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const ring = () => Array.from({ length: 4 }, (_, j) => relayOn(POSS(j)));
    const pieces = () => Array.from({ length: 4 }, (_, j) => relayOn(PIECE(j)));
    const quiet = () => expect(g.m.getState().alerts).toEqual([]);

    // power-on: the ring wakes already seeded at the home column (BOOTL's
    // NC feeds slave 0 until the first press latches the seed line dead)
    expect(g.posAt(), 'power-on: the home column').toBe(0);
    expect(ring()).toEqual([1, 0, 0, 0]);
    expect(pieces(), 'PIECE follows the ring').toEqual([1, 0, 0, 0]);
    quiet();

    // START arms the spawn latch; the register must not care
    g.pressStart();
    expect(ring(), 'START leaves the register alone').toEqual([1, 0, 0, 0]);
    quiet();

    // one full press, held: the ring must NOT move during the press (the
    // master samples; a mid-press step would let the still-closed direction
    // taps re-sample the moved ring and cascade to the edge)
    g.m.pressButton(TETRIS_IO.right.button, TETRIS_IO.right.machine);
    expect(ring(), 'held press: the slaves hold').toEqual([1, 0, 0, 0]);
    expect(relayOn(POSA(1)), 'held press: the target master latched').toBe(1);
    expect(relayOn(POSA(2)), 'held press: no cascade into master 2').toBe(0);
    g.m.releaseButton(TETRIS_IO.right.button, TETRIS_IO.right.machine);
    expect(ring(), 'release commits exactly one step').toEqual([0, 1, 0, 0]);
    expect(relayOn(POSA(1)), 'the master unwound').toBe(0);
    quiet();

    // walk to the right edge and lean on it
    g.pressBtn(TETRIS_IO.right);
    expect(ring()).toEqual([0, 0, 1, 0]);
    g.pressBtn(TETRIS_IO.right);
    expect(ring()).toEqual([0, 0, 0, 1]);
    g.pressBtn(TETRIS_IO.right);
    expect(ring(), 'right edge self-loops').toEqual([0, 0, 0, 1]);
    quiet();

    // and back to the left edge
    for (const want of [
      [0, 0, 1, 0],
      [0, 1, 0, 0],
      [1, 0, 0, 0],
      [1, 0, 0, 0], // the edge self-loop again
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
    expect(ring(), 'reset re-homes the register').toEqual([1, 0, 0, 0]);
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
    g.pressBtn(TETRIS_IO.right); // pos 1: the descent column (never blocked)
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
    // post-lock, pre-reset: row 7 has no legality row — steps stay free
    // (the piece is already written; a step only pre-positions the next)
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'post-lock steps are unrestricted').toBe(2);
    quiet();
    g.tick(); // reset re-homes
    expect(g.tokenAt()).toEqual([]);
    expect(g.posAt()).toBe(0);
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
    g.tick(); // spawn at row 0, home column
    g.pressBtn(TETRIS_IO.right); // descend in column 1
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
    expect(g.posAt(), 'reset re-homed').toBe(0);
    // no token + vmode up: steps stay free (dark rails default legal)
    g.pressBtn(TETRIS_IO.right);
    expect(g.posAt(), 'no-token steering unaffected by vmode').toBe(1);
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
    for (let r = 1; r <= 7; r++) {
      g.operatorWrite(r, 0b0001);
      model[r] = 0b0001;
    }
    expect(relayOn(GAMEOVER), 'alive while the stack builds').toBe(0);
    g.pressStart();
    g.tick(); // merged spawn + lock AT ROW 0: the top-out
    model[0] = 0b0001;
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

    expect(posAt(), 'power-on seed reaches the tall well').toBe(0);
    const model = Array(ROWS).fill(0);
    // four drops complete the floor row — no operator writes: rows 8-11
    // are beyond the 3-bit decoder, the game itself is the only writer
    for (let col = 0; col < 4; col++) {
      start();
      for (let k = 0; k < col; k++) press(4); // walk out from the re-homed 0
      expect(posAt(), `walked to ${col}`).toBe(col);
      tick(); // spawn
      expect(tokenAt(), `drop ${col} spawned`).toEqual([0]);
      for (let r = 1; r <= ROWS - 1; r++) tick(); // to the floor (merged lock)
      if (col < 3) {
        model[ROWS - 1] |= 1 << col;
        expect(field(), `drop ${col} locked deep`).toEqual(model);
        tick(); // reset: re-homes the register
        expect(tokenAt()).toEqual([]);
        expect(posAt(), 'reset re-homes').toBe(0);
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
    expect(posAt(), 'mid-well steering works').toBe(1);
    for (let r = 6; r <= ROWS - 1; r++) tick();
    model[ROWS - 1] = 0b0010;
    expect(field(), 'the steered piece locked at the floor').toEqual(model);
    tick(); // its reset
    expect(tokenAt()).toEqual([]);
    expect(posAt()).toBe(0);
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
