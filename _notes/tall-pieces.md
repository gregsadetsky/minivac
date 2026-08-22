# the remaining piece work — facts first, 2026-08-21

what the game has: 1x1, 2wide, 2tall, O, S, Z, and both horizontal
orientations of L, J, T. twelve ring states. of the seven tetrominoes
only **I is missing entirely**, and every vertical (3-tall) orientation
is missing.

## what the machine assumes today (read from source, not assumed)

- A LOCK IS TWO WRITE PHASES. the press writes the token row; a
  P2M/P2S master-slave pair (clocked by TICKM2, the LKM/LKS pattern)
  turns the next tick into PHASE 2, whose private power chain fires row
  r-1's existing write group through the TOPW(r) mirror bank ("token at
  r" -> route the write one row up). the reset then runs a tick late.
- COLLISION IS TWO TERMS. the bottom: MIRB mirrors read row+1 under the
  bottom mask. the top: a continuous series branch PIECET(j) AND
  occupied(tokenRow, j) feeding collideNode — because the top lands on
  the TOKEN row when the piece steps down.
- THE FANS ARE PER-ROW. the B fan taps offsets d in {0,1,2} (base,
  WIDM, WID3M rails); the T fan has its own four offset rails.
- OCCUPANCY IS READ ON TWO ROWS ALREADY: LEGINV (token row) and LEGINVT
  (one row above the token). the second bank exists for reshape
  legality — and it is exactly what a 3-tall piece's top check needs.

## therefore: two rungs, not one, and the cheap one comes first

### RUNG A — the horizontal I piece (completes all seven tetrominoes)

a 1x4 piece is FLAT. it needs no new write phase, no new collision
term, no new occupancy row. it needs:
- a 13th ring state (SHR4 block: clk/master/slave + a mirror tail),
- a fourth bottom-fan offset (d=3) with its own rail — the emitter
  currently hardcodes d in {0,1,2},
- the bound class max == cols-4, which no existing union covered
  (DONE: the unions are now derived from geometry, byte-identity
  verified, so the class appears automatically),
- rotation: I's partner is the VERTICAL I, which does not exist yet,
  so I is a singleton and refuses rotation — exactly like O, and the
  rotation rung already handles singletons by wiring the mux NC
  nowhere.
estimated ~8-10 relays. self-contained. this is the next rung.

### RUNG B — the tall piece engine (vertical S/Z/L/J/T, then vertical I)

a 3-tall piece needs a THIRD write phase (row r-2), a third fan, and a
third collision term; the 4-tall vertical I needs a fourth of each.
generalised: for a piece R rows tall the lock runs R phases, phase k
writing row tok-k, and collision checks row tok+1 under the bottom
mask plus rows tok-k+1 under each higher mask.
- the phase sequencer generalises from the P2M/P2S pattern: one
  master-slave pair per extra phase, chained so phase k+1 latches from
  phase k.
- the row routing needs one mirror bank per extra offset: TOPW(r)
  routes to r-1 today; TOPW2(r) would route to r-2. that is `rows`
  relays per extra piece row (12 at twelve rows).
- the collision terms: the row-above reads ALREADY EXIST (LEGINVT), so
  a 3-tall piece's checks are mostly available; a 4-tall piece needs a
  third occupancy bank.
rough estimate 40-60 relays for R=3, more for R=4. this is a big rung
and wants a cross-review of the phase sequencer before any wiring —
the phase machinery is the part with the race conditions (the existing
phase 2 already carries hard-won rules about which rails must stay dark
and which latches must survive).

## the honest sequencing

RUNG A first: it completes the tetromino set in one orientation each,
which is the visible milestone, at a tenth of the cost. RUNG B after,
and only with a design review — every review so far has found a fatal
flaw in my first draft (the ring reorder, the row-0 NOTOK gap, the root
gating that would have killed its own flips).

## RUNG A, read out of the source — the exact edit list (2026-08-21)

traced every site a 13th state touches. the ring machinery is already
NSTATES-parametric (the clock-com pairing at `i - (i % 2)`, the D-feed
`prevIx`, the UP emitter's per-target loop, `upResourceCounts`), so the
work is: three new relays, two new unions, one new fan offset, and the
five places that still switch on a hardcoded state index.

geometry: `{ label: 'I', bOff: 0, bW: 4, tOff: 0, tW: 0 }` appended at
index 12. flat, so tW = 0 and every top path stays dark.

1. SHAPES + NSTATES 12 -> 13. `ROT_STATE(12) = 12` (singleton: its
   partner is the vertical I, which RUNG B builds).
2. layout: `shr4Base = take(3)` (clk/master/slave) + MMIR4 + the I
   state's mirror tail + one more NOTM. allocate them at the END, next
   to `rotBase` — taking relays mid-sequence re-hosts every later coil
   and that is exactly what pushed a section past the 3.5A overload
   alarm last time.
3. `SH(i, part)`: add `i < 13 ? SHR4(i, part)`.
4. `mm = ... : t < 12 ? MMIR3(t) : MMIR4(t)` in the UP emitter.
5. the step-tree unions: `rightBottom(12) = 3`, which no union covers,
   and `maxCol(12) = cols - 4`, a new bound class. so two new rails —
   `uB3` and `uHIB2` — and STPUNION_CAP 10 -> 12. the right tree gains
   `poolHop(c + 3, uB3, false)` and `if (dir > 0 && c === cols - 3)
   refuse(uHIB2.request('changeover'))`. the LEFT tree needs nothing:
   I's bOff is 0, so its left-entering column is the shared d0 check.
6. the B fan gains offset 3: a fourth tap bank sourced from the I state
   mirror (NOT a WID-style compat net — I is ring-only, no legacy
   slide reaches it), tapping `fanPos[j - 3]` for j >= 3.
7. `caps` (the per-state step-mirror bank sizes) gains a 13th entry.
   count it from the emitter's actual requests and let the bank assert
   catch drift rather than guessing high.
8. the page + driver + tests: SHAPES is the single source of truth for
   rendering, so the page follows for free; the driver's own copy of
   the geometry table (verify-tetris-page.mjs) needs the 13th row.

the receipt: I spawns, falls, steers to both walls, refuses the right
wall at cols-4, locks, and completes a line by itself only at 4 wide.
plus the singleton refusal (UP mid-fall says no) and the ring walk
(12 -> 0 wraps).

## RUNG B, resized honestly (2026-08-21)

the earlier "40-60 relays" estimate counted the ENGINE and forgot the
STATES. counting properly: a full tetris piece set with every rotation
is 19 oriented shapes (I 2, O 1, S 2, Z 2, J 4, L 4, T 4). the ring
holds 12 today, of which 9 are tetromino orientations (O, S, Z, and the
two horizontal forms each of L/J/T) and 3 are the toy shapes (1x1,
2 wide, 2 tall) that the legacy slide modes and ~all the tests are
anchored to. so the gap is TEN more states, not two, and each state
costs 3 ring relays plus a mirror tail plus its transition branches.

so B is not one rung. the sequencing that actually works:

- **B0 — SHAPES becomes N rows.** today the record is
  `{bOff,bW,tOff,tW}` and every consumer reads those four fields
  (circuit, page, tests, driver). generalise to `rows: [{off,w}, ...]`
  bottom-first, keep bOff/bW/tOff/tW as derived getters so nothing
  else changes yet. receipt: netlist BYTE-IDENTICAL at (8,4) and
  (12,6), the same proof the union derivation used.
- **B1 — the third-row engine + vertical S and Z.** this is where the
  cost is: a phase-3 master/slave chained off P2S, a `p3railA` +
  P3GATE + p3break/p3gate rails, a TOPW2(r) bank routing row r-2's W
  group (rows-2 relays), a third mask fan (PIECET2 + its offset rails)
  behind a second STAGM-style changeover on the column feed, and a
  third collision term (PIECET2(j) AND occupied(tok-1, j)) — the
  row-above occupancy bank LEGINVT already exists and is exactly that
  read. two new ring states ride on top. **this alone answers half the
  user's rotation complaint: S and Z stop being singletons.**
- **B2 — vertical L/J/T, six states.** pure state work once B1's
  engine exists: three relays + a mirror tail + transition branches
  each, and ROT_STATE becomes a real 4-cycle for those three pieces
  instead of the i <-> i+3 flip it is today.
- **B3 — vertical I.** four rows tall, so it needs a FOURTH phase, fan
  and collision term. only worth it after B1 proves the pattern
  generalises; horizontal I (RUNG A) does not depend on it.

the step trees also grow a third entering read per direction
(`stepEntering` returns {b, t} and would return a list), and the
bounds unions are already derived from `shapeRange`, so a 3-row
shape's range falls out with no hand-laid lists — that is the payoff
of the union-derivation commit landing first.

DO NOT wire B1's phase sequencer from this note alone. every first
draft of phase machinery written this session was refuted on review
(the ring reorder, the row-0 NOTOK gap, the root gating that killed
its own flips). draft it, hand it to a clean-context reviewer with
the phase-2 source, THEN wire.

## B1's traps, found on paper before any wiring (2026-08-21)

three that a first draft would walk into:

1. **ROT_STATE stops being self-inverse.** every rotation pair today is
   an involution (1<->2, i<->i+3), which is why `DELTA_SOURCE(t) =
   ROT_STATE(t)` is correct: the source of the branch into t is the
   state t rotates back to. give L/J/T four orientations and rotation
   becomes a 4-CYCLE, so the source of "into t" is the unique s with
   ROT_STATE(s) === t — a separate ROT_PRED function. reusing
   ROT_STATE there would aim every branch's delta checks at the wrong
   shape, and the symptom would be rotations that pass legality they
   should fail. this is the off-by-one that already bit the MMIR
   pairing once ("pairing it with t -> t+1 was an off-by-one that
   walked on the wrong checks").
2. **the driver's rotation receipt asserts a 2-cycle.** it checks
   `L -> L flip -> L` on a falling piece. under a 4-cycle that becomes
   `L -> L vert -> L flip -> L vert2 -> L`. that is a REAL behaviour
   change, so the receipt gets rewritten deliberately — not quietly
   widened until it passes.
3. **a 3-tall piece cannot exist at rows 0 and 1.** phase 2 already
   handles this by simply not having a TOPW(0) — the top row is not
   written when the token is at row 0, and game-over latches on any
   lock at row 0 anyway. phase 3's bank starts at r = 2 for the same
   reason. worth stating because the natural first draft writes
   `for (let r = 0; r < rows; r++)` and silently addresses W(-1).

and one thing that is CHEAPER than it looks: the bounds. `shapeRange`
already derives a shape's legal columns from its geometry, and the step
trees' bound unions are now derived predicates over `maxCol`. so a
3-row shape's horizontal limits fall out with nothing hand-laid — that
is what the union-derivation commit bought.

## A LIVE BUG found while designing B1 (2026-08-21) — cells materialise

designing the phase-3 sequencer raised the question "is the SHAPE frozen
for the duration of a multi-phase lock?" — because the rotation muxes aim
at the rotation partner whenever a token is alive, and the token IS alive
from the lock press until the reset two ticks later. probed instead of
assumed, at 12x6, with an L (state 6, 3-wide bottom + a left stem):

    no UP mid-lock:  row10 "X....."   row11 "XXX..."   <- four cells, correct
    UP mid-lock:     row10 "XXX..."   row11 "XXX..."   <- SIX cells

so an UP pressed between the lock press and phase 2 re-aims the T fan and
phase 2 writes the ROTATED shape's top row over the already-written
bottom. the piece gains cells out of nowhere. this is in the shipped game
today, not something RUNG B introduces — and it is a plausible cause of
the "new shapes appear? conflicts?" report from the fast-gravity session,
since the page's key queue drains at every settle, including the settles
between a lock's phases.

the fix looks small: the UP clock's + already enters at UPM's set-1 arm,
and LKM2 (a lock-master mirror, up from the lock press until the reset)
has a free set — running the arm's feed through its NC refuses UP for the
whole lock. two wires. but the 'reshape legality' test deliberately
probes with LKS UP, so that scenario has to be re-read before touching
this: it may be asserting a refusal that would then come from the lock
gate rather than from the delta check it is about.

fix it as ITS OWN rung, with the failing test first — not folded into a
piece rung.

## B1 — the phase-3 write, DRAFT WIRING (2026-08-21). REVIEW BEFORE WIRING.

read out of the phase-2 block rather than remembered. what exists today:

    tick slide -> LKS (the LOCKED slave, master/slave off LKM)
    LKS.G -> P2S.H changeover
              P2S.J (NC, no phase 2) -> resetRail
              P2S.G (NO, phase 2)    -> p2railA
    p2railA -> P2CLR, P2GATE, the P2CUT bank            (depth 1)
    P2GATE's two sets -> p2break and p2gate rails       (depth 2)
    p2gate -> P2COL, and -> TOPW(r).H -> W(r-1,0).E     (the row-1 write)
    p2break ->            TOPW(r).L -> W(r-1,nGates).com
    P2COL.set2 -> STAGM.H: NC -> colFan (symmetric tops ride the B fan),
                           NO -> colFanT (staggered tops ride the T fan)
    P2M's set   = TICKM2.G AND COLLIDEM2 (press-scoped) AND VMODE
    P2M's break = P2CLR (rides p2railA, so phase 2 ends phase 2)
    P2S copies P2M only while the tick is LOW and holds while HIGH

### the proposed phase 3, as a NESTED changeover rather than a parallel one

    LKS.G -> P2S.H
              P2S.J -> resetRail                    (unchanged)
              P2S.G -> P3S.H                        (NEW: nest, don't fork)
                        P3S.J -> p2railA            (phase 2 as today)
                        P3S.G -> p3railA            (phase 3)

nesting keeps ONE branch live at a time by construction — a fork would
need a mutual-exclusion argument, and the tie-point law says two rails
hanging off one contact bridge each other. P2S stays UP through phase 3
so the reset rail is not reached early.

    P3M's set   = TICKM2.G AND (phase 2 is live) AND (the shape is 3 tall)
    P3M's break = P3CLR, riding p3railA
    P3S copies P3M while the tick is LOW, holds while HIGH  (P2S verbatim)

and the CLEAR ordering changes, which is the part most likely to be
wrong: today P2CLR rides p2railA, so phase 2 always ends the lock. with
a third phase, P2M must survive phase 2 when the piece is 3 tall. so
P2CLR's coil becomes p2railA AND NOT-(3 tall), and P3CLR (on p3railA)
breaks BOTH P3M and P2M. a 2-tall piece never raises the 3-tall rail and
its sequence is bit-for-bit what it is today — that is the property to
check first in any review.

### what phase 3 has to drive

- a TOPW2(r) bank, r = 2..rows-1, routing to W(r-2): `rows - 2` relays,
  parallel coils on the same slave mirror coms TOPW(r) uses if a hole
  is free, otherwise their own chain.
- a THIRD mask fan. the B fan writes the bottom, the T fan the row
  above; a 3-tall piece needs the row above THAT. same emitter shape as
  the T fan (offset rails = the states whose third row covers the
  offset, x a pos tap per column), feeding a new PIECET2 bank.
- P3COL, and a second STAGM-style changeover so phase 3's column feed
  reaches colFanT2.

### the collision term

the piece occupies rows tok, tok-1, tok-2. stepping DOWN newly enters
(tok+1, B), (tok, T) and (tok-1, T2). the first two exist. the third is
`PIECET2(j) AND occupied(tok-1, j)` — and the row-above occupancy bank
LEGINVT ALREADY reads exactly (tok-1, j), so this is one more series
branch onto collideNode, not a new bank.

### the step trees

`stepEntering(s, dir)` returns {b, t}; for R rows it returns a LIST, and
the tree emitter walks it. the bounds need nothing: `shapeRange` is
derived and the bound unions are predicates over `maxCol`.

### open questions a review must answer before any wire is written

1. is nesting P3S inside P2S's NO side correct, or does it make phase 3
   depend on P2S's contact timing in a way a fork would not?
2. P2CLR gaining a NOT-(3 tall) gate — is a dead gate relay's NC the
   right idiom here (it is elsewhere), and does the gate settle before
   the rail it gates?
3. does the reset still run exactly one tick after the LAST phase for
   both 2- and 3-tall pieces, and does CLEARP/CLEARP2 sensing still
   land in the right wave? the double clear senses on the PHASE-2
   rails; a 3-tall lock can complete THREE rows.
4. TOPW2's coils: is there a spare hole on the slave mirror coms, or
   does this need its own chain (and does that chain change any jack
   already at capacity)?
5. the mid-lock UP bug above doubles in exposure with a third phase —
   is the LKM2 gate enough, or does the SHAPE need latching for the
   duration of the lock?

## width sweep with the I in the ring (2026-08-21)

built every width 4..10, before and after, counting jack-capacity
violations:

    cols   baseline (12 states)        with the I (13 states)
     4     builds, 0 violations        builds, 0 violations
     5     builds, 6 violations        builds, 6 violations
     6     builds, 0 violations        builds, 0 violations
     7     builds, 12 violations       builds, 12 violations
     8     builds, 7 violations        STPREAD pool exhausted (57/56)
     9     builds, 12 violations       STPREAD pool exhausted (65/64)
    10     builds, 6 violations        STPREAD pool exhausted (73/72)

two separate things here, and only one is new:

- the VIOLATIONS at 5, 7, 8, 9, 10 are PRE-EXISTING — those widths were
  already not physically buildable. only 4 and 6 are clean, and 6 is
  what ships. this is the buildability debt the roadmap already logs.
- the POOL EXHAUSTION is new: the I's right-step trees each spend one
  more gated read (`poolHop(c + 3, uB3)`), and `STPREAD_CAP = 8 *
  (cols - 1)` has no room for it past seven columns.

NOT bumping the cap. `stpReadBase` is taken in the MIDDLE of the
allocation sequence, so widening it shifts every later bank — which is
exactly what re-hosts coils onto other machines and pushed a section
past the 3.5A overload alarm last time. widths 8-10 are already
unbuildable on jack capacity, so the trade would be real risk at the
shipping width for no gain at an unusable one. the 10-column rung has
to revisit the pool formula and the jack debt together; this note is
the pointer.

## THE CROSS-REVIEW VERDICT (2026-08-21) — three FATAL, draft refuted

a clean-context reviewer took the B1 draft apart against a real build at
the shipping geometry and a tick-by-tick trace of a vertical lock. the
draft does not survive. recorded in full because the next person needs
the traces, not the conclusion.

**F1 — phase 3 goes dark on every phase-2 cut.** P2CLR / P2GATE / P2COL /
P2CUT / CUTBD / CUTB1 / CUTC5 read 1 ONLY on the phase-2 tick: their
coils hang directly on p2railA (:1369, :1387, :1389) or one hop behind it
(:2396). the instant P3S diverts LKS.G to p3railA they all de-energize
WHILE THE PHASE-3 WRITE RAILS ARE HOT — the P2CUT bank drops so the
collision readback reconnects during a live write (the exact thing that
bank exists for, :1380), and CUTB drops so the B fan re-bridges colFan
(the leak CUTB was added to kill, :2364-2369). feeding those coils from
both rails is FORBIDDEN: a coil jack is a permanent tie, so that wire
ties the two rails together and deletes the exclusivity the nesting was
for. nesting therefore forces a DUPLICATE depth-1 bank (~17 relays) the
draft never counted. note vertical S/Z escape the CUTB half by luck
(1-wide bottoms bridge nothing); vertical L/J/T do not.

**F2 — "phase 2 is live" has ONE spare contact set in the block, on the
relay the draft switches off.** every other p2railA rider's sets are
spent; the only free one is P2CLR's — exactly what the draft inhibits for
3-tall pieces. wire P3M's set there and a 3-tall lock HANGS: P2CLR
inhibited -> P2M never breaks (:1357) -> P2S never drops -> LKS.G never
reaches P2S.J -> the reset rail never energizes -> the token never dies
and every later tick re-runs phase 2. a new P2LIVE relay is mandatory and
was not in the budget. (P2SM's free set is not a substitute: it stays up
THROUGH phase 3 and would re-feed P3M in the same wave P3CLR breaks it.)

**F3 — a third completed row is sensed by nothing, and there is nowhere
to seed a third elevator stage.** LINE(j)'s two sets are both spent for
all six columns (the bottom clear's chain :1269-1276, the double clear's
:1473-1475). even granting a LINE3 mirror bank, the collapse cannot take
the seed: SEEDM2(t).G lands on ELEVA(t-1).E (:1488), and ELEVA(t).E is
2/2 with comOf(ELEVA(t)) 4/4 at EVERY t. a row completed by the phase-3
write stays full forever — the permanent-junk class the double clear rung
already fixed once.

**fixable, but wrong in the draft:** TOPW2's coil tie point does not
exist where the draft puts it (comOf(MIRA(r)) is 4/4 at every r; use
MIRA(r).E or SEEDM2(r).E, E-to-E). the third collision term IS a new bank
after all (+cols): LEGINVT(1..4) are fully spent, only (0) and (5) have a
free set. the 3-tall gate must be `+`-fed continuous like STAGM, never
off p2railA. and TICKM2 is one pair from full — exactly enough for phase
3 and NOTHING left for a fourth, so vertical I (B3) needs another tick
mirror.

**budget: ~84 relays, not 40-60.** all appended after fanW4Base. this
pushes past 180 machines at 12x6, so per-section current wants
RE-MEASURING, not assuming.

**the cheaper construction the reviewer proposed.** drop the third rail
entirely. phase 3 differs from phase 2 in exactly two things: which row
the write routes to, and which fan drives the columns. so keep ONE
p2railA and one P2GATE/P2CLR/P2CUT/CUTBD bank, and add a single ROW2
master/slave (TICKM2-clocked, exactly like P2S) whose two changeovers sit
between p2gate/p2break and TWO TOPW banks: NC -> TOPW(r) as today, NO ->
a TOPW2(r) fan. both are legal one-contact fans by the SEEDM argument
(:1448-1450) — the banks are one-hot on the token row and every
unselected far side dead-ends. T-vs-T2 is one more changeover. this
deletes ~20 relays and kills F1 and F2 STRUCTURALLY: there is only ever
one phase rail, so nothing goes dark mid-lock and nothing needs a
phase-2-live contact. P2CLR's gate becomes "not (3-tall and ROW2 down)",
read off ROW2 itself — the same bit that decides whether another top
write is owed, so the two cannot disagree and the wedge is impossible.
cost: ROW2 moves a branch carrying the write triggers, so it must be
master/slave and must be trace-tested for the exact failure LKS and P2S
exist to prevent; and it changes the 2-tall wire list, so 2-tall
equivalence becomes a behavioural receipt rather than a diff.

**F3 IS UNTOUCHED BY THE CHEAPER CONSTRUCTION AND IS NOW THE LARGEST
UNSOLVED PIECE.** do not start B1 until the third line sense and the
three-hot collapse seed have a design of their own.

## F3 IS SMALLER THAN THE REVIEW THOUGHT — measured 2026-08-21

the review called the third-row clear the largest unsolved piece: no free
contacts for a third line-sense chain, and "nowhere to seed a third
elevator stage" because ELEVA(t).E is 2/2 and comOf(ELEVA(t)) is 4/4 at
every stage. the second half is wrong, and measuring the hole budget
showed why.

**the seed costs ZERO new relays.** ELEVA's own jacks are indeed full,
but you do not have to enter there. measured free at 12x6:
- `SEEDM2(t)` has its ENTIRE second contact set unused (L, K, N all free)
- `SEEDM2(t-1).G` — the node that ALREADY drives ELEVA(t-2).E — has one
  free hole

so a third seed is: tie SEEDM2(t)'s set-2 arm to a CLEARPM3-gated fan tap
and route its NO into SEEDM2(t-1).G. the one-hot ring makes the shared
node legal — when the token is at t, SEEDM2(t-1) is OPEN, so the far side
dead-ends. that is the same argument SEEDM's own fan rests on
(:1448-1450).

**and the walk works.** tested the premise before designing anything, by
appending those wires to a stock (8,4) netlist so every double clear
seeds three stages (wrong for the game, right as a mechanism probe), and
running the suite's own double-clear scenario with markers placed in the
columns the falling 2x2 does not occupy:

    control (two-hot, shipped):  markers rows 3,4 -> rows 5,6   dropped 2
    three-hot (one extra seed):  markers rows 3,4 -> rows 6,7   dropped 3

same completion tick (30), no alerts, no junk, no duplicated rows, both
markers moving together. the elevator is a shift register and an N-hot
hole walks as N.

two probe mistakes worth recording so nobody repeats them: the row
decoder is THREE address bits, so operatorWrite only reaches rows 0..7 —
at twelve rows the writes silently wrapped and the probe measured
nothing; and a marker row placed in the falling piece's own columns
blocks the drop before it reaches the rows under test.

**what is left of F3**, then, is only the SENSE: LINE(j)'s two contact
sets are genuinely both spent (arm and NO of each, measured), so a third
series chain needs a LINE3(j) mirror bank off LINE(j).E — `cols` relays —
plus LINEDLY3 / CPSET3 / CLEARP3 / CLEARPM3 and a fan group. call it
~10 relays at six wide, not the ~22 the review estimated.

STILL UNVERIFIED, and not to be reported as done: the third clear's own
latch and its hold through the phase-3 release; and the SCORE, which
showed 2 here because only two rows actually completed. a genuine triple
must step the ring three times, and that machinery already scored singles
twice once (:2318). trace it before wiring.

## B1b, READ OFF A REAL TRACE (2026-08-21) — and split in two

the review's cheaper construction says "ROW2 master/slave, TICKM2-clocked,
exactly like P2S". before wiring any of it, two measurements.

### the lock trace, at BOTH half-ticks (8x4, 2-tall piece, fast engine)

    t7 HI   LKM=1 P2M=1  P2S=0                 row 7 written  (the press)
    t7 lo   LKM=1 P2M=1  P2S=1                 the transfer
    t8 HI   P2M=0 P2S=1  P2CLR=1 P2GATE=1      row 6 written  (PHASE 2)
    t8 lo   P2S=0                              transfer sampled P2M=0
    t9 HI   RSTM=1, token dies                 (the reset)

three facts that decide the design, none of them guessable:

- **p2railA is TICK-HIGH only.** at t7 lo P2S is already up and P2CLR is
  still 0 — the rail comes from LKS.G, which the tick feeds. so anything
  hung on p2railA is a one-half-tick pulse, and ROW2's master CANNOT ride
  it into the tick-low transfer. it must LATCH, the way P2M latches.
- **P2M is cleared inside the phase-2 relaxation** (t8 HI: P2CLR=1 and
  P2M=0 in the same row). so "not (3-tall and ROW2 down)" has to gate
  P2CLR's COIL, not something downstream of it.
- **the write and the clear are the same half-tick**, which is why the
  third row cannot be bolted on as "one more tick" without moving P2CLR.

### the clock has NO free contact set, measured

TICKM2 at 12x6 reads `H:1 J:1 G:1 L:1 N:2 K:1` free HOLES — but set 1 is
a spent changeover (H at +, G to COLLIDEM2, J to P2M) and set 2 is a spent
changeover (L at +, K to P2S, N unwired). the free holes are on jacks that
are already gating something, so using them means FANNING a contact:
tie TICKM2.J to a second master and, when set 1 opens, P2S's com and the
new slave's com are bridged through their two masters. that is the
tie-point law, and it is exactly the bug class this file exists to avoid.

so: a fourth tick mirror, TICKM4, parallel-coil off TICKM3.E (measured
free: 1 hole). the mirror chain is already TICKM -> TICKM2 -> TICKM3 at
one node; a fourth coil makes it 4x55R in parallel = 13.75R on that feed,
so the SECTION CURRENT gets measured before this is called done, not
assumed from the fact that three already work.

### the split: timing first, routing second

B1b-i — **the fourth tick and the fourth phase, writing NOTHING new.**
TICKM4 + ROW2M (latched like P2M) + a V3 slide/relay for the 3-tall bit +
P2CLR's gate. ROW2 rises for exactly one half-tick window and the lock
takes FOUR ticks instead of three, but with row2gate/row2break's NO sides
still unwired the fourth tick writes nothing: a 3-tall-flagged lock must
put down exactly the same two cells as today. that isolates the risky half
(a changeover moving in the write-trigger path, the failure LKS and P2S
exist to prevent) from the routing half, and it is a real receipt: ROW2 up
in the right window, down before the reset, field identical.

B1b-ii — the TOPW2(r) bank (r = 2..rows-1, routing to W(r-2)), coils on
MIRA(r).E or SEEDM2(r).E (comOf(MIRA(r)) is 4/4 — the draft's tie point
does not exist), hung off ROW2's NO sides, which measure entirely free
(`G:2 K:2`). only then does a third row actually get written.

B1a's inert-contract test goes RED at B1b-i, which is the point of it.

## B1b-i LANDED (2026-08-21) — the fourth phase, writing nothing

four relays appended last: TICKM4, V3M, ROW2M, ROW2X. with the V3 slide
DOWN nothing changes; with it UP a vertical lock is four ticks instead of
three and puts down exactly the same two cells.

the measured trace (8x4, 2-tall piece, V3 up):

    t7 HI   P2M=1                            bottom row written
    t7 lo   P2S=1 LKS=1                      the transfer
    t8 HI   P2M=1 P2CLR=0 ROW2M=1 ROW2=0     row r-1 written; P2M SURVIVES
    t8 lo   ROW2=1 ROW2X=1                   the changeover moves, triggers cold
    t9 HI   P2CLR=1 ROW2M=0 ROW2=1           the third phase tick (writes nothing yet)
    t9 lo   P2S=0 ROW2=0                     both slaves follow their masters
    t10 HI  token dies                       the reset, one tick later

**the wedge, and why the gate chain is +-sourced.** the first cut hung
ROW2M's set chain on p2railA, the way everything else in the phase block
hangs on it. the machine WEDGED: P2M=1, P2S=1, LKS=1, no reset, forever.
ROW2M's LATCH backfed through its own set path into the rail and held
phase 2 on. P2M has the identical latch-plus-set shape and is safe only
because its set path dead-ends at `+` — a supply does not care about
backfeed, a rail driving fifteen coils does. so the chain is
`+ -> TICKM4.G (tick high) -> P2SM (the phase is running) -> V3M (3-tall)
-> ROW2X (is ROW2 up)`, whose product is exactly p2railA's own condition,
and P2CLR's coil moved off the rail onto it. RULE, general: **a latched
relay's set path must dead-end at a supply, never at a driven rail.**

**measured, not assumed:**
- peak supply current, worst branch, full drop: 8x4 2.444 -> 2.536 A,
  12x6 2.863 -> 2.938 A, both on `I(m1.V_POWER)` — the tick machine, which
  is the tightest supply in the build. +92 mA / +75 mA for the fourth
  coil on the tick-mirror node. the overload alarm sits near 3.4 A, so
  there is ~0.5 A of headroom left there and a FIFTH tick mirror needs
  this measurement again before it is wired.
- jack capacity clean at (8,4) and (12,6), zero undefined nodes. (16,8)
  still throws on the pre-existing STPREAD exhaustion, unrelated.
- machines 125 -> 126 at 8x4, 180 -> 181 at 12x6.
- flat pieces are untouched with the slide UP: VMODE gates P2M, so no
  phase means no fourth phase — 1x1 and 2-wide lock in 9 ticks either way.

**the test, checked in both directions.** `B1b-i: the V3 slide adds a
fourth phase tick that writes nothing new` pins the tick count, the
identical field, ROW2 up for exactly one tick-HIGH solve, P2CLR inhibited
on the phase-2 tick and firing on the phase-3 tick, and BREAK BEFORE MAKE
(ROW2 never changes state during a tick-high solve). it goes red on the
rail-sourced gate chain ("expected 16 to be 11" — the lock never ends)
and red with the slave's hold removed ("ROW2 is up for exactly one
tick-HIGH solve: expected +0 to be 1").

**what B1b-ii still owes:** the TOPW2(r) bank itself, r = 2..rows-1,
routing to W(r-2), hung off ROW2's NO sides (measured free: G:2 K:2),
coils on MIRA(r).E or SEEDM2(r).E. and the row-0/1 guard — a 3-tall piece
locking at row 1 would aim phase 3 at row -1; today that is inert because
nothing is routed, and it must stay inert (or be refused in the
collision term) once it is.

## B1b-ii's OUTPUT TIE POINTS, measured (2026-08-21) — the review missed these

the cross-review flagged TOPW2's COIL tie point (comOf(MIRA(r)) is 4/4;
use MIRA(r).E, measured 1 free at both geometries). it did not check the
OUTPUT end, and the obvious one is full: the two jacks TOPW(r) itself
uses to enter row r-1's write-trigger nets — `W(r,0).E` and
`comOf(W(r,nGates))` — measure **0 free holes at every row, both
geometries**. TOPW2 cannot copy TOPW's entry.

but each net has exactly one spare hole somewhere else, because the W
group's coils are chained E-to-E and a coil jack is a permanent tie, so
any jack on the net will do:

    8x4  (nGates 2)  gate net: MIRA(r).G  = 1 free (every row)
                     breaker : W(r,3).E   = 1 free (every row)
    12x6 (nGates 3)  gate net: W(r,2).E   = 1 free (every row)
                     breaker : W(r,5).E   = 1 free (every row)

so the BREAKER rule is general — `W(r, 2*nGates-1).E`, the last breaker
coil in the chain — and the GATE rule is not: at 4 cols the chain is
short enough that both gate coils are full (W0.E carries TOPW(r+1), W1.E
carries the collapse alpha trigger) and the spare hole is on MIRA(r).G;
at 6 cols MIRA(r).G is spent sourcing W2.E and the spare is on W2.E
itself. `nGates > 2 ? W(r, nGates-1).E : MIRA(r).G`, and
assertJackCapacity at both widths is what keeps it honest.

the fan is legal by the same argument as everything else here: the gate
net would then have three sources — the press path (comA), TOPW(r-1),
TOPW2(r) — and no two are ever closed together. TOPW(r-1) and TOPW2(r)
are one-hot on DIFFERENT token rows, and beyond that their far sides
(row2gate vs row3gate) are the two sides of ROW2's changeover, so they
are exclusive twice over.

STILL UNVERIFIED and not to be reported as done: none of this is wired.

## B1b-ii LANDED (2026-08-21) — the third row is written

`rows - 2` relays (TOPW2(r), r = 2..rows-1) plus two sub-rails off ROW2's
NO sides. TOPW2(r) is TOPW(r)'s twin one row up: same coil net
(MIRA(r).E, so it tracks the token row exactly), contacts routing to row
r-2. measured trace, 8x4, 2-tall piece, V3 up:

    t9 HI   P2CLR=1 ROW2=1     rows 5,6,7 written  (was 6,7)

**the entry jacks had to be measured, not copied.** TOPW's own entries
into a row's write-trigger nets — `W(x,0).E` and `comOf(W(x,nGates))` —
are FULL at every row and both geometries. those nets are coil nets
chained E-to-E, so any jack on the net works, and there is exactly one
spare hole on each: the breaker's generalizes (`W(x, 2*nGates-1).E`, the
last breaker coil), the gate's does not — `MIRA(x).G` at 4 cols,
`W(x, nGates-1).E` at 6 — because at 4 cols the gate chain is short
enough that both gate coils are spent and at 6 cols MIRA(x).G is itself
spent sourcing W2.E. assertJackCapacity at both widths is the guard.

**receipts:**
- V3-DOWN behaviour is IDENTICAL to the b1b-i circuit, tick by tick,
  field by field, at both (8,4) and (12,6) — compared against the
  committed previous file, driving each build with ITS OWN btnMachine
  (the first attempt drove the baseline with the new build's button
  machine and produced a nonsense diff: the same class of error as the
  /relays/ bug, twice in one day).
- jack capacity clean at (8,4) and (12,6), zero undefined nodes.
- peak supply current UNCHANGED: 2.536 A at 8x4, 2.938 A at 12x6, both
  still on I(m1.V_POWER). TOPW2's coils sit on the per-row MIRA nets,
  which are spread across machines and never touch the tick machine.
- machines 126 -> 127 at 8x4, 181 -> 183 at 12x6.
- the test goes red on an off-by-one in the routing (aim TOPW2 at r-1
  instead of r-2: "expected 2 to be 3").

**WHAT IS NOT TRUE YET, and is not asserted as if it were:** the third
row repeats the SECOND row's column mask. there is no third-row mask fan,
so with the V3 slide up the machine writes a 3-tall BAR of the top mask,
not a tetromino. that fan (the phase-3 analogue of colFan/colFanT) is the
next increment, and so is teaching the shape ring which states are 3
tall — today V3 is an operator slide and nothing else.

also still owed: the row-0/1 guard. a 3-tall piece locking at row 1 aims
phase 3 at row -1; TOPW2 starts at r=2 so no relay is selected and
nothing is written, which is the right behaviour by construction rather
than by a refusal in the collision term. that wants a test of its own.

## A DEFECT IN B1b-ii, FOUND AFTER SHIPPING IT (2026-08-22)

going to build B1c I probed the severity of having no third line sense,
and found something worse than the missing sense: **with the V3 slide up
AND a line clear in flight, the phase-3 row is WIPED instead of written,
and it takes pre-existing content with it.**

the case matrix, 8x4, 2-tall piece dropped at column 0:

    pre                        v3-off                v3-ON
    r7 .XXX  r6 .XXX  r5 .XX.  -> .XX. survives      -> 0 cells left
    r7 .XXX  r6 .XXX  r5 .XXX  -> .XXX survives      -> empty, score 2 (should be 3)
    r7 .XXX           r5 .XX.  -> both survive       -> both survive
    no completion at all       -> 2 rows written     -> 3 rows written

the first row is the damning one: two cells that CANNOT complete a line
are destroyed. the tick trace shows row 5's content gone at the phase-2
release, before phase 3 ever writes, and the phase-3 write then cleared
again at its own release — so the clear machinery is being aimed at
whatever row the write path currently selects, and ROW2 has moved that
to r-2.

**it is not reachable in shipped gameplay, verified rather than assumed:**
the only slides either page sets are `m1.5` (tick) and the oscillator's
`m116.6` — grepped every setSlide call in both pages — and V3M's slide is
`m178.2`, on a relay machine no page touches. only two wires in the whole
netlist reach that slide and both are V3M's own. the V3 path is opt-in
and half-built anyway (the third row still repeats the second row's
mask), so this is a defect in unfinished work, not a regression: the
V3-down behaviour is byte-verified identical to the pre-B1b circuit.

pinned with `it.fails('KNOWN BAD: a V3 lock during a clear destroys the
third row')`, which passes while the bug is present and goes RED the day
it is fixed. that is deliberate — a comment can be skimmed past, a test
that flips cannot.

**the real fix is the third line sense**, which the cross-review already
named as F3's remaining half: a LINE3(j) mirror bank off LINE(j).E
(LINE(j)'s own two sets are spent changeovers — measured, only the NC
sides have holes, so fanning them is the tie-point trap), plus
LINEDLY3 / CPSET3 / CLEARP3 / CLEARPM3 and a fan group. ~cols + 5 relays.
the block has room: CPSET, CPSET2, LINEDLY, LINEDLY2 and SCPM all have an
ENTIRELY free second contact set (measured L:2 N:2 K:2 at both
geometries).

**ordering correction to the roadmap.** B1c was written as "the phase-3
column mask fan". that is not the next rung. the third row's mask only
matters for shapes whose three rows DIFFER (vertical S/Z/L/J/T); the
cheapest real 3-tall piece is the vertical 3-BAR, whose three rows are
identical, so the current repeat-the-second-mask behaviour is already
correct for it. so:
  1. the third line sense (this defect's fix, and F3's remainder)
  2. the vertical 3-bar as a 14th ring state — the first real 3-tall
     piece, needing no new mask fan at all
  3. only then the general third-mask fan, for the shapes that need it

## B1c LANDED (2026-08-22) — the third line sense and the third seed

`cols + 5` relays: LINE3(j) per column, LINEDLY3, CPSET3, CLEARP3, RSTM3,
CLEARPM3. a row the phase-3 write completes now clears, and the elevator
walks a three-hot hole.

**traced before wiring, because the design rests on it:** during the
phase-3 tick the data rails really do carry row r-2's post-write content.
probed LINE(j) at every half-tick of a triple-completion drop and all
four read 1 exactly when row r-2 goes full (t9 HI). had that been false
the whole bank would have sensed the wrong row.

**two mirrors, both forced by the tie-point law rather than chosen:**
- LINE(j)'s two contact sets are spent changeovers (measured: only the NC
  sides have holes), so a third chain needs LINE3(j), a coil in parallel
  with LINE(j) off its E jack (1 free hole at every column).
- RSTM2's two NCs already break CLEARP's and CLEARP2's latches, and its +
  jack is full (0 holes), so a third latch cannot share it. fanning one NC
  would bridge two clear latches' coil nets the moment the contact opens.
  RSTM3 parallels RSTM2's coil off its E jack (1 free hole).

the seed cost zero extra relays beyond CLEARPM3, exactly as measured back
in the F3 note: SEEDM2(t)'s entire second contact set is free at every
index, and SEEDM2(t-1).G — already driving ELEVA(t-2).E — has one hole.

**receipts:**
- triple (rows 5,6,7 all complete): 4 cells of junk -> 0. all three clear.
- collapse depth: a marker two rows above falls 2->5 with the slide up
  and 2->4 with it down. before the seed it fell 2->4 either way, leaving
  the stack floating one row high.
- the '.XX. survives' case is unchanged at ['XXX.'] — the third sense
  correctly does NOT fire on a row that is not full.
- jack capacity clean at (8,4) and (12,6), zero undefined nodes.
- machines 127 -> 129 at 8x4, 183 -> 185 at 12x6.
- negative control: delete the seed loop and the case goes red with
  "the stack above fell by three rows: expected 4 to be 5".

**STILL WRONG, and pinned rather than described:** a triple scores TWO.
the score clock is its own tangle — CLEARPM2 drives scrClkCom(0), SCPM
drives scrClkCom(8), the even coms chain — and it has mis-counted before
(it once scored singles twice), so the third step gets its own trace and
its own rung. `it.fails('KNOWN BAD: a triple clear still scores two')`
holds the place and goes red the day it is fixed.
