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

import { MirrorBank } from './contact-alloc';

// ---- relay allocation: relay n lives at machine floor(n/6), section n%6+1
export const R = (n: number, jack: string) => `m${Math.floor(n / 6)}.${(n % 6) + 1}${jack}`;
export const comOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}com`;
export const plusOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}+`;
export const minusOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}-`;

// the DEFAULT-GEOMETRY map: every constant below derives from the
// layout allocator at (8 rows, 4 cols) — tetrisLayout is the primary
// source now (wider-well phase C shifts bank sizes; literals would
// break). the inline comments document each bank; jack ranges in
// them describe TODAY'S map and move with the allocator.
const L8 = tetrisLayout(8);
export const A0 = L8.A0, A0m = L8.A0m, A1 = L8.A1, A2 = L8.A2; // decoder address relays
export const W = L8.W; // write groups, k = 0..3
export const CELL = L8.CELL; // field cells
export const RING = L8.RING; // clk, master, slave
export const MIRA = L8.MIRA; // slave mirror A (W triggers)
export const MIRB = L8.MIRB; // slave mirror B (collision)
export const RESETM = L8.RESETM; // 4 reset mirrors, 2 stages each
export const COLLIDE = L8.COLLIDE, COLLIDEM = L8.COLLIDEM, LKM = L8.LKM, RSTM = L8.RSTM;
export const SPAWN = L8.SPAWN, SPAWNCLR = L8.SPAWNCLR, CLEARP = L8.CLEARP; // CLEARP: line-clear pending
export const LINE = L8.LINE;
export const PIECE = L8.PIECE;
export const LKS = L8.LKS, TICKM = L8.TICKM; // LOCKED slave + tick-phase mirror
export const COLLIDEM2 = L8.COLLIDEM2; // isolates the collision node from COLLIDE's com
export const READGATE = L8.READGATE; // depth-1 press relay: powers the depth-2 rails
export const MIRB2 = L8.MIRB2; // second collision mirror per row
export const PRESSCUT = L8.PRESSCUT; // 4 relays: drop the collision mirrors during a press
export const RAILGATE2 = L8.RAILGATE2; // second-hop rail power, aligns rail life with the W group
export const RSTM2 = L8.RSTM2; // clears the CLEARP latch during the reset tick
export const CPSET = L8.CPSET; // isolates CLEARP's set path from the LINE chain
// ---- vertical pieces ("phase-2 top write", roadmap rung 9b) ----
// a vertical piece = the column mask, two cells tall. The bottom cell IS the
// token (collision unchanged: the bottom leads). The lock press writes the
// bottom row through the existing path, untouched; a P2 master/slave pair
// then turns the NEXT tick into phase 2 — a second, private write of row
// r-1 through the TOPW mirrors — and the reset moves to the tick after.
export const VMODE = L8.VMODE; // piece-shape mode relay (slide-driven)
export const TOPW = L8.TOPW; // r=1..7: slave-r mirrors, route the phase-2 triggers to row r-1
export const P2M = L8.P2M; // phase-2 master: latched by a vertical lock press
export const P2S = L8.P2S; // phase-2 slave: the resetrail branch contact (two-phase, like LKS)
export const P2CLR = L8.P2CLR; // breaks P2M's latch during phase 2 (like RSTM for LKM)
export const P2GATE = L8.P2GATE; // phase-2 READGATE: powers the two trigger rails
export const P2COL = L8.P2COL; // phase-2 RAILGATE2: powers the column feed
export const TICKM2 = L8.TICKM2; // second tick mirror: clocks P2M -> P2S (TICKM's contacts are spoken for)
export const P2CUT = L8.P2CUT; // 4 relays: drop the collision mirrors during phase 2
export const LINEDLY = L8.LINEDLY; // delays the LINE chain's feed past the collision-sense cut
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
export const ELEVC = L8.ELEVC; // stage clocks (165..183)
export const ELEVA = L8.ELEVA; // stage masters (166..184)
export const ELEVSL = L8.ELEVSL; // stage slaves (167..185)
export const SEEDM = L8.SEEDM; // ring-slave mirrors: seed the chain at the token row (186..192)
export const CLEARPM = L8.CLEARPM; // CLEARP mirror: scopes the seed to clearing locks
export const LANE = L8.LANE; // collapse tick-lane slave (branches between LKS and COLLIDE)
export const TICKM3 = L8.TICKM3; // third tick mirror: clocks LANE and the phase toggle
export const TGM = L8.TGM, TGS = L8.TGS; // phase bit 0 (master/slave)
export const TG2M = L8.TG2M, TG2S = L8.TG2S; // phase bit 1: the collapse is THREE
// ticks per stage — alpha (gates-only move), beta (breakers-only clear),
// gamma (chain step with every rail dark). Stepping with a hot rail fired
// the freshly hot stage's routing mid-tick and killed the next row before
// its copy (the trace caught it); gamma isolates the step. Cycle:
// alpha arms TGM -> beta (TGS); beta arms TG2M -> gamma (TG2S); gamma arms
// nothing -> alpha. Decodes ride the toggles' own contacts off cgbRail.
export const ELEVW1 = L8.ELEVW1; // trigger-routing mirrors (198..210 even)
export const ELEVW2 = L8.ELEVW2; // (199..211 odd)
export const CGA = L8.CGA, CGB = L8.CGB; // collapse rail feeds (alpha rail / both-phase rail)
export const CGB2 = L8.CGB2; // second-hop breaker rail: aligns the source hold-break with the gate wave
export const CUTC1 = L8.CUTC1, CUTC2 = L8.CUTC2; // cut the piece arms off colFan during a collapse
export const CUTC3 = L8.CUTC3, CUTC4 = L8.CUTC4; // and the piece taps off collideNode: with 2+ mask
// columns the collision fan is a SECOND rail-to-rail bridge (rail -> K ->
// collideNode -> K' -> rail'), and the phase decode's gap-held gates would
// latch a bridged bit (caught by the instrumented random run at tick 31)
export const JUNC = L8.JUNC; // spare-section 4-hole coms as junction boxes
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
export const POSA = L8.POSA; // step masters (226..229)
export const POSS = L8.POSS; // position slaves, one-hot (230..233)
export const POSM = L8.POSM; // slave mirrors: left/right D taps (234..237)
export const LEFTM = L8.LEFTM, RIGHTM = L8.RIGHTM; // button-line mirrors (direction gates)
export const ANYBM = L8.ANYBM; // either button, depth 1: feeds the delay stage
export const ANYBM2 = L8.ANYBM2; // depth 2 echo: master hold, + TWIN's window detector
export const WIDM = L8.WIDM, WIDM2 = L8.WIDM2; // wide-mode mirrors (WID slide) for the edge feeds
export const POSRST = L8.POSRST; // 2 relays: the RESET tick re-homes POS
export const TWIN = L8.TWIN; // the release window (ANYBM down AND ANYBM2 still up): transfer NOW
export const BOOTL = L8.BOOTL; // latches on the first press; its NC is the power-on home seed
export const POSM2 = L8.POSM2; // 3 more slave mirrors: the wide taps' pos gates
// increment 2 — lateral legality in contacts:
export const MIRC = L8.MIRC; // rows 0..6 x2: token-row gates for the occupancy taps
export const LEGINV = L8.LEGINV; // "column j occupied at the token row" (rail coil); its changeover routes the step
export const LEGINV2 = L8.LEGINV2; // k=2,3: second reads of columns 2,3 for the wide right-edge checks
export const WIDM3 = L8.WIDM3, WIDM4 = L8.WIDM4; // wide-mode mirrors: the wide forks + the wall gate
// increment 3a — the tall piece's TOP row refuses too:
export const MIRCT = L8.MIRCT; // rows 1..6 x2: "token at r" reading row r-1 (273..284)
export const LEGINVT = L8.LEGINVT; // "column j occupied one row ABOVE the token" (285..288)
export const LEGINVT2 = L8.LEGINVT2; // k=2,3: top second-reads for the 2x2's right edge (289,290)
export const VMODEM = L8.VMODEM; // vmode mirrors: the tall forks in the D-tap trees (291..294)
// the game-over latch (appended: the tall-well layout below stays stable)
export const GOM = L8.GOM; // "token at row 0" mirror (chained off MIRC(0,1)'s coil jack)
export const GAMEOVER = L8.GAMEOVER; // latches on any lock at row 0; its NC blocks START forever
export const LKM2 = L8.LKM2; // lock-master mirror: the +-fed lock scope for GAMEOVER's set
// the score ring (0..9, one step per line clear — the token-ring pattern):
export const SCR = L8.SCR; // clk, master, slave per digit (298..327)
export const SCBOOT = L8.SCBOOT; // latches on the first clear; its NC is digit 0's power-on seed
// staggered pieces (S/Z — shapes increment 3b-1):
export const PIECET = L8.PIECET; // the TOP-row mask bank (TOPMASK slides on the button machine)
export const CUTC5 = L8.CUTC5, CUTC6 = L8.CUTC6; // colFanT's collapse cuts (the CUTC pattern for the T fan)
export const STAGM = L8.STAGM; // the STAG slide's mirror: phase 2 feeds colFanT (staggered) instead of colFan
export const CUTB1 = L8.CUTB1, CUTB2 = L8.CUTB2; // sever the B fan during a staggered phase 2 (its closed gates bridge rails through colFan)
export const CUTB3 = L8.CUTB3, CUTB4 = L8.CUTB4; // ...and the collision-tap side: the SECOND bridge (collideNode), rung 10's lesson verbatim
export const CUTBD = L8.CUTBD; // one-hop delay for ALL the stagger cuts: they must outlive the gates/rails/readback at the release
// the top collision term (shapes 3b-2): a staggered notch rests on stored content
export const LEGB = L8.LEGB; // second reads of "col j occupied at the token row" (the legality rails)
export const STAGM2 = L8.STAGM2; // second STAG mirror: the top collision term applies only in staggered mode
// the shape ring (3b-3a): a 6-state one-hot ring stepped by the UP button,
// state order = the page's cycle (0=1x1, 1=2wide, 2=2tall, 3=O, 4=S, 5=Z).
// the ring DERIVES the mode rails the operator slides drive, wiring into
// the SAME coil nets (compatibility-OR: every branch dead-ends at an open
// contact when its state is inactive, so slide+ring coexist tie-point-
// legally; a disagreement UNIONS, which is what real hardware would do).
// slide-driven tests/procedures stay valid; state 0 = all rails off =
// the slide defaults.
export const SHR = L8.SHR; // clk, master, slave per state (346..363)
export const UPM = L8.UPM; // UP-button mirror: set1 clocks the ring, set2 K pulses SHBOOT (the CLEARPM pattern)
export const SHBOOT = L8.SHBOOT; // latches on the first UP; its NC seeds state 0 (the BOOTL idiom, private relay)
export const SM = L8.SM; // S-state mirrors (366..369): 4 T-fan branches + WIDB/VMODE/STAGM rails
export const ZM = L8.ZM; // Z-state mirrors (370..373): same ledger as S
export const OM = L8.OM; // O-state mirror: WIDB + VMODE rails
export const I2TM = L8.I2TM; // 2-tall mirror: VMODE rail
export const I2WM = L8.I2WM; // 2-wide mirror: WIDB rail
export const POSM3 = L8.POSM3; // T-fan pos mirrors: k=0 pos0, k=1,2 pos1, k=3 pos2 (377..380)
// 3b-3b — the legality trees re-gated per the TRUE target top columns.
// key fact: the existing tree checks are false ONLY one mode at a time:
// every LEGINVT (point-1/left) check is correct for symmetric AND S
// (S's target top set {c-1,c} contains c) and false only for Z; every
// LEGINVT2 (wide point-2) check is correct for symmetric AND Z and false
// only for S. So the trees keep their exact shape: LEGINVT coils gain a
// NOT-Z gate, LEGINVT2 coils a NOT-S gate (a dead check relay passes
// through — its NC is closed), and the missing columns insert as plain
// series hops: LTS = S-gated top reads of c-1, LTZ = Z-gated reads of
// c+1/c+2, plus two pure BOUNDS checks (S cannot enter pos 0, Z cannot
// enter pos 2 — an S/Z state mirror's NO straight to the return).
export const LTS = L8.LTS; // S-only top reads: k=0 col0, k=1 col1 (coil = rail AND S)
export const LTZ = L8.LTZ; // Z-only top reads: k=0 col1, k=1 col2, k=2,3 col3
export const SG = L8.SG; // S mirrors: SG(0) = the NOT-S coil gates, SG(1) = the LTS coil gates
export const ZG = L8.ZG; // Z mirrors: ZG(0,1) = NOT-Z coil gates, ZG(2,3) = LTZ gates + the Z bound
// 3b-3c — UP-transition legality: the ring's clock feed conducts through
// a check network instead of a plain wire. The energized MASTER (one-hot:
// the current state's successor, sampled while the clock is low) names
// the TARGET state, so each transition is one M-contact fanning to
// one-hot pos branches whose series NC hops check the target footprint's
// NEW cells (covered cells can't be stored). An illegal UP just never
// raises the clock — no return path, the ring holds. Invalid positions
// have no branch at all, which is the bounds refusal for free.
// 3b-4a — the ring grows to NINE states: L1, J1, T1 append after Z (the
// upright 3-wide-bottom forms; the overhang trio L2/J2/T2 is 4b). state
// geometry: 6 L1 B={p..p+2} T={p}; 7 J1 B=triple T={p+2}; 8 T1 B=triple
// T={p+1}; all range pos {0,1}. their five rail memberships (WIDM,
// VMODE, STAG, WID3, NS-cut) are IDENTICAL, so one TRP rail (=L1|J1|T1)
// feeds them all. steering while a triple is selected is NS-CUT off
// entirely (the legality trees don't know 3-wide yet — 4b re-classes
// them; position first, then reshape: the transition network gates the
// entry at pos {0,1} and reads the delta cells).
export const NSTATES = 12; // ring states (the page's cycle length)
// the shape set — geometry per ring state as (bottom offset/width, top
// offset/width): the bottom row sits at register position p+bOff, the
// top at p+tOff. Order MUST match the ring (the L/J/T triples appended
// in 3b-4a, their 180-degree overhang forms in 3b-4c). SINGLE SOURCE OF
// TRUTH: the page renders from it and the wider-well emitter derives
// its step/reshape check tables from it (_notes/wider-well.md).
export const SHAPES = [
  { label: '1x1', bOff: 0, bW: 1, tOff: 0, tW: 0 },
  { label: '2 wide', bOff: 0, bW: 2, tOff: 0, tW: 0 },
  { label: '2 tall', bOff: 0, bW: 1, tOff: 0, tW: 1 },
  { label: '2x2 square', bOff: 0, bW: 2, tOff: 0, tW: 2 },
  { label: 'S', bOff: 0, bW: 2, tOff: -1, tW: 2 },
  { label: 'Z', bOff: 0, bW: 2, tOff: 1, tW: 2 },
  { label: 'L', bOff: 0, bW: 3, tOff: 0, tW: 1 },
  { label: 'J', bOff: 0, bW: 3, tOff: 2, tW: 1 },
  { label: 'T', bOff: 0, bW: 3, tOff: 1, tW: 1 },
  { label: 'L flip', bOff: 2, bW: 1, tOff: 0, tW: 3 },
  { label: 'J flip', bOff: 0, bW: 1, tOff: 0, tW: 3 },
  { label: 'T flip', bOff: 1, bW: 1, tOff: 0, tW: 3 },
] as const;
if (SHAPES.length !== NSTATES) throw new Error('SHAPES must mirror the ring');
// legal register positions for a shape at a given width (both rows fit)
export const shapeRange = (s: (typeof SHAPES)[number], cols: number) => ({
  min: Math.max(0, -s.bOff, s.tW > 0 ? -s.tOff : 0),
  max: Math.min(cols - s.bOff - s.bW, s.tW > 0 ? cols - s.tOff - s.tW : cols),
});
export const SHR2 = L8.SHR2; // states 6..8: clk, master, slave (415..423)
export const MMIR2 = L8.MMIR2; // into-6..8 transition gates (424..426)
// POSM5 set map (7 pos0 + 7 pos1 uses): k=0 B-fan PIECE(2) + T-fan L1;
// k=1 T-fan J1 + T1; k=2 into-6 p0 + into-7 p0; k=3 into-8 p0 + spare;
// k=4..7 the same roles at pos1.
export const POSM5 = L8.POSM5; // pos mirrors: k=0..3 pos0, k=4..7 pos1 (427..434)
export const UTR2 = L8.UTR2; // more top-rail reads: k=0 col0, k=1 col1, k=2 col2 (435..437)
export const TRP = L8.TRP; // the triple rail: L1|J1|T1
export const TRPM = L8.TRPM; // TRP mirrors (439..440)
export const L1M = L8.L1M; // L1 state mirrors (441..442)
export const J1M = L8.J1M; // J1 state mirrors (443..444)
export const T1M = L8.T1M; // T1 state mirrors (445..446)
export const WID3M = L8.WID3M; // "the bottom grows a third column": the offset-2 taps' gate
// 3b-4b — TRIPLE STEERING: the legality trees re-class per top geometry
// and the NS cut dies. the gate generalization: LEGINVT's checks are
// correct for {sym, S, L1} (their target top CONTAINS the checked
// column) -> its coil gate becomes NOT-(Z|J1|T1); LEGINVT2's are correct
// for {sym-wide, Z, T1} -> NOT-(S|L1|J1). T1's RIGHT step is fully
// covered by the existing point-2 check for free; the rest ride as
// state-gated series hops (LTJ/LTT top reads, LTB3 the triple bottom's
// entering col 3), plus TRPBND (a triple cannot right-step into pos 2).
// left-into-2 keeps no triple legs: a triple is never at pos 3.
export const ZJT = L8.ZJT; // gate coil: Z|J1|T1 (feeds ZG(0,1), the NOT gates on LEGINVT)
export const SLJ = L8.SLJ; // gate coil: S|L1|J1 (feeds SG(0), the NOT gate on LEGINVT2)
export const ZM2 = L8.ZM2; // one more Z mirror (ZJT's Z contact)
export const SM2 = L8.SM2; // one more S mirror (SLJ's S contact)
export const J1M2 = L8.J1M2, J1M3 = L8.J1M3; // more J1 mirrors: gate feeds + the LTJ coil gates
export const T1M2 = L8.T1M2; // more T1 contacts: the LTT coil gates
export const LTJ = L8.LTJ; // J1-only top reads: k=0 col2, k=1 col3
export const LTT = L8.LTT; // T1-only top reads: k=0 col1, k=1 col2
export const LTB3 = L8.LTB3; // triple-only bottom read of col 3 (the right step's entering column)
// 3b-4c — the OVERHANG TRIO completes the 2-row box: 9 L2=(001,111)
// B={p+2}, 10 J2=(100,111) B={p}, 11 T2=(010,111) B={p+1}, all with the
// 3-wide TT top and range {0,1}. the base bottom column is CUT for
// L2/T2 (one BCUT contact ahead of the chained POSS arms — one-hot
// makes the shared net legal); L2's bottom rides the WID3 tap alone,
// T2's the WIDM tap alone, J2 keeps the plain base. the ungated bottom
// check LEGINV(c) FALSE-refuses L2/T2 (their target bottoms exclude
// column c), so three trees gain an OVR bypass changeover riding the
// same L2|T2 signal as the cut; their true bottoms read via LTOB
// (L2-gated c+2) and T2B (T2-gated c+1), the shared top via LTOT
// (TT-gated c+2 on the right step), and the pos-2 bound extends to TT.
// the into-0 wrap gains its first check: T2 -> 1x1 uncovers (tok, p).
export const SHR3 = L8.SHR3; // states 9..11 (460..468)
export const MMIR3 = L8.MMIR3; // into-9..11 gates (469..471)
export const TT = L8.TT; // the triple-TOP rail: L2|J2|T2
export const TTM = L8.TTM; // TT mirrors (473..477)
export const BCUT = L8.BCUT; // the base-column cut (coil = L2|T2); set2 + BCUTM = the OVR bypasses
export const BCUTM = L8.BCUTM;
export const L2M = L8.L2M; // L2 mirrors (480..482)
export const J2M = L8.J2M; // J2 mirror
export const T2M = L8.T2M; // T2 mirrors (484..486)
export const LTOT = L8.LTOT; // TT-gated top read of col 3 (right-step entering top)
export const LTOB = L8.LTOB; // L2-gated bottom reads: k=0 col2, k=1 col3
export const T2B = L8.T2B; // T2-gated bottom reads: k=0 col1, k=1 col2
export const UTR3 = L8.UTR3; // one more top-col3 read (the T1->L2 transition)
export const LEGB3 = L8.LEGB3; // more bottom reads: k=0 col1, k=1 col2, k=2 col0
export const POSM6 = L8.POSM6; // pos mirrors: k=0..2 pos0, k=3..5 pos1 (496..501)
// 3b-5 — THE MACHINE TICKS ITSELF: a two-relay slow-release oscillator
// on real capacitors. TOSC's coil parallels a paralleled cap bank and is
// fed through TDRV's NC; TDRV is fed through TOSC's NO; TDRV's second
// set bridges + onto the tick net exactly as the tick slide's closure
// does (compatibility-OR — the slide still works). The cycle under
// stepTime: the supply recharges the bank in one backward-Euler step,
// TOSC+TDRV latch up (tick HIGH) while the bank drains through the coil,
// dropout breaks the pair and the transition solve BUZZES (the armature
// flap chatter-pins both down — a real relay oscillator buzzes; the game
// machinery is chatter-tolerant, device-verified class) leaving one
// clean tick-LOW step, then the recharge refires. AUTO = the slide on
// TOSC's own section: the operator chooses self-play. Period: a few
// hundred ms with four paralleled sections at 100ms steps (measured in
// the oscillator test; more sections or larger steps slow it further).
export const TOSC = L8.TOSC; // the timing relay (coil || cap bank)
export const TDRV = L8.TDRV; // the driver: follows TOSC, its set2 drives the tick net
export const MMIR = L8.MMIR; // master mirrors: gate the into-state-i branch (393..398)
export const POSM4 = L8.POSM4; // pos mirrors for the branches: k=0 pos0, k=1,2 pos1, k=3,4 pos2, k=5 pos3 (399..404)
// (POSM4(5) exists because NOTHING on POSM(3) was borrowable: its L arm
// IS the right-press sample bus and its K is the edge self-loop — tying
// a check node there let a join backfeed fire the D-tap trees and wipe
// the register to [1,1,1,1], caught by the ring walk test mid-build)
export const LEGB2 = L8.LEGB2; // second bottom-rail reads for cols 1,2,3 (405..407)
export const UTR = L8.UTR; // top-rail reads: k=0 col0, k=1,2 col1, k=3,4 col2, k=5,6 col3 (408..414)
// (re-homing on the spawn tick would flip the register mid-tick under a
// merged spawn+lock; the reset tick is stable long before any spawn)

// the LEFT/RIGHT buttons and the WID slide live on a DEDICATED machine —
// the one past the last relay machine, which therefore has every jack
// free. (They lived on m40 through the piece rung, sharing sections with
// relays whose + jacks HAPPENED to be unused; the 12-row layout landed
// TWIN's + on the shared section and the capacity auditor caught it.)
export const LEFTBTN = { button: 3, machine: L8.btnMachine };
export const RIGHTBTN = { button: 4, machine: L8.btnMachine };
export const UPBTN = { button: 2, machine: L8.btnMachine }; // steps the shape ring (press+release = one step)
export const WIDSLIDE = { slide: 5, machine: L8.btnMachine };
export const MACHINES = L8.machines; // the default build: the relay machines + the dedicated button machine

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
  cols: number;
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
  PIECET: (j: number) => number; CUTC5: number; CUTC6: number; STAGM: number; CUTB1: number; CUTB2: number; CUTB3: number; CUTB4: number; CUTBD: number;
  LEGB: (j: number) => number; STAGM2: number;
  SHR: (i: number, part: number) => number; UPM: number; SHBOOT: number;
  SM: (k: number) => number; ZM: (k: number) => number;
  OM: number; I2TM: number; I2WM: number;
  POSM3: (k: number) => number;
  LTS: (k: number) => number; LTZ: (k: number) => number;
  SG: (k: number) => number; ZG: (k: number) => number;
  MMIR: (i: number) => number; POSM4: (k: number) => number;
  LEGB2: (k: number) => number; UTR: (k: number) => number;
  SHR2: (i: number, part: number) => number;
  MMIR2: (i: number) => number; POSM5: (k: number) => number; UTR2: (k: number) => number;
  TRP: number; TRPM: (k: number) => number;
  L1M: (k: number) => number; J1M: (k: number) => number; T1M: (k: number) => number;
  WID3M: number;
  ZJT: number; SLJ: number; ZM2: number; SM2: number;
  J1M2: number; J1M3: number; T1M2: number;
  LTJ: (k: number) => number; LTT: (k: number) => number; LTB3: number;
  SHR3: (i: number, part: number) => number; MMIR3: (i: number) => number;
  TT: number; TTM: (k: number) => number; BCUT: number; BCUTM: number;
  L2M: (k: number) => number; J2M: number; T2M: (k: number) => number;
  LTOT: number; LTOB: (k: number) => number; T2B: (k: number) => number;
  UTR3: number; LEGB3: (k: number) => number; POSM6: (k: number) => number;
  TOSC: number; TDRV: number;
  btnMachine: number; // the dedicated (relay-free) button/slide machine
  machines: number;
  relays: number; // wired coils (the junction gap is com-only)
}

export function tetrisLayout(rows: number, cols = 4): TetrisLayout {
  if (rows < 4 || rows % 2 !== 0) throw new Error('rows must be even and >= 4');
  // the second parameterization axis (see _notes/wider-well.md). the
  // mechanical loops below already flow from this value; the column-CLASS
  // sites (POSM4/5/6 maps, per-state bound contacts, the D-tap tree
  // shapes, mirror/cut/rail COUNTS) are still hand-laid for 4 — the fence
  // comes down subsystem by subsystem as each class map is derived.
  if (cols !== 4) throw new Error('cols !== 4 needs the class derivations (wider-well phase C)');
  let n = 0;
  const take = (k: number) => {
    const a = n;
    n += k;
    return a;
  };
  const aBase = take(4);
  // W per row: gates + breakers, one contact SET per column, two sets per
  // relay -> 2*ceil(cols/2) relays (== cols when even; the fence holds 4)
  const wBase = take(rows * cols);
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
  const stagBase = take(17); // PIECET x4, CUTC5/6, STAGM, CUTB1..4, CUTBD, LEGB x4, STAGM2
  const shrBase = take(20); // the shape ring: 6 states x (clk, master, slave) + UPM + SHBOOT
  const smBase = take(15); // state mirrors SM x4, ZM x4, OM, I2TM, I2WM + POSM3 x4
  const ltBase = take(12); // 3b-3b: LTS x2, LTZ x4, SG x2, ZG x4
  const upcBase = take(22); // 3b-3c: MMIR x6, POSM4 x6, LEGB2 x3, UTR x7
  const shr2Base = take(9); // 3b-4a: states 6..8 (L1, J1, T1) x (clk, master, slave)
  const g4Base = take(24); // MMIR2 x3, POSM5 x8, UTR2 x3, TRP + TRPM x2, L1M/J1M/T1M x6, WID3M
  const g4bBase = take(12); // 3b-4b: ZJT, SLJ, ZM2, SM2, J1M2/3, T1M2, LTJ x2, LTT x2, LTB3
  const shr3Base = take(9); // 3b-4c: states 9..11 (L2, J2, T2)
  const g4cBase = take(33); // MMIR3 x3, TT+TTM x6, BCUT x2, L2M x3, J2M, T2M x3, LTOT, LTOB x2, T2B x2, UTR3, LEGB3 x3, POSM6 x6
  const oscBase = take(2); // 3b-5: TOSC, TDRV (the self-tick oscillator)
  return {
    rows,
    cols,
    A0: aBase, A0m: aBase + 1, A1: aBase + 2, A2: aBase + 3,
    W: (r, k) => wBase + cols * r + k,
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
    PIECET: j => stagBase + j, CUTC5: stagBase + 4, CUTC6: stagBase + 5, STAGM: stagBase + 6, CUTB1: stagBase + 7, CUTB2: stagBase + 8, CUTB3: stagBase + 9, CUTB4: stagBase + 10, CUTBD: stagBase + 11,
    LEGB: j => stagBase + 12 + j, STAGM2: stagBase + 16,
    SHR: (i, part) => shrBase + 3 * i + part, UPM: shrBase + 18, SHBOOT: shrBase + 19,
    SM: k => smBase + k, ZM: k => smBase + 4 + k,
    OM: smBase + 8, I2TM: smBase + 9, I2WM: smBase + 10,
    POSM3: k => smBase + 11 + k,
    LTS: k => ltBase + k, LTZ: k => ltBase + 2 + k,
    SG: k => ltBase + 6 + k, ZG: k => ltBase + 8 + k,
    MMIR: i => upcBase + i, POSM4: k => upcBase + 6 + k,
    LEGB2: k => upcBase + 12 + k, UTR: k => upcBase + 15 + k,
    SHR2: (i, part) => shr2Base + 3 * (i - 6) + part,
    MMIR2: i => g4Base + (i - 6), POSM5: k => g4Base + 3 + k, UTR2: k => g4Base + 11 + k,
    TRP: g4Base + 14, TRPM: k => g4Base + 15 + k,
    L1M: k => g4Base + 17 + k, J1M: k => g4Base + 19 + k, T1M: k => g4Base + 21 + k,
    WID3M: g4Base + 23,
    ZJT: g4bBase, SLJ: g4bBase + 1, ZM2: g4bBase + 2, SM2: g4bBase + 3,
    J1M2: g4bBase + 4, J1M3: g4bBase + 5, T1M2: g4bBase + 6,
    LTJ: k => g4bBase + 7 + k, LTT: k => g4bBase + 9 + k, LTB3: g4bBase + 11,
    SHR3: (i, part) => shr3Base + 3 * (i - 9) + part,
    MMIR3: i => g4cBase + (i - 9),
    TT: g4cBase + 3, TTM: k => g4cBase + 4 + k,
    BCUT: g4cBase + 9, BCUTM: g4cBase + 10,
    L2M: k => g4cBase + 11 + k, J2M: g4cBase + 14, T2M: k => g4cBase + 15 + k,
    LTOT: g4cBase + 18, LTOB: k => g4cBase + 19 + k, T2B: k => g4cBase + 21 + k,
    UTR3: g4cBase + 23, LEGB3: k => g4cBase + 24 + k, POSM6: k => g4cBase + 27 + k,
    TOSC: oscBase, TDRV: oscBase + 1,
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
  for (let j = 0; j < 4; j++) claim('PIECET', PIECET(j));
  claim('CUTC5/6/STAGM/CUTB', CUTC5, CUTC6, STAGM, CUTB1, CUTB2, CUTB3, CUTB4, CUTBD);
  for (let j = 0; j < 4; j++) claim('LEGB', LEGB(j));
  claim('STAGM2', STAGM2);
  for (let i = 0; i < 6; i++) claim('SHR', SHR(i, 0), SHR(i, 1), SHR(i, 2));
  claim('UPM/SHBOOT', UPM, SHBOOT);
  for (let k = 0; k < 4; k++) claim('SM', SM(k));
  for (let k = 0; k < 4; k++) claim('ZM', ZM(k));
  claim('OM/I2TM/I2WM', OM, I2TM, I2WM);
  for (let k = 0; k < 4; k++) claim('POSM3', POSM3(k));
  claim('LTS', LTS(0), LTS(1));
  for (let k = 0; k < 4; k++) claim('LTZ', LTZ(k));
  claim('SG/ZG', SG(0), SG(1), ZG(0), ZG(1), ZG(2), ZG(3));
  for (let i = 0; i < 6; i++) claim('MMIR', MMIR(i));
  for (let k = 0; k < 6; k++) claim('POSM4', POSM4(k));
  claim('LEGB2', LEGB2(0), LEGB2(1), LEGB2(2));
  for (let k = 0; k < 7; k++) claim('UTR', UTR(k));
  for (let i = 6; i < 9; i++) claim('SHR2', SHR2(i, 0), SHR2(i, 1), SHR2(i, 2));
  claim('MMIR2', MMIR2(6), MMIR2(7), MMIR2(8));
  for (let k = 0; k < 8; k++) claim('POSM5', POSM5(k));
  claim('UTR2', UTR2(0), UTR2(1), UTR2(2));
  claim('TRP/TRPM', TRP, TRPM(0), TRPM(1));
  claim('L1M/J1M/T1M', L1M(0), L1M(1), J1M(0), J1M(1), T1M(0), T1M(1));
  claim('WID3M', WID3M);
  claim('ZJT/SLJ/mirrors', ZJT, SLJ, ZM2, SM2, J1M2, J1M3, T1M2);
  claim('LTJ/LTT/LTB3', LTJ(0), LTJ(1), LTT(0), LTT(1), LTB3);
  for (let i = 9; i < 12; i++) claim('SHR3', SHR3(i, 0), SHR3(i, 1), SHR3(i, 2));
  claim('MMIR3', MMIR3(9), MMIR3(10), MMIR3(11));
  claim('TT/TTM', TT, TTM(0), TTM(1), TTM(2), TTM(3), TTM(4));
  claim('BCUT', BCUT, BCUTM);
  claim('overhang mirrors', L2M(0), L2M(1), L2M(2), J2M, T2M(0), T2M(1), T2M(2));
  claim('overhang reads', LTOT, LTOB(0), LTOB(1), T2B(0), T2B(1), UTR3);
  claim('LEGB3', LEGB3(0), LEGB3(1), LEGB3(2));
  for (let k = 0; k < 6; k++) claim('POSM6', POSM6(k));
  claim('TOSC/TDRV', TOSC, TDRV);

}

export function tetrisCircuit(rows = 8, cols = 4): {
  wires: string[];
  rails: string[][]; // data rail j -> its chained groups
  layout: TetrisLayout; // this build's index map (== the exports at rows=8)
  btnMachine: number; // LEFT/RIGHT buttons + WID slide live here (m40 classic)
} {
  const L = tetrisLayout(rows, cols);
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
    MIRCT, LEGINVT, LEGINVT2, VMODEM, GOM, GAMEOVER, LKM2, SCR, SCBOOT, PIECET, CUTC5, CUTC6, STAGM, CUTB1, CUTB2, CUTB3, CUTB4, CUTBD, LEGB, STAGM2,
    SHR, UPM, SHBOOT, SM, ZM, OM, I2TM, I2WM, POSM3,
    LTS, LTZ, SG, ZG,
    MMIR, POSM4, LEGB2, UTR,
    SHR2, MMIR2, POSM5, UTR2, TRP, TRPM, L1M, J1M, T1M, WID3M,
    ZJT, SLJ, ZM2, SM2, J1M2, J1M3, T1M2, LTJ, LTT, LTB3,
    SHR3, MMIR3, TT, TTM, BCUT, BCUTM, L2M, J2M, T2M,
    LTOT, LTOB, T2B, UTR3, LEGB3, POSM6,
    TOSC, TDRV,
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

  const dataRails = Array.from({ length: cols }, () => takeGroups(grown(6, 2))); // 6: 21 taps/rail at 8 rows since the T bank joined
  const railJack = (j: number, hole: number) => dataRails[j][Math.floor(hole / 4)];
  // chain each rail's groups (each link burns one hole on both sides, so a
  // group offers 4 fresh holes; railJack spreads consumers accordingly)
  for (const g of dataRails) for (let i = 1; i < g.length; i++) w.push(`${g[i - 1]}/${g[i]}`);
  const railUse: number[] = Array(cols).fill(0);
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
  const nGates = Math.ceil(cols / 2); // W(r, 0..nGates-1) gates, then breakers
  for (let r = 0; r < rows; r++) {
    const comA = comOf(W(r, 0));
    const comB = comOf(W(r, nGates));
    // the 3-bit operator-write decoder addresses 8 rows; on a taller well
    // the deep rows are game-writable only (locks fire W via the MIRA
    // triggers, not the decoder)
    if (r < 8) w.push(`${sel[r]}/${comA}`);
    for (let k = 0; k < 2 * nGates; k++) {
      const src = k < nGates ? comA : comB;
      w.push(`${src}/${R(W(r, k), 'E')}`, `${R(W(r, k), 'F')}/${minusOf(W(r, k))}`);
    }
    for (let j = 0; j < cols; j++) {
      const c = CELL(r, j);
      const [arm, no, nc] = j % 2 === 0 ? ['H', 'G', 'J'] : ['L', 'K', 'N'];
      const g = W(r, Math.floor(j / 2));
      w.push(`${tapRail(j)}/${R(g, arm)}`, `${R(g, no)}/${comOf(c)}`); // data gate
      // the breaker contact serves BOTH cell-private paths with one arm:
      // NC = the hold (idle), NO = the lock readback (press) — the cell's
      // own + through its own contact onto its own rail. Any SHARED readback
      // rail bridges the write rails through a stacked row's ON cells (two
      // drafts of this file died to exactly that, one row down and one up).
      const b = W(r, nGates + Math.floor(j / 2));
      w.push(`${plusOf(c)}/${R(b, arm)}`, `${R(b, nc)}/${R(c, 'H')}`); // hold break
      w.push(`${R(b, no)}/${R(c, 'L')}`); // press-scoped readback feed
      w.push(`${R(c, 'G')}/${comOf(c)}`);
      w.push(`${comOf(c)}/${R(c, 'E')}`, `${R(c, 'F')}/${minusOf(c)}`);
    }
  }
  // operator data slides on m1 sections 1-4 (m1.5 is the tick slide and
  // m1.6 START, so columns past 4 have no operator slide — the game's own
  // writes cover them; phase C revisits if operator masks must widen)
  for (let j = 0; j < Math.min(cols, 4); j++) {
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
    for (let j = 0; j < cols; j++) {
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
    w.push(`${tap(railB0, b0Use)}/${R(MIRA(r), 'L')}`, `${R(MIRA(r), 'K')}/${comOf(W(r, nGates))}`);
    if (r < rows - 1) {
      // one contact set per column: MIRB carries columns 0-1, MIRB2 2-3
      // (a wider well needs more mirrors per row — phase C grows the bank)
      const mirs = [MIRB(r), MIRB2(r)];
      for (let j = 0; j < cols; j++) {
        const mr = mirs[Math.floor(j / 2)];
        const [arm, no] = j % 2 === 0 ? ['H', 'G'] : ['L', 'K'];
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
  for (let j = 0; j < cols; j++) {
    const p = PIECE(j);
    const cutc = [CUTC1, CUTC2][Math.floor(j / 2)]; // one cut set per column
    const cutb = [CUTB1, CUTB2][Math.floor(j / 2)]; // (phase C grows the banks)
    const [cArm, cNc] = j % 2 === 0 ? ['H', 'J'] : ['L', 'N'];
    const cutk = [CUTC3, CUTC4][Math.floor(j / 2)];
    // coils fed from the POS register (see the piece-register section) —
    // the per-column slides are gone; position is machine state now
    w.push(`${R(p, 'F')}/${minusOf(p)}`);
    // colFan -> CUTB (NC, opens during a STAGGERED phase 2: the closed B
    // gates would bridge the T-driven rails through colFan — the mirror
    // of the bottom-press leak) -> CUTC (NC, opens during collapses) ->
    w.push(`${colFan}/${R(cutb, cArm)}`, `${R(cutb, cNc)}/${R(cutc, cArm)}`, `${R(cutc, cNc)}/${R(p, 'H')}`);
    w.push(`${R(p, 'G')}/${tapRail(j)}`);
    const cutb2 = [CUTB3, CUTB4][Math.floor(j / 2)];
    w.push(`${tapRail(j)}/${R(p, 'L')}`, `${R(p, 'K')}/${R(cutb2, cArm)}`);
    w.push(`${R(cutb2, cNc)}/${R(cutk, cArm)}`, `${R(cutk, cNc)}/${collideNode}`);
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
  for (let j = 0; j < cols; j++) {
    w.push(`${tapRail(j)}/${R(LINE(j), 'E')}`, `${R(LINE(j), 'F')}/${minusOf(LINE(j))}`);
  }
  w.push(`${plusOf(RAILGATE2)}/${R(RAILGATE2, 'H')}`, `${R(RAILGATE2, 'G')}/${R(LINEDLY, 'E')}`);
  w.push(`${R(LINEDLY, 'F')}/${minusOf(LINEDLY)}`);
  w.push(`${plusOf(LINEDLY)}/${R(LINEDLY, 'H')}`, `${R(LINEDLY, 'G')}/${R(LINE(0), 'H')}`);
  for (let j = 1; j < cols - 1; j++) w.push(`${R(LINE(j - 1), 'G')}/${R(LINE(j), 'H')}`);
  // the chain fires CPSET, and CPSET's contact — sourcing from + — sets
  // CLEARP. Wiring the chain straight into CLEARP's com lets CLEARP's
  // +-armed latch backfeed rail A through the still-closed LINE contacts
  // after the release: the whole press state froze as one parasitic latch
  // (this file's line-clear debug trace caught the entire circuit at it=1).
  w.push(`${R(LINE(cols - 2), 'G')}/${R(LINE(cols - 1), 'H')}`, `${R(LINE(cols - 1), 'G')}/${comOf(CPSET)}`);
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
  // phase 2's column feed runs through STAGM's changeover: flat/symmetric
  // pieces keep the classic path (NC -> colFan, the B-mask gates — zero
  // behavior change with the STAG slide off); staggered pieces divert to
  // the T fan (NO -> colFanT, the PIECET gates)
  w.push(`${plusOf(P2COL)}/${R(P2COL, 'L')}`, `${R(P2COL, 'K')}/${R(STAGM, 'H')}`);
  w.push(`${R(STAGM, 'J')}/${colFan}`);
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
  // (3b-4a's NS-CUT lived here for one increment — 4b re-classed the
  // legality trees per top geometry, so triples steer like everyone)
  w.push(`${bm}.3+/${bm}.3Y`, `${bm}.3X/${R(LEFTM, 'E')}`);
  w.push(`${bm}.4+/${bm}.4Y`, `${bm}.4X/${R(RIGHTM, 'E')}`);
  w.push(`${R(LEFTM, 'F')}/${minusOf(LEFTM)}`, `${R(RIGHTM, 'F')}/${minusOf(RIGHTM)}`, `${R(ANYBM, 'F')}/${minusOf(ANYBM)}`);
  w.push(`${plusOf(LEFTM)}/${R(LEFTM, 'L')}`, `${R(LEFTM, 'K')}/${R(ANYBM, 'E')}`);
  w.push(`${plusOf(RIGHTM)}/${R(RIGHTM, 'L')}`, `${R(RIGHTM, 'K')}/${R(ANYBM, 'E')}`);
  w.push(`${R(ANYBM, 'L')}/${plusOf(ANYBM)}`, `${R(ANYBM, 'K')}/${R(ANYBM2, 'E')}`, `${R(ANYBM2, 'F')}/${minusOf(ANYBM2)}`);
  // direction chains: one gate contact, POSM arms daisy-chained behind it
  w.push(`${plusOf(LEFTM)}/${R(LEFTM, 'H')}`, `${R(LEFTM, 'G')}/${R(POSM(0), 'H')}`);
  w.push(`${plusOf(RIGHTM)}/${R(RIGHTM, 'H')}`, `${R(RIGHTM, 'G')}/${R(POSM(0), 'L')}`);
  for (let j = 1; j < cols; j++) {
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
  w.push(`${R(POSM(cols - 1), 'K')}/${comOf(POSA(cols - 1))}`); // right self-loop at the wall
  // (the gated taps for the six real moves are pushed in the legality
  // section, after the rails they route through exist)
  // masters: hold from mid-press through the release window (ANYBM2.G
  // chain — ANYBM2 outlives the buttons by one wave), transfer out through
  // TWIN.G's chain into the new slave's com, in the window only
  w.push(`${plusOf(ANYBM2)}/${R(ANYBM2, 'H')}`, `${R(ANYBM2, 'G')}/${R(POSA(0), 'L')}`);
  w.push(`${plusOf(TWIN)}/${R(TWIN, 'H')}`, `${R(TWIN, 'G')}/${R(POSA(0), 'H')}`);
  for (let j = 1; j < cols; j++) {
    w.push(`${R(POSA(j - 1), 'L')}/${R(POSA(j), 'L')}`);
    w.push(`${R(POSA(j - 1), 'H')}/${R(POSA(j), 'H')}`);
  }
  for (let j = 0; j < cols; j++) {
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
  w.push(`${R(POSA(cols - 1), 'L')}/${R(ANYBM, 'H')}`, `${R(ANYBM, 'J')}/${R(TWIN, 'E')}`, `${R(TWIN, 'F')}/${minusOf(TWIN)}`);
  // slaves: idle hold through TWIN's NC (closed except in the window) and
  // the POSRST spawn-reset breaks; set2 feeds the PIECE column coils (the
  // slides are gone)
  w.push(`${plusOf(TWIN)}/${R(TWIN, 'L')}`, `${R(TWIN, 'N')}/${R(POSRST(0), 'H')}`);
  w.push(`${R(POSRST(0), 'H')}/${R(POSRST(0), 'L')}`, `${R(POSRST(0), 'L')}/${R(POSRST(1), 'H')}`, `${R(POSRST(1), 'H')}/${R(POSRST(1), 'L')}`);
  // one NC per column: POSRST(0) covers 0-1, POSRST(1) 2-3 (phase C grows)
  for (let j = 0; j < cols; j++) {
    const rr = POSRST(Math.floor(j / 2));
    const nc = j % 2 === 0 ? 'J' : 'N';
    w.push(`${R(rr, nc)}/${R(POSS(j), 'H')}`, `${R(POSS(j), 'G')}/${comOf(POSS(j))}`);
    w.push(`${comOf(POSS(j))}/${R(POSS(j), 'E')}`, `${R(POSS(j), 'F')}/${minusOf(POSS(j))}`);
    w.push(`${comOf(POSS(j))}/${R(POSM(j), 'E')}`, `${R(POSM(j), 'F')}/${minusOf(POSM(j))}`);
    w.push(`${R(POSS(j), 'K')}/${R(PIECE(j), 'E')}`);
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
  // grown to 3 base groups in 3b-4b: LTB3 taps the col-3 rail (and the
  // uniform growth leaves room for the coming overhang forms)
  const legRails = Array.from({ length: cols }, () => takeGroups(grown(3, 1)));
  for (const lg of legRails) for (let i = 1; i < lg.length; i++) w.push(`${lg[i - 1]}/${lg[i]}`);
  const legUse = Array.from({ length: cols }, () => ({ n: 0 }));
  const legTap = (j: number) => tap(legRails[j], legUse[j]);
  for (let r = 0; r <= rows - 2; r++) {
    const feed0 = r === 0 ? comOf(MIRA(0)) : R(TOPW(r), 'E');
    w.push(`${feed0}/${R(MIRC(r, 0), 'E')}`, `${R(MIRC(r, 0), 'E')}/${R(MIRC(r, 1), 'E')}`);
    w.push(`${R(MIRC(r, 0), 'F')}/${minusOf(MIRC(r, 0))}`, `${R(MIRC(r, 1), 'F')}/${minusOf(MIRC(r, 1))}`);
    for (let j = 0; j < cols; j++) {
      const mr = MIRC(r, Math.floor(j / 2));
      const [arm, no] = j % 2 === 0 ? ['H', 'G'] : ['L', 'K'];
      w.push(`${comOf(CELL(r, j))}/${R(mr, arm)}`, `${R(mr, no)}/${legTap(j)}`);
    }
  }
  for (let j = 0; j < cols; j++) {
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
  // grown to 3 base groups in 3b-3b: the mode-gated coil feeds (NOT-Z /
  // NOT-S gates + the LTS/LTZ reads) add two taps per column
  const legTRails = Array.from({ length: cols }, () => takeGroups(grown(3, 1)));
  for (const lg of legTRails) for (let i = 1; i < lg.length; i++) w.push(`${lg[i - 1]}/${lg[i]}`);
  const legTUse = Array.from({ length: cols }, () => ({ n: 0 }));
  const legTTap = (j: number) => tap(legTRails[j], legTUse[j]);
  for (let r = 1; r <= rows - 2; r++) {
    w.push(`${R(MIRC(r, 1), 'E')}/${R(MIRCT(r, 0), 'E')}`, `${R(MIRCT(r, 0), 'E')}/${R(MIRCT(r, 1), 'E')}`);
    w.push(`${R(MIRCT(r, 0), 'F')}/${minusOf(MIRCT(r, 0))}`, `${R(MIRCT(r, 1), 'F')}/${minusOf(MIRCT(r, 1))}`);
    for (let j = 0; j < cols; j++) {
      const armPrev = j % 2 === 0 ? 'H' : 'L';
      const mt = MIRCT(r, Math.floor(j / 2));
      const [arm, no] = j % 2 === 0 ? ['H', 'G'] : ['L', 'K'];
      w.push(`${R(MIRC(r - 1, Math.floor(j / 2)), armPrev)}/${R(mt, arm)}`, `${R(mt, no)}/${legTTap(j)}`);
    }
  }
  // 3b-3b: the top-bank coils are MODE-GATED at the feed — LEGINVT
  // through a NOT-Z contact (its checks are correct for symmetric AND S:
  // S's target top set {c-1,c} contains c; false only for Z) and
  // LEGINVT2 through a NOT-S contact (correct for symmetric AND Z). A
  // gated-off coil is dead and its NC contacts pass the sample through,
  // so the tree shapes below stay EXACTLY as they were. Legacy slide-
  // staggered mode (STAG up, no ring state) keeps the old symmetric
  // checks, unchanged.
  for (let j = 0; j < cols; j++) {
    const zg = ZG(Math.floor(j / 2));
    const [zArm, zNc] = j % 2 === 0 ? ['H', 'J'] : ['L', 'N'];
    w.push(`${legTTap(j)}/${R(zg, zArm)}`, `${R(zg, zNc)}/${R(LEGINVT(j), 'E')}`);
    w.push(`${R(LEGINVT(j), 'F')}/${minusOf(LEGINVT(j))}`);
  }
  w.push(`${legTTap(2)}/${R(SG(0), 'H')}`, `${R(SG(0), 'J')}/${R(LEGINVT2(2), 'E')}`, `${R(LEGINVT2(2), 'F')}/${minusOf(LEGINVT2(2))}`);
  w.push(`${legTTap(3)}/${R(SG(0), 'L')}`, `${R(SG(0), 'N')}/${R(LEGINVT2(3), 'E')}`, `${R(LEGINVT2(3), 'F')}/${minusOf(LEGINVT2(3))}`);
  // vmode mirrors for the tall forks (VMODE's own spare set can't serve
  // six tap trees); coils daisy-chained through the coil jacks
  // ...as the first allocator-managed bank (wider-well emitter 0 pilot):
  // the bank mints the same chain lazily; requests below arrive in the
  // hand-laid order, so the set map is unchanged (wire-multiset gate).
  // NOTE the chain tail stays a splice point: the ring-state union
  // enters at VMODEM(cols-1).E's free hole (the 3b-4a/4c splices).
  const vmBank = new MirrorBank({
    name: 'VMODEM', source: VMODE, base: VMODEM(0), capacity: cols, w, R, minusOf,
  });

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
  // return groups grown in 3b-3b (the mode hops add refusal throws; the
  // old hand-split 1/2/2 chains overflowed the moment they grew) and
  // again in 3b-4b (the triple legs): a uniform tap allocator
  const retNode = [takeGroups(3), takeGroups(5), takeGroups(4)];
  for (const g of retNode) for (let i = 1; i < g.length; i++) w.push(`${g[i - 1]}/${g[i]}`);
  const retUse = [{ n: 0 }, { n: 0 }, { n: 0 }];
  const retTap = (p: number) => tap(retNode[p], retUse[p]);
  w.push(`${retTap(0)}/${R(POSA(0), 'E')}`);
  w.push(`${retTap(1)}/${R(POSA(1), 'E')}`);
  w.push(`${retTap(2)}/${R(POSA(2), 'E')}`);
  for (const c of [1, 2] as const) {
    const tf = vmBank.request('changeover'); // the tall fork
    const tw = vmBank.request('changeover'); // the tall-wide fork
    const [wArm, wNc, wNo] = c === 1 ? ['H', 'J', 'G'] : ['L', 'N', 'K'];
    if (c === 1) {
      // 3b-4c: the OVR bypass — LEGINV(c) false-refuses L2/T2 (their
      // target bottoms exclude column c), so the overhang states route
      // AROUND the bottom check straight to the tall fork; their true
      // bottom columns read as gated hops further down
      w.push(`${R(POSM(0), 'K')}/${R(BCUTM, 'H')}`);
      w.push(`${R(BCUTM, 'J')}/${R(LEGINV(1), 'H')}`);
      w.push(`${R(BCUTM, 'G')}/${R(tf.relay, tf.arm)}`); // overhang: skip to the fork
    } else {
      w.push(`${R(POSM(c - 1), 'K')}/${R(LEGINV(c), 'H')}`); // the tap in
    }
    w.push(`${R(LEGINV(c), 'G')}/${retTap(c - 1)}`); // bottom-c occupied
    w.push(`${R(LEGINV(c), 'J')}/${R(tf.relay, tf.arm)}`); // free: the tall fork
    w.push(`${R(tf.relay, tf.no)}/${R(LEGINVT(c), 'H')}`); // tall: check top-c
    w.push(`${R(LEGINVT(c), 'G')}/${retTap(c - 1)}`); // top-c occupied
    // 3b-3b: S's extra top column (c-1) rides IN SERIES — under any other
    // mode the LTS coil is dead and its NC passes through. For c=2 the Z
    // BOUND follows: Z cannot enter pos 2, so ZG(3)'s NO (closed iff the
    // Z state is up) returns the sample unconditionally.
    if (c === 1) {
      w.push(`${R(LEGINVT(1), 'J')}/${R(LTS(0), 'H')}`);
      w.push(`${R(LTS(0), 'G')}/${retTap(0)}`); // S: top-0 occupied
      // 3b-4b: J1's stem target (top col 3) and the triple bottom's
      // entering column (bottom col 3) ride behind the S hop; T1's
      // target (top col 2) is the existing point-2 check, for free
      w.push(`${R(LTS(0), 'J')}/${R(LTJ(1), 'H')}`);
      w.push(`${R(LTJ(1), 'G')}/${retTap(0)}`); // J1: top-3 occupied
      w.push(`${R(LTJ(1), 'J')}/${R(LTB3, 'H')}`);
      w.push(`${R(LTB3, 'G')}/${retTap(0)}`); // triple: bottom-3 occupied
      // 3b-4c: the overhangs' entering top col 3 (TT-gated) and L2's
      // entering bottom col 3 (T2's rides the wide fork's existing check)
      w.push(`${R(LTB3, 'J')}/${R(LTOT, 'H')}`);
      w.push(`${R(LTOT, 'G')}/${retTap(0)}`); // TT: top-3 occupied
      w.push(`${R(LTOT, 'J')}/${R(LTOB(1), 'H')}`);
      w.push(`${R(LTOB(1), 'G')}/${retTap(0)}`); // L2: bottom-3 occupied
      w.push(`${R(LTOB(1), 'J')}/${R(tf.relay, tf.nc)}`); // free: join X
    } else {
      w.push(`${R(LEGINVT(2), 'J')}/${R(LTS(1), 'H')}`);
      w.push(`${R(LTS(1), 'G')}/${retTap(1)}`); // S: top-1 occupied
      w.push(`${R(LTS(1), 'J')}/${R(ZG(3), 'L')}`);
      w.push(`${R(ZG(3), 'K')}/${retTap(1)}`); // the Z bound: refuse
      // 3b-4b/4c: the triple bounds — neither a 3-wide bottom (TRP) nor
      // a 3-wide top (TT) can enter pos 2
      w.push(`${R(ZG(3), 'N')}/${R(TRPM(1), 'L')}`);
      w.push(`${R(TRPM(1), 'K')}/${retTap(1)}`);
      w.push(`${R(TRPM(1), 'N')}/${R(TTM(4), 'L')}`);
      w.push(`${R(TTM(4), 'K')}/${retTap(1)}`);
      w.push(`${R(TTM(4), 'N')}/${R(tf.relay, tf.nc)}`); // free: join X
    }
    w.push(`${R(tf.relay, tf.nc)}/${R(WIDM3, wArm)}`); // X: the wide fork
    w.push(`${R(WIDM3, wNc)}/${comOf(POSA(c))}`); // narrow: step
    w.push(`${R(WIDM3, wNo)}/${R(LEGINV2(c + 1), 'H')}`); // wide: bottom-c+1
    w.push(`${R(LEGINV2(c + 1), 'G')}/${retTap(c - 1)}`); // occupied
    w.push(`${R(LEGINV2(c + 1), 'J')}/${R(tw.relay, tw.arm)}`); // free: tall fork #2
    w.push(`${R(tw.relay, tw.nc)}/${R(WIDM3, wNc)}`); // flat-wide: join the step wire
    w.push(`${R(tw.relay, tw.no)}/${R(LEGINVT2(c + 1), 'H')}`); // tall-wide: top-c+1
    w.push(`${R(LEGINVT2(c + 1), 'G')}/${retTap(c - 1)}`); // occupied
    // 3b-3b: Z's extra top column (c+2) — only c=1 has one on the board
    // (c=2's Z was already returned by the bound at point 1)
    if (c === 1) {
      w.push(`${R(LEGINVT2(2), 'J')}/${R(LTZ(2), 'H')}`);
      w.push(`${R(LTZ(2), 'G')}/${retTap(0)}`); // Z: top-3 occupied
      w.push(`${R(LTZ(2), 'J')}/${R(tw.relay, tw.nc)}`); // free: join
    } else {
      w.push(`${R(LEGINVT2(3), 'J')}/${R(tw.relay, tw.nc)}`); // free: join
    }
  }
  const wallTf = vmBank.request('changeover'); // VMODEM(2).set1, hand order
  w.push(`${R(POSM(2), 'K')}/${R(LEGINV(3), 'H')}`);
  w.push(`${R(LEGINV(3), 'G')}/${retTap(2)}`); // bottom-3 occupied
  w.push(`${R(LEGINV(3), 'J')}/${R(wallTf.relay, wallTf.arm)}`); // free: the tall fork
  w.push(`${R(wallTf.relay, wallTf.no)}/${R(LEGINVT(3), 'H')}`); // tall: top-3
  w.push(`${R(LEGINVT(3), 'G')}/${retTap(2)}`); // occupied
  w.push(`${R(LEGINVT(3), 'J')}/${R(wallTf.relay, wallTf.nc)}`); // free: join
  w.push(`${R(wallTf.relay, wallTf.nc)}/${R(WIDM4, 'H')}`); // the wall gate
  w.push(`${R(WIDM4, 'J')}/${comOf(POSA(3))}`); // narrow: step
  w.push(`${R(WIDM4, 'G')}/${retTap(2)}`); // wide: the wall, return
  // left taps: the tall fork sets — requested in the hand-laid order
  // (VMODEM(2).set2 into 0, then VMODEM(3)'s two sets into 1 and 2)
  const leftFork = [
    vmBank.request('changeover'), // into 0
    vmBank.request('changeover'), // into 1
    vmBank.request('changeover'), // into 2
  ];
  // 3b-3b: each left tree's tall path gains its mode hops in series after
  // the (NOT-Z-gated) symmetric check: the S bound (left into 0 is out of
  // S's fit range) or S's extra column c-1, then Z's true target columns
  // c+1 / c+2 (dead coils pass through; left into 2 clips c+2 = 4).
  for (const c of [0, 1, 2] as const) {
    const { relay: vm, arm: vArm, nc: vNc, no: vNo } = leftFork[c];
    if (c === 0) {
      // 3b-4c: the OVR bypass (see the right tree) — L2/T2 skip the
      // false bottom check; their true columns read further down
      w.push(`${R(POSM(1), 'G')}/${R(BCUT, 'L')}`);
      w.push(`${R(BCUT, 'N')}/${R(LEGINV(0), 'L')}`);
      w.push(`${R(BCUT, 'K')}/${R(vm, vArm)}`); // overhang: skip to the fork
    } else if (c === 1) {
      w.push(`${R(POSM(2), 'G')}/${R(BCUTM, 'L')}`);
      w.push(`${R(BCUTM, 'N')}/${R(LEGINV(1), 'L')}`);
      w.push(`${R(BCUTM, 'K')}/${R(vm, vArm)}`); // overhang: skip to the fork
    } else {
      w.push(`${R(POSM(c + 1), 'G')}/${R(LEGINV(c), 'L')}`); // the tap in
    }
    w.push(`${R(LEGINV(c), 'N')}/${R(vm, vArm)}`); // bottom free: tall fork
    w.push(`${R(vm, vNc)}/${comOf(POSA(c))}`); // flat: step
    w.push(`${R(vm, vNo)}/${R(LEGINVT(c), 'L')}`); // tall: top-c
    if (c === 0) {
      w.push(`${R(LEGINVT(0), 'N')}/${R(SM(3), 'L')}`);
      w.push(`${R(SM(3), 'K')}/${retTap(1)}`); // the S bound: refuse
      w.push(`${R(SM(3), 'N')}/${R(LTZ(0), 'H')}`);
      w.push(`${R(LTZ(0), 'G')}/${retTap(1)}`); // Z: top-1 occupied
      w.push(`${R(LTZ(0), 'J')}/${R(LTZ(1), 'H')}`);
      w.push(`${R(LTZ(1), 'G')}/${retTap(1)}`); // Z: top-2 occupied
      // 3b-4b: the triples' stem targets (T1 top-1, J1 top-2)
      w.push(`${R(LTZ(1), 'J')}/${R(LTT(0), 'H')}`);
      w.push(`${R(LTT(0), 'G')}/${retTap(1)}`); // T1: top-1 occupied
      w.push(`${R(LTT(0), 'J')}/${R(LTJ(0), 'H')}`);
      w.push(`${R(LTJ(0), 'G')}/${retTap(1)}`); // J1: top-2 occupied
      // 3b-4c: the overhangs' true bottoms (T2 col 1, L2 col 2)
      w.push(`${R(LTJ(0), 'J')}/${R(T2B(0), 'H')}`);
      w.push(`${R(T2B(0), 'G')}/${retTap(1)}`); // T2: bottom-1 occupied
      w.push(`${R(T2B(0), 'J')}/${R(LTOB(0), 'H')}`);
      w.push(`${R(LTOB(0), 'G')}/${retTap(1)}`); // L2: bottom-2 occupied
      w.push(`${R(LTOB(0), 'J')}/${R(vm, vNc)}`); // free: join the step wire
    } else if (c === 1) {
      w.push(`${R(LEGINVT(1), 'N')}/${R(LTS(0), 'L')}`);
      w.push(`${R(LTS(0), 'K')}/${retTap(2)}`); // S: top-0 occupied
      w.push(`${R(LTS(0), 'N')}/${R(LTZ(1), 'L')}`);
      w.push(`${R(LTZ(1), 'K')}/${retTap(2)}`); // Z: top-2 occupied
      w.push(`${R(LTZ(1), 'N')}/${R(LTZ(3), 'L')}`);
      w.push(`${R(LTZ(3), 'K')}/${retTap(2)}`); // Z: top-3 occupied
      // 3b-4b: the triples' stem targets (T1 top-2, J1 top-3)
      w.push(`${R(LTZ(3), 'N')}/${R(LTT(1), 'L')}`);
      w.push(`${R(LTT(1), 'K')}/${retTap(2)}`); // T1: top-2 occupied
      w.push(`${R(LTT(1), 'N')}/${R(LTJ(1), 'L')}`);
      w.push(`${R(LTJ(1), 'K')}/${retTap(2)}`); // J1: top-3 occupied
      // 3b-4c: the overhangs' true bottoms (T2 col 2, L2 col 3)
      w.push(`${R(LTJ(1), 'N')}/${R(T2B(1), 'L')}`);
      w.push(`${R(T2B(1), 'K')}/${retTap(2)}`); // T2: bottom-2 occupied
      w.push(`${R(T2B(1), 'N')}/${R(LTOB(1), 'L')}`);
      w.push(`${R(LTOB(1), 'K')}/${retTap(2)}`); // L2: bottom-3 occupied
      w.push(`${R(LTOB(1), 'N')}/${R(vm, vNc)}`); // free: join the step wire
    } else {
      w.push(`${R(LEGINVT(2), 'N')}/${R(LTS(1), 'L')}`);
      w.push(`${R(LTS(1), 'N')}/${R(LTZ(3), 'H')}`);
      w.push(`${R(LTZ(3), 'J')}/${R(vm, vNc)}`); // free: join the step wire
      // position 3 has no return group: the refusals chain jack-to-jack
      // into the master's coil (the LTS/LTZ NO throws join the chain)
      w.push(`${R(LEGINV(2), 'K')}/${R(LEGINVT(2), 'K')}`);
      w.push(`${R(LEGINVT(2), 'K')}/${R(LTS(1), 'K')}`);
      w.push(`${R(LTS(1), 'K')}/${R(LTZ(3), 'G')}`);
      w.push(`${R(LTZ(3), 'G')}/${R(POSA(3), 'E')}`);
    }
    if (c !== 2) {
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

    // ---------- staggered pieces (S/Z): the TOP-row mask bank ----------
  // PIECET(j) mirrors the TOPMASK slides (slides 1-4 on the dedicated
  // button machine — each section's slide is separate hardware from its
  // button). Phase 2's diverted feed (STAGM NO) powers colFanT, and each
  // T gate puts its column onto the SAME data rail the B gate would —
  // the write machinery downstream is untouched. The T fan conducts ONLY
  // during phase 2: CUTC5/6 are NORMALLY-OPEN gates whose coils ride the
  // phase-2 rail — outside that window the fan is severed on the FAN side
  // of every T gate. The first draft used lane-scoped NC cuts (the B
  // fan's CUTC pattern) and the audit caught a bottom-press leak: with a
  // column in BOTH masks, the press's + walked rail -> closed T gate ->
  // colFanT -> another closed T gate -> a top-only column's rail, and the
  // bottom write grew extra cells. Phase-2-scoped NO gates kill that AND
  // the collapse bridge in one move (the collapse never runs phase 2).
  // Collision and lateral legality still read the B mask only in this
  // increment: a staggered top cell can overhang stored content and the
  // phase-2 OR-write absorbs it (documented; the top collision term is
  // the next increment).
  const colFanT = takeGroups(1)[0];
  w.push(`${R(STAGM, 'G')}/${colFanT}`);
  const bmS = `m${btnMachine}`;
  w.push(`${bmS}.6+/${bmS}.6S`, `${bmS}.6T/${R(STAGM, 'E')}`, `${R(STAGM, 'F')}/${minusOf(STAGM)}`);
  // ...and the gate coils are phase-2 AND staggered (STAGM's spare set):
  // with STAG off, a raised TOPMASK slide must not connect the fan even
  // during a symmetric piece's phase 2
  // the cut coils ride ONE HOP behind the phase-2 rail (CUTBD): at the
  // release the raw-rail version re-closed the B fan a wave before the
  // write gates and the fresh top row's own READBACK died, and that one
  // wave wrote a phantom cell through the re-bridged rails (the trace
  // showed a clean mid-press field growing a cell on the release). One
  // hop later, everything the leak needs is already dead; on the press
  // the cuts still land the same eval as the first hot rail.
  w.push(`${tap(p2railA, p2aUse)}/${R(STAGM, 'L')}`, `${R(STAGM, 'K')}/${R(CUTBD, 'E')}`);
  w.push(`${R(CUTBD, 'F')}/${minusOf(CUTBD)}`);
  w.push(`${plusOf(CUTBD)}/${R(CUTBD, 'H')}`, `${R(CUTBD, 'G')}/${R(CUTC5, 'E')}`);
  w.push(`${R(CUTC5, 'E')}/${R(CUTC6, 'E')}`);
  w.push(`${R(CUTC6, 'E')}/${R(CUTB1, 'E')}`, `${R(CUTB1, 'E')}/${R(CUTB2, 'E')}`);
  w.push(`${R(CUTB2, 'E')}/${R(CUTB3, 'E')}`, `${R(CUTB3, 'E')}/${R(CUTB4, 'E')}`);
  w.push(`${R(CUTB3, 'F')}/${minusOf(CUTB3)}`, `${R(CUTB4, 'F')}/${minusOf(CUTB4)}`);
  w.push(`${R(CUTC5, 'F')}/${minusOf(CUTC5)}`, `${R(CUTC6, 'F')}/${minusOf(CUTC6)}`);
  w.push(`${R(CUTB1, 'F')}/${minusOf(CUTB1)}`, `${R(CUTB2, 'F')}/${minusOf(CUTB2)}`);
  for (let j = 0; j < cols; j++) {
    const pt = PIECET(j);
    w.push(`${bmS}.${j + 1}+/${bmS}.${j + 1}S`, `${bmS}.${j + 1}T/${R(pt, 'E')}`, `${R(pt, 'F')}/${minusOf(pt)}`);
    const cutc = [CUTC5, CUTC6][Math.floor(j / 2)]; // phase C grows the bank
    const [cArm, cNo] = j % 2 === 0 ? ['H', 'G'] : ['L', 'K'];
    w.push(`${colFanT}/${R(cutc, cArm)}`, `${R(cutc, cNo)}/${R(pt, 'H')}`);
    w.push(`${R(pt, 'G')}/${tapRail(j)}`);
  }

  // ---------- the top collision term (3b-2) ----------
  // A staggered notch (a TOPMASK column outside the B mask) must REST on
  // stored content instead of burying it: per column, a private +-fed
  // series branch PIECET(j) AND occupied(tokenRow, j) feeds collideNode
  // continuously — the same legitimate pre-arm the bottom collision uses
  // between ticks (COLLIDE's own J contact re-routes the next tick into
  // a lock). occupied() comes from LEGB mirrors, second reads of the
  // increment-2 legality rails (their own contacts are all changeover-
  // spent). The B-mask overlap term is unnecessary: gravity guarantees
  // piece cells never coincide with stored cells, so a bottom-mask column
  // can never read occupied at the token row. Branch pairs tie at the
  // LEGB output jacks to fit collideNode's hole budget; a backward walk
  // from the node dead-ends at + or an open contact in every state.
  // occupied() feeds per column — a CLASS map: 0,1 read LEGINV directly,
  // 2,3 the LEGINV2 parallel copies (LEGINV(2/3)'s sets are spent). phase
  // C re-derives which columns need copies at a wider well.
  const legbFeed = [R(LEGINV(0), 'E'), R(LEGINV(1), 'E'), R(LEGINV2(2), 'E'), R(LEGINV2(3), 'E')];
  for (let j = 0; j < cols; j++) {
    w.push(`${legbFeed[j]}/${R(LEGB(j), 'E')}`, `${R(LEGB(j), 'F')}/${minusOf(LEGB(j))}`);
    w.push(`${plusOf(PIECET(j))}/${R(PIECET(j), 'L')}`, `${R(PIECET(j), 'K')}/${R(LEGB(j), 'H')}`);
  }
  // branch outputs chain jack-to-jack and enter at COLLIDE's com (its one
  // spare hole — collideNode itself is full). Idle, the com connects to
  // the node through COLLIDEM2's NC and the + does reach the B-mask
  // rails through the closed taps — audited benign: the LINE chain's
  // feed is LINEDLY press-delayed (lit coils, unpowered chain), the
  // write gates are open, and every backward walk dead-ends at + or an
  // open contact. A press-scoped tap gate was tried first and BROKE the
  // bottom collision's between-ticks pre-arm, which runs through these
  // same taps (both staggered tests watched pieces fall through blocks).
  w.push(`${R(LEGB(0), 'G')}/${R(LEGB(1), 'G')}`, `${R(LEGB(1), 'G')}/${R(LEGB(2), 'G')}`);
  // ...and the whole term is scoped to STAGGERED MODE through STAGM2 (a
  // second STAG mirror — STAGM's sets are spent): with STAG off, raised
  // TOPMASK slides must be inert everywhere (a hostile-slide regression
  // caught the ungated term resting a symmetric piece mid-air)
  w.push(`${R(STAGM, 'E')}/${R(STAGM2, 'E')}`, `${R(STAGM2, 'F')}/${minusOf(STAGM2)}`);
  w.push(`${R(LEGB(2), 'G')}/${R(LEGB(3), 'G')}`, `${R(LEGB(3), 'G')}/${R(STAGM2, 'H')}`);
  w.push(`${R(STAGM2, 'G')}/${comOf(COLLIDE)}`);

  // ---------- the shape ring (3b-3a): the shape becomes machine state ----
  // A 6-state one-hot ring stepped by the UP button — the score-ring
  // pattern verbatim with UPM (the button's mirror) in CLEARPM's role:
  // masters sample the previous state's slave while the clock is low,
  // slaves copy on the press. State order matches the page's cycle:
  // 1x1, 2wide, 2tall, O, S, Z. SHBOOT seeds state 0 at power-on (the
  // BOOTL idiom, private relay; its pulse feed rides UPM's spare K — a
  // latch fed from the clock chain would hold every ring clock high
  // forever, the SCBOOT lesson). The ring SURVIVES resets: the selected
  // shape persists across locks, exactly like the slides it derives.
  // states 0..5 live in the 3a block (SHR), 6..8 in the 4a block (SHR2),
  // 9..11 in the 4c block (SHR3)
  const SH = (i: number, part: number) =>
    i < 6 ? SHR(i, part) : i < 9 ? SHR2(i, part) : SHR3(i, part);
  const shrClkCom = (i: number) => comOf(SH(i, 0));
  w.push(`${bmS}.2+/${bmS}.2Y`, `${bmS}.2X/${R(UPM, 'E')}`, `${R(UPM, 'F')}/${minusOf(UPM)}`);
  // UPM's clock contact feeds the ring through the 3b-3c transition
  // legality network (wired below) instead of a plain wire
  w.push(`${plusOf(UPM)}/${R(UPM, 'H')}`);
  for (let i = 2; i < NSTATES; i += 2) w.push(`${shrClkCom(i - 2)}/${shrClkCom(i)}`);
  for (let i = 0; i < NSTATES; i++) {
    const c = SH(i, 0), a = SH(i, 1), sl = SH(i, 2);
    w.push(`${shrClkCom(i - (i % 2))}/${R(c, 'E')}`, `${R(c, 'F')}/${minusOf(c)}`);
    w.push(`${comOf(a)}/${R(a, 'E')}`, `${R(a, 'F')}/${minusOf(a)}`);
    w.push(`${comOf(sl)}/${R(sl, 'E')}`, `${R(sl, 'F')}/${minusOf(sl)}`);
    w.push(`${plusOf(c)}/${R(c, 'H')}`, `${plusOf(c)}/${R(c, 'L')}`);
    const prev = SH((i + NSTATES - 1) % NSTATES, 2);
    w.push(`${R(c, 'J')}/${R(prev, 'L')}`, `${R(prev, 'K')}/${comOf(a)}`);
    w.push(`${R(c, 'G')}/${R(a, 'H')}`, `${R(a, 'G')}/${comOf(a)}`); // master holds, clock high
    w.push(`${R(c, 'K')}/${R(a, 'L')}`, `${R(a, 'K')}/${comOf(sl)}`); // slave := master
    w.push(`${R(c, 'N')}/${R(sl, 'H')}`, `${R(sl, 'G')}/${comOf(sl)}`); // slave holds, clock low
  }
  w.push(`${R(SHBOOT, 'F')}/${minusOf(SHBOOT)}`);
  w.push(`${plusOf(UPM)}/${R(UPM, 'L')}`, `${R(UPM, 'K')}/${R(SHBOOT, 'E')}`);
  w.push(`${plusOf(SHBOOT)}/${R(SHBOOT, 'H')}`, `${R(SHBOOT, 'G')}/${R(SHBOOT, 'E')}`);
  w.push(`${plusOf(SHBOOT)}/${R(SHBOOT, 'L')}`, `${R(SHBOOT, 'N')}/${comOf(SHR(0, 2))}`);

  // state mirrors (the ring slaves' own sets are spent stepping the ring)
  // and POSM3 pos mirrors for the T fan — all coil-jack chained; POSM2's
  // second sets cover one pos branch per column, POSM3 covers the rest
  w.push(`${R(SHR(4, 2), 'E')}/${R(SM(0), 'E')}`);
  for (let k = 1; k < 4; k++) w.push(`${R(SM(k - 1), 'E')}/${R(SM(k), 'E')}`);
  w.push(`${R(SHR(5, 2), 'E')}/${R(ZM(0), 'E')}`);
  for (let k = 1; k < 4; k++) w.push(`${R(ZM(k - 1), 'E')}/${R(ZM(k), 'E')}`);
  w.push(`${R(SHR(3, 2), 'E')}/${R(OM, 'E')}`);
  w.push(`${R(SHR(2, 2), 'E')}/${R(I2TM, 'E')}`);
  w.push(`${R(SHR(1, 2), 'E')}/${R(I2WM, 'E')}`);
  w.push(`${R(POSM2(0), 'E')}/${R(POSM3(0), 'E')}`);
  w.push(`${R(POSM2(1), 'E')}/${R(POSM3(1), 'E')}`, `${R(POSM3(1), 'E')}/${R(POSM3(2), 'E')}`);
  w.push(`${R(POSM2(2), 'E')}/${R(POSM3(3), 'E')}`);
  for (const m of [SM(0), SM(1), SM(2), SM(3), ZM(0), ZM(1), ZM(2), ZM(3), OM, I2TM, I2WM, POSM3(0), POSM3(1), POSM3(2), POSM3(3)])
    w.push(`${R(m, 'F')}/${minusOf(m)}`);

  // the derived rails, entering the slide-fed coil nets at their FREE
  // holes (audited: WIDM.E/WIDM2.E and VMODE.E are full; WIDM3.E,
  // VMODEM(3).E and STAGM.E each have exactly one): WIDB = 2wide|O|S|Z,
  // VMODE = 2tall|O|S|Z, STAG = S|Z. Branch outputs chain jack-to-jack
  // (the LEGB trick) so each coil net takes ONE wire; the one-hot ring
  // means every inactive branch dead-ends at its open state contact, and
  // a raised slide's + walking the chain backward dead-ends the same way.
  w.push(`${plusOf(I2WM)}/${R(I2WM, 'H')}`, `${plusOf(OM)}/${R(OM, 'H')}`);
  w.push(`${plusOf(SM(2))}/${R(SM(2), 'H')}`, `${plusOf(ZM(2))}/${R(ZM(2), 'H')}`);
  w.push(`${R(I2WM, 'G')}/${R(OM, 'G')}`, `${R(OM, 'G')}/${R(SM(2), 'G')}`, `${R(SM(2), 'G')}/${R(ZM(2), 'G')}`);
  w.push(`${R(ZM(2), 'G')}/${R(WIDM3, 'E')}`);
  w.push(`${plusOf(I2TM)}/${R(I2TM, 'H')}`, `${plusOf(OM)}/${R(OM, 'L')}`);
  w.push(`${plusOf(SM(2))}/${R(SM(2), 'L')}`, `${plusOf(ZM(2))}/${R(ZM(2), 'L')}`);
  w.push(`${R(I2TM, 'G')}/${R(OM, 'K')}`, `${R(OM, 'K')}/${R(SM(2), 'K')}`, `${R(SM(2), 'K')}/${R(ZM(2), 'K')}`);
  // (the chain's last link to VMODEM(3).E moved into the 3b-4a splice:
  // the TRP contact rides between ZM(2).K and the coil net)
  // (STAGM.E itself is full — slide feed + the STAGM2 chain; the net's
  // free hole is on STAGM2.E, same coil net)
  w.push(`${plusOf(SM(3))}/${R(SM(3), 'H')}`, `${plusOf(ZM(3))}/${R(ZM(3), 'H')}`);
  w.push(`${R(SM(3), 'G')}/${R(ZM(3), 'G')}`);
  // (the link to STAGM2.E moved into the 3b-4a splice — the STAG rail
  // now means "phase 2 reads the T fan" and the triples belong on it)

  // the T fan from the ring: T(j) = S&(pos j | pos j+1) | Z&(pos j-1 |
  // pos j-2) — S's top pair is the bottom shifted LEFT, Z's RIGHT;
  // invalid-pos terms are omitted (an S forced to pos 0 simply has an
  // empty top mask and locks its bottom pair; the operator keeps it in
  // bounds until 3b-3c refuses the UP in contacts). Every branch is a
  // PRIVATE state-contact x pos-contact series pair into the PIECET coil
  // net: a shared state rail feeding several coils through per-branch pos
  // contacts would backfeed through the DEAD rail into sibling coils (the
  // first multivac counter's trap). Multi-branch columns chain their
  // outputs; each PIECET(j).E takes one wire at its free hole.
  // T(0) = S & pos1
  w.push(`${plusOf(SM(0))}/${R(SM(0), 'H')}`, `${R(SM(0), 'G')}/${R(POSM2(1), 'L')}`, `${R(POSM2(1), 'K')}/${R(PIECET(0), 'E')}`);
  // T(1) = S & pos1  |  S & pos2  |  Z & pos0
  w.push(`${plusOf(SM(0))}/${R(SM(0), 'L')}`, `${R(SM(0), 'K')}/${R(POSM3(1), 'H')}`);
  w.push(`${plusOf(SM(1))}/${R(SM(1), 'H')}`, `${R(SM(1), 'G')}/${R(POSM2(2), 'L')}`);
  w.push(`${plusOf(ZM(0))}/${R(ZM(0), 'H')}`, `${R(ZM(0), 'G')}/${R(POSM2(0), 'L')}`);
  w.push(`${R(POSM3(1), 'G')}/${R(POSM2(2), 'K')}`, `${R(POSM2(2), 'K')}/${R(POSM2(0), 'K')}`, `${R(POSM2(0), 'K')}/${R(PIECET(1), 'E')}`);
  // T(2) = S & pos2  |  Z & pos0  |  Z & pos1
  w.push(`${plusOf(SM(1))}/${R(SM(1), 'L')}`, `${R(SM(1), 'K')}/${R(POSM3(3), 'H')}`);
  w.push(`${plusOf(ZM(0))}/${R(ZM(0), 'L')}`, `${R(ZM(0), 'K')}/${R(POSM3(0), 'H')}`);
  w.push(`${plusOf(ZM(1))}/${R(ZM(1), 'H')}`, `${R(ZM(1), 'G')}/${R(POSM3(1), 'L')}`);
  w.push(`${R(POSM3(3), 'G')}/${R(POSM3(0), 'G')}`, `${R(POSM3(0), 'G')}/${R(POSM3(1), 'K')}`, `${R(POSM3(1), 'K')}/${R(PIECET(2), 'E')}`);
  // T(3) = Z & pos1
  w.push(`${plusOf(ZM(1))}/${R(ZM(1), 'L')}`, `${R(ZM(1), 'K')}/${R(POSM3(2), 'H')}`, `${R(POSM3(2), 'G')}/${R(PIECET(3), 'E')}`);

  // ---------- 3b-3b coils: the mode gates and mode-only top reads ------
  // SG mirrors chain off the S state net, ZG off the Z net (their NC/NO
  // contacts are the NOT-S/NOT-Z gates and the LTS/LTZ coil gates wired
  // into the legality section above). LTS/LTZ coils are top-rail reads
  // gated AT THE COIL by a state contact: dead in every other mode, so
  // their NC hops in the trees pass through.
  // 3b-4b re-classed the gates: SG(0) (the NOT gate on LEGINVT2) mirrors
  // SLJ = S|L1|J1 now; ZG(0,1) (the NOT gates on LEGINVT) mirror ZJT =
  // Z|J1|T1. SG(1) (the LTS coil gates) and ZG(2,3) (LTZ gates + the Z
  // bound) stay pure S / Z mirrors on re-routed chains.
  w.push(`${R(SM(3), 'E')}/${R(SG(1), 'E')}`, `${R(SG(1), 'E')}/${R(SM2, 'E')}`);
  w.push(`${R(SLJ, 'E')}/${R(SG(0), 'E')}`);
  w.push(`${R(ZM(3), 'E')}/${R(ZM2, 'E')}`, `${R(ZM2, 'E')}/${R(ZG(2), 'E')}`, `${R(ZG(2), 'E')}/${R(ZG(3), 'E')}`);
  w.push(`${R(ZJT, 'E')}/${R(ZG(0), 'E')}`, `${R(ZG(0), 'E')}/${R(ZG(1), 'E')}`);
  for (const m of [SG(0), SG(1), ZG(0), ZG(1), ZG(2), ZG(3), LTS(0), LTS(1), LTZ(0), LTZ(1), LTZ(2), LTZ(3)])
    w.push(`${R(m, 'F')}/${minusOf(m)}`);
  // S-gated reads (coil = rail AND S): columns 0 and 1
  w.push(`${legTTap(0)}/${R(SG(1), 'H')}`, `${R(SG(1), 'G')}/${R(LTS(0), 'E')}`);
  w.push(`${legTTap(1)}/${R(SG(1), 'L')}`, `${R(SG(1), 'K')}/${R(LTS(1), 'E')}`);
  // Z-gated reads: column 1, column 2, column 3 (two relays for col 3)
  w.push(`${legTTap(1)}/${R(ZG(2), 'H')}`, `${R(ZG(2), 'G')}/${R(LTZ(0), 'E')}`);
  w.push(`${legTTap(2)}/${R(ZG(2), 'L')}`, `${R(ZG(2), 'K')}/${R(LTZ(1), 'E')}`);
  w.push(`${legTTap(3)}/${R(ZG(3), 'H')}`, `${R(ZG(3), 'G')}/${R(LTZ(2), 'E')}`);
  w.push(`${R(LTZ(2), 'E')}/${R(LTZ(3), 'E')}`);

  // ---------- 3b-3c: UP-transition legality (the last seam) ----------
  // The clock conducts ONLY through a legal transition's branch: the
  // energized master (one-hot, the current state's successor) names the
  // target state; each transition is one MMIR contact whose output fans
  // to one-hot pos branches; each branch's series NC hops check the
  // target footprint's NEW cells on the occupancy rails (covered cells
  // can't be stored, so checking the delta suffices). No branch = no
  // clock = the bounds refusal for free (S has no into-4 branch at pos
  // 0, Z none at pos 2, wide shapes none at pos 3). A refused UP needs
  // NO return path — nothing samples, the ring simply holds. Pre-spawn
  // every rail is dark, so all in-bounds transitions stay free.
  for (let i = 0; i < 6; i++)
    w.push(`${R(SHR(i, 1), 'E')}/${R(MMIR(i), 'E')}`, `${R(MMIR(i), 'F')}/${minusOf(MMIR(i))}`);
  w.push(`${R(POSM3(0), 'E')}/${R(POSM4(0), 'E')}`);
  w.push(`${R(POSM3(2), 'E')}/${R(POSM4(1), 'E')}`, `${R(POSM4(1), 'E')}/${R(POSM4(2), 'E')}`);
  w.push(`${R(POSM3(3), 'E')}/${R(POSM4(3), 'E')}`, `${R(POSM4(3), 'E')}/${R(POSM4(4), 'E')}`);
  w.push(`${R(POSM(3), 'E')}/${R(POSM4(5), 'E')}`); // pos3: POSM(3)'s own sets are the sample bus + self-loop, untouchable
  for (let k = 0; k < 3; k++)
    w.push(`${R(LEGB(k + 1), 'E')}/${R(LEGB2(k), 'E')}`);
  w.push(`${legTTap(0)}/${R(UTR(0), 'E')}`);
  w.push(`${legTTap(1)}/${R(UTR(1), 'E')}`, `${R(UTR(1), 'E')}/${R(UTR(2), 'E')}`);
  w.push(`${legTTap(2)}/${R(UTR(3), 'E')}`, `${R(UTR(3), 'E')}/${R(UTR(4), 'E')}`);
  w.push(`${legTTap(3)}/${R(UTR(5), 'E')}`, `${R(UTR(5), 'E')}/${R(UTR(6), 'E')}`);
  for (const m of [POSM4(0), POSM4(1), POSM4(2), POSM4(3), POSM4(4), POSM4(5), LEGB2(0), LEGB2(1), LEGB2(2), UTR(0), UTR(1), UTR(2), UTR(3), UTR(4), UTR(5), UTR(6)])
    w.push(`${R(m, 'F')}/${minusOf(m)}`);
  // the root: UPM's clock contact chained through the six M arms
  w.push(`${R(UPM, 'G')}/${R(MMIR(0), 'H')}`);
  for (let i = 1; i < 6; i++) w.push(`${R(MMIR(i - 1), 'H')}/${R(MMIR(i), 'H')}`);
  // into 0 (Z -> 1x1): footprint shrinks, always legal
  // into 1 (1x1 -> 2wide): new bottom cell at p+1
  w.push(`${R(MMIR(1), 'G')}/${R(POSM3(0), 'L')}`);
  w.push(`${R(POSM3(0), 'L')}/${R(POSM4(1), 'H')}`, `${R(POSM4(1), 'H')}/${R(POSM4(3), 'H')}`);
  w.push(`${R(POSM3(0), 'K')}/${R(LEGB(1), 'L')}`);
  w.push(`${R(POSM4(1), 'G')}/${R(LEGB(2), 'L')}`);
  w.push(`${R(POSM4(3), 'G')}/${R(LEGB(3), 'L')}`);
  // into 2 (2wide -> 2tall): new top cell at p
  w.push(`${R(MMIR(2), 'G')}/${R(POSM4(0), 'H')}`);
  w.push(`${R(POSM4(0), 'H')}/${R(POSM4(1), 'L')}`, `${R(POSM4(1), 'L')}/${R(POSM4(3), 'L')}`);
  w.push(`${R(POSM4(3), 'L')}/${R(POSM4(5), 'H')}`);
  w.push(`${R(POSM4(0), 'G')}/${R(UTR(0), 'H')}`);
  w.push(`${R(POSM4(1), 'K')}/${R(UTR(1), 'H')}`);
  w.push(`${R(POSM4(3), 'K')}/${R(UTR(3), 'H')}`);
  w.push(`${R(POSM4(5), 'G')}/${R(UTR(5), 'H')}`);
  // into 3 (2tall -> O): new bottom AND top cells at p+1
  w.push(`${R(MMIR(3), 'G')}/${R(POSM4(0), 'L')}`);
  w.push(`${R(POSM4(0), 'L')}/${R(POSM4(2), 'H')}`, `${R(POSM4(2), 'H')}/${R(POSM4(4), 'H')}`);
  w.push(`${R(POSM4(0), 'K')}/${R(LEGB2(0), 'H')}`, `${R(LEGB2(0), 'J')}/${R(UTR(1), 'L')}`);
  w.push(`${R(POSM4(2), 'G')}/${R(LEGB2(1), 'H')}`, `${R(LEGB2(1), 'J')}/${R(UTR(3), 'L')}`);
  w.push(`${R(POSM4(4), 'G')}/${R(LEGB2(2), 'H')}`, `${R(LEGB2(2), 'J')}/${R(UTR(5), 'L')}`);
  // into 4 (O -> S): new top cell at p-1 (no branch at pos 0: the bound)
  w.push(`${R(MMIR(4), 'G')}/${R(POSM4(2), 'L')}`, `${R(POSM4(2), 'L')}/${R(POSM4(4), 'L')}`);
  w.push(`${R(POSM4(2), 'K')}/${R(UTR(0), 'L')}`);
  w.push(`${R(POSM4(4), 'K')}/${R(UTR(2), 'H')}`);
  // into 5 (S -> Z): new top cells at p+1 and p+2 (only pos 1 is in range)
  w.push(`${R(MMIR(5), 'G')}/${R(POSM3(2), 'L')}`);
  w.push(`${R(POSM3(2), 'K')}/${R(UTR(4), 'H')}`, `${R(UTR(4), 'J')}/${R(UTR(6), 'H')}`);
  // into 0 REWIRED in 3b-4c: the ring's 0-predecessor is T2 now, whose
  // bottom {p+1} does NOT cover 1x1's {p} — the wrap checks (tok, p)
  w.push(`${R(MMIR(0), 'G')}/${R(POSM6(2), 'L')}`, `${R(POSM6(2), 'L')}/${R(POSM6(5), 'L')}`);
  w.push(`${R(POSM6(2), 'K')}/${R(LEGB3(2), 'H')}`);
  w.push(`${R(POSM6(5), 'K')}/${R(LEGB3(0), 'L')}`);
  // the join: every branch's free-side output chains into the clock com
  w.push(`${R(LEGB3(2), 'J')}/${R(LEGB3(0), 'N')}`, `${R(LEGB3(0), 'N')}/${R(LEGB(1), 'N')}`);
  w.push(`${R(LEGB(1), 'N')}/${R(LEGB(2), 'N')}`, `${R(LEGB(2), 'N')}/${R(LEGB(3), 'N')}`);
  w.push(`${R(LEGB(3), 'N')}/${R(UTR(0), 'J')}`, `${R(UTR(0), 'J')}/${R(UTR(1), 'J')}`);
  w.push(`${R(UTR(1), 'J')}/${R(UTR(3), 'J')}`, `${R(UTR(3), 'J')}/${R(UTR(5), 'J')}`);
  w.push(`${R(UTR(5), 'J')}/${R(UTR(1), 'N')}`, `${R(UTR(1), 'N')}/${R(UTR(3), 'N')}`);
  w.push(`${R(UTR(3), 'N')}/${R(UTR(5), 'N')}`, `${R(UTR(5), 'N')}/${R(UTR(0), 'N')}`);
  w.push(`${R(UTR(0), 'N')}/${R(UTR(2), 'J')}`, `${R(UTR(2), 'J')}/${R(UTR(6), 'J')}`);

  // ---------- 3b-4a: L1 / J1 / T1 (the upright 3-wide forms) ----------
  // state mirrors chain off the new slaves; the TRP rail (= L1|J1|T1)
  // feeds every rail these states share identically
  w.push(`${R(SHR2(6, 2), 'E')}/${R(L1M(0), 'E')}`, `${R(L1M(0), 'E')}/${R(L1M(1), 'E')}`);
  w.push(`${R(SHR2(7, 2), 'E')}/${R(J1M(0), 'E')}`, `${R(J1M(0), 'E')}/${R(J1M(1), 'E')}`);
  w.push(`${R(SHR2(8, 2), 'E')}/${R(T1M(0), 'E')}`, `${R(T1M(0), 'E')}/${R(T1M(1), 'E')}`);
  w.push(`${R(TRP, 'E')}/${R(TRPM(0), 'E')}`, `${R(TRPM(0), 'E')}/${R(TRPM(1), 'E')}`);
  w.push(`${R(SHR2(6, 1), 'E')}/${R(MMIR2(6), 'E')}`);
  w.push(`${R(SHR2(7, 1), 'E')}/${R(MMIR2(7), 'E')}`);
  w.push(`${R(SHR2(8, 1), 'E')}/${R(MMIR2(8), 'E')}`);
  w.push(`${R(POSM4(0), 'E')}/${R(POSM5(0), 'E')}`);
  for (let k = 1; k < 4; k++) w.push(`${R(POSM5(k - 1), 'E')}/${R(POSM5(k), 'E')}`);
  w.push(`${R(POSM4(2), 'E')}/${R(POSM5(4), 'E')}`);
  for (let k = 5; k < 8; k++) w.push(`${R(POSM5(k - 1), 'E')}/${R(POSM5(k), 'E')}`);
  w.push(`${R(UTR(0), 'E')}/${R(UTR2(0), 'E')}`);
  w.push(`${R(UTR(2), 'E')}/${R(UTR2(1), 'E')}`);
  w.push(`${R(UTR(4), 'E')}/${R(UTR2(2), 'E')}`);
  for (const m of [MMIR2(6), MMIR2(7), MMIR2(8), POSM5(0), POSM5(1), POSM5(2), POSM5(3), POSM5(4), POSM5(5), POSM5(6), POSM5(7), UTR2(0), UTR2(1), UTR2(2), TRP, TRPM(0), TRPM(1), L1M(0), L1M(1), J1M(0), J1M(1), T1M(0), T1M(1), WID3M])
    w.push(`${R(m, 'F')}/${minusOf(m)}`);
  // the TRP coil: a wired-OR of one contact per new state
  w.push(`${plusOf(L1M(0))}/${R(L1M(0), 'H')}`, `${plusOf(J1M(0))}/${R(J1M(0), 'H')}`, `${plusOf(T1M(0))}/${R(T1M(0), 'H')}`);
  w.push(`${R(L1M(0), 'G')}/${R(J1M(0), 'G')}`, `${R(J1M(0), 'G')}/${R(T1M(0), 'G')}`, `${R(T1M(0), 'G')}/${R(TRP, 'E')}`);
  // the rails: WIDM (enter at WIDM4.E's free hole), VMODE and STAG
  // (their chain interiors are full — SPLICE the last link), WID3M and
  // NSC coils straight off TRPM(1)
  w.push(`${plusOf(TRP)}/${R(TRP, 'H')}`, `${R(TRP, 'G')}/${R(WIDM4, 'E')}`);
  w.push(`${plusOf(TRPM(0))}/${R(TRPM(0), 'H')}`, `${plusOf(TRPM(0))}/${R(TRPM(0), 'L')}`);
  w.push(`${R(ZM(2), 'K')}/${R(TRPM(0), 'G')}`);
  w.push(`${R(ZM(3), 'G')}/${R(TRPM(0), 'K')}`);
  // (the links to VMODEM(3).E / STAGM2.E moved into the 3b-4c splice:
  // the TT contacts ride between TRPM(0)'s outputs and the coil nets)
  w.push(`${plusOf(TRPM(1))}/${R(TRPM(1), 'H')}`, `${R(TRPM(1), 'G')}/${R(WID3M, 'E')}`);
  // (TRPM(1)'s second set is the 3b-4b triple bound in the right-into-2 tree)
  // the B fan's third column: pos(j-2) AND WID3 -> the PIECE(j) coil
  // nets, entering at the WIDM-branch output jacks' free holes
  w.push(`${plusOf(WID3M)}/${R(WID3M, 'H')}`, `${R(WID3M, 'G')}/${R(POSM5(0), 'H')}`, `${R(POSM5(0), 'G')}/${R(WIDM, 'K')}`);
  w.push(`${plusOf(WID3M)}/${R(WID3M, 'L')}`, `${R(WID3M, 'K')}/${R(POSM5(4), 'H')}`, `${R(POSM5(4), 'G')}/${R(WIDM2, 'G')}`);
  // the T fan: per-state private pairs onto the column nets' free holes
  // T(0) += L1 & pos0
  w.push(`${plusOf(L1M(0))}/${R(L1M(0), 'L')}`, `${R(L1M(0), 'K')}/${R(POSM5(0), 'L')}`, `${R(POSM5(0), 'K')}/${R(POSM2(1), 'K')}`);
  // T(1) += T1 & pos0  |  L1 & pos1
  w.push(`${plusOf(T1M(0))}/${R(T1M(0), 'L')}`, `${R(T1M(0), 'K')}/${R(POSM5(1), 'L')}`, `${R(POSM5(1), 'K')}/${R(POSM3(1), 'G')}`);
  w.push(`${plusOf(L1M(1))}/${R(L1M(1), 'H')}`, `${R(L1M(1), 'G')}/${R(POSM5(4), 'L')}`, `${R(POSM5(4), 'K')}/${R(POSM5(1), 'K')}`);
  // T(2) += J1 & pos0  |  T1 & pos1
  w.push(`${plusOf(J1M(0))}/${R(J1M(0), 'L')}`, `${R(J1M(0), 'K')}/${R(POSM5(1), 'H')}`, `${R(POSM5(1), 'G')}/${R(POSM3(3), 'G')}`);
  w.push(`${plusOf(T1M(1))}/${R(T1M(1), 'H')}`, `${R(T1M(1), 'G')}/${R(POSM5(5), 'L')}`, `${R(POSM5(5), 'K')}/${R(POSM5(1), 'G')}`);
  // T(3) += J1 & pos1
  w.push(`${plusOf(J1M(1))}/${R(J1M(1), 'H')}`, `${R(J1M(1), 'G')}/${R(POSM5(5), 'H')}`, `${R(POSM5(5), 'G')}/${R(POSM3(2), 'G')}`);
  // transitions into 6/7/8: the root chain extends, each branch reads
  // the target's delta cells (Z->L1 grows bottom p+2 AND top p; L1->J1
  // moves the top stem p -> p+2; J1->T1 moves it p+2 -> p+1)
  w.push(`${R(MMIR(5), 'H')}/${R(MMIR2(6), 'H')}`);
  w.push(`${R(MMIR2(6), 'H')}/${R(MMIR2(7), 'H')}`, `${R(MMIR2(7), 'H')}/${R(MMIR2(8), 'H')}`);
  w.push(`${R(MMIR2(6), 'G')}/${R(POSM5(2), 'H')}`, `${R(POSM5(2), 'H')}/${R(POSM5(6), 'H')}`);
  w.push(`${R(POSM5(2), 'G')}/${R(LEGB2(1), 'L')}`, `${R(LEGB2(1), 'N')}/${R(UTR2(0), 'H')}`);
  w.push(`${R(POSM5(6), 'G')}/${R(LEGB2(2), 'L')}`, `${R(LEGB2(2), 'N')}/${R(UTR2(1), 'H')}`);
  w.push(`${R(MMIR2(7), 'G')}/${R(POSM5(2), 'L')}`, `${R(POSM5(2), 'L')}/${R(POSM5(6), 'L')}`);
  w.push(`${R(POSM5(2), 'K')}/${R(UTR2(2), 'H')}`);
  w.push(`${R(POSM5(6), 'K')}/${R(UTR(6), 'L')}`);
  w.push(`${R(MMIR2(8), 'G')}/${R(POSM5(3), 'H')}`, `${R(POSM5(3), 'H')}/${R(POSM5(7), 'H')}`);
  w.push(`${R(POSM5(3), 'G')}/${R(UTR(2), 'L')}`);
  w.push(`${R(POSM5(7), 'G')}/${R(UTR(4), 'L')}`);
  // the join grows the new tails before entering the clock com
  w.push(`${R(UTR(6), 'J')}/${R(UTR2(0), 'J')}`, `${R(UTR2(0), 'J')}/${R(UTR2(1), 'J')}`);
  w.push(`${R(UTR2(1), 'J')}/${R(UTR2(2), 'J')}`, `${R(UTR2(2), 'J')}/${R(UTR(6), 'N')}`);
  w.push(`${R(UTR(6), 'N')}/${R(UTR(2), 'N')}`, `${R(UTR(2), 'N')}/${R(UTR(4), 'N')}`);
  w.push(`${R(UTR(4), 'N')}/${shrClkCom(0)}`);

  // ---------- 3b-4b coils: the re-classed gates and triple reads ------
  // mirror chains for the extra contacts
  w.push(`${R(J1M(1), 'E')}/${R(J1M2, 'E')}`, `${R(J1M2, 'E')}/${R(J1M3, 'E')}`);
  w.push(`${R(T1M(1), 'E')}/${R(T1M2, 'E')}`);
  // ZJT = Z|J1|T1 and SLJ = S|L1|J1, one contact per state, wired-OR
  w.push(`${plusOf(ZM2)}/${R(ZM2, 'H')}`, `${plusOf(J1M(1))}/${R(J1M(1), 'L')}`, `${plusOf(T1M(1))}/${R(T1M(1), 'L')}`);
  w.push(`${R(ZM2, 'G')}/${R(J1M(1), 'K')}`, `${R(J1M(1), 'K')}/${R(T1M(1), 'K')}`, `${R(T1M(1), 'K')}/${R(ZJT, 'E')}`);
  w.push(`${plusOf(SM2)}/${R(SM2, 'H')}`, `${plusOf(L1M(1))}/${R(L1M(1), 'L')}`, `${plusOf(J1M2)}/${R(J1M2, 'H')}`);
  w.push(`${R(SM2, 'G')}/${R(L1M(1), 'K')}`, `${R(L1M(1), 'K')}/${R(J1M2, 'G')}`, `${R(J1M2, 'G')}/${R(SLJ, 'E')}`);
  // J1-only top reads (coil = rail AND J1): cols 2 and 3
  w.push(`${legTTap(2)}/${R(J1M2, 'L')}`, `${R(J1M2, 'K')}/${R(LTJ(0), 'E')}`);
  w.push(`${legTTap(3)}/${R(J1M3, 'H')}`, `${R(J1M3, 'G')}/${R(LTJ(1), 'E')}`);
  // T1-only top reads: cols 1 and 2
  w.push(`${legTTap(1)}/${R(T1M2, 'H')}`, `${R(T1M2, 'G')}/${R(LTT(0), 'E')}`);
  w.push(`${legTTap(2)}/${R(T1M2, 'L')}`, `${R(T1M2, 'K')}/${R(LTT(1), 'E')}`);
  // the triple-only bottom read of col 3 (TRP's spare set gates it)
  w.push(`${legTap(3)}/${R(TRP, 'L')}`, `${R(TRP, 'K')}/${R(LTB3, 'E')}`);
  for (const m of [ZJT, SLJ, ZM2, SM2, J1M2, J1M3, T1M2, LTJ(0), LTJ(1), LTT(0), LTT(1), LTB3])
    w.push(`${R(m, 'F')}/${minusOf(m)}`);

  // ---------- 3b-4c: the overhang trio's coils, rails and fans --------
  // state mirrors off the new slaves; TT = L2|J2|T2; BCUT = L2|T2
  w.push(`${R(SHR3(9, 2), 'E')}/${R(L2M(0), 'E')}`, `${R(L2M(0), 'E')}/${R(L2M(1), 'E')}`, `${R(L2M(1), 'E')}/${R(L2M(2), 'E')}`);
  w.push(`${R(SHR3(10, 2), 'E')}/${R(J2M, 'E')}`);
  w.push(`${R(SHR3(11, 2), 'E')}/${R(T2M(0), 'E')}`, `${R(T2M(0), 'E')}/${R(T2M(1), 'E')}`, `${R(T2M(1), 'E')}/${R(T2M(2), 'E')}`);
  w.push(`${R(SHR3(9, 1), 'E')}/${R(MMIR3(9), 'E')}`);
  w.push(`${R(SHR3(10, 1), 'E')}/${R(MMIR3(10), 'E')}`);
  w.push(`${R(SHR3(11, 1), 'E')}/${R(MMIR3(11), 'E')}`);
  w.push(`${plusOf(L2M(0))}/${R(L2M(0), 'H')}`, `${plusOf(J2M)}/${R(J2M, 'H')}`, `${plusOf(T2M(0))}/${R(T2M(0), 'H')}`);
  w.push(`${R(L2M(0), 'G')}/${R(J2M, 'G')}`, `${R(J2M, 'G')}/${R(T2M(0), 'G')}`, `${R(T2M(0), 'G')}/${R(TT, 'E')}`);
  w.push(`${R(TT, 'E')}/${R(TTM(0), 'E')}`);
  for (let k = 1; k < 5; k++) w.push(`${R(TTM(k - 1), 'E')}/${R(TTM(k), 'E')}`);
  w.push(`${plusOf(L2M(0))}/${R(L2M(0), 'L')}`, `${plusOf(T2M(0))}/${R(T2M(0), 'L')}`);
  w.push(`${R(L2M(0), 'K')}/${R(T2M(0), 'K')}`, `${R(T2M(0), 'K')}/${R(BCUT, 'E')}`);
  w.push(`${R(BCUT, 'E')}/${R(BCUTM, 'E')}`);
  // the base-column cut: ONE contact ahead of the chained POSS arms
  // (one-hot slaves make the shared arm net legal)
  w.push(`${plusOf(BCUT)}/${R(BCUT, 'H')}`, `${R(BCUT, 'J')}/${R(POSS(0), 'L')}`);
  w.push(`${R(POSS(0), 'L')}/${R(POSS(1), 'L')}`, `${R(POSS(1), 'L')}/${R(POSS(2), 'L')}`, `${R(POSS(2), 'L')}/${R(POSS(3), 'L')}`);
  // rails: T2 joins WIDM (at TRP.G's free hole), L2 joins WID3; VMODE and
  // STAG gain one TT contact each (spliced into the 4a links)
  w.push(`${plusOf(T2M(1))}/${R(T2M(1), 'H')}`, `${R(T2M(1), 'G')}/${R(TRP, 'G')}`);
  w.push(`${plusOf(L2M(1))}/${R(L2M(1), 'H')}`, `${R(L2M(1), 'G')}/${R(WID3M, 'E')}`);
  w.push(`${plusOf(TTM(0))}/${R(TTM(0), 'H')}`, `${plusOf(TTM(0))}/${R(TTM(0), 'L')}`);
  w.push(`${R(TRPM(0), 'G')}/${R(TTM(0), 'G')}`, `${R(TTM(0), 'G')}/${R(VMODEM(3), 'E')}`);
  w.push(`${R(TRPM(0), 'K')}/${R(TTM(0), 'K')}`, `${R(TTM(0), 'K')}/${R(STAGM2, 'E')}`);
  // the T fan: six TT x pos branches onto the column nets' free holes
  w.push(`${plusOf(TTM(1))}/${R(TTM(1), 'H')}`, `${R(TTM(1), 'G')}/${R(POSM5(3), 'L')}`, `${R(POSM5(3), 'K')}/${R(POSM5(0), 'K')}`);
  w.push(`${plusOf(TTM(1))}/${R(TTM(1), 'L')}`, `${R(TTM(1), 'K')}/${R(POSM6(0), 'H')}`);
  w.push(`${plusOf(TTM(2))}/${R(TTM(2), 'H')}`, `${R(TTM(2), 'G')}/${R(POSM5(7), 'L')}`);
  w.push(`${R(POSM6(0), 'G')}/${R(POSM5(7), 'K')}`, `${R(POSM5(7), 'K')}/${R(POSM5(4), 'K')}`);
  w.push(`${plusOf(TTM(2))}/${R(TTM(2), 'L')}`, `${R(TTM(2), 'K')}/${R(POSM6(0), 'L')}`);
  w.push(`${plusOf(TTM(3))}/${R(TTM(3), 'H')}`, `${R(TTM(3), 'G')}/${R(POSM6(3), 'H')}`);
  w.push(`${R(POSM6(0), 'K')}/${R(POSM6(3), 'G')}`, `${R(POSM6(3), 'G')}/${R(POSM5(5), 'K')}`);
  w.push(`${plusOf(TTM(3))}/${R(TTM(3), 'L')}`, `${R(TTM(3), 'K')}/${R(POSM6(3), 'L')}`, `${R(POSM6(3), 'K')}/${R(POSM5(5), 'G')}`);
  // pos mirror chains for the new contacts
  w.push(`${R(POSM5(3), 'E')}/${R(POSM6(0), 'E')}`, `${R(POSM6(0), 'E')}/${R(POSM6(1), 'E')}`, `${R(POSM6(1), 'E')}/${R(POSM6(2), 'E')}`);
  w.push(`${R(POSM5(7), 'E')}/${R(POSM6(3), 'E')}`, `${R(POSM6(3), 'E')}/${R(POSM6(4), 'E')}`, `${R(POSM6(4), 'E')}/${R(POSM6(5), 'E')}`);
  // the overhang reads: LTOT (TT top col3), LTOB (L2 bottoms), T2B (T2
  // bottoms), UTR3 (a parallel coil on the top col3 rail), LEGB3 mirrors
  w.push(`${legTTap(3)}/${R(TTM(4), 'H')}`, `${R(TTM(4), 'G')}/${R(LTOT, 'E')}`);
  w.push(`${legTap(2)}/${R(L2M(1), 'L')}`, `${R(L2M(1), 'K')}/${R(LTOB(0), 'E')}`);
  w.push(`${legTap(3)}/${R(L2M(2), 'H')}`, `${R(L2M(2), 'G')}/${R(LTOB(1), 'E')}`);
  w.push(`${legTap(1)}/${R(T2M(1), 'L')}`, `${R(T2M(1), 'K')}/${R(T2B(0), 'E')}`);
  w.push(`${legTap(2)}/${R(T2M(2), 'H')}`, `${R(T2M(2), 'G')}/${R(T2B(1), 'E')}`);
  w.push(`${R(UTR(6), 'E')}/${R(UTR3, 'E')}`);
  w.push(`${R(LEGB2(0), 'E')}/${R(LEGB3(0), 'E')}`);
  w.push(`${R(LEGB2(1), 'E')}/${R(LEGB3(1), 'E')}`);
  w.push(`${R(LEGB(0), 'E')}/${R(LEGB3(2), 'E')}`);
  // transitions into the overhangs (the root chain extends; deltas only)
  w.push(`${R(MMIR2(8), 'H')}/${R(MMIR3(9), 'H')}`);
  w.push(`${R(MMIR3(9), 'H')}/${R(MMIR3(10), 'H')}`, `${R(MMIR3(10), 'H')}/${R(MMIR3(11), 'H')}`);
  // into 9 (T1 -> L2): the top grows cols p and p+2
  w.push(`${R(MMIR3(9), 'G')}/${R(POSM6(1), 'H')}`, `${R(POSM6(1), 'H')}/${R(POSM6(4), 'H')}`);
  w.push(`${R(POSM6(1), 'G')}/${R(UTR2(0), 'L')}`, `${R(UTR2(0), 'N')}/${R(UTR2(2), 'L')}`);
  w.push(`${R(POSM6(4), 'G')}/${R(UTR2(1), 'L')}`, `${R(UTR2(1), 'N')}/${R(UTR3, 'H')}`);
  // into 10 (L2 -> J2): the bottom moves to col p
  w.push(`${R(MMIR3(10), 'G')}/${R(POSM6(1), 'L')}`, `${R(POSM6(1), 'L')}/${R(POSM6(4), 'L')}`);
  w.push(`${R(POSM6(1), 'K')}/${R(LEGB(0), 'L')}`);
  w.push(`${R(POSM6(4), 'K')}/${R(LEGB2(0), 'L')}`);
  // into 11 (J2 -> T2): the bottom moves to col p+1
  w.push(`${R(MMIR3(11), 'G')}/${R(POSM6(2), 'H')}`, `${R(POSM6(2), 'H')}/${R(POSM6(5), 'H')}`);
  w.push(`${R(POSM6(2), 'G')}/${R(LEGB3(0), 'H')}`);
  w.push(`${R(POSM6(5), 'G')}/${R(LEGB3(1), 'H')}`);
  // the join grows the overhang tails
  w.push(`${R(UTR2(2), 'N')}/${R(UTR3, 'J')}`, `${R(UTR3, 'J')}/${R(LEGB(0), 'N')}`);
  w.push(`${R(LEGB(0), 'N')}/${R(LEGB2(0), 'N')}`, `${R(LEGB2(0), 'N')}/${R(LEGB3(0), 'J')}`);
  w.push(`${R(LEGB3(0), 'J')}/${R(LEGB3(1), 'J')}`, `${R(LEGB3(1), 'J')}/${R(LEGB3(2), 'J')}`);
  for (const m of [MMIR3(9), MMIR3(10), MMIR3(11), TT, TTM(0), TTM(1), TTM(2), TTM(3), TTM(4), BCUT, BCUTM, L2M(0), L2M(1), L2M(2), J2M, T2M(0), T2M(1), T2M(2), LTOT, LTOB(0), LTOB(1), T2B(0), T2B(1), UTR3, LEGB3(0), LEGB3(1), LEGB3(2), POSM6(0), POSM6(1), POSM6(2), POSM6(3), POSM6(4), POSM6(5)])
    w.push(`${R(m, 'F')}/${minusOf(m)}`);

  // ---------- 3b-5: the self-tick oscillator (see the constants) -------
  const om = Math.floor(TOSC / 6);
  const os = (TOSC % 6) + 1;
  w.push(`m${om}.${os}+/m${om}.${os}S`, `m${om}.${os}T/${R(TDRV, 'H')}`); // AUTO gates the feed
  w.push(`${R(TDRV, 'J')}/${R(TOSC, 'E')}`, `${R(TOSC, 'F')}/${minusOf(TOSC)}`);
  w.push(`${R(TOSC, 'E')}/m${om}.${os}cap`); // the coil parallels the bank
  const capSecs = [os, ...[1, 2, 3, 4, 5, 6].filter(s => s !== os).slice(0, 3)];
  for (let i = 1; i < capSecs.length; i++)
    w.push(`m${om}.${capSecs[i - 1]}cap/m${om}.${capSecs[i]}cap`);
  w.push(`${plusOf(TOSC)}/${R(TOSC, 'H')}`, `${R(TOSC, 'G')}/${R(TDRV, 'E')}`, `${R(TDRV, 'F')}/${minusOf(TDRV)}`);
  // the tick bridge: TDRV's set2 puts + on the tick net exactly as the
  // slide's S-T closure does (both dead-end open when inactive)
  w.push(`${plusOf(TDRV)}/${R(TDRV, 'L')}`, `${R(TDRV, 'K')}/${R(LKS, 'H')}`);

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
  up: UPBTN, // momentary: step the shape ring (1x1 -> 2wide -> 2tall -> O -> S -> Z -> L -> J -> T -> wrap)
  // the shape ring's one-hot slaves (state 0 = 1x1 seeds at power-on)
  shapeRelay: (i: number) => {
    const s = i < 6 ? SHR(i, 2) : i < 9 ? SHR2(i, 2) : SHR3(i, 2);
    return { machine: Math.floor(s / 6), index: s % 6 };
  },
  // AUTO: the oscillator's own section slide — right = the machine ticks
  // itself under stepTime (3b-5); the tick slide stays live in parallel
  auto: { slide: (TOSC % 6) + 1, machine: Math.floor(TOSC / 6) },
  // TDRV up = the oscillator is holding the tick line high
  oscRelay: { machine: Math.floor(TDRV / 6), index: TDRV % 6 },
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
