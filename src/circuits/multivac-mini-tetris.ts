/**
 * The mini-tetris multivac circuit (roadmap rungs 7 + 9 + 9b + 10): 4x8 field,
 * gravity + stacking + line clear + row collapse in pure relay wiring — 218 relays across
 * 38 machines. A piece is any COLUMN MASK the slides raise (1 or 2 wide),
 * and with the VMODE slide up it is two cells TALL: the lock press writes
 * the token row as ever, then a phase-2 tick writes the row above through
 * the TOPW mirror bank before the (now one-tick-late) reset. This module is
 * the single source of truth for the netlist: the test
 * (src/simulator/tests/multivac-mini-tetris.test.ts, which owns the full
 * design commentary and the war stories) and the /tetris/ browser page both
 * import it. The generator builds the circuit from logical blocks (register
 * file, token ring, collision network, tick branch, phase-2 sequencer), so
 * it can also serve as the gate-level description of the machine; the wire
 * list is the compiled output.
 */

// ---- relay allocation: relay n lives at machine floor(n/6), section n%6+1
export const R = (n: number, jack: string) => `m${Math.floor(n / 6)}.${(n % 6) + 1}${jack}`;
export const comOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}com`;
export const plusOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}+`;
export const minusOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}-`;

export const A0 = 0, A0m = 1, A1 = 2, A2 = 3; // decoder address relays
export const W = (r: number, k: number) => 4 + 4 * r + k; // write groups, k = 0..3
export const CELL = (r: number, j: number) => 36 + 4 * r + j; // field cells
export const RING = (i: number, part: number) => 68 + 3 * i + part; // clk, master, slave
export const MIRA = (r: number) => 92 + 2 * r; // slave mirror A (W triggers)
export const MIRB = (r: number) => 93 + 2 * r; // slave mirror B (collision)
export const RESETM = (x: number) => 108 + x; // 4 reset mirrors, 2 stages each
export const COLLIDE = 112, COLLIDEM = 113, LKM = 114, RSTM = 115;
export const SPAWN = 116, SPAWNCLR = 117, CLEARP = 118; // CLEARP: line-clear pending
export const LINE = (j: number) => 119 + j;
export const PIECE = (j: number) => 123 + j;
export const LKS = 127, TICKM = 128; // LOCKED slave + tick-phase mirror
export const COLLIDEM2 = 129; // isolates the collision node from COLLIDE's com
export const READGATE = 130; // depth-1 press relay: powers the depth-2 rails
export const MIRB2 = (r: number) => 131 + r; // second collision mirror per row
export const PRESSCUT = (x: number) => 139 + x; // 4 relays: drop the collision mirrors during a press
export const RAILGATE2 = 143; // second-hop rail power, aligns rail life with the W group
export const RSTM2 = 144; // clears the CLEARP latch during the reset tick
export const CPSET = 145; // isolates CLEARP's set path from the LINE chain
// ---- vertical pieces ("phase-2 top write", roadmap rung 9b) ----
// a vertical piece = the column mask, two cells tall. The bottom cell IS the
// token (collision unchanged: the bottom leads). The lock press writes the
// bottom row through the existing path, untouched; a P2 master/slave pair
// then turns the NEXT tick into phase 2 — a second, private write of row
// r-1 through the TOPW mirrors — and the reset moves to the tick after.
export const VMODE = 146; // piece-shape mode relay (slide-driven)
export const TOPW = (r: number) => 146 + r; // r=1..7: slave-r mirrors, route the phase-2 triggers to row r-1
export const P2M = 154; // phase-2 master: latched by a vertical lock press
export const P2S = 155; // phase-2 slave: the resetrail branch contact (two-phase, like LKS)
export const P2CLR = 156; // breaks P2M's latch during phase 2 (like RSTM for LKM)
export const P2GATE = 157; // phase-2 READGATE: powers the two trigger rails
export const P2COL = 158; // phase-2 RAILGATE2: powers the column feed
export const TICKM2 = 159; // second tick mirror: clocks P2M -> P2S (TICKM's contacts are spoken for)
export const P2CUT = (x: number) => 160 + x; // 4 relays: drop the collision mirrors during phase 2
export const LINEDLY = 164; // delays the LINE chain's feed past the collision-sense cut
// ---- row collapse ("the elevator", roadmap rung 10) ----
// after a line clear at row r the hole walks UP: THREE ticks per row —
// alpha fires the source and hole rows' gates only (the source's content
// leaks onto the rails backward through its own closed gates — contacts
// are bidirectional — and the hole latches an exact copy; nothing breaks,
// nothing to strand), beta fires the source's breakers alone (the copied
// row drops out), gamma steps the chain with every rail dark (stepping
// with a hot rail fired the freshly hot stage's routing mid-tick and
// killed the row above before its copy — the trace caught it). The chain
// is the rung-5 ring pattern chained in REVERSE (the token ring only
// walks down); stage t = "the hole is at row t", t = 1..7 — a clear at
// row 0 has nothing above it and never seeds. The chain seeds from the
// dying token on the reset tick (the reset doubles as the seed-transfer
// clock) and drains by walking off stage 1. Full design + rejected
// alternatives + the observed-but-unexplained alpha-release anomaly:
// _notes/collapse-design.md
export const ELEVC = (t: number) => 162 + 3 * t; // stage clocks (165..183)
export const ELEVA = (t: number) => 163 + 3 * t; // stage masters (166..184)
export const ELEVSL = (t: number) => 164 + 3 * t; // stage slaves (167..185)
export const SEEDM = (t: number) => 185 + t; // ring-slave mirrors: seed the chain at the token row (186..192)
export const CLEARPM = 193; // CLEARP mirror: scopes the seed to clearing locks
export const LANE = 194; // collapse tick-lane slave (branches between LKS and COLLIDE)
export const TICKM3 = 195; // third tick mirror: clocks LANE and the phase toggle
export const TGM = 196, TGS = 197; // phase bit 0 (master/slave)
export const TG2M = 222, TG2S = 223; // phase bit 1: the collapse is THREE
// ticks per stage — alpha (gates-only move), beta (breakers-only clear),
// gamma (chain step with every rail dark). Stepping with a hot rail fired
// the freshly hot stage's routing mid-tick and killed the next row before
// its copy (the trace caught it); gamma isolates the step. Cycle:
// alpha arms TGM -> beta (TGS); beta arms TG2M -> gamma (TG2S); gamma arms
// nothing -> alpha. Decodes ride the toggles' own contacts off cgbRail.
export const ELEVW1 = (t: number) => 196 + 2 * t; // trigger-routing mirrors (198..210 even)
export const ELEVW2 = (t: number) => 197 + 2 * t; // (199..211 odd)
export const CGA = 212, CGB = 213; // collapse rail feeds (alpha rail / both-phase rail)
export const CGB2 = 214; // second-hop breaker rail: aligns the source hold-break with the gate wave
export const CUTC1 = 215, CUTC2 = 216; // cut the piece arms off colFan during collapse ticks
export const JUNC = (k: number) => 216 + k; // spare-section 4-hole coms as junction boxes
// (JUNC(0) shares m36.1 with CUTC2 — a section's com jack is electrically
// separate from its relay, so the junction coexists with the coil)
export const MACHINES = 38; // relays through m37.2; m36's coms serve as the junctions

export function tetrisCircuit(): {
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
    const p2c = P2CUT(Math.floor(i / 2));
    const [pArm, pNc] = i % 2 === 0 ? ['H', 'J'] : ['L', 'N'];
    w.push(`${comOf(s)}/${comOf(MIRA(i))}`);
    w.push(`${comOf(MIRA(i))}/${R(MIRA(i), 'E')}`, `${R(MIRA(i), 'F')}/${minusOf(MIRA(i))}`);
    // the collision mirrors' coil feed runs through TWO cut contacts in
    // series: PRESSCUT (drops them for the press) and P2CUT (drops them for
    // the phase-2 top write — the row below the token must not touch the
    // rails then either). PRESSCUT's coils cannot simply double-feed from
    // the phase-2 rail: a coil jack is a tie point, and that wire would tie
    // rail A to the phase-2 rail permanently, firing the top write on every
    // ordinary press.
    w.push(`${comOf(MIRA(i))}/${R(pc, pArm)}`, `${R(pc, pNc)}/${R(p2c, pArm)}`);
    w.push(`${R(p2c, pNc)}/${comOf(MIRB(i))}`);
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
  // LKS.G runs through P2S's branch contact (vertical section below): NC ->
  // the reset rail as always, NO -> the phase-2 rail. Pre-closed when P2S is
  // idle, so the normal reset path is unchanged. LKS.J likewise runs through
  // LANE's branch (collapse section below): NC -> the collision relay as
  // always, NO -> the collapse tick lane — the lane must intercept BEFORE
  // the collision branch or a collapse tick would clock the ring and spawn
  // the next piece mid-collapse.
  w.push(`${R(LKS, 'G')}/${R(P2S, 'H')}`, `${R(LKS, 'J')}/${R(LANE, 'H')}`);
  w.push(`${R(LANE, 'J')}/${R(COLLIDE, 'H')}`);
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
  // rail during a lock, set 2 taps the rail into the collision coil. The
  // column feed runs through CUTC (pre-closed NC, coils on the collapse's
  // cgbRail): with two or more mask slides raised, the closed piece gates
  // would otherwise TIE their data rails together through the colFan node —
  // colFan needs no feed to bridge, a jack is a tie — and a collapse move's
  // row content would leak across the masked columns (the mask can change
  // between the lock and the collapse, so this is reachable in play).
  for (let j = 0; j < 4; j++) {
    const p = PIECE(j);
    const sec = `m${Math.floor(p / 6)}.${(p % 6) + 1}`;
    const cutc = j < 2 ? CUTC1 : CUTC2;
    const [cArm, cNc] = j % 2 === 0 ? ['H', 'J'] : ['L', 'N'];
    w.push(`${sec}+/${sec}S`, `${sec}T/${R(p, 'E')}`, `${R(p, 'F')}/${minusOf(p)}`);
    w.push(`${colFan}/${R(cutc, cArm)}`, `${R(cutc, cNc)}/${R(p, 'H')}`);
    w.push(`${R(p, 'G')}/${tapRail(j)}`);
    w.push(`${tapRail(j)}/${R(p, 'L')}`, `${R(p, 'K')}/${collideNode}`);
  }

  // LINE relays on the rails; their series chain latches CLEARP when a lock
  // completes a row. The clear itself happens on the NEXT tick — the reset
  // tick — where CLEARP's contact powers the breaker-trigger rail: only the
  // full row's holds break (the token is still there to select it), no
  // gates, no rails, and all four cells drop out. The full line is visible
  // for exactly one tick, like a real tetris line flash. RSTM2 (on the
  // reset rail) breaks CLEARP's latch so the clear fires once.
  //
  // The chain's feed is DELAYED one relay past the press rails (LINEDLY:
  // coil on RAILGATE2's spare set, so it needs the press chain = operator
  // writes still can't trigger it). Feeding it from rail A directly fired
  // it FALSELY whenever a piece locked directly above a persistent full
  // row: for the press's first two waves — before PRESSCUT's cut lands —
  // the collision readback of the full row below holds all four rails hot,
  // and a wave-1 feed latches CLEARP through the stale LINE contacts,
  // clearing the row being written. Unreachable before vertical pieces
  // (a full row could never persist), found by their tests. By the wave the
  // delayed feed arrives, the rails carry only the mask and the token
  // row's own readback — the true line state.
  for (let j = 0; j < 4; j++) {
    w.push(`${tapRail(j)}/${R(LINE(j), 'E')}`, `${R(LINE(j), 'F')}/${minusOf(LINE(j))}`);
  }
  w.push(`${plusOf(RAILGATE2)}/${R(RAILGATE2, 'H')}`, `${R(RAILGATE2, 'G')}/${R(LINEDLY, 'E')}`);
  w.push(`${R(LINEDLY, 'F')}/${minusOf(LINEDLY)}`);
  w.push(`${plusOf(LINEDLY)}/${R(LINEDLY, 'H')}`, `${R(LINEDLY, 'G')}/${R(LINE(0), 'H')}`);
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

  // ---------- vertical pieces (rung 9b): mode relay + TOPW mirror bank ----
  // TOPW(r) is one more parallel coil on slave r's mirror com (its spare 4th
  // hole): it tracks the token row exactly, and its contacts are the phase-2
  // row selectors — TOPW(r) closed routes the top write to row r-1's W
  // group. Row 0 has no TOPW: a vertical lock there clips the top cell.
  const vsec = `m${Math.floor(VMODE / 6)}.${(VMODE % 6) + 1}`;
  w.push(`${vsec}+/${vsec}S`, `${vsec}T/${R(VMODE, 'E')}`, `${R(VMODE, 'F')}/${minusOf(VMODE)}`);
  for (let r = 1; r < 8; r++) {
    w.push(`${comOf(MIRA(r))}/${R(TOPW(r), 'E')}`, `${R(TOPW(r), 'F')}/${minusOf(TOPW(r))}`);
  }

  // ---------- vertical pieces: the phase-2 sequencer ----------
  // A vertical lock is THREE ticks: press (bottom write, P2M latches), phase
  // 2 (top write; the reset rail stays dark so the token, LKM and any CLEARP
  // latch survive), reset (as before, one tick late). P2M may never flip
  // while the line its slave routes is hot, so it is master/slave like
  // LKM/LKS: P2S copies P2M only while the tick is low and holds while it is
  // high. TICKM's contacts are all spoken for — TICKM2 is a parallel-coil
  // second tick mirror (its E jack's spare hole ties the coils).
  w.push(`${R(TICKM, 'E')}/${R(TICKM2, 'E')}`, `${R(TICKM2, 'F')}/${minusOf(TICKM2)}`);
  // P2M set = tick-high AND press AND vertical mode, dead-ending at + like
  // LKM's set: TICKM2.G -> COLLIDEM2's spare set (press-scoped) -> VMODE's
  // contact (mode-scoped) -> P2M's com. COLLIDEM2 is open outside the press,
  // so the latched com can never backfeed the tick line through this chain.
  w.push(`${plusOf(TICKM2)}/${R(TICKM2, 'H')}`, `${R(TICKM2, 'G')}/${R(COLLIDEM2, 'L')}`);
  w.push(`${R(COLLIDEM2, 'K')}/${R(VMODE, 'H')}`, `${R(VMODE, 'G')}/${comOf(P2M)}`);
  w.push(`${comOf(P2M)}/${R(P2M, 'E')}`, `${R(P2M, 'F')}/${minusOf(P2M)}`);
  // latch, broken by P2CLR during phase 2 (P2CLR:P2M :: RSTM:LKM). P2S rides
  // its hold through the break and copies the low state only after the tick
  // falls — the branch contact never moves under a live line.
  w.push(`${plusOf(P2CLR)}/${R(P2CLR, 'H')}`, `${R(P2CLR, 'J')}/${R(P2M, 'L')}`, `${R(P2M, 'K')}/${comOf(P2M)}`);
  w.push(`${R(TICKM2, 'J')}/${R(P2M, 'H')}`, `${R(P2M, 'G')}/${comOf(P2S)}`);
  w.push(`${plusOf(TICKM2)}/${R(TICKM2, 'L')}`, `${R(TICKM2, 'K')}/${R(P2S, 'L')}`, `${R(P2S, 'K')}/${comOf(P2S)}`);
  w.push(`${comOf(P2S)}/${R(P2S, 'E')}`, `${R(P2S, 'F')}/${minusOf(P2S)}`);
  // the phase-2 depth-1 rail (P2S's NO side; its NC side is the reset rail,
  // wired at the tick branch above). P2CLR rides it; P2GATE and the P2CUT
  // bank join in the next increment.
  const p2railA = takeGroups(2);
  w.push(`${p2railA[0]}/${p2railA[1]}`);
  const p2aUse = { n: 0 };
  w.push(`${R(P2S, 'G')}/${tap(p2railA, p2aUse)}`);
  w.push(`${R(P2S, 'J')}/${tap(resetRail, rrUse)}`);
  w.push(`${tap(p2railA, p2aUse)}/${R(P2CLR, 'E')}`, `${R(P2CLR, 'F')}/${minusOf(P2CLR)}`);

  // ---------- vertical pieces: the phase-2 write ----------
  // The top write may NOT re-power the press rails: the token row's mirrorA
  // would re-fire that row's breakers and put its freshly-written content
  // back on the rails — straight into the top row's open gates (the exact
  // pollution class this whole file exists to avoid; the token row can hold
  // stack content beside the piece). So phase 2 mirrors the press's power
  // chain with its own depth-aligned relays, and ONLY row r-1's W group
  // fires, via the TOPW mirrors:
  //   p2railA (tick via LKS.G -> P2S.G)   -> depth-1 coils
  //   depth 1: P2GATE, P2CLR, the P2CUT bank (collision sense dies wave 2)
  //   p2break / p2gate rails = + via P2GATE's two sets (one rail per
  //                            contact — the 1961 lesson, as ever)
  //   depth 2: row r-1's W group fires via TOPW(r); P2COL fires
  //   column feed = + via P2COL onto colFan's spare 6th hole
  // Release unwinds exactly like the press (same depths), so the fresh top
  // row hands off from its gates to its re-closed holds without a gap.
  w.push(`${tap(p2railA, p2aUse)}/${R(P2GATE, 'E')}`, `${R(P2GATE, 'F')}/${minusOf(P2GATE)}`);
  for (let x = 0; x < 4; x++) {
    w.push(`${tap(p2railA, p2aUse)}/${R(P2CUT(x), 'E')}`, `${R(P2CUT(x), 'F')}/${minusOf(P2CUT(x))}`);
  }
  const p2break = takeGroups(2);
  const p2gate = takeGroups(3);
  for (const g of [p2break, p2gate]) {
    for (let i = 1; i < g.length; i++) w.push(`${g[i - 1]}/${g[i]}`);
  }
  const p2bUse = { n: 0 }, p2gUse = { n: 0 };
  w.push(`${plusOf(P2GATE)}/${R(P2GATE, 'H')}`, `${R(P2GATE, 'G')}/${tap(p2break, p2bUse)}`);
  w.push(`${plusOf(P2GATE)}/${R(P2GATE, 'L')}`, `${R(P2GATE, 'K')}/${tap(p2gate, p2gUse)}`);
  w.push(`${tap(p2gate, p2gUse)}/${R(P2COL, 'E')}`, `${R(P2COL, 'F')}/${minusOf(P2COL)}`);
  w.push(`${plusOf(P2COL)}/${R(P2COL, 'L')}`, `${R(P2COL, 'K')}/${colFan}`);
  // TOPW(r) routes the triggers to row r-1. The gate com (comA) is 4/4
  // full, but a com is one node: the trigger enters through W(r-1,0)'s coil
  // jack spare hole instead. Backfeed out of that node dead-ends at open
  // contacts in every phase (mirrorA of r-1 is off while the token is at r;
  // the decoder leaf dead-ends at the released WRITE button).
  for (let r = 1; r < 8; r++) {
    w.push(`${tap(p2gate, p2gUse)}/${R(TOPW(r), 'H')}`, `${R(TOPW(r), 'G')}/${R(W(r - 1, 0), 'E')}`);
    w.push(`${tap(p2break, p2bUse)}/${R(TOPW(r), 'L')}`, `${R(TOPW(r), 'K')}/${comOf(W(r - 1, 2))}`);
  }

  // ---------- row collapse (rung 10) C1: the elevator chain + seeding ----
  // Stage t = "the hole is at row t". The chain is the ring pattern chained
  // in REVERSE (stage t's master samples stage t+1's slave), its clock coms
  // fed from the reset rail: the reset tick that kills the token doubles as
  // the seed-transfer clock — the seed path (CLEARPM -> SEEDM fan) holds the
  // token row's MASTER up from the clearing press until mid-reset, and the
  // transfer lands it in the slave just before the seed dies with the token.
  // Until the tick lane exists (next increment) every later reset also
  // clocks the chain, so the one-hot visibly walks one stage up per lock —
  // pure passive state, no routing, the game unchanged.
  const elevClkCom = (t: number) => comOf(ELEVC(t));
  w.push(`${tap(resetRail, rrUse)}/${elevClkCom(1)}`);
  for (let t = 3; t <= 7; t += 2) w.push(`${elevClkCom(t - 2)}/${elevClkCom(t)}`);
  for (let t = 1; t <= 7; t++) {
    const c = ELEVC(t), a = ELEVA(t), s = ELEVSL(t);
    w.push(`${elevClkCom(t % 2 === 1 ? t : t - 1)}/${R(c, 'E')}`, `${R(c, 'F')}/${minusOf(c)}`);
    w.push(`${plusOf(c)}/${R(c, 'H')}`, `${plusOf(c)}/${R(c, 'L')}`);
    // master D while the clock is low: the slave one stage DOWN the field
    // (the hole walks up); stage 7's master has only the seed
    if (t < 7) {
      w.push(`${R(c, 'J')}/${R(ELEVSL(t + 1), 'L')}`, `${R(ELEVSL(t + 1), 'K')}/${comOf(a)}`);
    }
    w.push(`${R(c, 'G')}/${R(a, 'H')}`, `${R(a, 'G')}/${comOf(a)}`); // master holds, clock high
    w.push(`${comOf(a)}/${R(a, 'E')}`, `${R(a, 'F')}/${minusOf(a)}`);
    w.push(`${R(c, 'K')}/${R(a, 'L')}`, `${R(a, 'K')}/${comOf(s)}`); // slave := master, clock high
    // slave self-hold while low — NO reset break: the chain is SET by the
    // reset tick and dies by walking off stage 1
    w.push(`${R(c, 'N')}/${R(s, 'H')}`, `${R(s, 'G')}/${comOf(s)}`);
    w.push(`${comOf(s)}/${R(s, 'E')}`, `${R(s, 'F')}/${minusOf(s)}`);
  }
  // the seed: CLEARPM (parallel coil on CLEARP's com — energized from the
  // clearing press until RSTM2) gates + into a fan of SEEDM contacts.
  // SEEDM(t) is a parallel coil on ring slave t's E-jack spare hole, so at
  // most ONE fan consumer conducts — the one-hot token — which is what
  // makes the one-contact fan legal (every other far side is dead).
  w.push(`${comOf(CLEARP)}/${R(CLEARPM, 'E')}`, `${R(CLEARPM, 'F')}/${minusOf(CLEARPM)}`);
  const seedFan = takeGroups(2);
  w.push(`${seedFan[0]}/${seedFan[1]}`);
  const sfUse = { n: 0 };
  w.push(`${plusOf(CLEARPM)}/${R(CLEARPM, 'H')}`, `${R(CLEARPM, 'G')}/${tap(seedFan, sfUse)}`);
  for (let t = 1; t <= 7; t++) {
    w.push(`${R(RING(t, 2), 'E')}/${R(SEEDM(t), 'E')}`, `${R(SEEDM(t), 'F')}/${minusOf(SEEDM(t))}`);
    w.push(`${tap(seedFan, sfUse)}/${R(SEEDM(t), 'H')}`, `${R(SEEDM(t), 'G')}/${comOf(ELEVA(t))}`);
  }

  // ---------- row collapse C2: the tick lane + the alpha/beta toggle ----
  // While any elevator stage is hot, ticks belong to the collapse: LANE (a
  // two-phase branch slave like LKS and P2S, clocked by TICKM3) re-routes
  // them off the collision branch. Ticks alternate alpha (the move — data
  // routing lands in the next increment) and beta (the chain steps): TGM
  // samples "not TGS" during an alpha tick and TGS copies it between ticks,
  // so the routing never flips under a live line. TGM's sample rides the
  // depth-2 CGB rail — a contact-path feed would die in the same wave as
  // the tick mirrors and the master would drop before its self-hold
  // (TICKM.N) could catch it. The chain's beta clock enters at stage 7's
  // com: the com chain ties it to the reset-rail feed, which is safe
  // because each side dead-ends through open contacts while the other is
  // live (resets and collapse ticks cannot coincide — LKS picks one lane).
  w.push(`${R(TICKM2, 'E')}/${R(TICKM3, 'E')}`, `${R(TICKM3, 'F')}/${minusOf(TICKM3)}`);
  // the "collapse active" OR: ELEVW1 mirrors (parallel coils on the stage
  // slaves' spare com holes) fan + into laneNode — legal one-contact-per-
  // consumer wired-OR: many sources, ONE consumer (LANE's copy gate)
  const laneNode = takeGroups(3);
  for (let i = 1; i < laneNode.length; i++) w.push(`${laneNode[i - 1]}/${laneNode[i]}`);
  const lnUse = { n: 0 };
  for (let t = 1; t <= 7; t++) {
    w.push(`${comOf(ELEVSL(t))}/${R(ELEVW1(t), 'E')}`, `${R(ELEVW1(t), 'F')}/${minusOf(ELEVW1(t))}`);
    w.push(`${plusOf(ELEVW1(t))}/${R(ELEVW1(t), 'L')}`, `${R(ELEVW1(t), 'K')}/${tap(laneNode, lnUse)}`);
  }
  // LANE: copies the OR while the tick is low, holds while high
  w.push(`${tap(laneNode, lnUse)}/${R(TICKM3, 'H')}`, `${R(TICKM3, 'J')}/${comOf(LANE)}`);
  w.push(`${plusOf(TICKM3)}/${R(TICKM3, 'L')}`, `${R(TICKM3, 'K')}/${R(LANE, 'L')}`, `${R(LANE, 'K')}/${comOf(LANE)}`);
  w.push(`${comOf(LANE)}/${R(LANE, 'E')}`, `${R(LANE, 'F')}/${minusOf(LANE)}`);
  // the collapse tick node and the both-phase depth-2 rail
  const clpNode = takeGroups(1)[0];
  const cgbRail = takeGroups(1)[0];
  w.push(`${R(LANE, 'G')}/${clpNode}`);
  w.push(`${clpNode}/${R(CGB, 'E')}`, `${R(CGB, 'F')}/${minusOf(CGB)}`);
  w.push(`${plusOf(CGB)}/${R(CGB, 'L')}`, `${R(CGB, 'K')}/${cgbRail}`);
  // the phase ring, decoded through the toggles' own contact chains:
  //   cgbRail -> TGS.H;  TGS.J (bit0 off) -> TG2S.H;  TGS.G (bit0 on) ->
  //     TG2M's sample + CGB2 (beta);
  //   TG2S.J (bit1 off too) -> TGM's sample + CGA (alpha);
  //   TG2S.G (bit1 on) -> the chain clock (gamma).
  // Both samplers ride cgbRail (depth 2), so a master outlives the tick by
  // one wave and its TICKM.N self-hold catches it; the slaves copy between
  // ticks (TICKM3.N) and hold through them (TICKM3.G carries laneNode).
  w.push(`${cgbRail}/${R(TGS, 'H')}`, `${R(TGS, 'J')}/${R(TG2S, 'H')}`);
  w.push(`${R(TG2S, 'J')}/${comOf(TGM)}`, `${R(TG2S, 'G')}/${elevClkCom(7)}`);
  w.push(`${R(TGS, 'G')}/${comOf(TG2M)}`);
  w.push(`${comOf(TGM)}/${R(TGM, 'E')}`, `${R(TGM, 'F')}/${minusOf(TGM)}`);
  w.push(`${comOf(TG2M)}/${R(TG2M, 'E')}`, `${R(TG2M, 'F')}/${minusOf(TG2M)}`);
  w.push(`${R(TICKM, 'N')}/${R(TGM, 'L')}`, `${R(TGM, 'K')}/${comOf(TGM)}`);
  w.push(`${R(TICKM, 'N')}/${R(TG2M, 'L')}`, `${R(TG2M, 'K')}/${comOf(TG2M)}`);
  w.push(`${R(TICKM3, 'N')}/${R(TGM, 'H')}`, `${R(TGM, 'G')}/${comOf(TGS)}`);
  w.push(`${R(TICKM3, 'N')}/${R(TG2M, 'H')}`, `${R(TG2M, 'G')}/${comOf(TG2S)}`);
  w.push(`${R(TICKM3, 'G')}/${R(TGS, 'L')}`, `${R(TGS, 'K')}/${comOf(TGS)}`);
  w.push(`${R(TICKM3, 'G')}/${R(TG2S, 'L')}`, `${R(TG2S, 'K')}/${comOf(TG2S)}`);
  w.push(`${comOf(TGS)}/${R(TGS, 'E')}`, `${R(TGS, 'F')}/${minusOf(TGS)}`);
  w.push(`${comOf(TG2S)}/${R(TG2S, 'E')}`, `${R(TG2S, 'F')}/${minusOf(TG2S)}`);

  // ---------- row collapse C3: the moves ----------
  // alpha: GATES ONLY on the source row and the hole row. The source's
  // content leaks onto the rails backward through its own closed gates (a
  // live com drives an idle rail — bidirectional contacts, the same leak
  // the mid-reset bug demonstrated), and the hole latches an exact copy.
  // No holds break, so nothing can strand at the release. beta: cgbRail2
  // (CGB2, gated by TGS.G) alone fires the source's breakers — the copied
  // row drops out, the line-clear shape. gamma: TG2S.G steps the chain
  // with both rails dark. The gate-trigger nodes of rows 1-6 are out of
  // holes (each is both a source and a destination), so they extend
  // through junction coms: spare sections' com jacks as junction boxes.
  // CGA (alpha) rides the phase decode off cgbRail — lane-gated by
  // construction, so the reset tick that seeds the chain cannot fire it
  // (an earlier draft fed it from the tick mirrors and the alpha ran one
  // tick early, mid-reset, copying the source through its own write gates —
  // contacts are bidirectional: a live row leaks onto the rails backward
  // through a closed gate. That same leak, deliberately, IS the alpha move:
  // gates-only on the source and the hole, no breakers, nothing to strand.)
  w.push(`${R(TG2S, 'J')}/${R(CGA, 'E')}`, `${R(CGA, 'F')}/${minusOf(CGA)}`);
  const collapseA = takeGroups(4);
  for (let i = 1; i < collapseA.length; i++) w.push(`${collapseA[i - 1]}/${collapseA[i]}`);
  const caUse = { n: 0 };
  w.push(`${plusOf(CGA)}/${R(CGA, 'L')}`, `${R(CGA, 'K')}/${tap(collapseA, caUse)}`);
  w.push(`${R(TGS, 'G')}/${R(CGB2, 'E')}`, `${R(CGB2, 'F')}/${minusOf(CGB2)}`);
  const cgbRail2 = takeGroups(2);
  w.push(`${cgbRail2[0]}/${cgbRail2[1]}`);
  const cb2Use = { n: 0 };
  w.push(`${plusOf(CGB2)}/${R(CGB2, 'L')}`, `${R(CGB2, 'K')}/${tap(cgbRail2, cb2Use)}`);
  // the colFan bridge cut, scoped to the WHOLE collapse (laneNode), not per
  // tick: the toggle masters' between-tick self-holds keep the phase decode
  // nodes — and with them CGA/CGB2 and the held gates — alive through the
  // inter-tick gaps (observed in the trace; idempotent re-latches of the
  // same content), so the bridge must stay cut through the gaps too.
  w.push(`${tap(laneNode, lnUse)}/${R(CUTC1, 'E')}`, `${R(CUTC1, 'F')}/${minusOf(CUTC1)}`);
  w.push(`${tap(laneNode, lnUse)}/${R(CUTC2, 'E')}`, `${R(CUTC2, 'F')}/${minusOf(CUTC2)}`);
  for (let t = 1; t <= 7; t++) {
    w.push(`${R(ELEVW1(t), 'E')}/${R(ELEVW2(t), 'E')}`, `${R(ELEVW2(t), 'F')}/${minusOf(ELEVW2(t))}`);
    // source gates: comA of row t-1 (row 0 has a direct spare hole; rows
    // 1-6 go through their junction, being destinations too)
    const srcATarget = t === 1 ? R(W(0, 1), 'E') : comOf(JUNC(t - 2));
    w.push(`${tap(collapseA, caUse)}/${R(ELEVW1(t), 'H')}`, `${R(ELEVW1(t), 'G')}/${srcATarget}`);
    // destination gates: comA of row t
    const destTarget = t === 7 ? R(W(7, 1), 'E') : comOf(JUNC(t - 1));
    w.push(`${tap(collapseA, caUse)}/${R(ELEVW2(t), 'H')}`, `${R(ELEVW2(t), 'G')}/${destTarget}`);
    // source breakers: comB of row t-1 (its coil jack's spare hole)
    w.push(`${tap(cgbRail2, cb2Use)}/${R(ELEVW2(t), 'L')}`, `${R(ELEVW2(t), 'K')}/${R(W(t - 1, 2), 'E')}`);
  }
  for (let x = 1; x <= 6; x++) {
    w.push(`${R(W(x, 1), 'E')}/${comOf(JUNC(x - 1))}`);
  }

  return { wires: w, rails: dataRails };
}


// how the outside world drives the game (the browser page uses these)
export const TETRIS_IO = {
  tick: { slide: 5, machine: 1 }, // right = tick high, left = tick low
  start: { button: 6, machine: 1 }, // press+release arms SPAWN
  vmode: { slide: (VMODE % 6) + 1, machine: Math.floor(VMODE / 6) }, // right = piece is 2 tall
  // LKS up = the machine owes itself bookkeeping ticks (phase 2 / reset)
  lockedRelay: { machine: Math.floor(LKS / 6), index: LKS % 6 },
  // LANE up = a collapse is in progress: ticks walk the stack down
  collapseRelay: { machine: Math.floor(LANE / 6), index: LANE % 6 },
  pieceSlide: (j: number) => ({ slide: (PIECE(j) % 6) + 1, machine: Math.floor(PIECE(j) / 6) }),
  cellRelay: (r: number, j: number) => ({ machine: Math.floor(CELL(r, j) / 6), index: CELL(r, j) % 6 }),
  tokenRelay: (i: number) => {
    const s = RING(i, 2);
    return { machine: Math.floor(s / 6), index: s % 6 };
  },
};
