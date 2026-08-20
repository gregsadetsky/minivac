# row collapse ("the elevator") — rung 10 design note, 2026-08-20

goal: after a line clear at row r, rows 0..r-1 shift down one; row 0 empties.
built and proven at 4x8 BEFORE scaling the field: the collapse is the last
novel mechanism; field size is repetition.

## designs rejected on paper

1. one-tick simultaneous shift (the fpga way): every row's old state must
   survive while the cells re-latch -> a second storage plane (master/slave
   field). ~64 relays at 4x8 and O(cells) at 10x20. dead end for scaling.
2. naive row-copy through the rails (source breakers + destination gates):
   the source's holds break, its coil loses all feed, and the readback
   contacts open ONE WAVE before the destination gates see the rails. the
   press only survives its own readback because the cell refeeds itself
   through its own gate — a copy has no such loop for the source.
3. per-cell direct transfer (shift mirrors + row triggers): O(cells) again
   (~48 relays at 4x8), and the simultaneous version still ORs into
   uncleared destinations.

## the surviving design: sequential moves, 2 ticks per row, O(rows)

the hole starts at the cleared row r and walks UP. each step moves the row
above the hole down into it, using three firing shapes the machine already
has:

- tick alpha (move): SOURCE row (above the hole) fires gates+breakers = a
  full self-press: its content goes onto the data rails and relatches
  itself through its own gates (the proven press mechanism). DESTINATION
  row (the hole) fires GATES ONLY (the operator-write shape): it latches
  the rails into an empty row = an exact copy. colFan never fires, so the
  mask slides cannot inject — no mask parking needed. LINE relays energize
  from the rails but the chain root (LINEDLY, press-only) is dark.
- tick beta (clear + step): SOURCE fires BREAKERS ONLY (the line-clear
  shape): its holds break with gates dark and the row drops out. the
  elevator chain advances one stage up.
- last move is 0 -> 1; clearing source row 0 empties the top. done.

## machinery

- ELEV chain: one-hot master/slave chain (rung-5 ring pattern, chained in
  the REVERSED direction — the token ring only walks down). stage t = "the
  hole is at row t". 8 stages x 3 relays.
- seeding: the chain must start at the token's row at clear time. per-stage
  SEEDM mirrors (parallel coils on the ring slaves' spare E-jack holes, the
  TICKM2 trick) gate a CLEARP-scoped + into each stage's master com. the
  seed path dead-ends at + (law 3).
- tick lane: ELEVM/ELEVS master-slave branch (the P2S pattern) INTERCEPTS
  BETWEEN LKS.J AND COLLIDE.H — if the collapse ticks reached COLLIDE, the
  ring would clock and spawn mid-collapse. ELEVS.J (NC) -> COLLIDE.H keeps
  the normal path one pre-closed contact deeper. clocking needs a tick-low
  contact (TICKM2.N, free) and a tick-high one (TICKM3, a third parallel
  tick mirror on TICKM2.E's spare hole).
- alpha/beta alternation: a toggle bit (counter pattern) clocked by the
  collapse ticks.
- trigger routing per stage t: ELEVW mirrors (2 relays/stage) route
  - collapseA rail (alpha only) -> comA_{t-1} (source gates) and
    comA_t (destination gates),
  - collapseB rail (alpha AND beta... beta only for the clear; alpha's
    source breakers ride it too, so: hot both phases) -> comB_{t-1}.
  hole scarcity: comA nodes are FULL (sel, W0.E+TOPW tie, W1.E, MIRA.G);
  W(x,1).E has one spare hole and the rest comes from JUNCTION COMS —
  unused sections' com jacks as 4-hole junction boxes.
- SPAWN waits naturally: SPAWNCLR fires only on the ring clock, which is
  dark during the collapse; the armed spawn fires on the first normal tick
  after the elevator finishes.

## increments

- C1: ELEV chain + SEEDM bank + alpha/beta toggle, trace test (seeds at the
  token row on a clearing lock, walks up one stage per tick-pair, drains).
- C2: ELEVP tick lane (latch + ELEVS branch), spawn deferral proven.
- C3: trigger routing + junction coms; the move; the full battery
  (mid-stack clear, floor clear, empty-above no-ops, back-to-back clears,
  vertical interactions, random gameplay with collapse in the model).
- C4: page (auto-run while collapsing, "rows falling" note) + playwright.
- C5: gates (check + dense + fast + MASS scenario with a collapse), deploy.
