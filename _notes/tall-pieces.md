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
