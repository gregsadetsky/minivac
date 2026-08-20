/**
 * The mini-tetris multivac circuit (roadmap rungs 7 + 9 + 9b + 10 + the
 * piece register): 4x8 field, gravity + stacking + line clear + row
 * collapse in pure relay wiring — 289 relays across 50 machines. The
 * piece's COLUMN is machine state: a one-hot relay ring stepped by
 * momentary LEFT/RIGHT buttons (sample-on-press, commit-on-release; edges
 * self-loop; every reset re-homes it), 1 or 2 wide via the WID slide, and
 * with the VMODE slide up it is two cells TALL: the lock press writes
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
export const CUTC1 = 215, CUTC2 = 216; // cut the piece arms off colFan during a collapse
export const CUTC3 = 224, CUTC4 = 225; // and the piece taps off collideNode: with 2+ mask
// columns the collision fan is a SECOND rail-to-rail bridge (rail -> K ->
// collideNode -> K' -> rail'), and the phase decode's gap-held gates would
// latch a bridged bit (caught by the instrumented random run at tick 31)
export const JUNC = (k: number) => 216 + k; // spare-section 4-hole coms as junction boxes
// (JUNC(0) shares m36.1 with CUTC2 — a section's com jack is electrically
// separate from its relay, so the junction coexists with the coil)
// ---- the piece register, increment 1 (roadmap piece rung) ----
// piece position is MACHINE state: a bidirectional one-hot POS ring stepped
// by momentary LEFT/RIGHT buttons — sample-on-press (the masters latch the
// direction-gated neighbor), commit-on-release (the slaves copy, LKS-style
// against ANYBM). Edge presses self-loop (the master samples its own slave)
// so the one-hot can never walk off the ring. Every spawn resets POS to the
// home column (slave 0) via POSRST + SPAWNCLR's spare set — correct tetris
// AND the seeding story. The PIECE column relays re-feed from the register:
// slave j's tap, or WIDM AND slave j-1 (the wide edge). Width itself is the
// WID slide; legality gating (lateral collision) is the next increment.
export const POSA = (j: number) => 226 + j; // step masters (226..229)
export const POSS = (j: number) => 230 + j; // position slaves, one-hot (230..233)
export const POSM = (j: number) => 234 + j; // slave mirrors: left/right D taps (234..237)
export const LEFTM = 238, RIGHTM = 239; // button-line mirrors (direction gates)
export const ANYBM = 240; // either button, depth 1: feeds the delay stage
export const ANYBM2 = 241; // depth 2 echo: master hold, + TWIN's window detector
export const WIDM = 242, WIDM2 = 243; // wide-mode mirrors (WID slide) for the edge feeds
export const POSRST = (x: number) => 244 + x; // 2 relays: the RESET tick re-homes POS
export const TWIN = 246; // the release window (ANYBM down AND ANYBM2 still up): transfer NOW
export const BOOTL = 247; // latches on the first press; its NC is the power-on home seed
export const POSM2 = (j: number) => 248 + j; // 3 more slave mirrors: the wide taps' pos gates
// increment 2 — lateral legality in contacts:
export const MIRC = (r: number, h: number) => 251 + 2 * r + h; // rows 0..6 x2: token-row gates for the occupancy taps
export const LEGINV = (j: number) => 265 + j; // "column j occupied at the token row" (rail coil); its changeover routes the step
export const LEGINV2 = (k: number) => 267 + k; // k=2,3: second reads of columns 2,3 for the wide right-edge checks
export const WIDM3 = 271, WIDM4 = 272; // wide-mode mirrors: the wide forks + the wall gate
// increment 3a — the tall piece's TOP row refuses too:
export const MIRCT = (r: number, h: number) => 273 + 2 * (r - 1) + h; // rows 1..6 x2: "token at r" reading row r-1 (273..284)
export const LEGINVT = (j: number) => 285 + j; // "column j occupied one row ABOVE the token" (285..288)
export const LEGINVT2 = (k: number) => 287 + k; // k=2,3: top second-reads for the 2x2's right edge (289,290)
export const VMODEM = (p: number) => 291 + p; // vmode mirrors: the tall forks in the D-tap trees (291..294)
// the game-over latch (appended: the tall-well layout below stays stable)
export const GOM = 295; // "token at row 0" mirror (chained off MIRC(0,1)'s coil jack)
export const GAMEOVER = 296; // latches on any lock at row 0; its NC blocks START forever
export const LKM2 = 297; // lock-master mirror: the +-fed lock scope for GAMEOVER's set
// the score ring (0..9, one step per line clear — the token-ring pattern):
export const SCR = (i: number, part: number) => 298 + 3 * i + part; // clk, master, slave per digit (298..327)
export const SCBOOT = 328; // latches on the first clear; its NC is digit 0's power-on seed
// (re-homing on the spawn tick would flip the register mid-tick under a
// merged spawn+lock; the reset tick is stable long before any spawn)

// the LEFT/RIGHT buttons and the WID slide live on a DEDICATED machine —
// the one past the last relay machine, which therefore has every jack
// free. (They lived on m40 through the piece rung, sharing sections with
// relays whose + jacks HAPPENED to be unused; the 12-row layout landed
// TWIN's + on the shared section and the capacity auditor caught it.)
export const LEFTBTN = { button: 3, machine: 55 };
export const RIGHTBTN = { button: 4, machine: 55 };
export const WIDSLIDE = { slide: 5, machine: 55 };
export const MACHINES = 56; // relays through m54.5 + the dedicated button machine m55; m36's coms serve as the junctions

// ---- the ROWS-parameterized layout (rung 11 groundwork) ----
// The same allocation map as the exported constants, laid out sequentially
// from a row count. At rows=8 it reproduces every hand-laid index EXACTLY
// (asserted below against the exports, including the junction gap and the
// machine count) — the exports stay authoritative for the default
// geometry; tetrisCircuit(rows) builds from a layout so a taller well is
// a parameter, not a fork. Columns stay 4: the register, legality, LINE
// and write machinery are per-column and scale on their own rung.
export interface TetrisLayout {
  rows: number;
  A0: number; A0m: number; A1: number; A2: number;
  W: (r: number, k: number) => number;
  CELL: (r: number, j: number) => number;
  RING: (i: number, part: number) => number;
  MIRA: (r: number) => number;
  MIRB: (r: number) => number;
  RESETM: (x: number) => number;
  COLLIDE: number; COLLIDEM: number; LKM: number; RSTM: number;
  SPAWN: number; SPAWNCLR: number; CLEARP: number;
  LINE: (j: number) => number;
  PIECE: (j: number) => number;
  LKS: number; TICKM: number; COLLIDEM2: number; READGATE: number;
  MIRB2: (r: number) => number;
  PRESSCUT: (x: number) => number;
  RAILGATE2: number; RSTM2: number; CPSET: number; VMODE: number;
  TOPW: (r: number) => number;
  P2M: number; P2S: number; P2CLR: number; P2GATE: number; P2COL: number; TICKM2: number;
  P2CUT: (x: number) => number;
  LINEDLY: number;
  ELEVC: (t: number) => number;
  ELEVA: (t: number) => number;
  ELEVSL: (t: number) => number;
  SEEDM: (t: number) => number;
  CLEARPM: number; LANE: number; TICKM3: number; TGM: number; TGS: number;
  ELEVW1: (t: number) => number;
  ELEVW2: (t: number) => number;
  CGA: number; CGB: number; CGB2: number; CUTC1: number; CUTC2: number;
  JUNC: (k: number) => number;
  TG2M: number; TG2S: number; CUTC3: number; CUTC4: number;
  POSA: (j: number) => number;
  POSS: (j: number) => number;
  POSM: (j: number) => number;
  LEFTM: number; RIGHTM: number; ANYBM: number; ANYBM2: number;
  WIDM: number; WIDM2: number;
  POSRST: (x: number) => number;
  TWIN: number; BOOTL: number;
  POSM2: (j: number) => number;
  MIRC: (r: number, h: number) => number;
  LEGINV: (j: number) => number;
  LEGINV2: (k: number) => number;
  WIDM3: number; WIDM4: number;
  MIRCT: (r: number, h: number) => number;
  LEGINVT: (j: number) => number;
  LEGINVT2: (k: number) => number;
  VMODEM: (p: number) => number;
  GOM: number; GAMEOVER: number; LKM2: number;
  SCR: (i: number, part: number) => number; SCBOOT: number;
  btnMachine: number; // the dedicated (relay-free) button/slide machine
  machines: number;
  relays: number; // wired coils (the junction gap is com-only)
}

export function tetrisLayout(rows: number): TetrisLayout {
  if (rows < 4 || rows % 2 !== 0) throw new Error('rows must be even and >= 4');
  const cols = 4;
  let n = 0;
  const take = (k: number) => {
    const a = n;
    n += k;
    return a;
  };
  const aBase = take(4);
  const wBase = take(rows * 4);
  const cellBase = take(rows * cols);
  const ringBase = take(rows * 3);
  const mirBase = take(rows * 2);
  const resetmBase = take(rows / 2);
  const collideBase = take(7);
  const lineBase = take(cols);
  const pieceBase = take(cols);
  const lksBase = take(4);
  const mirb2Base = take(rows);
  const presscutBase = take(rows / 2);
  const rg2Base = take(3);
  const vmode = take(1);
  const topwBase = take(rows - 1); // TOPW(r), r = 1..rows-1
  const p2Base = take(6);
  const p2cutBase = take(rows / 2);
  const linedly = take(1);
  const elevBase = take(3 * (rows - 1)); // ELEVC/A/SL, t = 1..rows-1
  const seedmBase = take(rows - 1);
  const clearpmBase = take(5);
  const elevwBase = take(2 * (rows - 1));
  const cgaBase = take(5); // CGA, CGB, CGB2, CUTC1, CUTC2
  const juncGap = take(rows - 3); // junction-only sections; JUNC(0) shares CUTC2's com
  const tg2Base = take(4); // TG2M, TG2S, CUTC3, CUTC4
  const posaBase = take(cols);
  const possBase = take(cols);
  const posmBase = take(cols);
  const btnBase = take(2);
  const anyBase = take(2);
  const widBase = take(2);
  const posrstBase = take(2);
  const twin = take(1);
  const bootl = take(1);
  const posm2Base = take(cols - 1);
  const mircBase = take(2 * (rows - 1)); // MIRC, r = 0..rows-2
  const leginvBase = take(cols);
  const leginv2Base = take(2);
  const widm34 = take(2);
  const mirctBase = take(2 * (rows - 2)); // MIRCT, r = 1..rows-2
  const leginvtBase = take(cols);
  const leginvt2Base = take(2);
  const vmodemBase = take(cols);
  const gomBase = take(3); // GOM, GAMEOVER, LKM2 — appended after the tall-well layout shipped
  const scBase = take(31); // the score ring: 10 digits x (clk, master, slave) + SCBOOT
  return {
    rows,
    A0: aBase, A0m: aBase + 1, A1: aBase + 2, A2: aBase + 3,
    W: (r, k) => wBase + 4 * r + k,
    CELL: (r, j) => cellBase + cols * r + j,
    RING: (i, part) => ringBase + 3 * i + part,
    MIRA: r => mirBase + 2 * r,
    MIRB: r => mirBase + 2 * r + 1,
    RESETM: x => resetmBase + x,
    COLLIDE: collideBase, COLLIDEM: collideBase + 1, LKM: collideBase + 2, RSTM: collideBase + 3,
    SPAWN: collideBase + 4, SPAWNCLR: collideBase + 5, CLEARP: collideBase + 6,
    LINE: j => lineBase + j,
    PIECE: j => pieceBase + j,
    LKS: lksBase, TICKM: lksBase + 1, COLLIDEM2: lksBase + 2, READGATE: lksBase + 3,
    MIRB2: r => mirb2Base + r,
    PRESSCUT: x => presscutBase + x,
    RAILGATE2: rg2Base, RSTM2: rg2Base + 1, CPSET: rg2Base + 2, VMODE: vmode,
    TOPW: r => topwBase + (r - 1),
    P2M: p2Base, P2S: p2Base + 1, P2CLR: p2Base + 2, P2GATE: p2Base + 3, P2COL: p2Base + 4, TICKM2: p2Base + 5,
    P2CUT: x => p2cutBase + x,
    LINEDLY: linedly,
    ELEVC: t => elevBase + 3 * (t - 1),
    ELEVA: t => elevBase + 3 * (t - 1) + 1,
    ELEVSL: t => elevBase + 3 * (t - 1) + 2,
    SEEDM: t => seedmBase + (t - 1),
    CLEARPM: clearpmBase, LANE: clearpmBase + 1, TICKM3: clearpmBase + 2, TGM: clearpmBase + 3, TGS: clearpmBase + 4,
    ELEVW1: t => elevwBase + 2 * (t - 1),
    ELEVW2: t => elevwBase + 2 * (t - 1) + 1,
    CGA: cgaBase, CGB: cgaBase + 1, CGB2: cgaBase + 2, CUTC1: cgaBase + 3, CUTC2: cgaBase + 4,
    JUNC: k => (k === 0 ? cgaBase + 4 : juncGap + k - 1),
    TG2M: tg2Base, TG2S: tg2Base + 1, CUTC3: tg2Base + 2, CUTC4: tg2Base + 3,
    POSA: j => posaBase + j,
    POSS: j => possBase + j,
    POSM: j => posmBase + j,
    LEFTM: btnBase, RIGHTM: btnBase + 1, ANYBM: anyBase, ANYBM2: anyBase + 1,
    WIDM: widBase, WIDM2: widBase + 1,
    POSRST: x => posrstBase + x,
    TWIN: twin, BOOTL: bootl,
    POSM2: j => posm2Base + j,
    MIRC: (r, h) => mircBase + 2 * r + h,
    LEGINV: j => leginvBase + j,
    LEGINV2: k => leginv2Base + (k - 2),
    WIDM3: widm34, WIDM4: widm34 + 1,
    MIRCT: (r, h) => mirctBase + 2 * (r - 1) + h,
    LEGINVT: j => leginvtBase + j,
    LEGINVT2: k => leginvt2Base + (k - 2),
    VMODEM: p => vmodemBase + p,
    GOM: gomBase, GAMEOVER: gomBase + 1, LKM2: gomBase + 2,
    SCR: (i, part) => scBase + 3 * i + part, SCBOOT: scBase + 30,
    btnMachine: Math.ceil(n / 6),
    machines: Math.ceil(n / 6) + 1,
    relays: n - (rows - 3),
  };
}

// ---- the coil-allocation registry: every relay index above, claimed by
// name over its full domain at module load. Two constants landing on the
// same COIL index throw immediately (any test run validates) — the ranges
// are hand-laid and the file has grown by five rungs; a silent collision
// would wire two mechanisms into one relay. JUNC is exempt: it claims COM
// jacks only (a section's com is electrically separate from its coil, so
// junctions deliberately coexist with CUTC2/TG2M/TG2S/CUTC3's coils).
// This registry is also the first brick of the ROWSxCOLS parameterization:
// the map's shape is now data the generator can check itself against.
{
  const claimed = new Map<number, string>();
  const claim = (name: string, ...idx: number[]) => {
    for (const i of idx) {
      const prev = claimed.get(i);
      if (prev) throw new Error(`relay ${i} claimed by both ${prev} and ${name}`);
      claimed.set(i, name);
    }
  };
  claim('A0/A0m/A1/A2', A0, A0m, A1, A2);
  for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) claim('W', W(r, k));
  for (let r = 0; r < 8; r++) for (let j = 0; j < 4; j++) claim('CELL', CELL(r, j));
  for (let i = 0; i < 8; i++) for (let part = 0; part < 3; part++) claim('RING', RING(i, part));
  for (let r = 0; r < 8; r++) claim('MIRA', MIRA(r));
  for (let r = 0; r < 8; r++) claim('MIRB', MIRB(r));
  for (let x = 0; x < 4; x++) claim('RESETM', RESETM(x));
  claim('COLLIDE..CPSET', COLLIDE, COLLIDEM, LKM, RSTM, SPAWN, SPAWNCLR, CLEARP);
  for (let j = 0; j < 4; j++) claim('LINE', LINE(j));
  for (let j = 0; j < 4; j++) claim('PIECE', PIECE(j));
  claim('LKS/TICKM/COLLIDEM2/READGATE', LKS, TICKM, COLLIDEM2, READGATE);
  for (let r = 0; r < 8; r++) claim('MIRB2', MIRB2(r));
  for (let x = 0; x < 4; x++) claim('PRESSCUT', PRESSCUT(x));
  claim('RAILGATE2/RSTM2/CPSET/VMODE', RAILGATE2, RSTM2, CPSET, VMODE);
  for (let r = 1; r <= 7; r++) claim('TOPW', TOPW(r));
  claim('P2M..TICKM2', P2M, P2S, P2CLR, P2GATE, P2COL, TICKM2);
  for (let x = 0; x < 4; x++) claim('P2CUT', P2CUT(x));
  claim('LINEDLY', LINEDLY);
  for (let t = 1; t <= 7; t++) claim('ELEVC/A/SL', ELEVC(t), ELEVA(t), ELEVSL(t));
  for (let t = 1; t <= 7; t++) claim('SEEDM', SEEDM(t));
  claim('CLEARPM/LANE/TICKM3/TGM/TGS', CLEARPM, LANE, TICKM3, TGM, TGS);
  for (let t = 1; t <= 7; t++) claim('ELEVW1/2', ELEVW1(t), ELEVW2(t));
  claim('CGA/CGB/CGB2/CUTC/TG2', CGA, CGB, CGB2, CUTC1, CUTC2, TG2M, TG2S, CUTC3, CUTC4);
  for (let j = 0; j < 4; j++) claim('POSA', POSA(j));
  for (let j = 0; j < 4; j++) claim('POSS', POSS(j));
  for (let j = 0; j < 4; j++) claim('POSM', POSM(j));
  claim('button/mode mirrors', LEFTM, RIGHTM, ANYBM, ANYBM2, WIDM, WIDM2, TWIN, BOOTL, WIDM3, WIDM4);
  for (let x = 0; x < 2; x++) claim('POSRST', POSRST(x));
  for (let j = 0; j < 3; j++) claim('POSM2', POSM2(j));
  for (let r = 0; r <= 6; r++) claim('MIRC', MIRC(r, 0), MIRC(r, 1));
  for (let j = 0; j < 4; j++) claim('LEGINV', LEGINV(j));
  claim('LEGINV2', LEGINV2(2), LEGINV2(3));
  for (let r = 1; r <= 6; r++) claim('MIRCT', MIRCT(r, 0), MIRCT(r, 1));
  for (let j = 0; j < 4; j++) claim('LEGINVT', LEGINVT(j));
  claim('LEGINVT2', LEGINVT2(2), LEGINVT2(3));
  for (let p = 0; p < 4; p++) claim('VMODEM', VMODEM(p));
  claim('GOM/GAMEOVER/LKM2', GOM, GAMEOVER, LKM2);
  for (let i = 0; i < 10; i++) claim('SCR', SCR(i, 0), SCR(i, 1), SCR(i, 2));
  claim('SCBOOT', SCBOOT);

  // the parameterized layout must reproduce the hand-laid map exactly at
  // the default geometry — every scalar, every function over its domain,
  // and the machine count
  const L = tetrisLayout(8);
  const eq = (name: string, a: number, b: number) => {
    if (a !== b) throw new Error(`layout(8).${name} = ${a}, expected ${b}`);
  };
  eq('A0', L.A0, A0); eq('A0m', L.A0m, A0m); eq('A1', L.A1, A1); eq('A2', L.A2, A2);
  for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) eq('W', L.W(r, k), W(r, k));
  for (let r = 0; r < 8; r++) for (let j = 0; j < 4; j++) eq('CELL', L.CELL(r, j), CELL(r, j));
  for (let i = 0; i < 8; i++) for (let pt = 0; pt < 3; pt++) eq('RING', L.RING(i, pt), RING(i, pt));
  for (let r = 0; r < 8; r++) { eq('MIRA', L.MIRA(r), MIRA(r)); eq('MIRB', L.MIRB(r), MIRB(r)); eq('MIRB2', L.MIRB2(r), MIRB2(r)); }
  for (let x = 0; x < 4; x++) { eq('RESETM', L.RESETM(x), RESETM(x)); eq('PRESSCUT', L.PRESSCUT(x), PRESSCUT(x)); eq('P2CUT', L.P2CUT(x), P2CUT(x)); }
  eq('COLLIDE', L.COLLIDE, COLLIDE); eq('COLLIDEM', L.COLLIDEM, COLLIDEM); eq('LKM', L.LKM, LKM); eq('RSTM', L.RSTM, RSTM);
  eq('SPAWN', L.SPAWN, SPAWN); eq('SPAWNCLR', L.SPAWNCLR, SPAWNCLR); eq('CLEARP', L.CLEARP, CLEARP);
  for (let j = 0; j < 4; j++) { eq('LINE', L.LINE(j), LINE(j)); eq('PIECE', L.PIECE(j), PIECE(j)); eq('POSA', L.POSA(j), POSA(j)); eq('POSS', L.POSS(j), POSS(j)); eq('POSM', L.POSM(j), POSM(j)); eq('LEGINV', L.LEGINV(j), LEGINV(j)); eq('LEGINVT', L.LEGINVT(j), LEGINVT(j)); eq('VMODEM', L.VMODEM(j), VMODEM(j)); }
  eq('LKS', L.LKS, LKS); eq('TICKM', L.TICKM, TICKM); eq('COLLIDEM2', L.COLLIDEM2, COLLIDEM2); eq('READGATE', L.READGATE, READGATE);
  eq('RAILGATE2', L.RAILGATE2, RAILGATE2); eq('RSTM2', L.RSTM2, RSTM2); eq('CPSET', L.CPSET, CPSET); eq('VMODE', L.VMODE, VMODE);
  for (let r = 1; r <= 7; r++) eq('TOPW', L.TOPW(r), TOPW(r));
  eq('P2M', L.P2M, P2M); eq('P2S', L.P2S, P2S); eq('P2CLR', L.P2CLR, P2CLR); eq('P2GATE', L.P2GATE, P2GATE); eq('P2COL', L.P2COL, P2COL); eq('TICKM2', L.TICKM2, TICKM2);
  eq('LINEDLY', L.LINEDLY, LINEDLY);
  for (let t = 1; t <= 7; t++) {
    eq('ELEVC', L.ELEVC(t), ELEVC(t)); eq('ELEVA', L.ELEVA(t), ELEVA(t)); eq('ELEVSL', L.ELEVSL(t), ELEVSL(t));
    eq('SEEDM', L.SEEDM(t), SEEDM(t)); eq('ELEVW1', L.ELEVW1(t), ELEVW1(t)); eq('ELEVW2', L.ELEVW2(t), ELEVW2(t));
  }
  eq('CLEARPM', L.CLEARPM, CLEARPM); eq('LANE', L.LANE, LANE); eq('TICKM3', L.TICKM3, TICKM3); eq('TGM', L.TGM, TGM); eq('TGS', L.TGS, TGS);
  eq('CGA', L.CGA, CGA); eq('CGB', L.CGB, CGB); eq('CGB2', L.CGB2, CGB2); eq('CUTC1', L.CUTC1, CUTC1); eq('CUTC2', L.CUTC2, CUTC2);
  for (let k = 0; k <= 5; k++) eq('JUNC', L.JUNC(k), JUNC(k));
  eq('TG2M', L.TG2M, TG2M); eq('TG2S', L.TG2S, TG2S); eq('CUTC3', L.CUTC3, CUTC3); eq('CUTC4', L.CUTC4, CUTC4);
  eq('LEFTM', L.LEFTM, LEFTM); eq('RIGHTM', L.RIGHTM, RIGHTM); eq('ANYBM', L.ANYBM, ANYBM); eq('ANYBM2', L.ANYBM2, ANYBM2);
  eq('WIDM', L.WIDM, WIDM); eq('WIDM2', L.WIDM2, WIDM2); eq('WIDM3', L.WIDM3, WIDM3); eq('WIDM4', L.WIDM4, WIDM4);
  for (let x = 0; x < 2; x++) eq('POSRST', L.POSRST(x), POSRST(x));
  eq('TWIN', L.TWIN, TWIN); eq('BOOTL', L.BOOTL, BOOTL);
  for (let j = 0; j < 3; j++) eq('POSM2', L.POSM2(j), POSM2(j));
  for (let r = 0; r <= 6; r++) { eq('MIRC0', L.MIRC(r, 0), MIRC(r, 0)); eq('MIRC1', L.MIRC(r, 1), MIRC(r, 1)); }
  for (let r = 1; r <= 6; r++) { eq('MIRCT0', L.MIRCT(r, 0), MIRCT(r, 0)); eq('MIRCT1', L.MIRCT(r, 1), MIRCT(r, 1)); }
  eq('LEGINV2(2)', L.LEGINV2(2), LEGINV2(2)); eq('LEGINV2(3)', L.LEGINV2(3), LEGINV2(3));
  eq('LEGINVT2(2)', L.LEGINVT2(2), LEGINVT2(2)); eq('LEGINVT2(3)', L.LEGINVT2(3), LEGINVT2(3));
  eq('GOM', L.GOM, GOM); eq('GAMEOVER', L.GAMEOVER, GAMEOVER); eq('LKM2', L.LKM2, LKM2);
  for (let i = 0; i < 10; i++)
    for (let pt = 0; pt < 3; pt++) eq('SCR', L.SCR(i, pt), SCR(i, pt));
  eq('SCBOOT', L.SCBOOT, SCBOOT);
  eq('machines', L.machines, MACHINES);
  eq('btnMachine', L.btnMachine, LEFTBTN.machine);
  eq('btnMachine2', L.btnMachine, RIGHTBTN.machine);
  eq('btnMachine3', L.btnMachine, WIDSLIDE.machine);
}

export function tetrisCircuit(rows = 8): {
  wires: string[];
  rails: string[][]; // data rail j -> its chained groups
  layout: TetrisLayout; // this build's index map (== the exports at rows=8)
  btnMachine: number; // LEFT/RIGHT buttons + WID slide live here (m40 classic)
} {
  const L = tetrisLayout(rows);
  // shadow the default-geometry exports with this build's layout: the
  // whole wiring body below reads THESE, so a taller well is a parameter
  const {
    A0, A0m, A1, A2, W, CELL, RING, MIRA, MIRB, RESETM,
    COLLIDE, COLLIDEM, LKM, RSTM, SPAWN, SPAWNCLR, CLEARP,
    LINE, PIECE, LKS, TICKM, COLLIDEM2, READGATE, MIRB2, PRESSCUT,
    RAILGATE2, RSTM2, CPSET, VMODE, TOPW,
    P2M, P2S, P2CLR, P2GATE, P2COL, TICKM2, P2CUT, LINEDLY,
    ELEVC, ELEVA, ELEVSL, SEEDM, CLEARPM, LANE, TICKM3, TGM, TGS,
    ELEVW1, ELEVW2, CGA, CGB, CGB2, CUTC1, CUTC2, JUNC,
    TG2M, TG2S, CUTC3, CUTC4,
    POSA, POSS, POSM, LEFTM, RIGHTM, ANYBM, ANYBM2, WIDM, WIDM2,
    POSRST, TWIN, BOOTL, POSM2, MIRC, LEGINV, LEGINV2, WIDM3, WIDM4,
    MIRCT, LEGINVT, LEGINVT2, VMODEM, GOM, GAMEOVER, LKM2, SCR, SCBOOT,
  } = L;
  // buttons/slides live on the layout's dedicated relay-free machine:
  // every anchor that shared a machine with relays eventually collided
  // (machines-10 drifted with appended rungs; the-POS-block's-machine put
  // the buttons on TWIN's + jacks at 12 rows).
  const btnMachine = L.btnMachine;
  const w: string[] = [];

  // rails on 6-hole M10/M11 matrix groups, allocated one list at a time
  // (allocator state lives per-circuit: a second build must start fresh)
  const M_GROUPS: string[] = [];
  for (let k = 0; k < L.machines; k++) M_GROUPS.push(`m${k}.M10`, `m${k}.M11`);
  let mNext = 0;
  const takeGroups = (n: number) => {
    if (mNext + n > M_GROUPS.length) throw new Error('out of matrix groups');
    return M_GROUPS.slice(mNext, (mNext += n));
  };
  // fan/rail group counts: the hand-fit size at the classic 8 rows plus
  // growth for the extra per-row consumers (tap() spends 4 holes per
  // group, keeping 2 for the chain links) — deliberately never SMALLER
  // than the classic size, so the 8-row wire list is untouched
  const grown = (base: number, perRow: number) =>
    base + Math.ceil(Math.max(0, (rows - 8) * perRow) / 4);

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

  const dataRails = [takeGroups(grown(5, 2)), takeGroups(grown(5, 2)), takeGroups(grown(5, 2)), takeGroups(grown(5, 2))];
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
  for (let r = 0; r < rows; r++) {
    const comA = comOf(W(r, 0));
    const comB = comOf(W(r, 2));
    // the 3-bit operator-write decoder addresses 8 rows; on a taller well
    // the deep rows are game-writable only (locks fire W via the MIRA
    // triggers, not the decoder)
    if (r < 8) w.push(`${sel[r]}/${comA}`);
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
  for (let i = 0; i < rows; i += 2) {
    if (i > 0) w.push(`${ringClkCom(i - 2)}/${ringClkCom(i)}`);
  }
  for (let i = 0; i < rows; i++) {
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
  for (let r = 0; r < rows; r++) {
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
  const railA = takeGroups(grown(3, 0.5)); // tick-driven, dies instantly on release
  const railB0 = takeGroups(grown(3, 1)); // breaker triggers: live on press OR clear
  const railB0p = takeGroups(grown(3, 1)); // gate triggers: live on press only
  const colFan = takeGroups(1)[0]; // column feed, via RAILGATE2 (press only)
  const resetRail = takeGroups(grown(2, 0.5));
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
  for (let x = 0; x < rows / 2; x++) {
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
  for (let r = 0; r < rows; r++) {
    w.push(`${tap(railB0p, bpUse)}/${R(MIRA(r), 'H')}`, `${R(MIRA(r), 'G')}/${comOf(W(r, 0))}`);
    w.push(`${tap(railB0, b0Use)}/${R(MIRA(r), 'L')}`, `${R(MIRA(r), 'K')}/${comOf(W(r, 2))}`);
    if (r < rows - 1) {
      const taps: Array<[number, string, string]> = [
        [MIRB(r), 'H', 'G'], [MIRB(r), 'L', 'K'],
        [MIRB2(r), 'H', 'G'], [MIRB2(r), 'L', 'K'],
      ];
      for (let j = 0; j < 4; j++) {
        const [mr, arm, no] = taps[j];
        w.push(`${plusOf(mr)}/${R(mr, arm)}`, `${R(mr, no)}/${R(CELL(r + 1, j), 'L')}`);
      }
    } else {
      // the floor: the token at the bottom row always collides
      w.push(`${plusOf(MIRB(rows - 1))}/${R(MIRB(rows - 1), 'H')}`, `${R(MIRB(rows - 1), 'G')}/${collideNode}`);
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
    const cutc = j < 2 ? CUTC1 : CUTC2;
    const [cArm, cNc] = j % 2 === 0 ? ['H', 'J'] : ['L', 'N'];
    const cutk = j < 2 ? CUTC3 : CUTC4;
    // coils fed from the POS register (see the piece-register section) —
    // the per-column slides are gone; position is machine state now
    w.push(`${R(p, 'F')}/${minusOf(p)}`);
    w.push(`${colFan}/${R(cutc, cArm)}`, `${R(cutc, cNc)}/${R(p, 'H')}`);
    w.push(`${R(p, 'G')}/${tapRail(j)}`);
    w.push(`${tapRail(j)}/${R(p, 'L')}`, `${R(p, 'K')}/${R(cutk, cArm)}`);
    w.push(`${R(cutk, cNc)}/${collideNode}`);
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
  for (let x = 0; x < rows / 2; x++) {
    w.push(`${tap(resetRail, rrUse)}/${R(RESETM(x), 'E')}`, `${R(RESETM(x), 'F')}/${minusOf(RESETM(x))}`);
  }

  // SPAWN latch: set = tick-high AND reset-press, wired + -> TICKM.G ->
  // RSTM's spare contact -> SPAWN's com, so the set current dead-ends at +
  // (gating from the reset rail itself would be circular: RSTM's coil rides
  // that rail, the latch would hold the gate closed and the gate would hold
  // the rail up — the same parasitic rail latch LKM's set had). Held through
  // SPAWNCLR's NC until the ring clock consumes it.
  // BOTH set paths (the reset auto-re-arm here, the START button below)
  // converge on GAMEOVER's arm jack and enter the com through its NC: one
  // latch blocks every future spawn. The tie is legal — each feed's far
  // side dead-ends at the other's open contact (the released button / the
  // idle RSTM.K).
  w.push(`${R(TICKM, 'G')}/${R(RSTM, 'L')}`, `${R(RSTM, 'K')}/${R(GAMEOVER, 'H')}`);
  w.push(`${comOf(SPAWN)}/${R(SPAWN, 'E')}`, `${R(SPAWN, 'F')}/${minusOf(SPAWN)}`);
  w.push(`${plusOf(SPAWNCLR)}/${R(SPAWNCLR, 'H')}`, `${R(SPAWNCLR, 'J')}/${R(SPAWN, 'L')}`, `${R(SPAWN, 'K')}/${comOf(SPAWN)}`);
  w.push(`${ringClkCom(rows - 2)}/${R(SPAWNCLR, 'E')}`, `${R(SPAWNCLR, 'F')}/${minusOf(SPAWNCLR)}`); // the LAST ring pair com has the spare hole
  // START arms SPAWN directly: a button IS a private contact, so it may
  // feed the com without a leak (unpressed = open = dead end for the latch)
  w.push(`${plusOf(SPAWN)}/m1.6Y`, `m1.6X/${R(GAMEOVER, 'H')}`, `${R(GAMEOVER, 'J')}/${comOf(SPAWN)}`);

  // ---------- vertical pieces (rung 9b): mode relay + TOPW mirror bank ----
  // TOPW(r) is one more parallel coil on slave r's mirror com (its spare 4th
  // hole): it tracks the token row exactly, and its contacts are the phase-2
  // row selectors — TOPW(r) closed routes the top write to row r-1's W
  // group. Row 0 has no TOPW: a vertical lock there clips the top cell.
  const vsec = `m${Math.floor(VMODE / 6)}.${(VMODE % 6) + 1}`;
  w.push(`${vsec}+/${vsec}S`, `${vsec}T/${R(VMODE, 'E')}`, `${R(VMODE, 'F')}/${minusOf(VMODE)}`);
  for (let r = 1; r < rows; r++) {
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
  const p2railA = takeGroups(grown(2, 0.5));
  for (let i = 1; i < p2railA.length; i++) w.push(`${p2railA[i - 1]}/${p2railA[i]}`);
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
  for (let x = 0; x < rows / 2; x++) {
    w.push(`${tap(p2railA, p2aUse)}/${R(P2CUT(x), 'E')}`, `${R(P2CUT(x), 'F')}/${minusOf(P2CUT(x))}`);
  }
  const p2break = takeGroups(grown(2, 1));
  const p2gate = takeGroups(grown(3, 1));
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
  for (let r = 1; r < rows; r++) {
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
  for (let t = 3; t <= rows - 1; t += 2) w.push(`${elevClkCom(t - 2)}/${elevClkCom(t)}`);
  for (let t = 1; t <= rows - 1; t++) {
    const c = ELEVC(t), a = ELEVA(t), s = ELEVSL(t);
    w.push(`${elevClkCom(t % 2 === 1 ? t : t - 1)}/${R(c, 'E')}`, `${R(c, 'F')}/${minusOf(c)}`);
    w.push(`${plusOf(c)}/${R(c, 'H')}`, `${plusOf(c)}/${R(c, 'L')}`);
    // master D while the clock is low: the slave one stage DOWN the field
    // (the hole walks up); the TOP stage's master has only the seed
    if (t < rows - 1) {
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
  const seedFan = takeGroups(grown(2, 1));
  for (let i = 1; i < seedFan.length; i++) w.push(`${seedFan[i - 1]}/${seedFan[i]}`);
  const sfUse = { n: 0 };
  w.push(`${plusOf(CLEARPM)}/${R(CLEARPM, 'H')}`, `${R(CLEARPM, 'G')}/${tap(seedFan, sfUse)}`);
  for (let t = 1; t <= rows - 1; t++) {
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
  const laneNode = takeGroups(grown(3, 1));
  for (let i = 1; i < laneNode.length; i++) w.push(`${laneNode[i - 1]}/${laneNode[i]}`);
  const lnUse = { n: 0 };
  for (let t = 1; t <= rows - 1; t++) {
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
  w.push(`${R(TG2S, 'J')}/${comOf(TGM)}`, `${R(TG2S, 'G')}/${elevClkCom(rows - 1)}`); // gamma enters at the LAST elevator pair com
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
  const collapseA = takeGroups(grown(4, 2));
  for (let i = 1; i < collapseA.length; i++) w.push(`${collapseA[i - 1]}/${collapseA[i]}`);
  const caUse = { n: 0 };
  w.push(`${plusOf(CGA)}/${R(CGA, 'L')}`, `${R(CGA, 'K')}/${tap(collapseA, caUse)}`);
  w.push(`${R(TGS, 'G')}/${R(CGB2, 'E')}`, `${R(CGB2, 'F')}/${minusOf(CGB2)}`);
  const cgbRail2 = takeGroups(grown(2, 1));
  for (let i = 1; i < cgbRail2.length; i++) w.push(`${cgbRail2[i - 1]}/${cgbRail2[i]}`);
  const cb2Use = { n: 0 };
  w.push(`${plusOf(CGB2)}/${R(CGB2, 'L')}`, `${R(CGB2, 'K')}/${tap(cgbRail2, cb2Use)}`);
  // the colFan bridge cut, scoped to the WHOLE collapse (laneNode), not per
  // tick: the toggle masters' between-tick self-holds keep the phase decode
  // nodes — and with them CGA/CGB2 and the held gates — alive through the
  // inter-tick gaps (observed in the trace; idempotent re-latches of the
  // same content), so the bridge must stay cut through the gaps too.
  w.push(`${tap(laneNode, lnUse)}/${R(CUTC1, 'E')}`, `${R(CUTC1, 'F')}/${minusOf(CUTC1)}`);
  w.push(`${tap(laneNode, lnUse)}/${R(CUTC2, 'E')}`, `${R(CUTC2, 'F')}/${minusOf(CUTC2)}`);
  w.push(`${tap(laneNode, lnUse)}/${R(CUTC3, 'E')}`, `${R(CUTC3, 'F')}/${minusOf(CUTC3)}`);
  w.push(`${tap(laneNode, lnUse)}/${R(CUTC4, 'E')}`, `${R(CUTC4, 'F')}/${minusOf(CUTC4)}`);
  for (let t = 1; t <= rows - 1; t++) {
    w.push(`${R(ELEVW1(t), 'E')}/${R(ELEVW2(t), 'E')}`, `${R(ELEVW2(t), 'F')}/${minusOf(ELEVW2(t))}`);
    // source gates: comA of row t-1 (row 0 has a direct spare hole; the
    // middle rows go through their junction, being destinations too)
    const srcATarget = t === 1 ? R(W(0, 1), 'E') : comOf(JUNC(t - 2));
    w.push(`${tap(collapseA, caUse)}/${R(ELEVW1(t), 'H')}`, `${R(ELEVW1(t), 'G')}/${srcATarget}`);
    // destination gates: comA of row t
    const destTarget = t === rows - 1 ? R(W(rows - 1, 1), 'E') : comOf(JUNC(t - 1));
    w.push(`${tap(collapseA, caUse)}/${R(ELEVW2(t), 'H')}`, `${R(ELEVW2(t), 'G')}/${destTarget}`);
    // source breakers: comB of row t-1 (its coil jack's spare hole)
    w.push(`${tap(cgbRail2, cb2Use)}/${R(ELEVW2(t), 'L')}`, `${R(ELEVW2(t), 'K')}/${R(W(t - 1, 2), 'E')}`);
  }
  for (let x = 1; x <= rows - 2; x++) {
    w.push(`${R(W(x, 1), 'E')}/${comOf(JUNC(x - 1))}`);
  }

  // ---------- the piece register, increment 1: the POS ring ----------
  // Sample-on-press, commit-on-RELEASE. During the press only the target
  // MASTER latches (direction chain -> the one live POSM tap -> master com;
  // the hold chain rides ANYBM2.G); the slaves are UNTOUCHED. The transfer
  // (break the idle holds, conduct master -> new slave) runs inside a
  // one-wave RELEASE WINDOW owned by TWIN, whose coil reads "ANYBM already
  // dropped AND ANYBM2 still up" through ANYBM's NC hung off the hold
  // chain's tail. The first draft transferred DURING the press (ANYBM2
  // owned both jobs) and the trace test caught the ring going [1,1,1,1] on
  // one held press: the moment a second slave rose, a second POSM's tap
  // contacts closed, and the master coms BRIDGED each other through the
  // idle direction chain (a dead chain still ties — the tie-point law), so
  // every master latched and every slave got transfer-fed. Slaves frozen
  // mid-press = at most one POSM up while the taps are armed = nothing to
  // bridge. In the window itself the direction chains are already dark
  // (buttons dropped two waves earlier), so the new POSM rising commits
  // nothing. All the fan chains are arm-daisy-chains with at most ONE live
  // consumer (the register is one-hot), the legal fan shape.
  // one coil per button X-line, NOTHING shared: the first draft wired both
  // X-lines into ANYBM's coil jack and the trace caught LEFTM firing on a
  // RIGHT press — the coil jack is a tie, so one button's + walked through
  // it into the other button's mirror (the far side of the "wired-OR" was
  // never an open button, it was the other coil). ANYBM's either-button OR
  // is a CONTACT or instead: each mirror's spare K from its own +, the two
  // K outputs tied at ANYBM.E, each far side dead-ending at an open
  // contact when its button is up. Costs one wave (ANYBM is depth 2 now).
  const bm = `m${btnMachine}`;
  w.push(`${bm}.3+/${bm}.3Y`, `${bm}.3X/${R(LEFTM, 'E')}`);
  w.push(`${bm}.4+/${bm}.4Y`, `${bm}.4X/${R(RIGHTM, 'E')}`);
  w.push(`${R(LEFTM, 'F')}/${minusOf(LEFTM)}`, `${R(RIGHTM, 'F')}/${minusOf(RIGHTM)}`, `${R(ANYBM, 'F')}/${minusOf(ANYBM)}`);
  w.push(`${plusOf(LEFTM)}/${R(LEFTM, 'L')}`, `${R(LEFTM, 'K')}/${R(ANYBM, 'E')}`);
  w.push(`${plusOf(RIGHTM)}/${R(RIGHTM, 'L')}`, `${R(RIGHTM, 'K')}/${R(ANYBM, 'E')}`);
  w.push(`${R(ANYBM, 'L')}/${plusOf(ANYBM)}`, `${R(ANYBM, 'K')}/${R(ANYBM2, 'E')}`, `${R(ANYBM2, 'F')}/${minusOf(ANYBM2)}`);
  // direction chains: one gate contact, POSM arms daisy-chained behind it
  w.push(`${plusOf(LEFTM)}/${R(LEFTM, 'H')}`, `${R(LEFTM, 'G')}/${R(POSM(0), 'H')}`);
  w.push(`${plusOf(RIGHTM)}/${R(RIGHTM, 'H')}`, `${R(RIGHTM, 'G')}/${R(POSM(0), 'L')}`);
  for (let j = 1; j < 4; j++) {
    w.push(`${R(POSM(j - 1), 'H')}/${R(POSM(j), 'H')}`);
    w.push(`${R(POSM(j - 1), 'L')}/${R(POSM(j), 'L')}`);
  }
  // D routing: left steps down, right steps up; the edges self-loop so an
  // edge press is a no-op instead of walking the one-hot off the ring.
  // Every D-tap runs through a LEGINV CHANGEOVER (increment 2, wired
  // below): the legal side continues into the target master's com, the
  // blocked side RETURNS the sample into the current master (a forced
  // no-op step). A plain block would latch NO master and the release
  // window would then break every slave hold with nothing to transfer —
  // one refused press would wipe the ring. The edge self-loops stay
  // ungated: stepping into your own column is always legal.
  w.push(`${R(POSM(0), 'G')}/${comOf(POSA(0))}`); // left self-loop at 0
  w.push(`${R(POSM(3), 'K')}/${comOf(POSA(3))}`); // right self-loop at 3
  // (the gated taps for the six real moves are pushed in the legality
  // section, after the rails they route through exist)
  // masters: hold from mid-press through the release window (ANYBM2.G
  // chain — ANYBM2 outlives the buttons by one wave), transfer out through
  // TWIN.G's chain into the new slave's com, in the window only
  w.push(`${plusOf(ANYBM2)}/${R(ANYBM2, 'H')}`, `${R(ANYBM2, 'G')}/${R(POSA(0), 'L')}`);
  w.push(`${plusOf(TWIN)}/${R(TWIN, 'H')}`, `${R(TWIN, 'G')}/${R(POSA(0), 'H')}`);
  for (let j = 1; j < 4; j++) {
    w.push(`${R(POSA(j - 1), 'L')}/${R(POSA(j), 'L')}`);
    w.push(`${R(POSA(j - 1), 'H')}/${R(POSA(j), 'H')}`);
  }
  for (let j = 0; j < 4; j++) {
    w.push(`${comOf(POSA(j))}/${R(POSA(j), 'E')}`, `${R(POSA(j), 'F')}/${minusOf(POSA(j))}`);
    w.push(`${R(POSA(j), 'K')}/${comOf(POSA(j))}`); // hold: L(chain) -> K -> own com
    w.push(`${R(POSA(j), 'G')}/${comOf(POSS(j))}`); // transfer: H(chain) -> G -> slave com
  }
  // TWIN's coil hangs off the hold chain's tail through ANYBM's NC: hot
  // exactly when the chain is up (ANYBM2) but the button wave is already
  // down (ANYBM) — the one-wave release window. It drops WITH the masters
  // (both coils die the wave ANYBM2's contacts open), so the idle holds
  // re-close on the same wave the transfer feed dies: the new slave is
  // caught without a gap.
  w.push(`${R(POSA(3), 'L')}/${R(ANYBM, 'H')}`, `${R(ANYBM, 'J')}/${R(TWIN, 'E')}`, `${R(TWIN, 'F')}/${minusOf(TWIN)}`);
  // slaves: idle hold through TWIN's NC (closed except in the window) and
  // the POSRST spawn-reset breaks; set2 feeds the PIECE column coils (the
  // slides are gone)
  w.push(`${plusOf(TWIN)}/${R(TWIN, 'L')}`, `${R(TWIN, 'N')}/${R(POSRST(0), 'H')}`);
  w.push(`${R(POSRST(0), 'H')}/${R(POSRST(0), 'L')}`, `${R(POSRST(0), 'L')}/${R(POSRST(1), 'H')}`, `${R(POSRST(1), 'H')}/${R(POSRST(1), 'L')}`);
  const rstNc: Array<[number, string]> = [
    [POSRST(0), 'J'], [POSRST(0), 'N'], [POSRST(1), 'J'], [POSRST(1), 'N'],
  ];
  for (let j = 0; j < 4; j++) {
    const [rr, nc] = rstNc[j];
    w.push(`${R(rr, nc)}/${R(POSS(j), 'H')}`, `${R(POSS(j), 'G')}/${comOf(POSS(j))}`);
    w.push(`${comOf(POSS(j))}/${R(POSS(j), 'E')}`, `${R(POSS(j), 'F')}/${minusOf(POSS(j))}`);
    w.push(`${comOf(POSS(j))}/${R(POSM(j), 'E')}`, `${R(POSM(j), 'F')}/${minusOf(POSM(j))}`);
    w.push(`${plusOf(POSS(j))}/${R(POSS(j), 'L')}`, `${R(POSS(j), 'K')}/${R(PIECE(j), 'E')}`);
  }
  // re-home on the RESET tick (piece death), NOT the spawn tick: a
  // spawn-tick reset would flip the register mid-tick under a merged
  // spawn+lock. The reset rail gains a third group for the POSRST coils;
  // the home set rides POSRST's own spare NO (its arm is the idle-hold
  // chain — + always, except inside a button-release window, which can't
  // coincide with a tick). The very FIRST seed is POWER-ON: BOOTL is down
  // at boot, so its NC feeds + into slave 0's com and the ring wakes at
  // the home column; the first button activity latches BOOTL forever
  // (through ANYBM2's spare K, waves before any release window could need
  // slave 0's hold broken) and the seed line goes dead. A first draft
  // seeded through the START button's X line instead — and that jack is
  // TIED to the SPAWN latch's com (the tie-point law, again): the armed
  // latch fed slave 0 through the tie so it could never step off home,
  // and a held slave 0 would have back-fed the latch into respawning
  // forever. Ticks never latch BOOTL and don't need to: a no-steering
  // game just keeps the boot seed feeding the home column it sits at,
  // and every reset's POSRST re-set agrees with it.
  const resetRail3 = takeGroups(1)[0];
  w.push(`${resetRail[resetRail.length - 1]}/${resetRail3}`);
  w.push(`${resetRail3}/${R(POSRST(0), 'E')}`, `${R(POSRST(0), 'F')}/${minusOf(POSRST(0))}`);
  w.push(`${resetRail3}/${R(POSRST(1), 'E')}`, `${R(POSRST(1), 'F')}/${minusOf(POSRST(1))}`);
  w.push(`${R(POSRST(0), 'G')}/${R(POSS(0), 'E')}`); // home set, reset-scoped
  w.push(`${comOf(BOOTL)}/${R(BOOTL, 'E')}`, `${R(BOOTL, 'F')}/${minusOf(BOOTL)}`);
  w.push(`${plusOf(BOOTL)}/${R(BOOTL, 'H')}`, `${R(BOOTL, 'G')}/${comOf(BOOTL)}`); // hold forever
  w.push(`${plusOf(ANYBM2)}/${R(ANYBM2, 'L')}`, `${R(ANYBM2, 'K')}/${R(BOOTL, 'E')}`); // set on the first press
  w.push(`${plusOf(BOOTL)}/${R(BOOTL, 'L')}`, `${R(BOOTL, 'N')}/${R(POSS(0), 'G')}`); // the power-on seed
  // wide mode: PIECE(j+1) also fires when (wide AND pos == j). Each tap is
  // + through TWO series contacts — POSM2(j) (pos == j) then a WIDM/WIDM2
  // set (wide) — into PIECE(j+1)'s coil jack. The first draft armed the
  // WIDM contact straight from the slave-com node and the trace caught the
  // register re-lighting [1,1,1,0] at "wide, pos 2": PIECE(2)'s coil jack
  // is + via the ring whenever pos == 2, and with the wide contact CLOSED
  // that + walked BACKWARD through it into slave 1's com. A wired-OR into
  // a coil jack is legal only while every far side dead-ends at an OPEN
  // contact; the pos gate makes the backward path always hit one (one-hot:
  // pos can't be j and j+1 at once). POSM2 coils chain off the POSM coil
  // jacks (the slave coms themselves are at capacity 4).
  w.push(`${bm}.5+/${bm}.5S`, `${bm}.5T/${R(WIDM, 'E')}`, `${bm}.5T/${R(WIDM2, 'E')}`);
  w.push(`${R(WIDM, 'F')}/${minusOf(WIDM)}`, `${R(WIDM2, 'F')}/${minusOf(WIDM2)}`);
  for (let j = 0; j < 3; j++) {
    w.push(`${R(POSM(j), 'E')}/${R(POSM2(j), 'E')}`, `${R(POSM2(j), 'F')}/${minusOf(POSM2(j))}`);
    w.push(`${plusOf(POSM2(j))}/${R(POSM2(j), 'H')}`);
  }
  w.push(`${R(POSM2(0), 'G')}/${R(WIDM, 'H')}`, `${R(WIDM, 'G')}/${R(PIECE(1), 'E')}`);
  w.push(`${R(POSM2(1), 'G')}/${R(WIDM, 'L')}`, `${R(WIDM, 'K')}/${R(PIECE(2), 'E')}`);
  w.push(`${R(POSM2(2), 'G')}/${R(WIDM2, 'H')}`, `${R(WIDM2, 'G')}/${R(PIECE(3), 'E')}`);

  // ---------- the piece register, increment 2: lateral legality ----------
  // "Buttons request, contacts decide" — the same doctrine as the fall.
  // Occupancy rails: rail(j) = the cell at (tokenRow, j) is ON. Sources
  // are the cell COM taps (each field com had exactly one spare hole),
  // gated per row by MIRC mirrors ("token at row r", chained off TOPW's
  // coil jacks; row 0 off MIRA(0)'s spare com hole; row 7 unmapped — the
  // token only shows row 7 post-lock, where a step merely pre-positions
  // the next spawn). The token ring is one-hot, so at most one row's
  // gates are closed: the legal fan-in shape. LEGINV(j) reads the rail;
  // NO TOKEN ROW selected = rails dark = every step legal, which is what
  // keeps pre-spawn and post-lock steering (and the power-on ring) free.
  // Backward audit: a rail is fed only through the one closed MIRC row
  // gate; an OFF cell's com behind an OPEN gate can never be energized
  // from the rail side.
  const legRails = [takeGroups(grown(2, 1)), takeGroups(grown(2, 1)), takeGroups(grown(2, 1)), takeGroups(grown(2, 1))];
  for (const lg of legRails) for (let i = 1; i < lg.length; i++) w.push(`${lg[i - 1]}/${lg[i]}`);
  const legUse = [{ n: 0 }, { n: 0 }, { n: 0 }, { n: 0 }];
  const legTap = (j: number) => tap(legRails[j], legUse[j]);
  for (let r = 0; r <= rows - 2; r++) {
    const feed0 = r === 0 ? comOf(MIRA(0)) : R(TOPW(r), 'E');
    w.push(`${feed0}/${R(MIRC(r, 0), 'E')}`, `${R(MIRC(r, 0), 'E')}/${R(MIRC(r, 1), 'E')}`);
    w.push(`${R(MIRC(r, 0), 'F')}/${minusOf(MIRC(r, 0))}`, `${R(MIRC(r, 1), 'F')}/${minusOf(MIRC(r, 1))}`);
    for (let j = 0; j < 4; j++) {
      const mr = MIRC(r, j < 2 ? 0 : 1);
      const [arm, no] = j % 2 === 0 ? ['H', 'G'] : ['L', 'K'];
      w.push(`${comOf(CELL(r, j))}/${R(mr, arm)}`, `${R(mr, no)}/${legTap(j)}`);
    }
  }
  for (let j = 0; j < 4; j++) {
    w.push(`${legTap(j)}/${R(LEGINV(j), 'E')}`, `${R(LEGINV(j), 'F')}/${minusOf(LEGINV(j))}`);
  }
  // second reads of columns 2 and 3 (parallel coils, coil-jack chained)
  // for the wide right-edge checks — LEGINV's own sets are spoken for
  w.push(`${R(LEGINV(2), 'E')}/${R(LEGINV2(2), 'E')}`, `${R(LEGINV2(2), 'F')}/${minusOf(LEGINV2(2))}`);
  w.push(`${R(LEGINV(3), 'E')}/${R(LEGINV2(3), 'E')}`, `${R(LEGINV2(3), 'F')}/${minusOf(LEGINV2(3))}`);
  // narrow/wall mirrors on the WID slide (WIDM/WIDM2's sets feed PIECE)
  w.push(`${R(WIDM, 'E')}/${R(WIDM3, 'E')}`, `${R(WIDM3, 'F')}/${minusOf(WIDM3)}`);
  w.push(`${R(WIDM2, 'E')}/${R(WIDM4, 'E')}`, `${R(WIDM4, 'F')}/${minusOf(WIDM4)}`);

  // ------- increment 3a: the TOP row's occupancy (tall legality) -------
  // a second read of the SAME cell-com nodes, one row up: MIRCT(r) =
  // "token at r" reading row r-1, its arms tied to the cell coms THROUGH
  // the MIRC(r-1) arm jacks' spare holes (the coms themselves are 4/4).
  // rows 1..6 only: row 0 has no row above (the write clips there too)
  // and row 7 is post-lock. dark rails = no top constraint, so flat
  // pieces, no-token steering and the power-on ring never feel this bank.
  const legTRails = [takeGroups(grown(2, 1)), takeGroups(grown(2, 1)), takeGroups(grown(2, 1)), takeGroups(grown(2, 1))];
  for (const lg of legTRails) for (let i = 1; i < lg.length; i++) w.push(`${lg[i - 1]}/${lg[i]}`);
  const legTUse = [{ n: 0 }, { n: 0 }, { n: 0 }, { n: 0 }];
  const legTTap = (j: number) => tap(legTRails[j], legTUse[j]);
  for (let r = 1; r <= rows - 2; r++) {
    w.push(`${R(MIRC(r, 1), 'E')}/${R(MIRCT(r, 0), 'E')}`, `${R(MIRCT(r, 0), 'E')}/${R(MIRCT(r, 1), 'E')}`);
    w.push(`${R(MIRCT(r, 0), 'F')}/${minusOf(MIRCT(r, 0))}`, `${R(MIRCT(r, 1), 'F')}/${minusOf(MIRCT(r, 1))}`);
    for (let j = 0; j < 4; j++) {
      const armPrev = j % 2 === 0 ? 'H' : 'L';
      const mt = MIRCT(r, j < 2 ? 0 : 1);
      const [arm, no] = j % 2 === 0 ? ['H', 'G'] : ['L', 'K'];
      w.push(`${R(MIRC(r - 1, j < 2 ? 0 : 1), armPrev)}/${R(mt, arm)}`, `${R(mt, no)}/${legTTap(j)}`);
    }
  }
  for (let j = 0; j < 4; j++) {
    w.push(`${legTTap(j)}/${R(LEGINVT(j), 'E')}`, `${R(LEGINVT(j), 'F')}/${minusOf(LEGINVT(j))}`);
  }
  w.push(`${R(LEGINVT(2), 'E')}/${R(LEGINVT2(2), 'E')}`, `${R(LEGINVT2(2), 'F')}/${minusOf(LEGINVT2(2))}`);
  w.push(`${R(LEGINVT(3), 'E')}/${R(LEGINVT2(3), 'E')}`, `${R(LEGINVT2(3), 'F')}/${minusOf(LEGINVT2(3))}`);
  // vmode mirrors for the tall forks (VMODE's own spare set can't serve
  // six tap trees); coils daisy-chained through the coil jacks
  w.push(`${R(VMODE, 'E')}/${R(VMODEM(0), 'E')}`);
  for (let p = 1; p < 4; p++) w.push(`${R(VMODEM(p - 1), 'E')}/${R(VMODEM(p), 'E')}`);
  for (let p = 0; p < 4; p++) w.push(`${R(VMODEM(p), 'F')}/${minusOf(VMODEM(p))}`);

  // the gated D-taps: every stage is a CHANGEOVER (blocked returns the
  // sample to the current master — see the ring notes) and every OPTIONAL
  // stage is a mode fork. RIGHT into c (c=1,2):
  //   LEGINV(c) {occ->ret; free-> VMODEM {flat->X; tall-> LEGINVT(c)
  //   {occ->ret; free->X}}}; X -> WIDM3 {narrow->step; wide-> LEGINV2(c+1)
  //   {occ->ret; free-> VMODEM' {flat->step; tall-> LEGINVT2(c+1)
  //   {occ->ret; free->step}}}}
  // RIGHT into 3: LEGINV(3) -> tall fork -> WIDM4 {narrow->step;
  // wide->ret} — the wall. LEFT into c (c=0,1,2): LEGINV(c) -> tall fork
  // -> step (a wide piece's right cell moves into its own old column, so
  // left needs no wide stage). Refusal returns collect on matrix groups
  // (two chained for the both-direction positions) and re-latch the
  // current master through its coil jack's spare hole.
  const retNode = [
    takeGroups(1)[0],
    takeGroups(2),
    takeGroups(2),
  ] as const;
  w.push(`${retNode[1][0]}/${retNode[1][1]}`, `${retNode[2][0]}/${retNode[2][1]}`);
  const ret = (p: number, k: number) =>
    p === 0 ? (retNode[0] as string) : (retNode[p] as string[])[k >= 3 ? 1 : 0];
  const retUse = [0, 0, 0];
  const retTap = (p: number) => ret(p, retUse[p]++);
  w.push(`${retTap(0)}/${R(POSA(0), 'E')}`);
  w.push(`${retTap(1)}/${R(POSA(1), 'E')}`);
  w.push(`${retTap(2)}/${R(POSA(2), 'E')}`);
  for (const c of [1, 2] as const) {
    const vm = VMODEM(c - 1);
    const [wArm, wNc, wNo] = c === 1 ? ['H', 'J', 'G'] : ['L', 'N', 'K'];
    w.push(`${R(POSM(c - 1), 'K')}/${R(LEGINV(c), 'H')}`); // the tap in
    w.push(`${R(LEGINV(c), 'G')}/${retTap(c - 1)}`); // bottom-c occupied
    w.push(`${R(LEGINV(c), 'J')}/${R(vm, 'H')}`); // free: the tall fork
    w.push(`${R(vm, 'G')}/${R(LEGINVT(c), 'H')}`); // tall: check top-c
    w.push(`${R(LEGINVT(c), 'G')}/${retTap(c - 1)}`); // top-c occupied
    w.push(`${R(LEGINVT(c), 'J')}/${R(vm, 'J')}`); // top-c free: join X
    w.push(`${R(vm, 'J')}/${R(WIDM3, wArm)}`); // X: the wide fork
    w.push(`${R(WIDM3, wNc)}/${comOf(POSA(c))}`); // narrow: step
    w.push(`${R(WIDM3, wNo)}/${R(LEGINV2(c + 1), 'H')}`); // wide: bottom-c+1
    w.push(`${R(LEGINV2(c + 1), 'G')}/${retTap(c - 1)}`); // occupied
    w.push(`${R(LEGINV2(c + 1), 'J')}/${R(vm, 'L')}`); // free: tall fork #2
    w.push(`${R(vm, 'N')}/${R(WIDM3, wNc)}`); // flat-wide: join the step wire
    w.push(`${R(vm, 'K')}/${R(LEGINVT2(c + 1), 'H')}`); // tall-wide: top-c+1
    w.push(`${R(LEGINVT2(c + 1), 'J')}/${R(vm, 'N')}`); // free: join
    w.push(`${R(LEGINVT2(c + 1), 'G')}/${retTap(c - 1)}`); // occupied
  }
  w.push(`${R(POSM(2), 'K')}/${R(LEGINV(3), 'H')}`);
  w.push(`${R(LEGINV(3), 'G')}/${retTap(2)}`); // bottom-3 occupied
  w.push(`${R(LEGINV(3), 'J')}/${R(VMODEM(2), 'H')}`); // free: the tall fork
  w.push(`${R(VMODEM(2), 'G')}/${R(LEGINVT(3), 'H')}`); // tall: top-3
  w.push(`${R(LEGINVT(3), 'G')}/${retTap(2)}`); // occupied
  w.push(`${R(LEGINVT(3), 'J')}/${R(VMODEM(2), 'J')}`); // free: join
  w.push(`${R(VMODEM(2), 'J')}/${R(WIDM4, 'H')}`); // the wall gate
  w.push(`${R(WIDM4, 'J')}/${comOf(POSA(3))}`); // narrow: step
  w.push(`${R(WIDM4, 'G')}/${retTap(2)}`); // wide: the wall, return
  // left taps: the tall fork sets — VMODEM(2).set2 serves left-into-0,
  // VMODEM(3)'s two sets serve left-into-1 and left-into-2
  const leftFork: Array<[number, string, string, string]> = [
    [VMODEM(2), 'L', 'N', 'K'], // into 0
    [VMODEM(3), 'H', 'J', 'G'], // into 1
    [VMODEM(3), 'L', 'N', 'K'], // into 2
  ];
  for (const c of [0, 1, 2] as const) {
    const [vm, vArm, vNc, vNo] = leftFork[c];
    w.push(`${R(POSM(c + 1), 'G')}/${R(LEGINV(c), 'L')}`); // the tap in
    w.push(`${R(LEGINV(c), 'N')}/${R(vm, vArm)}`); // bottom free: tall fork
    w.push(`${R(vm, vNc)}/${comOf(POSA(c))}`); // flat: step
    w.push(`${R(vm, vNo)}/${R(LEGINVT(c), 'L')}`); // tall: top-c
    w.push(`${R(LEGINVT(c), 'N')}/${R(vm, vNc)}`); // free: join the step wire
    if (c === 2) {
      // position 3 has no return group: tie both left refusals, one wire
      w.push(`${R(LEGINV(2), 'K')}/${R(LEGINVT(2), 'K')}`);
      w.push(`${R(LEGINVT(2), 'K')}/${R(POSA(3), 'E')}`);
    } else {
      w.push(`${R(LEGINV(c), 'K')}/${retTap(c + 1)}`); // bottom occupied
      w.push(`${R(LEGINVT(c), 'K')}/${retTap(c + 1)}`); // top occupied
    }
  }

  // ---------- game over: the stack topped out ----------
  // GAMEOVER latches on any LOCK AT ROW 0 (a row-0 clearing lock also
  // tops out — documented simplification) and its NC sits in the START
  // button's arm path above, so no spawn can ever arm again; a power
  // cycle starts the next game. GOM = "token at row 0": one more coil
  // chained off MIRC(0,1)'s jack (row 0 has no MIRCT chain there). The
  // set is +-fed through LKM2 (a lock-master mirror: up from the lock
  // press until the reset) so it DEAD-ENDS AT + while the latch holds —
  // the first draft tapped the breaker rail instead, and the held latch's
  // com back-fed + onto that rail through GOM's still-closed contact,
  // re-firing row 0's hold-break forever (the fresh top-out write never
  // latched; the failing test's field showed exactly rows 1-7 intact and
  // row 0 empty). The tie-point law: a set path must dead-end at + or an
  // open contact in EVERY state, not just the idle one.
  w.push(`${R(MIRC(0, 1), 'E')}/${R(GOM, 'E')}`, `${R(GOM, 'F')}/${minusOf(GOM)}`);
  w.push(`${R(LKM, 'E')}/${R(LKM2, 'E')}`, `${R(LKM2, 'F')}/${minusOf(LKM2)}`);
  w.push(`${plusOf(LKM2)}/${R(LKM2, 'H')}`, `${R(LKM2, 'G')}/${R(GOM, 'H')}`);
  w.push(`${R(GOM, 'G')}/${comOf(GAMEOVER)}`);
  w.push(`${comOf(GAMEOVER)}/${R(GAMEOVER, 'E')}`, `${R(GAMEOVER, 'F')}/${minusOf(GAMEOVER)}`);
  w.push(`${plusOf(GAMEOVER)}/${R(GAMEOVER, 'L')}`, `${R(GAMEOVER, 'K')}/${comOf(GAMEOVER)}`);

  // ---------- the score ring: a decimal digit, one step per line clear ----
  // The token-ring pattern verbatim with CLEARP as the clock: each clear
  // pulses CLEARP (at most one row clears per lock), the one-hot digit
  // steps 0 -> 1 -> ... -> 9 -> 0. Clock coils pair on their own section
  // coms fed from CLEARPM's coil-jack chain; each stage's master samples
  // the PREVIOUS digit's slave while the clock is low and the slaves copy
  // on the pulse. Digit 0 seeds at power-on through SCBOOT's NC (the
  // BOOTL idiom — its own relay: sharing BOOTL's N jack would tie the POS
  // ring's com to the score com forever); SCBOOT latches on the FIRST
  // pulse and the seed line goes dead mid-pulse, exactly before the
  // clock-fall hold would have re-caught digit 0.
  const scrClkCom = (i: number) => comOf(SCR(i, 0));
  w.push(`${R(CLEARPM, 'E')}/${scrClkCom(0)}`);
  for (let i = 2; i < 10; i += 2) w.push(`${scrClkCom(i - 2)}/${scrClkCom(i)}`);
  for (let i = 0; i < 10; i++) {
    const c = SCR(i, 0), a = SCR(i, 1), sl = SCR(i, 2);
    w.push(`${scrClkCom(i - (i % 2))}/${R(c, 'E')}`, `${R(c, 'F')}/${minusOf(c)}`);
    w.push(`${comOf(a)}/${R(a, 'E')}`, `${R(a, 'F')}/${minusOf(a)}`);
    w.push(`${comOf(sl)}/${R(sl, 'E')}`, `${R(sl, 'F')}/${minusOf(sl)}`);
    w.push(`${plusOf(c)}/${R(c, 'H')}`, `${plusOf(c)}/${R(c, 'L')}`);
    // D while the clock is low: the previous digit's slave (9 wraps to 0)
    const prev = SCR((i + 9) % 10, 2);
    w.push(`${R(c, 'J')}/${R(prev, 'L')}`, `${R(prev, 'K')}/${comOf(a)}`);
    w.push(`${R(c, 'G')}/${R(a, 'H')}`, `${R(a, 'G')}/${comOf(a)}`); // master holds, clock high
    w.push(`${R(c, 'K')}/${R(a, 'L')}`, `${R(a, 'K')}/${comOf(sl)}`); // slave := master
    w.push(`${R(c, 'N')}/${R(sl, 'H')}`, `${R(sl, 'G')}/${comOf(sl)}`); // slave holds, clock low
  }
  // SCBOOT: pulse-fed through CLEARPM's spare K contact — NOT the clock
  // chain: a latch sharing the chain node would hold every ring clock
  // high forever after the first clear. The self-hold injects into the
  // coil jack; between pulses that + dead-ends at CLEARPM's open K, and
  // during a pulse it meets the same + on the arm. Until the first pulse
  // its NC feeds digit 0's com (the BOOTL idiom, private relay — sharing
  // BOOTL's jack would tie the POS ring's com to the score com forever).
  w.push(`${R(SCBOOT, 'F')}/${minusOf(SCBOOT)}`);
  w.push(`${plusOf(CLEARPM)}/${R(CLEARPM, 'L')}`, `${R(CLEARPM, 'K')}/${R(SCBOOT, 'E')}`);
  w.push(`${plusOf(SCBOOT)}/${R(SCBOOT, 'H')}`, `${R(SCBOOT, 'G')}/${R(SCBOOT, 'E')}`);
  w.push(`${plusOf(SCBOOT)}/${R(SCBOOT, 'L')}`, `${R(SCBOOT, 'N')}/${comOf(SCR(0, 2))}`);

    return { wires: w, rails: dataRails, layout: L, btnMachine };
}


// how the outside world drives the game (the browser page uses these)
export const TETRIS_IO = {
  tick: { slide: 5, machine: 1 }, // right = tick high, left = tick low
  start: { button: 6, machine: 1 }, // press+release arms SPAWN
  vmode: { slide: (VMODE % 6) + 1, machine: Math.floor(VMODE / 6) }, // right = piece is 2 tall
  wid: WIDSLIDE, // right = piece is 2 wide
  left: LEFTBTN, // momentary: step the position register left
  right: RIGHTBTN, // momentary: step it right (edge presses no-op)
  // LKS up = the machine owes itself bookkeeping ticks (phase 2 / reset)
  lockedRelay: { machine: Math.floor(LKS / 6), index: LKS % 6 },
  // LANE up = a collapse is in progress: ticks walk the stack down
  collapseRelay: { machine: Math.floor(LANE / 6), index: LANE % 6 },
  // the position register's one-hot slaves (dark until the first spawn)
  posRelay: (j: number) => ({ machine: Math.floor(POSS(j) / 6), index: POSS(j) % 6 }),
  cellRelay: (r: number, j: number) => ({ machine: Math.floor(CELL(r, j) / 6), index: CELL(r, j) % 6 }),
  tokenRelay: (i: number) => {
    const s = RING(i, 2);
    return { machine: Math.floor(s / 6), index: s % 6 };
  },
};
