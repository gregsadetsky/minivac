# rotation groups (the rotation rung) — design, 2026-08-20 ~21:40Z

## the goal

UP should ROTATE the falling piece (step within its orientation set),
not walk all twelve shapes. real-tetris feel, in contacts.

## the groups (2-row engine truth)

with tops+bottoms spanning at most 2 rows, the reachable orientation
sets are:
- {0} 1x1, {3} O — self-groups (rotation = no-op)
- {1 <-> 2} the domino (2wide <-> 2tall)
- {4} S, {5} Z — SINGLETONS here: their other orientations are 3-tall
  (the vertical S/Z need the 3-row engine; same for I entirely)
- {6 <-> 9} L, {7 <-> 10} J, {8 <-> 11} T — the two horizontal
  180-degree forms each; the two vertical forms are 3-tall (absent)

## the ONE-BUTTON design (no new key)

UP's meaning depends on whether a token exists — routed by a NOTOK
changeover on the UPM clock contact:
- NO TOKEN (pre-spawn): the OLD full-cycle network = the piece
  SELECTOR. it already exists and pre-spawn every occupancy rail is
  dark, so all in-bounds transitions pass — zero changes needed.
- TOKEN FALLING: a NEW rotation network — same emitted structure as
  the UP network (MMIR-class per-target gates -> one-hot pos fans ->
  series delta reads -> the ring clock com) but with the ROTATION
  successor rot(i) (in-group next) instead of i+1. the emitter already
  computes deltas for ARBITRARY state pairs (reshapeEntering), so this
  is a successor-function parameter + a second emission pass.
- singletons: no branch = UP is a machine-refused no-op mid-fall
  (nothing conducts, the ring holds) — bounds-refusal semantics reused.

rough size: 8 rotation transitions (4 pairs x 2 directions) x legal
positions ~ 8-20 branches — SMALLER than the selection network.
resources: its own pos-fan requests (fanPos free sets), its own read
pool, one NOTOK mirror (coil on the spawn/token state — check which
existing relay carries 'no token' cleanly; SPAWN's latch state or a
ring-slave-none union... the LKS/idle path may already offer it),
and the UPM root changeover (UPM set2? check spends).

## page changes

- ArrowUp UX unchanged (one key, context does the right thing);
  the clamp walk must use the ROTATION successor's target when a
  token exists (geometry from SHAPES; the page already computes
  ranges) and the old cycle pre-spawn.
- help text: 'up = rotate (pre-spawn: choose piece)'.

## receipts plan

- suite: a rotation test (L1 <-> L2 mid-fall with occupancy refusals
  both ways, domino flip, S/Z/O/1x1 no-op, the selection cycle still
  full pre-spawn); the walk test unchanged (pre-spawn = old cycle).
- driver: rotate mid-fall in the step-exact game; select pre-spawn.
- gates as ever: file, check, sweep; deploy by sha.

## the paper pass RESOLVED the design (21:50Z) — alternative C

the one-button two-network idea has a fatal flaw: the SUCCESSOR MAP
lives in the MASTER SAMPLING CHAIN (slave i feeds master next(i)
continuously), not in the clock network — the network only decides
whether the clock conducts. two different successors would need a
D-feed mux on every slave. the fix that shrinks it:

REORDER THE RING so rotation pairs are adjacent:
  0 1x1 | 1 2wide, 2 2tall | 3 O | 4 S | 5 Z |
  6 L1, 7 L2 | 8 J1, 9 J2 | 10 T1, 11 T2
then mid-fall rotation IS the forward edge for group-first members
(1->2, 6->7, 8->9, 10->11 — same successor, no mux), and only the
FOUR group-last slaves {2,7,9,11} need a D-feed changeover (mid-fall:
back to group-first; pre-spawn: the normal next). singletons refuse
natively (no mid-fall branch). cross-group branches gain ONE series
NOTOK contact at the transition root (8 roots = 4 mirror relays).

NOTOK source: a NC-series chain through the SEEDM(t) mirrors' FREE
second sets (they are ring-slave parallel coils, one per row; set1
feeds the seed fan, set2 unspent) -> 'no token anywhere', rows-scaled.

mux-flip safety: the shape ring's clock only rises on UP presses;
spawns/deaths happen on FALL ticks with the shape clock LOW — the
masters are transparent-D there, so a mid-low successor change just
re-samples (the ring pattern's own discipline covers it).

budget: NOTOK + its chain (1 relay), ~4-6 NOTOK mirrors (8 root
contacts + 4 mux changeovers), the 4 back-edge network branches with
delta checks, the reorder itself (free — everything derives from
SHAPES order; SHBOOT still seeds state 0 = 1x1).

reorder blast radius: SHAPES array order + any test/page site that
hardcodes state INDICES (the emitters and ranges all derive; the walk
test derives; grep for literal ring indices before assuming).

## open questions (paper-check before wiring)

- the NOTOK signal source: needs a relay whose contacts say 'no token
  exists' with a free set — candidates: the SPAWN latch chain, LKS's
  idle side, or a small union of ring-slave NCs (12-wide series NC
  chain = expensive; prefer an existing single relay).
- UPM contact budget: which set feeds the current root chain, is the
  other set free for the changeover?
- the tie-point law at the fork: the changeover's two throws feed two
  network roots — each root dead-ends at open master contacts when its
  network is idle, so the fork should be legal; verify on paper.
- DEALER (random pieces) comes LATER on top: a free-running ring
  sampled at START replaces manual selection under auto; selection
  stays for operator play.
