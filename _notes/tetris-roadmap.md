# multivac -> tetris roadmap (2026-08-19)

## proven so far (all in the test suite, pure wiring, no gates-cheating)

- multivac core: N machines in one circuit, `b.3G` cross-wiring, per-machine
  supplies, common negative rail (src/simulator/tests/multivac.test.ts)
- gates NOT/AND/OR/XOR (truth tables + settle depth 1-4), cross-machine XOR
- SR latch; clocked master-slave D flip-flop across 2 machines (no capacitors)
- 2-bit synchronous counter across 4 machines, 24 cycles
  (mirror relays for fan-out; two clock relays for contact isolation)
- 4-bit register with parallel load (4 machines); 4-bit ripple-borrow
  comparator, 256/256 (multivac-register-comparator.test.ts)
- sparse solver: 11-26x, equivalence-validated; heavy validators kept env-gated
  (MINIVAC_MASS=1), 400 random circuits run in every suite pass
- 32-machine sparse cascade smoke past the letter-alias range
  (multivac-scale.test.ts)
- 8-bit sipo shift register: 4 machines, chained master-slave dffs, one
  clock-mirror relay per bit (multivac-shift-register.test.ts)
- 4-bit ripple-carry adder: 3 machines, 15 relays, parity-ladder sum +
  kill/generate/propagate carry, 256/256 (multivac-adder.test.ts)

## THE LAW (cost us two debugging sessions, also bit the 1961 book authors)

a contact jack with two consumers is a TIE POINT: when the contact is open the
jack still bridges the consumers. fan a gated signal out through one contact
only if every consumer's far side is guaranteed dead when the contact opens.
otherwise: one contact per consumer (mint contacts with parallel-coil mirror
relays). assertJackCapacity() in the tests enforces 2 holes/jack, 4/com.

## next building blocks, in order — EACH tested under both engines
(pattern: loop the test over setSolverEngine('cktsim'|'sparse'), like
sparse-engine.test.ts, or run suite with MINIVAC_SOLVER=sparse)

1. DONE 2026-08-19 — ADDRESSING PAST 8 MACHINES. numeric `m12.3G` is
   canonical (a.-h. legacy aliases); 16-machine both-engine cascade +
   32-machine sparse smoke/perf point in multivac-scale.test.ts.
2. DONE 2026-08-19 — SHIFT REGISTER (8-bit, serial in, parallel out) — tetris
   GRAVITY. chained the proven DFF, 4 machines, both engines
   (multivac-shift-register.test.ts).
3. DONE 2026-08-19 — RIPPLE-CARRY ADDER (4-bit) — score/position arithmetic.
   sum = XOR3 parity ladder, carry = comparator-style kill/generate/propagate;
   256 pairs exhaustive under both engines (multivac-adder.test.ts).
4. DECODER + REGISTER FILE — 1-of-8 decoder (relay tree), then 8 rows x 4 bits
   with addressed write. this is the playfield storage pattern. the full field
   (10x20) is ~35-70 machines later; prove the addressing pattern small first.
5. GAME-TICK SEQUENCER — ring counter FSM: spawn -> fall -> collide? -> lock ->
   line-clear -> repeat. reuses counter + decoder.
6. COLLISION / LINE LOGIC — collision = OR-reduction of (piece AND field) row;
   line-full = series-contact AND of 10 bits (cheap!). reuses comparator ideas.
7. VERTICAL SLICE: "mini-tetris" 4x8 field, one piece type (1x1 or domino),
   gravity + stacking + line clear, ~15-25 machines. THE milestone that proves
   composition. only then scale the field.
8. PERF GATE: when slices pass ~20 machines, measure; if sparse fill grows,
   next lever is substructuring (per-machine Thevenin reduction at used jacks —
   interface system is only the cross-wires).

## display/input notes

- the canvas viewer reads relay states directly as pixels — the playfield does
  NOT need light bulbs (saves ~34 machines of light budget).
- input: buttons on a dedicated machine (left/right/rotate/drop), debounced by
  the game-tick FSM.
- browser stays on cktsim until the multivac ui lands (see multivac-ui.md).
