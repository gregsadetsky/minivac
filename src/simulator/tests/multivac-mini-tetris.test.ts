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

// ---- relay allocation: relay n lives at machine floor(n/6), section n%6+1
const R = (n: number, jack: string) => `m${Math.floor(n / 6)}.${(n % 6) + 1}${jack}`;
const comOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}com`;
const plusOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}+`;
const minusOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}-`;

const A0 = 0, A0m = 1, A1 = 2, A2 = 3; // decoder address relays
const W = (r: number, k: number) => 4 + 4 * r + k; // write groups, k = 0..3
const CELL = (r: number, j: number) => 36 + 4 * r + j; // field cells
const RING = (i: number, part: number) => 68 + 3 * i + part; // clk, master, slave
const MIRA = (r: number) => 92 + 2 * r; // slave mirror A (W triggers)
const MIRB = (r: number) => 93 + 2 * r; // slave mirror B (collision)
const RESETM = (x: number) => 108 + x; // 4 reset mirrors, 2 stages each
const COLLIDE = 112, COLLIDEM = 113, LKM = 114, RSTM = 115;
const SPAWN = 116, SPAWNCLR = 117, CLEARP = 118; // CLEARP: line-clear pending
const LINE = (j: number) => 119 + j;
const PIECE = (j: number) => 123 + j;
const LKS = 127, TICKM = 128; // LOCKED slave + tick-phase mirror
const COLLIDEM2 = 129; // isolates the collision node from COLLIDE's com
const READGATE = 130; // depth-1 press relay: powers the depth-2 rails
const MIRB2 = (r: number) => 131 + r; // second collision mirror per row
const PRESSCUT = (x: number) => 139 + x; // 4 relays: drop the collision mirrors during a press
const RAILGATE2 = 143; // second-hop rail power, aligns rail life with the W group
const RSTM2 = 144; // clears the CLEARP latch during the reset tick
const CPSET = 145; // isolates CLEARP's set path from the LINE chain
const MACHINES = 25; // relay 145 -> m24.2

function tetrisCircuit(): {
  wires: string[];
  rails: string[][]; // data rail j -> its chained groups
} {
  const w: string[] = [];

  // rails on 6-hole M10/M11 matrix groups, allocated one list at a time
  // (allocator state lives per-circuit: a second build must start fresh)
  const M_GROUPS: string[] = [];
  for (let k = 0; k < MACHINES; k++) M_GROUPS.push(`m${k}.M10`, `m${k}.M11`);
  let mNext = 0;
  const takeGroups = (n: number) => {
    if (mNext + n > M_GROUPS.length) throw new Error('out of matrix groups');
    return M_GROUPS.slice(mNext, (mNext += n));
  };

  // ---------- the rung-4 register file, decoder path included ----------
  w.push(
    'm0.1+/m0.1S', `m0.1T/${comOf(A0)}`, `${comOf(A0)}/${R(A0, 'E')}`,
    `${comOf(A0)}/${R(A0m, 'E')}`, `${R(A0, 'F')}/${minusOf(A0)}`,
    `${R(A0m, 'F')}/${minusOf(A0m)}`,
    'm0.2+/m0.2S', `m0.2T/${R(A1, 'E')}`, `${R(A1, 'F')}/${minusOf(A1)}`,
    'm0.3+/m0.3S', `m0.3T/${R(A2, 'E')}`, `${R(A2, 'F')}/${minusOf(A2)}`,
    'm0.4+/m0.4Y', `m0.4X/${R(A2, 'H')}`, // WRITE button gates the tree root
    `${R(A2, 'J')}/${R(A1, 'H')}`, `${R(A2, 'G')}/${R(A1, 'L')}`,
    `${R(A1, 'J')}/${R(A0, 'H')}`, `${R(A1, 'G')}/${R(A0, 'L')}`,
    `${R(A1, 'N')}/${R(A0m, 'H')}`, `${R(A1, 'K')}/${R(A0m, 'L')}`,
  );
  const sel = [
    R(A0, 'J'), R(A0, 'G'), R(A0, 'N'), R(A0, 'K'),
    R(A0m, 'J'), R(A0m, 'G'), R(A0m, 'N'), R(A0m, 'K'),
  ];

  const dataRails = [takeGroups(5), takeGroups(5), takeGroups(5), takeGroups(5)];
  const railJack = (j: number, hole: number) => dataRails[j][Math.floor(hole / 4)];
  // chain each rail's groups (each link burns one hole on both sides, so a
  // group offers 4 fresh holes; railJack spreads consumers accordingly)
  for (const g of dataRails) for (let i = 1; i < g.length; i++) w.push(`${g[i - 1]}/${g[i]}`);
  const railUse: number[] = [0, 0, 0, 0];
  const tapRail = (j: number) => railJack(j, railUse[j]++);

  // gates (W, W' on comA) and breakers (W'', W''' on comB) are triggered
  // SEPARATELY: a lock press fires both (via mirrorA's two contacts), the
  // line-clear fires only the breakers. The decoder leaf feeds ONLY the gate
  // com — wiring it to both coms would tie them together through the leaf
  // jack itself (a jack is a permanent tie: that variant let the clear's
  // breaker trigger backfeed the gates and freeze the whole write group).
  // Operator writes here are therefore SET-only: they close gates without
  // breaking holds. The game's lock path does the full OR-write, CLEARP
  // does the clearing, and the register-file file keeps the classic
  // destructive-write machinery.
  for (let r = 0; r < 8; r++) {
    const comA = comOf(W(r, 0));
    const comB = comOf(W(r, 2));
    w.push(`${sel[r]}/${comA}`);
    for (let k = 0; k < 4; k++) {
      const src = k < 2 ? comA : comB;
      w.push(`${src}/${R(W(r, k), 'E')}`, `${R(W(r, k), 'F')}/${minusOf(W(r, k))}`);
    }
    for (let j = 0; j < 4; j++) {
      const c = CELL(r, j);
      const [arm, no, nc] = j % 2 === 0 ? ['H', 'G', 'J'] : ['L', 'K', 'N'];
      const g = W(r, j < 2 ? 0 : 1);
      w.push(`${tapRail(j)}/${R(g, arm)}`, `${R(g, no)}/${comOf(c)}`); // data gate
      // the breaker contact serves BOTH cell-private paths with one arm:
      // NC = the hold (idle), NO = the lock readback (press) — the cell's
      // own + through its own contact onto its own rail. Any SHARED readback
      // rail bridges the write rails through a stacked row's ON cells (two
      // drafts of this file died to exactly that, one row down and one up).
      const b = W(r, j < 2 ? 2 : 3);
      w.push(`${plusOf(c)}/${R(b, arm)}`, `${R(b, nc)}/${R(c, 'H')}`); // hold break
      w.push(`${R(b, no)}/${R(c, 'L')}`); // press-scoped readback feed
      w.push(`${R(c, 'G')}/${comOf(c)}`);
      w.push(`${comOf(c)}/${R(c, 'E')}`, `${R(c, 'F')}/${minusOf(c)}`);
    }
  }
  // operator data slides on m1 sections 1-4
  for (let j = 0; j < 4; j++) {
    w.push(`m1.${j + 1}+/m1.${j + 1}S`, `m1.${j + 1}T/${tapRail(j)}`);
  }

  // ---------- the token ring: 8 stages, no wrap, SPAWN feeds master 0 ----------
  // ring clock rail rides the clock relays' own section coms (chain of 4-hole
  // coms, like the rung-2 shift register); the rail is fed by collide.J below
  const ringClkCom = (i: number) => comOf(RING(i, 0));
  for (let i = 0; i < 8; i += 2) {
    if (i > 0) w.push(`${ringClkCom(i - 2)}/${ringClkCom(i)}`);
  }
  for (let i = 0; i < 8; i++) {
    const c = RING(i, 0), a = RING(i, 1), s = RING(i, 2);
    w.push(`${ringClkCom(i - (i % 2))}/${R(c, 'E')}`, `${R(c, 'F')}/${minusOf(c)}`);
    w.push(`${comOf(a)}/${R(a, 'E')}`, `${R(a, 'F')}/${minusOf(a)}`);
    w.push(`${comOf(s)}/${R(s, 'E')}`, `${R(s, 'F')}/${minusOf(s)}`);
    w.push(`${plusOf(c)}/${R(c, 'H')}`, `${plusOf(c)}/${R(c, 'L')}`);
    // D path while CLK low: stage 0 samples SPAWN, others the slave above
    if (i === 0) {
      w.push(`${R(c, 'J')}/${R(SPAWN, 'H')}`, `${R(SPAWN, 'G')}/${comOf(a)}`);
    } else {
      w.push(`${R(c, 'J')}/${R(RING(i - 1, 2), 'L')}`, `${R(RING(i - 1, 2), 'K')}/${comOf(a)}`);
    }
    w.push(`${R(c, 'G')}/${R(a, 'H')}`, `${R(a, 'G')}/${comOf(a)}`); // master holds, CLK high
    w.push(`${R(c, 'K')}/${R(a, 'L')}`, `${R(a, 'K')}/${comOf(s)}`); // slave := master, CLK high
    // slave hold while CLK low, WITH a private reset break per stage
    const rm = RESETM(Math.floor(i / 2));
    const [rArm, rNc] = i % 2 === 0 ? ['H', 'J'] : ['L', 'N'];
    w.push(`${R(c, 'N')}/${R(rm, rArm)}`, `${R(rm, rNc)}/${R(s, 'H')}`, `${R(s, 'G')}/${comOf(s)}`);
    // slave mirrors: mirrorA's coil is a plain parallel (needed DURING the
    // press: readback + W trigger). The collision mirrors B and B2 hang off
    // the same node but through a PRESSCUT contact: a press drops them, so
    // their sense contacts are open before the write gates close — the
    // collision readback of the row below must never touch the data rails
    // while a write is in flight (that pollution cost this file a draft:
    // a lock at row 6 wrote row 7's content into row 6).
    const pc = PRESSCUT(Math.floor(i / 2));
    const [pArm, pNc] = i % 2 === 0 ? ['H', 'J'] : ['L', 'N'];
    w.push(`${comOf(s)}/${comOf(MIRA(i))}`);
    w.push(`${comOf(MIRA(i))}/${R(MIRA(i), 'E')}`, `${R(MIRA(i), 'F')}/${minusOf(MIRA(i))}`);
    w.push(`${comOf(MIRA(i))}/${R(pc, pArm)}`, `${R(pc, pNc)}/${comOf(MIRB(i))}`);
    w.push(`${comOf(MIRB(i))}/${R(MIRB(i), 'E')}`, `${R(MIRB(i), 'F')}/${minusOf(MIRB(i))}`);
    w.push(`${comOf(MIRB(i))}/${R(MIRB2(i), 'E')}`, `${R(MIRB2(i), 'F')}/${minusOf(MIRB2(i))}`);
  }

  // ---------- readback output taps: each cell's K contact onto its rail ----
  // (the arm's two FEEDS — hold-breaker NO for the lock readback, collision
  // mirror for the sense — are wired at those relays; there is NO shared
  // readback rail anywhere: every shared variant bridged the write rails)
  for (let r = 0; r < 8; r++) {
    for (let j = 0; j < 4; j++) {
      w.push(`${R(CELL(r, j), 'K')}/${tapRail(j)}`);
    }
  }

  // ---------- phase rails ----------
  // Contacts are bidirectional, so every rail here is reachable ONLY through
  // press-scoped contacts (an early draft's un-scoped fan re-fed rail A
  // backward through a closed column gate — an 8-relay oscillator). The
  // power chain is DEPTH-ALIGNED so both edges are race-free:
  //   rail A (contact path from the tick)  -> depth-1 relay coils only
  //   depth 1: READGATE, COLLIDEM, COLLIDEM2, PRESSCUTs (flip end of wave 1)
  //   rail B0  (breaker triggers)  = + via READGATE, OR via CLEARP on a
  //                                  reset tick with a pending line-clear
  //   rail B0p (gate triggers)     = + via READGATE, press only
  //   depth 2: the W groups (via mirrorA) and RAILGATE2 fire here; the
  //            collision mirrors DIE here (coils cut by PRESSCUT in wave 1)
  //   column feed = + via RAILGATE2 (press only, one more wave behind)
  // On the press: the write gates close in the same wave the collision
  // sense contacts open (no pollution window) and the rails go live a wave
  // later. On the release the chain unwinds in order: W drops one wave
  // after the depth-1 relays, the feeds die with or after W — exactly when
  // the cells' hold paths have re-closed. Feeding any of this from rail A
  // directly would strand every freshly written cell for one wave and drop
  // it (a bug this file's debug traces caught, twice).
  const railA = takeGroups(3); // tick-driven, dies instantly on release
  const railB0 = takeGroups(3); // breaker triggers: live on press OR clear
  const railB0p = takeGroups(3); // gate triggers: live on press only
  const colFan = takeGroups(1)[0]; // column feed, via RAILGATE2 (press only)
  const resetRail = takeGroups(2);
  const collideNode = takeGroups(1)[0];
  for (const g of [railA, railB0, railB0p, resetRail]) {
    for (let i = 1; i < g.length; i++) w.push(`${g[i - 1]}/${g[i]}`);
  }
  const aUse = { n: 0 }, b0Use = { n: 0 }, bpUse = { n: 0 }, rrUse = { n: 0 };
  const tap = (g: string[], u: { n: number }) => g[Math.floor(u.n++ / 4)];
  // depth-1 coils and the depth hops
  w.push(`${tap(railA, aUse)}/${R(READGATE, 'E')}`, `${R(READGATE, 'F')}/${minusOf(READGATE)}`);
  // one rail per contact: hanging both rails off one output jack would tie
  // them together through the jack itself, contact open or not — the exact
  // 1961 lesson. READGATE spends a full contact set on each rail.
  w.push(`${plusOf(READGATE)}/${R(READGATE, 'H')}`, `${R(READGATE, 'G')}/${tap(railB0, b0Use)}`);
  w.push(`${plusOf(READGATE)}/${R(READGATE, 'L')}`, `${R(READGATE, 'K')}/${tap(railB0p, bpUse)}`);
  w.push(`${tap(railB0p, bpUse)}/${R(RAILGATE2, 'E')}`, `${R(RAILGATE2, 'F')}/${minusOf(RAILGATE2)}`);
  w.push(`${plusOf(RAILGATE2)}/${R(RAILGATE2, 'L')}`, `${R(RAILGATE2, 'K')}/${colFan}`);
  for (let x = 0; x < 4; x++) {
    w.push(`${tap(railA, aUse)}/${R(PRESSCUT(x), 'E')}`, `${R(PRESSCUT(x), 'F')}/${minusOf(PRESSCUT(x))}`);
  }

  // tick branch: tick slide -> LKS (the LOCKED slave) -> collide -> (lock |
  // ring clock). The branch relay is the SLAVE of a two-phase pair: LKM
  // latches during a lock press, LKS copies it only while the tick is low
  // (via TICKM, a mirror on the tick line) and holds while it is high — a
  // branch contact that moved mid-press would re-route the still-held tick
  // and unwind its own source (that bug cost the first draft of this file).
  w.push('m1.5+/m1.5S', `m1.5T/${R(LKS, 'H')}`, `m1.5T/${R(TICKM, 'E')}`);
  w.push(`${R(TICKM, 'F')}/${minusOf(TICKM)}`);
  w.push(`${R(LKS, 'G')}/${tap(resetRail, rrUse)}`, `${R(LKS, 'J')}/${R(COLLIDE, 'H')}`);
  w.push(`${R(COLLIDE, 'G')}/${tap(railA, aUse)}`, `${R(COLLIDE, 'J')}/${ringClkCom(0)}`);
  // LKS: copy from LKM while the tick is low, hold while it is high
  w.push(`${plusOf(TICKM)}/${R(TICKM, 'H')}`, `${R(TICKM, 'J')}/${R(LKM, 'H')}`, `${R(LKM, 'G')}/${comOf(LKS)}`);
  w.push(`${plusOf(TICKM)}/${R(TICKM, 'L')}`, `${R(TICKM, 'K')}/${R(LKS, 'L')}`, `${R(LKS, 'K')}/${comOf(LKS)}`);
  w.push(`${comOf(LKS)}/${R(LKS, 'E')}`, `${R(LKS, 'F')}/${minusOf(LKS)}`);

  // collide relay: coil node on a com, fed by the collision network; latches
  // on rail A so a lock survives its own readback being cut. COLLIDEM rides
  // rail A too (NOT the collide coil: it cuts the collision readback, and
  // doing that whenever a collision is merely SENSED would starve the coil
  // and oscillate) — its G output powers the hold only during a lock press.
  //
  // LATCHES AND THE TIE-POINT LAW (found by this file's debug trace): a
  // latch contact feeding + into a relay's com latches EVERYTHING wired to
  // that com. The first draft latched collide with its com tied straight to
  // the collision node: the latch current ran out of the node, through the
  // chosen column's collision tap, onto the data rails, through every ON
  // cell's readback contact — and held the whole lock phase (and, through
  // the branch contacts, the tick line itself) up forever. Every latched
  // relay's SET path therefore enters its com through a private contact:
  // COLLIDEM2 (NC, open during the lock) isolates the collision node,
  // COLLIDEM's spare set gates LKM's set, RSTM's spare set gates SPAWN's.
  w.push(`${collideNode}/${R(COLLIDEM2, 'H')}`, `${R(COLLIDEM2, 'J')}/${comOf(COLLIDE)}`);
  w.push(`${tap(railA, aUse)}/${R(COLLIDEM2, 'E')}`, `${R(COLLIDEM2, 'F')}/${minusOf(COLLIDEM2)}`);
  w.push(`${comOf(COLLIDE)}/${R(COLLIDE, 'E')}`, `${R(COLLIDE, 'F')}/${minusOf(COLLIDE)}`);
  w.push(`${tap(railA, aUse)}/${R(COLLIDEM, 'E')}`, `${R(COLLIDEM, 'F')}/${minusOf(COLLIDEM)}`);
  // collide's hold: + through COLLIDEM's press-scoped NO output — never a
  // rail-A latch (a latch arm on rail A is bidirectional and re-fed the rail
  // through its own re-closed contact in an earlier draft).
  w.push(`${R(COLLIDEM, 'G')}/${R(COLLIDE, 'L')}`, `${R(COLLIDE, 'K')}/${comOf(COLLIDE)}`);
  w.push(`${plusOf(COLLIDEM)}/${R(COLLIDEM, 'H')}`);

  // mirrorA: both sets are row-scoped W triggers, one wave behind rail A so
  // the gates close in the same wave the collision sense opens. Set 1 fires
  // the gates (press-only rail), set 2 fires the breakers (press-or-clear
  // rail: the line-clear pass fires ONLY the breakers — holds broken, no
  // rails, no gates — and the full row simply drops out).
  // mirrorB/mirrorB2: PRIVATE per-cell collision readback of the row BELOW —
  // arms fed from their own sections' + (a shared collision readrail bridged
  // the write rails through the stacked row's cells; a shared arm-feed rail
  // bridged them one node further up: only fully private feeds are safe).
  for (let r = 0; r < 8; r++) {
    w.push(`${tap(railB0p, bpUse)}/${R(MIRA(r), 'H')}`, `${R(MIRA(r), 'G')}/${comOf(W(r, 0))}`);
    w.push(`${tap(railB0, b0Use)}/${R(MIRA(r), 'L')}`, `${R(MIRA(r), 'K')}/${comOf(W(r, 2))}`);
    if (r < 7) {
      const taps: Array<[number, string, string]> = [
        [MIRB(r), 'H', 'G'], [MIRB(r), 'L', 'K'],
        [MIRB2(r), 'H', 'G'], [MIRB2(r), 'L', 'K'],
      ];
      for (let j = 0; j < 4; j++) {
        const [mr, arm, no] = taps[j];
        w.push(`${plusOf(mr)}/${R(mr, arm)}`, `${R(mr, no)}/${R(CELL(r + 1, j), 'L')}`);
      }
    } else {
      // the floor: token at row 7 always collides
      w.push(`${plusOf(MIRB(7))}/${R(MIRB(7), 'H')}`, `${R(MIRB(7), 'G')}/${collideNode}`);
    }
  }

  // piece column relays: slide-driven; set 1 puts the column onto its data
  // rail during a lock, set 2 taps the rail into the collision coil
  for (let j = 0; j < 4; j++) {
    const p = PIECE(j);
    const sec = `m${Math.floor(p / 6)}.${(p % 6) + 1}`;
    w.push(`${sec}+/${sec}S`, `${sec}T/${R(p, 'E')}`, `${R(p, 'F')}/${minusOf(p)}`);
    w.push(`${colFan}/${R(p, 'H')}`, `${R(p, 'G')}/${tapRail(j)}`);
    w.push(`${tapRail(j)}/${R(p, 'L')}`, `${R(p, 'K')}/${collideNode}`);
  }

  // LINE relays on the rails; their series chain (rooted in rail A, so
  // operator writes never trigger it) latches CLEARP when a lock completes a
  // row. The clear itself happens on the NEXT tick — the reset tick — where
  // CLEARP's contact powers the breaker-trigger rail: only the full row's
  // holds break (the token is still there to select it), no gates, no rails,
  // and all four cells drop out. The full line is visible for exactly one
  // tick, like a real tetris line flash. RSTM2 (on the reset rail) breaks
  // CLEARP's latch so the clear fires once.
  for (let j = 0; j < 4; j++) {
    w.push(`${tapRail(j)}/${R(LINE(j), 'E')}`, `${R(LINE(j), 'F')}/${minusOf(LINE(j))}`);
  }
  w.push(`${tap(railA, aUse)}/${R(LINE(0), 'H')}`);
  w.push(`${R(LINE(0), 'G')}/${R(LINE(1), 'H')}`, `${R(LINE(1), 'G')}/${R(LINE(2), 'H')}`);
  // the chain fires CPSET, and CPSET's contact — sourcing from + — sets
  // CLEARP. Wiring the chain straight into CLEARP's com lets CLEARP's
  // +-armed latch backfeed rail A through the still-closed LINE contacts
  // after the release: the whole press state froze as one parasitic latch
  // (this file's line-clear debug trace caught the entire circuit at it=1).
  w.push(`${R(LINE(2), 'G')}/${R(LINE(3), 'H')}`, `${R(LINE(3), 'G')}/${comOf(CPSET)}`);
  w.push(`${comOf(CPSET)}/${R(CPSET, 'E')}`, `${R(CPSET, 'F')}/${minusOf(CPSET)}`);
  w.push(`${plusOf(CPSET)}/${R(CPSET, 'H')}`, `${R(CPSET, 'G')}/${comOf(CLEARP)}`);
  w.push(`${comOf(CLEARP)}/${R(CLEARP, 'E')}`, `${R(CLEARP, 'F')}/${minusOf(CLEARP)}`);
  w.push(`${plusOf(RSTM2)}/${R(RSTM2, 'H')}`, `${R(RSTM2, 'J')}/${R(CLEARP, 'L')}`, `${R(CLEARP, 'K')}/${comOf(CLEARP)}`);
  // CLEARP's consumer sources from + and dead-ends there (wiring it from
  // the reset rail would bridge the live rail B0 into the reset machinery
  // DURING the press and kill the token mid-lock — the bidirectional-contact
  // trap once more). While CLEARP is latched it holds the full row's
  // breaker-trigger rail up on its own: the row's holds stay broken from
  // the moment the press releases, the four cells drop out right there, and
  // the reset tick's RSTM2 breaks the latch to re-arm the row.
  w.push(`${plusOf(CLEARP)}/${R(CLEARP, 'H')}`, `${R(CLEARP, 'G')}/${tap(railB0, b0Use)}`);
  w.push(`${tap(resetRail, rrUse)}/${R(RSTM2, 'E')}`, `${R(RSTM2, 'F')}/${minusOf(RSTM2)}`);

  // LKM (LOCKED master): set by tick-high AND lock-press, wired as + ->
  // TICKM's NO output -> COLLIDEM's spare contact -> LKM's com. The set
  // current therefore dead-ends at the + rail and can never reach rail A (a
  // rail-A-side gate would be circular: its own coil rides rail A, so the
  // LKM latch would hold the gate closed and the gate would hold rail A up
  // — the parasitic rail latch this file's debug trace caught). Self-held
  // through RSTM's NC so the reset tick clears it.
  w.push(`${R(TICKM, 'G')}/${R(COLLIDEM, 'L')}`, `${R(COLLIDEM, 'K')}/${comOf(LKM)}`);
  w.push(`${comOf(LKM)}/${R(LKM, 'E')}`, `${R(LKM, 'F')}/${minusOf(LKM)}`);
  w.push(`${plusOf(RSTM)}/${R(RSTM, 'H')}`, `${R(RSTM, 'J')}/${R(LKM, 'L')}`, `${R(LKM, 'K')}/${comOf(LKM)}`);
  w.push(`${tap(resetRail, rrUse)}/${R(RSTM, 'E')}`, `${R(RSTM, 'F')}/${minusOf(RSTM)}`);

  // reset mirrors: coils on the reset rail (contacts already in the slave holds)
  for (let x = 0; x < 4; x++) {
    w.push(`${tap(resetRail, rrUse)}/${R(RESETM(x), 'E')}`, `${R(RESETM(x), 'F')}/${minusOf(RESETM(x))}`);
  }

  // SPAWN latch: set = tick-high AND reset-press, wired + -> TICKM.G ->
  // RSTM's spare contact -> SPAWN's com, so the set current dead-ends at +
  // (gating from the reset rail itself would be circular: RSTM's coil rides
  // that rail, the latch would hold the gate closed and the gate would hold
  // the rail up — the same parasitic rail latch LKM's set had). Held through
  // SPAWNCLR's NC until the ring clock consumes it.
  w.push(`${R(TICKM, 'G')}/${R(RSTM, 'L')}`, `${R(RSTM, 'K')}/${comOf(SPAWN)}`);
  w.push(`${comOf(SPAWN)}/${R(SPAWN, 'E')}`, `${R(SPAWN, 'F')}/${minusOf(SPAWN)}`);
  w.push(`${plusOf(SPAWNCLR)}/${R(SPAWNCLR, 'H')}`, `${R(SPAWNCLR, 'J')}/${R(SPAWN, 'L')}`, `${R(SPAWN, 'K')}/${comOf(SPAWN)}`);
  w.push(`${ringClkCom(6)}/${R(SPAWNCLR, 'E')}`, `${R(SPAWNCLR, 'F')}/${minusOf(SPAWNCLR)}`);
  // START arms SPAWN directly: a button IS a private contact, so it may
  // feed the com without a leak (unpressed = open = dead end for the latch)
  w.push(`${plusOf(SPAWN)}/m1.6Y`, `m1.6X/${comOf(SPAWN)}`);

  return { wires: w, rails: dataRails };
}

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
