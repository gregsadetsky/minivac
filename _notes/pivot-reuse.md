# the solve lever: pivot order / symbolic factorization reuse

the user-reported symptom: ~7s from a line making contact to the field
settling. arithmetic says that is SOLVE time, not theater — a clearing
lock owes ~36-40 bookkeeping ticks (3 per collapse stage), each tick is
two full solves (slide press + release), each solve ~70-90ms in the
browser at ~725 relays. the page's theatrical holds are already down to
one frame per owed tick.

## what dc() does today (fast-circuit.ts)

every dc() is a FROM-SCRATCH sparse gaussian elimination:
- pivot ROW: min-nonzero bucket, tie-break on cached row max, then index
- pivot COL: largest |v| in that row
- threshold repivot: collect the column, repivot if |v| < 1e-3 * colmax
- elimination through a sparse accumulator, bucket maintenance per
  affected row
the pivot ORDER is recorded already (`order`, orderN) — for the
back-substitution, but it is exactly the artifact a reuse path needs.

## the two levers, in increasing payoff

1. PIVOT-ORDER REUSE: cache the (pivot row, pivot col) sequence keyed by
   the matrix's structural signature; on a hit skip the search, the
   bucket maintenance and the threshold collects. saves the search, not
   the arithmetic — plausibly 30-50%, NOT 5x.
2. SYMBOLIC FACTORIZATION REUSE: with the order fixed, the FILL PATTERN
   is fixed too. precompute, per pattern, the flat list of (target
   index, pivot index, multiplier source) triples and run the numeric
   phase as a straight loop over typed arrays — no scatter/gather, no
   stamps, no bucket bookkeeping. this is the classic symbolic/numeric
   split and is where the 2-5x lives. lever 1 is its prerequisite.

## the thing to measure FIRST (do not build on a guess)

the whole idea rests on patterns REPEATING. in this simulator a closed
contact is stamped as a wire, so the sparsity pattern changes whenever
any relay flips — and a relaxation flips relays every iteration. so:
- how many DISTINCT structural signatures does a game tick produce?
- what fraction of solves are repeats (within a tick? across ticks?)
- how is dc() time split between search+bookkeeping and arithmetic?
if repeats are rare, BOTH levers are worthless and the honest answer is
to say so and look elsewhere (e.g. reusing the previous solution as a
warm start cannot help a linear solve; substructuring per machine is
the remaining idea, and it is the "last resort" already in ROADMAP).

instrumentation plan: a counter behind an env flag in fast-circuit —
signature = cheap rolling hash over (rowStart, aCols) after stamping —
tallying total solves, distinct signatures, and repeat hits, plus
coarse timers around the search vs elimination phases. run it over a
real game tick and a clearing lock's cascade.

## validation protocol (user-specified, non-negotiable)

- new-fast vs current-fast AND vs the dense oracle on the incremental
  ladder: 5 / 50 / 500 / 5000 random circuits
- the full suite under fast
- the standing 5000-circuit sweep
- ~100 spot cases against the original sparse engine (not the world)
zero mismatches or it does not land.


## MEASURED 2026-08-21 — BOTH LEVERS ARE DEAD

instrument: FNV-1a over the post-stamp row structure, counted per dc().
validated first — four solves driven at an IDENTICAL relay configuration
collapse to ONE signature (3 repeats), so repeats ARE detectable.

the game, 12x6:
- one ordinary fall+lock:      91 solves, 91 distinct, **0.0% repeat**
- a clearing lock + collapse: 182 solves, 180 distinct, **1.1% repeat**

the decision rule written before the run said: repeat rate under ~30%
means both levers are worthless. it is 0-1%. so:
- PIVOT-ORDER REUSE: dead. there is nothing to reuse an order FROM.
- SYMBOLIC FACTORIZATION REUSE: dead for the same reason (it needs the
  fill pattern to be stable across solves, and the pattern is the thing
  that changes).

why, mechanically: a closed contact is stamped as a WIRE, so the node
merges — and therefore the whole matrix structure — change whenever any
relay flips. a relaxation flips relays by construction (that is what it
is relaxing), and consecutive game states differ too. the matrix is
essentially never the same twice.

## what is actually left

- SUBSTRUCTURING (per-machine thevenin reduction at used jacks): the
  roadmap's "last resort", and now the only surviving structural idea.
  it rests on a DIFFERENT invariant than pattern-repeat — that most
  MACHINES are untouched between consecutive solves even though the
  global pattern changed. that invariant has NOT been measured. do that
  before building anything: instrument per-machine relay churn between
  consecutive solves; if the median solve touches only a few machines,
  the reduction has real headroom, and if it does not, substructuring
  dies here too and the honest answer is that the solve cost is what it
  is.
- reducing the NUMBER of solves is the other axis and is cheaper to
  explore: a lock costs ~91 solves today. worth a look at whether the
  owed-tick bookkeeping can settle in fewer relaxation passes.

the instrumentation stays in fast-circuit.ts behind `profStats.on`
(default false, one boolean test per solve) because the substructuring
question needs the same kind of evidence.


## THE FULL PERF PICTURE, MEASURED 2026-08-21

four measurements, each with its rule written before the run:

1. SPARSITY-PATTERN REPEAT (pivot-order + symbolic reuse):
   0.0% on an ordinary lock, 1.1% on a clearing cascade. **DEAD.**
2. PER-SOLVE MACHINE CHURN (substructuring's premise): median **2 of
   178 machines** touched per solve (1.1%), p90 13, max 22, and ~30% of
   solves change nothing at all. the reuse premise HOLDS — if machines
   could be reduced independently, ~176 of 178 reductions would survive
   a solve untouched.
3. THE BOUNDARY (substructuring's cost): 49% of wires cross machines;
   3446 distinct boundary jacks against a matrix of N ~= 8950; median
   26 ports per machine, max 54. so the interface is ~38% of the whole
   system, and each machine's reduction is a DENSE block of 26-54 —
   the reduced boundary system would carry far more fill than today's
   very sparse matrix. **payoff uncertain, quite possibly negative.**
4. ISOLATED/DANGLING ROWS (a cheap pruning win?): median 105 of 8950 =
   **1%**. the hypothesis that most nodes are unwired jacks carried for
   nothing is WRONG. no win here.

## conclusion: no cheap solver lever exists

the ~7s post-clear cascade is close to the floor for this architecture.
what remains is substructuring, and measurement 3 says its reduced
system may cost more than the sparse solve it replaces — it is a large
engine build (per-machine schur complements, a boundary assembly, and a
full equivalence protocol against the dense oracle) with a genuinely
uncertain payoff. NOT recommended now.

better places for the same effort, in order: random piece dealing (a
free-running relay ring sampled at START), then the I piece and the
vertical orientations (the 3-row piece engine), then 10 columns. if the
solve cost ever becomes the actual blocker, come back to
substructuring, prototype the boundary assembly FIRST on one tick, and
only build it if the prototype beats the current solve.

the measurement kit stays: `profStats` in fast-circuit.ts (pattern
signature, N, dead rows) and `churnStats` in minivac-simulator.ts
(machines touched per solve), both default-off, one boolean test each.
probes: scratchpad/dbg-profile.mjs, dbg-churn.mjs, dbg-boundary.mjs,
dbg-size.mjs.
