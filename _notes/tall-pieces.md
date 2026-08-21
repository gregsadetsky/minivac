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
