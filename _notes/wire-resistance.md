# "wires are 0.1-ohm resistors, not shorts — is that costing us?"

asked 2026-08-21. measured, because the answer turned out to be much
bigger than the "if it is 1% do not worry" the question allowed for.

## what the model does today

`WIRE_RESISTANCE = 0.1` (minivac-simulator.ts:66). every patch wire is
stamped as a RESISTOR between two distinct nodes, so both of its jacks
are real nodes in the matrix. contacts, by contrast, ARE ideal shorts.

## the measurement

union-find over the parsed wire terminals: every merge an ideal short
would perform is one node the matrix loses.

    8x4 :  125 machines, 3118 wires, N=6051, solve  82ms
           merges 3118 -> N ~2933 (48% of today's)
    12x6:  180 machines, 4782 wires, N=9146, solve 145ms
           merges 4782 -> N ~4364 (48% of today's)

and the empirical growth between those two points: **time ~ N^1.39**.
so shorting the wires would put 12x6 at N ~4364 and roughly **36% of
today's solve time — about a 2.8x speedup**. that is the largest lever
found in this project; every idea in _notes/pivot-reuse.md came back
dead by comparison.

## three things that stop this being a free win

1. **the exponent is a two-point fit.** the 48% node reduction is exact
   (it is a count). the time estimate is not — N^1.39 from two sizes is
   weak. measure four or five geometries before trusting the 2.8x.
2. **it changes the ELECTRICAL MODEL, not just the speed.** a wire drops
   0.1 ohm x I: ~20mV at 200mA, so ~200mV down a ten-wire chain, ~1.5%
   of the 13.3V supply. the pickup/dropout thresholds in this file were
   CALIBRATED on a real Minivac with this model in place, and the
   3-coils-in-series case is already knowingly mispredicted. removing
   the drops nudges every current up and can flip relays sitting near
   threshold. this needs the full dense-oracle re-validation and the
   5000-circuit sweep, not a swap.
3. **it costs per-wire current.** the relay viewer colours wires by
   I = (V(a)-V(b))/R, which only exists BECAUSE a wire is a resistor.
   merge the nodes and a wire has no current of its own; recovering it
   would mean solving flows inside each merged node.

## what it does NOT break

the worry that prompted the question — a disconnected wire reading
something insane or floating — is not the blocker. floating islands
already exist and are already regularised with a 1e-12 diagonal (see
CLAUDE.md, and the 'previously-diverging comparator' regression test).
merging REDUCES the node count, so there would be fewer of them.

## recommendation

do not touch it as a side quest. but if the ~200ms solve ever becomes
the thing blocking the game — and it is already the visible pain in the
line-clear cascade — this is where to go, and the order is: (a) fit the
exponent properly over several geometries, (b) prototype the merge
behind the existing solver-engine switch so both models can run side by
side, (c) re-validate against the dense oracle before believing a single
game result.
