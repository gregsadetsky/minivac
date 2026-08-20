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
