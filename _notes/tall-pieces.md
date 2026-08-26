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

## THE SCORE'S THIRD STEP: attempted, TRACED, and REVERTED (2026-08-22)

not shipped. what the attempt established, so the next one does not start
from a guess:

**why a triple scores two.** the score ring steps once per clock CYCLE,
and every clock com is one chained node. two pulse sources feed it: SCPM
(the bottom clear, deliberately ended when phase 2 rises — "CLEARP signal
AND NOT phase 2") and CLEARPM2 (the top clear). traced across a triple:

    t8 HI  CLK=1 CP=1 CP2=1 CPM2=1              sc2
    t9 HI  CLK=1 CP3=1 CPM3=1  <- still high    sc2
    t10 HI CLK=0                                sc2

CLEARPM2 holds the clock high from the phase-2 tick straight through the
phase-3 tick, so CLEARPM3 rising inside that window is not a new cycle.
the third clear needs the clock to FALL first.

**the obvious fix over-counts, and here is exactly why.** gate the top
pulse on ROW2's NC — the same shape SCPM uses one phase earlier — and the
triple scores 3 correctly. but ROW2 is a two-edged signal: it goes up at
the phase-2 release and DOWN again at the phase-3 release, so with a
double (V3 up, only two rows completing) the top pulse falls at t8 lo and
RE-RISES at t9 lo, giving a third cycle for two rows. measured:

    depth      v3-off   v3-ON with the naive gate   want
    triple       2            3                      3   ok
    double       2            3                      2   OVER
    top-only     1            2                      1   OVER

so the cut has to be LATCHED — up from the phase-2 release until the
reset — not live-gated on ROW2. and that is where it stops being cheap:
ROW2's and ROW2X's contact sets are all spent, so nothing can SET such a
latch, and ROW2M is cleared at the phase-3 tick so it cannot be it either.
a latch needs both a set contact off ROW2 (none free) and a break off the
reset, i.e. at least one more relay AND a free ROW2 contact that does not
exist. that is a design problem, not a wiring one.

useful hole facts found on the way: every score clock COM is full (all
five, both geometries), but each clock relay's E jack has one hole and is
the same node — a coil jack is a permanent tie — so a third pulse HAS
somewhere to land once the timing is solved. ROW2X.E has one free hole for
another mirror coil.

reverted rather than shipped: an over-count on doubles is worse than the
under-count on triples that is already pinned. `it.fails('a triple clear
still scores two')` stays.

**SECOND ATTEMPT, LANDED.** the cut has to be latched, and the reason
ROW2 cannot set that latch is worth stating plainly because it is the
general lesson: ROW2's own contacts hang off p2gate/p2break, which are
TICK-HIGH rails, so they are dead at exactly the tick-low where ROW2
moves. a signal that changes at a tick-low can only be read through a
contact whose arm is at + . so two relays:

  ROW2Y  a mirror of ROW2 with its arm at + (coil off ROW2X.E, 1 hole)
  ROW2Z  latched by ROW2Y.G, held through its own NO against RSTM3's NC,
         and its NC is the top pulse's gate

the third pulse lands on `SCR(2,0).E` — every score clock COM is full at
both geometries, but a clock relay's E jack is the same node and has a
hole.

every depth now counts right in both slide positions:

    depth      v3-off   v3-ON   (naive live gate, for contrast)
    triple       2        3      3
    double       2        2      3   <- was the over-count
    single       1        1      1
    top-only     1        1      2   <- was the over-count

negative control: point the gate back at ROW2Y's live NC instead of
ROW2Z's latched one and the case goes red with
"expected [ 3, 3, 1, 2 ] to deeply equal [ 3, 2, 1, 1 ]".

## B1 CONCRETE WIRING PLAN, second draft (2026-08-26) — REVIEW BEFORE WIRING

goal: ring states 13 (S vert) and 14 (Z vert), driving the LANDED phase-3
engine (B1b-i/ii + B1c are in main, slide-driven via V3M). geometry, in
machine rows (bottom-first, off/w relative to pos p):
  S vert = [{0,1},{0,2},{1,1}]  bottom X at p,   mid XX at p..p+1, top X at p+1
  Z vert = [{1,1},{0,2},{0,1}]  bottom X at p+1, mid XX at p..p+1, top X at p
(these are the NRS verticals of the machine's S and Z, mechanically
verified as true quarter turns in tetris-reference.test.ts; landing order
matches TARGET_SHAPES 13/14.)

### increments, each with its own receipt

B1-0 (prerequisite, byte-identical): SHAPES entries become
  { label, rows: [{off,w},...] } with bOff/bW/tOff/tW as DERIVED getters
  so every existing consumer (emitters, page, driver, tests) reads on
  unchanged. receipt: netlist byte-identical at (8,4) and (12,6).

B1-1 (states + mode rails): NSTATES 15; ring hardware per the rung-A
  edit list (clk/master/slave + MMIR tail + NOTM extension + state
  mirrors SVM2/ZVM2); unions gain the new memberships:
  - VMODE: both (they have a phase-2 row)
  - V3: both — the union splices at V3M.E exactly as VMODEM's splices,
    per B1b-i's own comment ("when the ring learns the tall shapes")
  - STAG: both (mid mask != bottom mask, phase 2 must read the T fan)
  - WIDM: NEITHER (1-wide bottoms)
  - Z vert's bottom is the OFFSET single at p+1 = T2's bottom pattern
    verbatim: BCUT suppresses the base, the WIDM-tap-alone carries p+1
  - S vert's bottom is the plain base at p
  T fan: both states' MID mask {p, p+1} — new private series pairs into
  PIECET(p)/PIECET(p+1), same emitter shape as S/Z's branches.

B1-2 (the third fan + phase-3 mask): a PIECET2(j) bank + colFanT2 node
  group; the phase-3 column feed diverts there through a NEW parallel
  mirror ROW2W (coil on ROW2's coil net, since ROW2's own sets are the
  write changeover and ROW2X's four are spent): P2COL.K -> ROW2W.H;
  ROW2W.J (NC, phase 2) -> STAGM.H (the existing changeover, so phase 2
  is bit-identical); ROW2W.G (NO, phase 3) -> colFanT2. PIECET2 branches:
  state 13 -> {p+1}, state 14 -> {p}, private per state x pos.
  RECEIPT: a 3-tall lock writes three DIFFERENT row masks where the
  verticals demand it, and the V3-slide-only tests stay green (slide-up
  with no vert state = old behavior: PIECET2 dark, but ROW2W diverts the
  feed... SEE OPEN QUESTION 1).

B1-3 (collision: the top row rests on content): new term
  PIECET2(j).set2 AND occupied(tok-1, j) — the tok-1 occupancy SOURCES
  exist (the MIRCT-gated rails). entry into the collide node: the com's
  spare hole went to LEGB (3b-2), so the new branches need another
  entry — candidate: chain off the LEGB branch net's tail (they are
  series branches into the same node; a tail extension is one more
  parallel branch). AUDIT NEEDED.

B1-4 (rotation + selection): ROT_STATE grows 4<->13, 5<->14 (still
  involutions — ROT_PRED is a B2 problem, not B1). the rotation muxes:
  S/Z's mux NCs are wired NOWHERE today (singletons); they now aim at
  13/14 mid-fall, and the new states' muxes aim back. transition
  branches into 13/14 read the delta cells; sel edges 12->13->14->0
  rewire the chooser wrap (the 12->0 D-feed moves to 14->0).

### the two SEAMS B1 ships with (page-guarded, documented, like 3a did)

the machine cannot read row tok-2 (no third occupancy bank): so
  (a) LATERAL steering of a vertical checks bottom+mid rows in contacts;
      the top-row cell is a page guard until a B1-5 adds MIRCT2/LEGINVT3
  (b) ROTATION into a vertical checks its tok-1 delta in contacts; the
      tok-2 delta is the same page guard
precedent: increments 2 -> 3a shipped exactly this shape for the 2-tall.

### OPEN QUESTIONS for the reviewer (refute freely)

1. ROW2W diverts phase 3's column feed to colFanT2 UNCONDITIONALLY when
   ROW2 is up — but the V3-SLIDE path (no vert state, PIECET2 dark) then
   writes an EMPTY mask in phase 3?! B1b's tests expect the slide-up
   phase 3 to write the B/T mask (the '3 rows same mask' receipts).
   options: (i) accept and REWRITE those tests (the slide becomes a
   service switch whose phase-3 mask is empty unless a vert state is up
   — but then B1b's 'V3 adds a third row' receipt loses its content);
   (ii) ROW2W's NO feeds colFanT2 AND the old path stays through a
   PIECET2-default... no — two rails on one contact output is the
   tie-point law. (iii) make the slide-up case ALSO populate PIECET2
   via a slide-driven default branch (a V3M set feeding PIECET2 from
   the B mask columns) so the old receipts keep meaning. leaning (iii).
2. is the collide-node entry for B1-3 real? count the holes.
3. the T fan for mid {p,p+1}: S/Z states imply wide bottoms and their
   fan gates on pos mirrors directly — the vert states' mid needs the
   same two columns but their WIDM union is OFF. does the existing
   T-fan emitter shape carry a 2-column top for a state with no wide
   rail, or does it assume tOff/tW only? (the emitters read the 2-row
   record; the ROWS array's third row is invisible to them — how much
   is hand-laid vs derived must be pinned per site.)
4. reset timing: ROW2M's arm is gated on V3M.G (LIVE rail, not
   press-sampled). the lock freezes the shape (LKM2/LKM3), so the V3
   union is stable through a lock — is that enough, or does phase-count
   sampling need a P2M-style latch at the press?
5. anything about CLEARP2/CLEARP3 and the score's ROW2Y/Z that assumes
   "phase 3 mask == phase 2 mask"? B1c's LINE3 senses the rails during
   the phase-3 tick — with a DIFFERENT mask on the rails the sense is
   still the true row content (rails = mask OR readback), but check the
   double/triple-clear collapse seeding for mask assumptions.

## B1 REVIEW VERDICT (clean-context adversarial review, 2026-08-26)

the second draft was refuted in four places. full review kept with the
session log; the DECISIVE findings, folded in:

- Q1 -> a FOURTH option wins: the phase-3 diversion is VERT-GATED, not
  unconditional. ROW2W's coil = + -> ROW2Y.L (its set 2 is FREE — only
  set 1 is spent on the score latch) -> a vert-union contact -> ROW2W.E.
  slide-only phase 3 keeps the NC path and writes the bar exactly as
  today: B1b/B1c receipts stay green untouched. ROW2W's second set then
  hosts the cut-chain split below.
- B1-2 was REFUTED twice: (1) diverting the FEED does not sever the
  GATES — CUTC5/6 ride p2railA and are closed during phase 3, so the
  continuous T fan's closed gates bridge rail p to rail p+1 through
  colFanT and S vert's phase 3 writes a FIFTH cell. the cut chain must
  split: CUTC5/6 become (CUTBD AND ROW2-down), new CUTC7/8 for the
  colFanT2 gates become (CUTBD AND ROW2-up), riding ROW2W's second set.
  (2) the T2 fan's pos taps OVERFLOW FANPOS (7/8 used at cols 0-1
  already): it needs its OWN appended pos bank + rail relays.
- B1-4 was REFUTED as fatal-at-load: upResourceCounts asserts the
  selection edge and rotation edge share one branch with identical pos
  ranges; appended at 13/14 with selection prev = I, the ranges diverge
  (and at 4 cols the ring would WEDGE at I: I lives only at pos 0, the
  into-Sv branch only at pos >= 1).
  THE FIX (post-review synthesis): the SELECTION CYCLE IS JUST D-FEED
  WIRING, not index order (the rotation rung's own lesson: "the D-feed
  wires ARE the map"). so the chooser becomes
    ... 3 O -> 4 S -> 13 S vert -> 5 Z -> 14 Z vert -> 6 L ... 12 I -> 0
  with 13/14 physically appended (no spine surgery). then every new
  edge's selection predecessor IS its rotation partner (or has an
  identical range): prev(13)=4=rot(13); prev(5)=13, rot-src(5)=14, and
  Sv/Zv ranges are identical; prev(14)=5=rot(14); prev(6)=14 vs
  rot-src(6)=9 — both intersect L's range identically. the assert holds
  at 4 and 6 (CHECK MECHANICALLY in upResourceCounts before wiring).
  COST: NSTATES stops being the selection order — the circuit exports
  SELECTION_NEXT and the reference/page/driver read it (the reference's
  (i+1)%n dies).
- B1-1's union bullet contradicted itself: Z vert needs WIDB membership
  (the T2 tap mechanism needs BOTH nets) or its bottom locks EMPTY.
  splice holes, counted by the review: BCUT interior full -> enter at
  L2M(0).K; STAG chain -> SM(3).G; VMODE chain -> I2TM.G; V3 -> V3M.E.
- B1-3's entry: the LEGB tail is FULL; the real hole is COLLIDE.E
  (1 free). reads = a new LEGBT bank paralleling LEGINVT(j).E (exactly
  1 free hole per column). MIRCT covers r=1..rows-2: token at rows-1
  reads dark (benign, floor lock — say so in the test).
- NEW TRAPS from the review: T4 — Z vert's LEFT step tree needs a
  14-gated bypass + d1 read (the T2/L2 bypasses are hand-laid per
  state; without it Zv false-refuses AND can step INTO stored content).
  T7 — a 3-tall lock at row 1 clips its top silently with no game-over
  (TOPW2 starts at r=2; GOM is row-0 only): declared-limit test needed.
  T2 — LINEDLY2 is live on the phase-3 tick (coil on P2COL.G, P2COL on
  p2gate, hot both phases): an r-2-ONLY completion latches CLEARP2 too,
  whose pulse holds row r-1's breakers = the wipe class, PLUS a spurious
  ELEVA(t-1) seed. LIKELY LATENT IN MAIN TODAY (slide-only, no page
  reaches it); B1 makes it common. trace first, then fix (a ROW2-down
  series contact in LINEDLY2's feed — but note during a NON-tall lock
  ROW2 is down and must stay conducting; the gate must distinguish
  "phase 3 live" not "vert piece", i.e. ROW2X/ROW2Y state).
- B1-0 is sound and lands first, with shapeRange (and homeColumn)
  generalized to ALL rows in the same increment (correct-by-coincidence
  for S/Z vert, wrong for B2's vert J), byte-identical receipt.

## T2 WAS REAL, AND IT HAD A SECOND FACE (fixed 2026-08-26, pre-B1)

the probe (phase3-line-sense-probe.test.ts: an r-2-ONLY completion by a
slide-driven 3-tall bar) reproduced the review's wipe on the first run:
row r-1 came back ZERO. and fixing the wipe exposed a second gap in the
same untested case: the SCORE read 0 — SCBOOT's latch paths only covered
bottom (CLEARPM.K) and top (CLEARPM2C) clears, so a phase-3-only first
clear left the boot seed live and the ring TWO-HOT (digits 1100000000).

the fix, two appended relays, both entries hole-counted:
- P3LG parallels ROW2's coil net (ROW2Y.E's free hole); its NC sits
  ahead of LINEDLY2's coil. phase-2 sense identical (closed NC, zero
  waves added); the phase-3 tick can no longer reach CLEARP2.
- CLEARPM3B parallels CLEARP3's com net (CLEARPM3.E's free hole); its
  NO enters the SCBOOT latch net through CLEARPM2C.G's free hole.
both pinned by the probe test (which was red before each half).
NOTE for B1: the review earmarked ROW2Y's set 2 for ROW2W's coil gate —
P3LG used only ROW2Y's COIL-NET hole (E), not the set. the set is still
free for B1.

## B1 LANDED (2026-08-26, same session as the review) — see ROADMAP 50

executed as reviewed, with these deltas discovered while wiring:
- the mux pool needed NOTHING: with the selection cycle re-threaded,
  states 13/14 are one-wire D-feeds (rotation partner IS selection
  successor) and t=5/t=6 keep muxes — still exactly 12.
- FANPOS overflowed exactly where counted; grew 4 -> 5 mirrors/position.
- colFanT2 shipped UNGATED (single-column masks bridge nothing); the
  B2 cut bank's entry is reserved at ROW2W.G.
- LEGBT is belt-and-braces at B1: for S/Z verts the mid provably
  vacates the top's entering cell. it starts doing real work at B2 (L vert
  R's top {p+1,p+2} vs mid {p+1} — (tok-1, p+2) is a real entry).
- THREE first-draft trace scenarios were physically impossible (sweep
  covers the delta column; the mid rests the piece first; S can't
  enter pos 0). derive the reachable form on paper first, THEN probe.
B2 ledger notes that survive: ROT stops being self-inverse (ROT_PRED);
the selection cycle grows to the full TARGET_SELECTION_CYCLE prefix
(6 -> 15 -> 9 -> 16 -> 7 ...); the T2-fan cut bank; a third occupancy
row for the seams; upResourceCounts' 2-row views undercount 3-row
DELTAS for 4-cycles (the into-vertical branches read only the mid —
fine at B1 where the tok-2 seam is declared; B2 must re-audit).

## B2 LEDGER, first draft (2026-08-26) — REVIEW BEFORE WIRING

six states: 15 L-vert-R, 16 L-vert-L, 17 J-vert-R, 18 J-vert-L,
19 T-vert-R, 20 T-vert-L (TARGET_SHAPES geometry, quarter-turn-verified).

1. ROT_STATE becomes a real 4-cycle for L/J/T (6->15->9->16->6 etc.) —
   and DELTA_SOURCE(t) must become ROT_PRED(t) (the unique s with
   ROT(s)=t), NOT ROT_STATE(t): with involutions they coincided; with
   4-cycles reusing ROT_STATE aims every into-branch's delta checks at
   the wrong shape (tall-pieces trap #1, now live).
2. SELECTION_CYCLE grows to the target prefix: ... 6 -> 15 -> 9 -> 16 ->
   7 -> 17 -> 10 -> 18 -> 8 -> 19 -> 11 -> 20 -> 12 ... — every family
   edge's selection predecessor IS its rotation source (the reference's
   all-edges invariant test already passes this at 4/6/10). D-FEED
   NOTE: family-internal edges become one-wire feeds; count the mux
   pool consumption fresh (12 today; edges into 12 and 0 and the toy
   states keep muxes; expect the pool to SHRINK in consumers — verify,
   do not assume).
3. the T2-fan CUT BANK becomes required: L/J vert tops are... CHECK:
   L vert R rows[2] = {off 1, w 2}?? NO — L vert R = [{1,1},{1,1},{1,2}]:
   the TOP row (rows[2]) is {off1,w2} = TWO columns -> the closed
   PIECET2 gates bridge rails during any fall of that state. the cut
   bank (CUTC7/8-class) enters at ROW2W.G (reserved at B1's split) and
   must conduct ONLY during a vertical's phase 3.
4. the T2 fan grows offset rails (tops at off 0,1,2 across the six
   states) + T2POS taps beyond 2 sets/pos -> T2POS banks need capacity
   counted fresh; FANPOS feeds stay 1/pos (bank pattern).
5. upResourceCounts/the UP emitter see 2-ROW views: the into-vertical
   branches read only bottom+mid deltas. at B1 the tok-2 seam was
   declared; at B2 the 4-cycles make rotations INTO 3-row states from
   3-row states (15->9 reads a 2-row target: fine; 9->16: target 3-row)
   — enumerate which deltas the emitter MISSES per edge and either
   extend the emitter to rows[2] reads (needs a tok-2 occupancy bank =
   B1-5's MIRCT2/LEGINVT3, pulling that increment INTO B2) or declare
   the seams per edge. THE DECISION for the reviewer.
6. LEGBT starts doing real work (L vert R: top enters (tok-1, p+2), not
   covered by the mid) — its firing finally testable in play.
7. phase-2/3 row COUNT is per-state: all six are 3-row -> V3 union
   membership; mids: 15 {p+1}x1, 16 {p+1}... every mid is 1 column
   EXCEPT none? check: 15 mid {1,1}, 16 mid {1,1}, 17 {1,1}, 18 {1,1},
   19 mid {1,2} (T vert R: [{1,1},{1,2},{1,1}]), 20 mid {0,2}. so T
   verts have 2-column MIDS -> STAG memberships + T-fan entries; L/J
   verts have 1-column mids EQUAL to neither bottom nor... their mid ==
   bottom column for 15/17 ({1} vs bottom {1}/{1,2}?) — 15 bottom
   {1,1}: mid == bottom -> NOT staggered (phase 2 rides the B fan)?
   the staggered predicate is derived (tOff/tW vs bOff/bW) — audit per
   state what phase 2 must write vs what the derivation gives.
8. bounds/unions: all derived; new classes possible (check mkUnion
   coverage of rightBottom/rightTop/leftTop values the six states add).
9. caps for stBanks[15..20] + STPMIR/STPREAD growth; count from the
   emitters' requests, let the bank asserts catch drift.

## B2 REVIEW VERDICT (clean-context adversarial review #3, 2026-08-26)

the ledger contained BOTH HALVES OF A CONTRADICTION (T-A, fatal as
drafted) plus a silent-shipping trap. folded:

- T-A: the T2 cut bank's reserved feed (ROW2W.G) hangs off CUTBD.K, and
  CUTBD's coil is p2railA AND STAGM — STAG-scoped. my item 7 kept
  15/18 (L vert R, J vert L: mid == bottom) OUT of STAG -> their
  phase 3 would divert to colFanT2 with the cut bank DEAD and the top
  row would never be written. FIX (reviewed option i): ALL SIX states
  join STAG; the derived predicate becomes
  `rows.length > 2 || mid != bottom`; 15/18's phase 2 rides the T fan
  (identical content), CUTBD lives in both phases, the LEGB term goes
  live-but-inert for them (gravity argument).
- T-B: DELTA_SOURCE reusing ROT_STATE ships SILENTLY at B2 — the
  shared-branch ranges coincide on all twelve 4-cycle edges at 4/6/10,
  so the load assert never fires and only the delta CELLS are wrong.
  DELTA_SOURCE becomes ROT_PRED (the unique s with ROT(s)=t, else
  SELECTION_PREV) plus a NEW load assert:
  ROT_STATE(DELTA_SOURCE(t)) === t for every non-singleton t, plus a
  trace probing a ROT_PRED-only delta cell.
- ITEM-5 CALL (reviewer, adopted): MIRCT2/LEGINVT3 — the tok-2
  occupancy bank — lands INSIDE B2 as its own increment BEFORE the six
  states (~14 relays at 8x4, ~33 at 12x6 + emitter growth: a top2 term
  in upResourceCounts, rows[2] entering reads in the step trees, ~5 new
  union classes -> STPUNION ~17). decisive reason: edge 11 -> 20 has
  ZERO contact checks without it (one pos contact, nothing else), and
  per-edge seams would force a third compat mode into the diff harness.
  SEQUENCING RECEIPT: land the bank against the EXISTING 13/14 first —
  "rotation into S vert refused on (tok-2, p+1) content" is RED today
  and goes green with the bank, before any B2 state exists. B1's two
  declared seams retire with it. (it does NOT finish B3: I-vert needs
  tok-3.)
- D-feeds at 21 states: 12 one-wire, 9 muxes — THE POOL SHRINKS to
  9/12. masters 9/10/11 lose their fourth com wire.
- T2 fan at B2: rails d0={14,18}, d1={13,15,16,17,18,19,20}, d2={15} —
  a THIRD rail; FANRAIL2 take(2)->3, T2POS overflows (6 relays @4,
  10 @6), FANT2 overflows (5 @4, 8 @6). all appended-tail growth ->
  re-measure section current (the 3.5A rule).
- item 9 cost-saver (adopted): a shared "left-bottom-offset-1" union
  (T2|Zv|15|16?|17|18|19|20 — count from geometry) replaces per-state
  left bypasses: 2x(cols-1) sets instead of ~10x(cols-1).
- LEGBT's real-work receipt probes state 18 (J vert L: top enters
  (tok-1, p)), not only 15.
- T-D: ROW2Y.K is 2/2 — the six new coil-gate arms chain arm-jack-to-
  arm-jack off the B1 arms' spare holes.
- T-E receipts due: the driver's rotation receipt becomes a 4-cycle
  (deliberately rewritten, not widened); the relays driver's deal walk
  count; the driver geometry table +6; TETRIS_IO.up's comment.
- 17 (J vert R) needs BCUT+WIDB+WID3 SIMULTANEOUSLY — a combination no
  state uses today; composes on paper, wants its own receipt.
- no chooser wedge at 4 cols (walked); into-12 still steers to 0, as
  shipped today.

B2 BUILD ORDER, final: B2-0 the tok-2 bank + emitter extension
(red-then-green on S/Z verts) -> B2-1 ROT_PRED + load assert -> B2-2
the six states (corrected STAG list, fan growth, cut bank, shared
left-offset union, receipts incl. state 18 and the 4-cycle driver
rewrite).

## B2-0 LANDED (2026-08-26): the tok-2 occupancy bank

MIRCT2/LEGINVT3 per the review's item-5 call — the MIRCT idiom one
level up (coils off MIRCT(r,1).E / the MIRCTX tail; arms through the
MIRCT(r-1) arm jacks' one free hole each; r = 2..rows-2). the UP
emitter and upResourceCounts read ALL THREE shape rows now (plus the
T-B load assert: DELTA_SOURCE must rotate INTO its target); the step
trees grew four derived top2 union classes and hops. RECEIPT: the B1
seam assertion in multivac-vertical-pieces flipped red -> green (a
rotation into S vert now refuses on (tok-2, p+1) content in contacts).
pool growth: STPUNION 12->16, STPREAD 9->11(cols-1), STPMIR
55+7(cols-1), retNode 4->5 groups, caps[13/14] +1 relay each.

TWO NEW GENERAL LESSONS, paid for at 3.53A:
1. THE ARM-SOURCE RULE: a member contact sources its whole destination
   net's coil current from whatever machine feeds its arm. a state with
   many memberships (the verticals) concentrates every union/rail/mode
   chain on its own mirror bank's supply — machine 94 tripped the
   overload alarm the moment S vert was selected. fix, now the emitters'
   convention: CHAIN the member arms (the B fan's POSS-arm idiom) and
   feed the chain ONCE from the DESTINATION rail's machine. this also
   keeps the destination's + jack at one wire.
2. destination relays whose own + is 2/2 (both arms legacy-fed: WIDM3,
   STAGM2) cannot source their own splice — the feed comes from a
   provably-free + on a low-load machine (LEGB's + jacks are unused at
   every geometry). count the + holes like any other jack: the audit
   catches it (it did, three times).
- scenario lesson AGAIN: a floor-bound piece has no steerable tok-7
  moment (merged lock) — the conducts-proof moves sideways.
