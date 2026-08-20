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
10. ROW COLLAPSE — DONE 2026-08-20 ("the elevator"): after a line clear
   the stack falls one row into the hole, walked UP by a reversed one-hot
   chain seeded from the dying token (the clearing lock's reset tick
   doubles as the seed-transfer clock). THREE ticks per row, dealt by a
   two-bit relay phase ring: alpha = gates-only move (the source row's
   content leaks onto the rails BACKWARD through its own closed write
   gates — contacts are bidirectional — and the empty hole latches an
   exact copy; nothing breaks, nothing to strand), beta = breakers-only
   clear of the copied row, gamma = chain step with every rail dark. a
   LANE branch slave between LKS and COLLIDE owns the ticks; the armed
   spawn waits and fires after the drain. 220 relays / 38 machines.
   bugs the build traced and fixed (per-tick relay traces + model-checked
   tests, none found by inspection): stepping the chain on a hot-rail tick
   killed the row above before its copy (-> gamma); the alpha fired during
   the seeding reset via its tick-mirror trigger (-> lane-gated phase
   decode); TWO rail-to-rail bridges through the raised mask slides' piece
   relays (colFan tie AND collideNode tie — either cross-writes moving
   rows; mask can change mid-collapse) -> the CUTC bank opens both fans,
   lane-scoped; op-writes with 2+ mask columns raised bridge the driven
   rails (the acceptance probe corrupted its own setup this way — tests
   park the mask first); UNEXPLAINED and avoided, on the list in
   _notes/collapse-design.md: the superseded 2-tick alpha's source died at
   its release against the paper wave-count (the shipped alpha never
   breaks holds, so the mechanism cannot fire).
   receipts 2026-08-20: 3-collapse acceptance run with distinct patterns +
   a mid-collapse mask-swap bridge probe; the lane/phase sequencing walk;
   long random gameplay 231 ticks / 40 locks / 20 vertical / 5 clears with
   collapses, model-checked every tick; npm run check 185 green; fast
   engine-wide suite green; dense engine-wide suite green on 34/35 files
   with the one failure a 600s contention timeout on a sparse-pinned test
   that passed solo (timeouts since raised); playwright page flow incl.
   the visible falling cascade and the sideways-move guard.
   POLICY 2026-08-20 (user call): the recorded engine-disagreement count
   is ZERO across every sweep and suite (sparse-dense 5000 circuits max
   1.4e-10 mA; fast-dense 5000 circuits max 1.1e-10 mA + 300 meshes
   bit-identical + 150 circuits re-checked every pass), so the tetris game
   tests now ITERATE ON FAST (file gate 2434s -> 167s, 14.6x); sparse
   stays the suite default elsewhere; dense composed-game runs stay
   MASS-gated for rung landings.
   KNOWN GAP, promoted to the piece rung: LATERAL COLLISION IS NOT IN
   RELAYS. the circuit cannot refuse a slide (operator-held), so moving or
   reshaping into stored cells overlaps them (benign for data — the lock
   is an OR-write — wrong as tetris); the page refuses such keys as a
   documented stopgap. the relay fix is a machine-held COLUMN REGISTER
   (a sideways token ring) stepped by momentary left/right buttons whose
   step is gated by a legality contact network, exactly as the collision
   network gates the fall — buttons request, contacts decide. this is the
   same piece-becomes-machine-state refactor that L/S/T shapes and true
   rotation need, so all three land together in the piece-register rung.

10.5 THE PIECE REGISTER — increment 1 LANDED 2026-08-20: the column is
   machine state. a one-hot slave ring (POSS 0-3) stepped by momentary
   LEFT/RIGHT buttons on m40: sample-on-press (the target master latches
   through the one live POSM tap; the slaves hold, so the piece never
   flickers), commit-on-release (a one-wave transfer window owned by the
   TWIN relay = "ANYBM already down, ANYBM2 still up"); edge presses
   self-loop; every reset re-homes to column 0; the ring wakes seeded at
   power-on via the BOOTL latch's NC and the first press latches the seed
   line dead. width = the WID slide, feeding PIECE(pos+1) through series
   pos+wide contact gates (POSM2 bank). the per-column mask slides are
   GONE; the page reads position from the machine and presses buttons.
   245 relays / 42 machines.
   the trace test caught FOUR wiring bugs before any game test ran, all
   the tie-point law in new costumes (full stories in
   _notes/piece-register-design.md): the button "wired-OR" through a coil
   jack pressed both directions at once; transferring during the press
   cascaded the ring to [1,1,1,1] through the DEAD direction chain (dead
   chains still tie); seeding via the START button's X line tied the SPAWN
   latch's com to slave 0 (would have held the piece home and re-armed
   spawns forever); the wide taps armed from slave-com nodes back-fed the
   ring through their closed contacts (a wired-OR into a coil jack is
   legal only while every far side dead-ends at an OPEN contact).
   receipts: the register trace test (power-on seed, mid-press holds,
   exactly-one-step commits, both edges, wide feeds at every pos incl. the
   edge degradation, mid-fall steering, lock-tick hold, reset re-home);
   the full tetris file green under fast with the re-home folded into the
   random model; playwright page flow on the button-driven page.
   increment 2 LANDED 2026-08-20, same day: LATERAL COLLISION IS IN THE
   RELAYS — buttons request, contacts decide, like the fall. Occupancy
   rails (cell-com taps gated per row by MIRC mirrors riding the one-hot
   token; row 7 unmapped, rails dark = legal, so pre-spawn/post-lock
   steering stays free) read by LEGINV coils whose contacts sit in every
   D-tap as CHANGEOVERS: legal continues into the target master, blocked
   RETURNS the sample into the current master — a plain block would latch
   no master and the release window would wipe the ring on the first
   refused press. Wide right-steps run a second-read tree (WIDM3 +
   LEGINV2) for the right edge's target, and wide-into-column-3 is the
   WIDM4 wall gate: the wall is geometry in contacts, and the page's
   wide-at-wall clamp is deleted. 267 relays / 46 machines. The page's JS
   guard SHRANK to the two documented seams: the ArrowUp reshape (slides
   cannot be electrically refused) and the tall piece's top cell (the
   token-row read; increment 3 closes it). the wiring passed its trace on
   the first run — the failures that took iterations were MY test
   scenarios (the model now walks with real presses and accepts partial
   walks; wideness for re-home comes from the tracked slide; the old
   steer-into-overlap premise became the refusal receipt, with OR-
   absorption coverage moved to the reshape seam).
   receipts: the lateral-legality trace (wide-edge refusal, the wall in
   contacts, narrow + left refusals, post-lock freedom, re-home); both
   random-gameplay runs green with refusals exercised (114/219 ticks,
   model-checked every tick); full tetris file green under fast;
   playwright page flow with the machine (not JS) refusing the steer.
   increment 3a LANDED 2026-08-20, same day: the TALL piece's TOP row
   refuses too. A second occupancy read one row up (MIRCT gates tied to
   the same cell-com nodes through the MIRC arm jacks' spare holes — the
   coms were full; an arm jack is a tie point, this time working for us)
   feeds LEGINVT/LEGINVT2 coils, and every D-tap tree gains VMODEM forks:
   flat skips the top stage, tall runs it as one more changeover, the
   2x2's wide branch checks the right edge's top as well. Right-into-c is
   now a 4-check tree with a return exit at every stage. Row 0 has no top
   row (the write clips there too) and dark rails default legal, so
   no-token/flat steering never feels the bank. 289 relays / 50 machines.
   The page's JS guard is down to exactly ONE seam: the ArrowUp RESHAPE —
   a slide cannot be electrically refused. Lateral collision is otherwise
   fully in the relays for every current shape.
   SCOPE DECISION, recorded: the full piece register (per-column row
   offsets, L/S/T, rotation as register rewiring) moves BEHIND field
   scaling — the seam it was meant to close is closed; new shapes earn
   their relays on the bigger field where they have room to matter.

11. FIELD SCALING: wider/taller grid = stamping proven patterns; the
   solver budget is the real constraint. also queued: score counter via
   the adder rung.
   GAME OVER LANDED 2026-08-20, same session: any LOCK AT ROW 0 is the
   top-out (a row-0 clearing lock too — documented simplification).
   3 appended relays: GOM ("token at row 0", chained off MIRC(0,1)'s coil
   jack), the GAMEOVER latch, and LKM2 (a lock-master mirror giving the
   set a +-fed lock-scoped arm). TWO wiring bugs caught by the failing
   test before they shipped, both old lessons re-learned: (1) the first
   set path tapped the breaker rail, and the held latch's com BACK-FED +
   onto that rail through GOM's closed contact, re-firing row 0's
   hold-break forever (a set path must dead-end at + or an open contact
   in EVERY state); (2) blocking only the START button missed SPAWN's
   AUTO-RE-ARM on every reset tick — both set paths now converge on
   GAMEOVER's arm jack and enter through its one NC. the random-gameplay
   model plays MULTIPLE GAMES per run now: both seeds were quietly
   locking at row 0 all along, so a top-out power-cycles a fresh machine
   and the coverage continues (seed 20260820: 4 games, 40 locks, 326
   model-checked ticks). the page paints the stack rust-red and freezes
   ("reload for a new game" — the latch is relay-held; only a power
   cycle clears it).
   OPENING MOVE LANDED 2026-08-20 — the DEAD-HARDWARE TRIM (lever (c),
   displacing the planned lever (b)): measured first, +50 EMPTY machines
   tripled a tetris tick (237ms -> 666ms, same wires) because every
   built-in probe is an extra MNA unknown (18/machine) — and pivot-order
   reuse can't cross a contact flip anyway (contacts change the TOPOLOGY,
   not values; an 11-orders value change would fail any threshold check).
   the fix extends the capacitor block's wiredNodes rule to ALL built-in
   hardware: lights, indicator lamps (split from coils — a series lamp
   with its jack unwired can never conduct, so coil-only relays drop the
   lamp probe), coils, contact wires, buttons, slides, supplies, the
   motor. floating islands solve to exactly zero and every reader already
   defaults a missing probe to zero, so the trim is exact, and all three
   engines see the same netlist. machine 0's supply is always emitted:
   an all-empty netlist crashes the dense oracle's matrix code (caught by
   the dense suite — sparse/fast tolerate zero unknowns).
   measured after: tick 237ms -> 71ms (3.3x), press 402ms -> 117ms, and
   machine count is FREE (100 built machines = 50). npm run check itself
   dropped 341s -> 111s. field scaling no longer pays the machine tax.
   THE TALL WELL LANDED 2026-08-20, same session: tetrisCircuit(rows) —
   the whole allocation map became a computed layout (tetrisLayout(rows),
   asserted equal to the hand-laid exports at rows=8 index by index), the
   wiring loops thread rows, fan/rail groups grow by measured per-row
   consumption ("classic size + growth", never smaller, so the 8-row wire
   list is byte-identical except 8 hole reassignments WITHIN chained —
   single-net — rail groups, each verified equivalent). columns stay 4 by
   design (the register/legality/LINE machinery is per-column and scales
   on its own rung). exactly FOUR scale seams existed, all hand-fit spare
   holes or literal indices, all caught by the capacity auditor at the
   first 12-row build: the floor collide's MIRB(7), the SPAWNCLR feed on
   the last ring pair com, gamma's elevClkCom(7) entry, and the reset
   rail's third-group link. deep rows (8+) are game-writable only — the
   3-bit op-write decoder covers rows 0-7; the game's own write path (MIRA
   triggers) reaches everything. the 12-ROW WELL: 396 relays / 68
   machines, the full game generalizes — receipts: the tall-well test
   (four drops complete the deep floor with no operator writes, the clear,
   all 33 collapse ticks, re-home, mid-well steering) green under fast in
   14.5s on the FIRST run; the whole 8-row regression suite green;
   playwright plays the 12-row page end to end (the /tetris/ page now
   ships the tall well). a MASS-gated dense variant of the tall-well test
   is the rung's oracle receipt.
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
