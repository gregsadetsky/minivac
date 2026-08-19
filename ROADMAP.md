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
- 1-of-8 decoder tree + 8x4 register file with addressed write: 68 relays,
  12 machines, per-cell private hold-break contacts — a shared per-row hold
  rail hit the tie-point law (a cell being set backfed the broken rail
  through its own hold contact and kept its clearing sibling alive)
  (multivac-register-file.test.ts)
- 5-state one-hot ring sequencer, 3 machines (multivac-ring-sequencer.test.ts)
- collision + line-full logic: 256-combo exhaustive + composed onto stored
  rows (multivac-collision-line.test.ts, multivac-register-file.test.ts)
- MINI-TETRIS: 4x8 field, gravity, stacking, line clear — 145 relays,
  25 machines, pure wiring (multivac-mini-tetris.test.ts)

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
4. DONE 2026-08-19 — DECODER + REGISTER FILE — 1-of-8 relay tree + 8x4 with
   addressed write (multivac-register-file.test.ts). the addressing pattern
   is proven; the write group is 4 relays/row because every cell needs BOTH
   a private data gate and a private hold-break (see tie-point note above).
   the full field (10x20) is ~35-70 machines later.
5. DONE 2026-08-19 — GAME-TICK SEQUENCER — 5-state one-hot ring counter
   (the shift register bent into a ring), seeded by holding START through
   one clock rise (multivac-ring-sequencer.test.ts).
6. DONE 2026-08-19 — COLLISION / LINE LOGIC — standalone 256-combo
   exhaustive (multivac-collision-line.test.ts) AND composed onto the
   stored register file through the cells' spare second contact sets
   (multivac-register-file.test.ts). line-full = series-contact AND;
   collision = OR of per-bit piece-AND-cell series branches.
7. DONE 2026-08-19 — VERTICAL SLICE: "mini-tetris" 4x8 field, 1x1 piece,
   gravity + stacking + line clear (no collapse yet), 145 relays across 25
   machines, every game decision in relay contacts
   (multivac-mini-tetris.test.ts). THE composition milestone. six new
   tie-point/latch lessons paid for and documented in the file header —
   the big ones: a latch contact feeding + into a com latches everything
   wired to that com (set paths need private isolating contacts); two wires
   on one contact-output jack tie their rails together with the contact
   open (one rail per contact); rails powering relay coils must die
   relay-timed, depth-aligned with the contacts they race.
8. PERF GATE — MEASURED 2026-08-19 at the 25-machine tetris scale: sparse
   ~160-200ms/solve; a game tick = 2 relaxations x ~3 waves = ~1.1-1.3s
   (merged lock ticks ~2-3s). breakdown per solve: build 5.6ms, finalize
   ~0ms, dc() 198ms — the NONLINEAR dc solve dominates (bulb curve =>
   newton iterations from a cold start every solve), NOT stamping/rebuild.
   playability math: classic gravity is ~1 cell/s, so the current page is
   already at the edge of playable; soft-drop feel wants ~5-10 ticks/s =
   5-10x; the 10x20 field (~35-70 machines) wants ~30-50x.
   CORRECTION after reading sparse-circuit.ts: dc() is a SINGLE LINEAR
   solve — bulbs are re-fit by the outer relaxation, there is no inner
   newton in the sparse engine. the 198ms is implementation cost: per-row
   Maps/Sets, a full scan of remaining rows per pivot step, fill-in churn.
   LEVER (a) LANDED 2026-08-19: THIRD ENGINE 'fast' (fast-circuit.ts) — a
   typed-array rewrite of the sparse elimination, same MNA stamps and pivot
   policy, from-scratch solve per dc() (no caching needed to hit target).
   measured: 159 -> 9.6 ms/solve (16.7x), tetris tick 1.2s -> ~70-100ms
   (~13-18x depending on box load), init 289 -> 117ms. validated on the
   incremental ladder vs the dense oracle: 5 / 50 / 500 / 5000 random
   circuits, zero mismatches, max current diff 1.1e-10 mA (sparse's own
   record: 1.4e-10) + 300 adversarial meshes bit-identical + full suite
   green under MINIVAC_SOLVER=fast. suite default remains 'sparse';
   /tetris/ runs 'fast'. three engines now, permanently cross-checked
   (fast-engine.test.ts in every pass, fast-mass-validation MASS-gated).
   remaining levers if the 10x20 field still wants more:
   b. pivot-order reuse across dc() calls with identical sparsity.
   c. substructuring (per-machine thevenin reduction at used jacks) — still
      the last resort.

9. DONE 2026-08-19 — PIECES, horizontal: a piece is whatever COLUMN MASK the
   slides raise — the lock feed and collision taps already fan per-column
   through private contacts, so dominoes (and wider) needed ZERO circuit
   changes. proven: two-domino line clear, overhang physics, mixed-width
   random gameplay (multivac-mini-tetris.test.ts); /tetris/ toggles piece
   size with the up arrow. NEXT for pieces: vertical/2-row shapes and
   rotation — that DOES need circuit work (a second token row: tail bit per
   ring stage or a paired token, collision sensing two rows down, and a
   two-row lock).
10. FIELD SCALING: 10x20 with row collapse after a line clear (rows above
   shift down = the stored-row shift machinery). this is where the rung-8a
   solver rewrite becomes necessary rather than nice.

## display/input notes

- the canvas viewer reads relay states directly as pixels — the playfield does
  NOT need light bulbs (saves ~34 machines of light budget).
- input: buttons on a dedicated machine (left/right/rotate/drop), debounced by
  the game-tick FSM.
- browser stays on cktsim until the multivac ui lands (see multivac-ui.md).
