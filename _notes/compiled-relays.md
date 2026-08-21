# hand-wired vs compiled relay logic — the "just port an FPGA tetris" question

asked 2026-08-21. the honest framing: nobody ports a tetris core to a
Minivac directly. what you would actually build is a BACKEND — gate
netlist (yosys JSON, say) -> relays — and then any HDL design compiles.
so the question is not "port or not", it is "is a compiler cheaper than
hand-designing the remaining rungs".

## what a relay backend has to do that a gate netlist never says

- **the tie-point law.** a synthesized net is a driven wire with one
  driver. a Minivac jack is a TIE: two consumers on one contact bridge
  each other and current sneaks backward through one consumer's network
  into the other. so every fan-out needs its own contact set — the
  MirrorBank discipline this repo already has.
- **jack capacity.** 2 holes/jack, 4 on COMMON, 6 on M10/M11. no
  synthesis tool models this; every net needs explicit chaining.
- **no global clock.** relays race (pickup 70mA, dropout 30mA, ~10ms).
  every FF must be a real master/slave pair and the clock distribution
  must be clean or the design chatters. the codebase's hardest bugs are
  all in this class.
- **contact reuse is where hand designs win.** the 4-bit adder here is
  15 relays because SUM is a transfer-contact PARITY LADDER (A's set 1
  splits + into even/odd rails, B and C swap them twice) — a DPDT trick
  that gate synthesis cannot express, let alone find.

## the two baselines that make this measurable, already in the repo

- rung 2: 8-bit SIPO shift register, **24 relays / 4 machines**
  (3 per bit: clock mirror, master, slave)
- rung 3: 4-bit ripple-carry adder, **15 relays / 3 machines**,
  exhaustive over all 256 input pairs

compile the SAME two designs from a plain gate netlist through a minimal
relay backend and compare: relays, wires, matrix N, solve time, and
whether the compiled version passes the SAME tests.

## the decision rule, fixed BEFORE the run

- compiled/hand relay ratio <= 2.5x on BOTH baselines, and solve time
  scaling in line with N: the compiler is viable. building it out
  (HDL frontend, then a real core) beats hand-designing the remaining
  rungs, and the tetris port becomes a genuine option.
- ratio > 4x on either: hand-designing wins for this project; a
  compiled port is a DIFFERENT project (a general relay-logic
  simulator), interesting on its own but not this one.
- in between: report both numbers plus the tetris-scale extrapolation
  (~725 relays x ratio, and what that does to the ~180-solve clearing
  cascade that already costs ~7s) and decide with that in hand.

no result is written here until the run happens.


## MEASURED 2026-08-21 — a working backend, and a split verdict

built the backend described above (~180 lines, scratchpad/relay-compile.mjs):
one relay per primary input / gate output / DFF-half, gate functions as
contact networks, fan-out past two changeover sets minting parallel-coil
mirrors, and a + hole allocator (supplies are per-machine and the six
section + jacks are the same node, so picking a jack with a free hole is
routing, not electricity — the hand shift register does it too). every
compiled design below is FUNCTIONALLY VERIFIED against the same behaviour
as its hand twin, with zero jack-capacity violations.

| design | hand | compiled | ratio | matrix N | 
|---|---|---|---|---|
| 4-bit ripple-carry adder | 15 relays | **32** | 2.13x | 1.47x |
| 8-bit SIPO shift register | 24 relays | **29** | 1.21x | 1.17x |
| 1-of-8 decoder, naive gates | 4 relays | **31** | 7.75x | — |
| 1-of-8 decoder, cones collapsed | 4 relays | **20** | 5.00x | — |

receipts: the adder is exhaustive over all 256 input pairs (ALL CORRECT);
the shift register shifts a test pattern through correctly; both decoders
are one-hot correct at all 8 addresses.

## what the numbers say

**my prior was wrong and the datapath result is the interesting one.** i
guessed 5-10x across the board. for DATAPATH it is 1.2-2.1x — a
mechanically compiled adder and shift register are nearly as dense as the
hand ones, because a full adder and a master/slave DFF have no cleverness
left to find. that part of an FPGA port would be nearly free.

**CONTROL logic is where it collapses, and tetris is nearly all control
logic.** rung 4's 1-of-8 decoder is FOUR relays by hand: a three-level
transfer-contact tree whose eight leaves are plain JACKS, not relays. a
gate netlist cannot say "the leaves are nodes" — it says "eight AND3
gates", and every gate output that drives something becomes a relay. even
after collapsing each cone into a single series contact chain (a real
relay-aware optimisation, implemented and measured) it is 20 relays: 8
leaves, 3 inputs, and **9 FAN-OUT MIRRORS** — each address literal is read
by four leaves and a relay carries only two contact sets.

that mirror term is the structural tax and no compiler escapes it. hand
designs dodge it by borrowing spare sets off unrelated relays, which needs
global knowledge of what is free — exactly the MirrorBank / stBanks
bookkeeping the tetris generator is full of.

note the decoder was added AFTER the decision rule was written, because
the first two baselines turned out to both be datapath and unrepresentative
of tetris. recording that so the result cannot be read as if the rule had
predicted it.

## the verdict, and what it does NOT say

- **porting an FPGA tetris through a naive backend: no.** at 5-8x on
  control logic the ~725-relay game becomes ~3600 relays, and the solve
  cost — already the user-visible pain at ~7s per clearing cascade — is
  superlinear in matrix size. that is minutes per line clear.
- **but a relay backend is not worthless.** it is right for anything
  datapath-shaped, where it is within ~2x and needs no design thinking at
  all. if a future rung wants a counter, a comparator, an adder, a wide
  register — compile it.
- **the gap is closable in principle and expensive in practice.** what
  would close it is multi-level factoring that SHARES contact chains
  across cones (that factoring IS the transfer-contact tree) plus letting
  a cone's output drive a coil directly instead of buffering it. that is
  a logic-synthesis project against an unusual cost model (series/parallel
  contact networks, two sets per relay, 2-hole jacks). interesting; not a
  shortcut.

so: keep hand-designing the tetris rungs. keep the backend in the
scratchpad as a tool for datapath-shaped subproblems. the 5x is an UPPER
bound on the gap (the decoder is the most tree-friendly circuit in the
repo) and 1.2x a lower bound; nothing measured says where tetris control
logic actually falls between them.
