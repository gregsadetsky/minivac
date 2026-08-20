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
   size with the up arrow.
9b. DONE 2026-08-19 — PIECES, vertical ("phase-2 top write"): VMODE slide
   makes the mask two cells TALL (so 1x2 and 2x2 pieces; 163 relays / 28
   machines total). the bottom cell IS the token — collision unchanged —
   and the press writes the token row exactly as before; a P2M/P2S
   master-slave pair (clocked by TICKM2, the LKM/LKS pattern) then turns
   the next tick into PHASE 2: a private power chain (P2GATE->trigger
   rails->P2COL column feed, P2CUT dropping the collision mirrors) fires
   row r-1's EXISTING write group through the TOPW mirror bank, and the
   reset runs one tick late. the press rails stay dark during phase 2 (the
   token row's readback must not re-fire — it can hold stack content) and
   the reset cluster sits phase 2 out (token/LKM/CLEARP survive). limits,
   pinned by tests: top cell clips at row 0; a line completed by the TOP
   write does not clear (token-row-addressed clear machinery; the rung-10
   collapse replaces clears anyway). BONUS BUG the new tests found in the
   rung-7 machine: locking directly above a persistent full row falsely
   fired the line sensor through the collision readback during the press's
   pre-PRESSCUT waves (unreachable before — full rows never persisted);
   fixed by delaying the LINE chain's feed one relay past the press rails
   (LINEDLY). proven: pollution tests with per-leak-source bit signatures
   (floor + stack flavors), 2x2 squares, bottom-write clears with the top
   cell surviving, top-full stays, row-0 clip, vertical-mixed random
   gameplay, a fast-engine scenario (what /tetris/ runs), a dense-oracle
   vertical scenario (MASS-gated). /tetris/: up arrow cycles
   1x1 -> 2 wide -> 2 tall -> 2x2, and the page auto-runs the machine's
   bookkeeping ticks while LOCKED is up (also closes the window where
   steering between the bottom and top writes would shear the piece).
   NEXT for pieces: rotation = just remapping the four shape slides
   (1x2 <-> 2x1 is already the up-arrow cycle); L/S/T shapes need
   per-column row offsets — real circuit work, likely after rung 10.
   gates 2026-08-19: npm run check green + full suite green under dense
   AND fast (181 tests each), MASS dense-oracle tetris scenario with a
   vertical drop green (15.2 min), random gameplay 74 ticks / 14 locks
   (8 vertical) model-checked every tick, /tetris/ page playwright-verified
   on the preview build (vertical drop, 2x2 square, auto-bookkeeping).
10. FIELD SCALING: 10x20 with row collapse after a line clear (rows above
   shift down = the stored-row shift machinery). this is where the rung-8a
   solver rewrite becomes necessary rather than nice.
   design notes 2026-08-20 (from the live-play report + reading
   baliika/fpga-tetris at the user's suggestion): collapse = top-down row
   scan; on a full row, shift ALL rows above down one — the continuing scan
   makes multi-line clears fall out of a single shift mechanism. on relays:
   one transfer contact per cell (load-from-above) + a per-row shift
   trigger, ~another W group per row. address-remapping instead of
   shifting was considered and rejected: it would make the collision
   network's row-below wiring dynamic (per-cell contacts again, worse).
   also queued: game-over latch (spawn collision), score via the adder.
   the live-play "a row disappears" report was reproduced and is NOT a
   bug — it is the line clear with no collapse (rows above float); the
   page now paints the mid-press line flash and says "line cleared! rows
   above stay put" so it reads as gameplay instead of a glitch. permanent
   tests added: steer-into-overlap (both engines; rows vanish only by
   completion) + long random gameplay under FAST (the page's engine):
   158 ticks / 40 locks / 19 vertical / 5 clears, zero model mismatches.

## display/input notes

- the canvas viewer reads relay states directly as pixels — the playfield does
  NOT need light bulbs (saves ~34 machines of light budget).
- input: buttons on a dedicated machine (left/right/rotate/drop), debounced by
  the game-tick FSM.
- browser stays on cktsim until the multivac ui lands (see multivac-ui.md).
