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
   solver budget is the real constraint.
   THE SCORE RING LANDED 2026-08-20, same session: a one-hot DECIMAL
   digit (0..9, wraps) stepped once per line clear — the token-ring
   pattern verbatim with CLEARP as the clock, 31 appended relays (10 x
   clk/master/slave + SCBOOT, the power-on seed latch that latches away
   on the first pulse). a binary counter was drafted first and KILLED ON
   PAPER: its increment ladder's done-track kept leaking + into the
   below-toggle masters through bidirectional contacts (three redesigns
   deep it still needed another mirror bank — the ring is the proven
   idiom and displays as a real digit). two more wiring traps caught
   before the suite ran: SCBOOT sharing the clock-chain node would have
   held every ring clock high forever after the first clear (its pulse
   feed rides CLEARPM's spare K instead, dead-ending at + or an open
   contact in every state), and the button-machine anchor drifted TWICE
   (machines-10 moved when the ring grew the count; the POS-block anchor
   landed on TWIN's + jacks at 12 rows) — the buttons/WID slide now live
   on a DEDICATED relay-free machine past the last relay machine, with
   the registry asserting the exports match. receipts: eleven scored
   clears incl. the 9 -> 0 wrap, green first run; full suite 192; the
   page shows "score N" and the game-over banner reports the final
   score. 8 rows: 324 relays / 56 machines; the 12-row well: 430 / 75.
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

GAME OVER LANDED 2026-08-20, same session: a lock at row 0 latches
   GAMEOVER (GOM mirrors token-at-0, LKM2 gives the set a lock-scoped
   arm) and the latch blocks every spawn — both set paths (START and the
   reset tick's auto-re-arm, which the first draft missed) enter through
   the latch's one NC contact. the first draft's rail-tapped set ALSO
   back-fed + through the held latch into row 0's hold-break (the tie-
   point law again: a set path must dead-end at + or an open contact in
   EVERY state, not just idle). receipts: the game-over test (top-out,
   latch held, spawn refused, steering dead) + the random-gameplay runs
   now play MULTIPLE GAMES per run — a top-out power-cycles a fresh
   machine (seed 20260820: 4 games / 40 locks / 326 ticks); the page
   freezes rust-red with the score and a reload note.
   THE SCORE RING LANDED 2026-08-20, same session: one decimal digit
   (0-9, wraps) stepped once per line clear — the token-ring
   master/slave/clock pattern re-used verbatim with CLEARP as the clock
   plus SCBOOT power-on seed pulse-fed off CLEARPM's spare K (feeding the
   seed from the clock chain would latch the ring clocks high forever). a
   binary counter was designed first and killed on paper: its done-track
   leaked + into below-toggle masters through bidirectional contacts
   (three redesigns, each needing another mirror bank — the ring is
   cheaper AND the pattern was already proven). buttons/WID moved to a
   dedicated relay-free machine (layout.btnMachine) after two anchor
   schemes drifted with rows; the registry asserts the geometry. receipt:
   eleven scored clears including the 9-to-0 wrap, green first run; the
   page shows the score live.
   STAGGERED PIECES (shapes 3b-1) LANDED 2026-08-20, same session: S and
   Z. a shape on this machine is a (bottomMask, topMask) pair — the
   phase-2 top write now samples a TOPMASK slide bank (PIECET) behind
   STAGM's changeover when the STAG slide is up. the T fan conducts ONLY
   during a staggered phase 2 (normally-open cuts CUTC5/6), the B fan and
   its collision taps are severed for that window (CUTB1-4), and ALL six
   cuts ride one delay hop (CUTBD): the release trace caught a clean
   mid-press write growing a phantom cell when the fresh top row's
   readback re-fed the data rails one relaxation wave after raw-rail cuts
   dropped — cuts must die depth-aligned with what they race. a
   press-scoped tap gate was tried and REVERTED: it severed the bottom
   collision's between-ticks pre-arm running through the same taps
   (pieces fell straight through blocks; the idle + on the taps is
   audited benign — LINEDLY keeps the LINE chain unpowered).
   TOP COLLISION (3b-2) LANDED same session: a staggered notch rests ON
   stored content — PIECET+LEGB series branches pre-arm COLLIDE at its
   com (the collide node was at capacity; entering through the com's one
   spare hole is the same trick as GAMEOVER's NC entry), scoped by STAGM2
   after a hostile-TOPMASK regression caught the ungated term resting a
   symmetric piece mid-air. receipts: S/Z write tests + notch-rests-on-
   content + a hostile symmetric regression (STAG off + TOPMASK 0b1111
   ignored), all green under fast.
   THE PAGE PLAYS S AND Z, same session: the shape cycle grew the
   staggered pair; arrow steps re-sync the absolute TOPMASK columns,
   entering a staggered shape auto-clamps the register into its fit
   bounds (again after every reset re-home, as pre-spawn operator steps —
   exactly what a human at the slides would do), the preview paints the
   shifted top pair. the JS guard now covers exactly TWO seams until the
   shape ring (3b-3): the reshape slide flip and the staggered top
   column the legality trees can't see (they read the top row per the
   BOTTOM mask's columns; the machine may also falsely refuse — both
   directions of that seam die when the ring re-gates the trees).
   playwright receipt: the driver cycles through all six shapes, drops an
   S onto a stack, and reads the staggered zigzag out of the pixels.
   THE SHAPE RING LANDED 2026-08-20, same session (3b-3a): the shape
   itself is machine state — a 6-state one-hot ring (1x1, 2wide, 2tall,
   O, S, Z) stepped by the UP button, the score-ring pattern verbatim
   with UPM as the clock mirror and SHBOOT seeding 1x1 at power-on. the
   ring DERIVES the mode rails INTO THE SAME COIL NETS the operator
   slides feed (compatibility-OR: every inactive branch dead-ends at an
   open contact; slide+ring disagreement unions, which is what the
   hardware would do) — so every slide-driven test stayed green
   untouched, and the slides remain as service switches. the T fan
   computes PIECET from state x live position through PRIVATE series
   pairs (a shared state rail would backfeed through dead rails into
   sibling coils — the first counter's trap); S/Z states imply their
   wide bottoms so the fan gates on pos mirrors directly. the capacity
   auditor caught one full jack mid-build (STAGM.E: slide + STAGM2
   chain; the rail enters at STAGM2.E). the page reads the shape back
   from the ring slaves like it reads position — applyShape DIED, the
   page touches no slides at all. receipts: a six-state walk asserting
   every rail and T-bank value per state x pos; a Z and an S locked
   with zero slides; playwright end to end.
   STAGGERED STEERING IN CONTACTS (3b-3b), same session: the legality
   trees now read the TRUE target top columns. the key observation that
   kept the trees' shape intact: every existing LEGINVT check is correct
   for symmetric AND S (S's target top set {c-1,c} contains c) and false
   only for Z; every LEGINVT2 wide check is correct for symmetric AND Z
   and false only for S. so the coils got MODE GATES at their feeds
   (NOT-Z / NOT-S contacts — a dead check relay passes the sample
   through its NC) and the missing columns ride as series hops: LTS =
   S-gated reads of c-1, LTZ = Z-gated reads of c+1/c+2, private per
   tree. the fit bounds refuse in contacts too (state-mirror NOs: S
   cannot enter pos 0, Z cannot enter pos 2). the return groups grew to
   a uniform tap allocator (the hand-split 1/2/2 chains overflowed the
   moment they took five more refusal throws). the page's staggered
   steering guard is DELETED — steering has no JS seam left. receipts:
   the old false symmetric refusal died (a Z steps under a tower that
   would have blocked it), S's shifted column and Z's far column refuse,
   both bounds refuse, and the symmetric legality regressions passed
   untouched. test-scenario lessons paid twice on paper: towers must
   sit BESIDE the fall path (a stored cell in the fall columns is
   unreachable state), and operator writes must happen at 1x1 — a
   ring-wide state defeats operatorWrite's slide-narrowing via the
   union and would bridge driven rails through the piece gates.
   RESHAPE LEGALITY IN CONTACTS (3b-3c) LANDED same session — the LAST
   SEAM: the ring's clock feed conducts through a transition-check
   network instead of a plain wire. the energized MASTER (one-hot: the
   current state's successor, sampled while the clock is low) names the
   target state; each transition is one master-mirror contact fanning to
   one-hot pos branches whose series NC hops read the target footprint's
   NEW cells off the occupancy rails (covered cells can't be stored, so
   the delta suffices). a refusal needs NO return path — the clock never
   rises and the ring holds; invalid positions simply have no branch,
   which is the fit-bounds refusal for free. the page's wouldOverlap
   DIED: the page holds no game model — steering, reshaping, collision,
   bounds, scoring and game-over all refuse or decide in relays; the one
   guard left is Enter's double-spawn interlock (the 1961 operator's
   discipline, documented). the expensive lesson: POSM(3)'s "spare" set
   was never spare — its L arm IS the right-press sample bus and its K
   the edge self-loop; tying a check node there let a join backfeed fire
   the D-tap trees mid-press and wipe the register to [1,1,1,1] (the
   ring-walk trace caught it; pos 3 got a real mirror). a borrowed
   contact set is free only if BOTH its arm and its throws are unwired.
   receipts: five occupancy transitions each blocked then allowed a row
   later; fit-range refusals; the register held through refusals; the
   whole file + check + playwright green. 414 relays / 71 machines.
   L, J AND T LANDED 2026-08-20, same session (3b-4a): the ring grew to
   NINE states — the upright triples (3-wide bottoms, one-cell stems at
   left/right/center) append after Z. one TRP rail feeds their five
   IDENTICAL memberships (WIDM, VMODE, STAG — which now means "phase 2
   reads the T fan" — the new WID3 third-column taps, and the steering
   cut); the B fan is CUMULATIVE (base column + WIDM adds p+1 + WID3
   adds p+2), the T fan gained six stem branches, and the transition
   network grew branches into each triple reading its delta cells (the
   T1-to-1x1 wrap is free: fully covered). steering a triple is CUT AT
   THE BUTTON MIRRORS until 4b re-classes the legality trees — position
   first, then shape; the cut sits at the mirrors and NOT the sample bus
   because a sampleless press still runs TWIN's release window and would
   wipe the register (the increment-2 hazard, nearly repeated on paper).
   the page's SHAPES became (bottomWidth, topOffset, topWidth) geometry
   tuples; the playwright driver caught a page bug (shapeRelay mapped
   the triples through the 6-state accessor into unrelated relays — the
   machine stepped, the page read garbage). receipts: the 9-state walk
   asserting rails and both fans per state, an L-J-T tower with all
   three stems, a mid-fall triple entry refused on a stored delta cell,
   whole file + check + driver green. 449 relays / 76 machines.
   TRIPLE STEERING (3b-4b) LANDED same session — the NS cut died after
   ONE increment: the legality trees re-classed per top geometry. the
   generalization that kept them small: a check is correct wherever the
   TARGET top set CONTAINS the checked column, so LEGINVT's gate widened
   from NOT-Z to NOT-(Z|J1|T1) (correct for sym, S, L1) and LEGINVT2's
   from NOT-S to NOT-(S|L1|J1) (correct for sym-wide, Z — and T1, whose
   right-step stem lands exactly on the point-2 column: that check came
   FREE). the triple legs ride as state-gated series hops — LTJ reads
   J1's shifted stem, LTB3 the 3-wide bottom's entering column 3 — plus
   the pos-2 triple bound. several stem checks are PROVABLY unreachable
   in play (the piece's own body just vacated those cells: a J1/T1 stem
   column is always inside the bottom's fall path) and stand as belt and
   braces. receipts: steering scenarios refused-then-allowed one row
   apart for the third column, J1's stem, and L1's stem via point-1;
   the whole file, check and playwright green. 460 relays / 78 machines.
   DEPLOY + RECEIPTS RESTRUCTURED, same session: the dense-oracle 12-row
   game crossed its 2-hour test timeout mid-solve (vitest cannot preempt
   the synchronous solver; the test never completed — NO mismatch, the
   zero-disagreement record stands) while the dense 8-ROW scenario
   passed on the same circuit. the deploy gate is now the dense 8-row
   scenario + the 5000-circuit oracle sweep; the full dense tall-well
   ladder becomes an occasional overnight receipt. 335fb7f (game over +
   score ring + staggered pieces + page S/Z) deployed to main on the
   green scenario receipt.
   THE OVERHANG TRIO (3b-4c) LANDED same session — THE 2-ROW BOX IS
   COMPLETE: L2/J2/T2 (the 180-degree forms: 3-wide tops over offset
   single bottoms) joined the ring, which now holds every orientation of
   the family — TWELVE states, all reshapes rotations, all in contacts.
   the bottom machinery generalized with ONE new idea each: a single
   BCUT contact ahead of the chained POSS arms suppresses the base
   column (one-hot slaves make the shared arm net legal — a fan-out that
   is finally NOT a tie-point trap), L2's bottom rides the WID3 tap
   alone, T2's the WIDM tap, J2 keeps the plain base. the legality
   surprise: the UNGATED bottom check false-refuses L2/T2 (their target
   bottoms exclude the checked column) — three trees gained an OVR
   bypass changeover on the same L2|T2 signal, their true bottoms read
   as gated hops, and several of those are PROVABLY unreachable in play
   (the notch machinery rests the piece before the state can exist) —
   wired anyway, belt and braces. the wrap transition gained its first
   delta check. two lessons repeated until learned: the ret-group count
   must include the tree's own refusals, and EVERY ring accessor must
   know all three index blocks (the walk test caught states 9-11 reading
   pos mirrors as two-hot-at-boot). receipts: the 12-state walk, L2+J2
   locks stacked on each other's stems, T2 steering refused-then-allowed
   under a tower, file/check/playwright green. 502 relays / 85 machines.
   THE MACHINE TICKS ITSELF (3b-5) LANDED 2026-08-20, same session:
   CAPACITOR GRAVITY. a two-relay slow-release oscillator on the REAL
   capacitor bank — TOSC's coil parallels four paralleled 500uF sections
   and is fed through TDRV's NC; TDRV follows TOSC and its second set
   bridges + onto the tick net exactly as the tick slide's closure does
   (the compatibility-OR again — the slide stays live). under stepTime:
   the supply recharges the bank in ONE backward-euler step (A-stable,
   no overshoot), the pair latches tick-HIGH while the bank drains
   through the 55-ohm coil (~hundreds of ms), and the dropout transition
   BUZZES — a real relay oscillator buzzes; the chatter pins de-energized
   (the device-verified book-IV class) leaving one clean tick-LOW step,
   then the cycle repeats. AUTO = the slide on TOSC's own section; the
   two relays landed exactly in m83's last two free sections (504 relays,
   still 85 machines). the page's 'a' key opens the time faucet (an
   interval feeding wall-clock dt into stepTime) — the OSCILLATOR does
   all the ticking, lock bookkeeping included; steering and reshaping
   keep working mid-fall. receipts: engine parity on the oscillator
   (sparse and fast agree edge-for-edge and cap-voltage-exact), hands-off
   gameplay from a single START press, AUTO-off freezes gravity, whole
   file + check + playwright hands-off scenario green. the scratch
   experiment that gated the design: the first stepTime run ever to
   drive the game (nothing in the browser had called it before).
   THE MACHINE WALL + THE OSCILLATOR GAPS (3b-6) LANDED 2026-08-20, same
   session: the canvas viewer rung — a strip under the well drawing ALL
   104 minivacs (12-row build) as tiles, six armature dots each, amber
   when energized, redrawn straight from getMachineState on every render
   (no react, no per-frame state). the wall's FIRST driver run caught a
   real bug, which unspooled into the arc's two operating hazards, both
   machine-verified and now pinned by a contract test: (1) a START
   pressed while TDRV holds the tick line high DISSIPATES — the arm
   needs a low line to survive to the next rising edge; under stepTime
   the cycle settles tick-low only on the buzz solve (~1 beat in 5), so
   Enter under auto lost ~4 of 5 spawns, silently. (2) taking the AUTO
   slide back mid-release FREEZES the line high (time stops, the cap
   never drains) — every manual tick and START is dead against it: the
   page's old 'a'-off wedged the whole machine, which is exactly what
   the wall receipt tripped on (tick with zero relay change = frozen
   bitmap). fixes are operator guards, same philosophy as the enter
   interlock: Enter under auto waits for a beat that settled tick-low
   and re-presses if the machine still swallowed it; 'a'-off cuts the
   feed FIRST, keeps time flowing until the driver relay stays down
   (the cap drains through the coil in a couple of beats), and only
   then stops the clock; 'a' is allowed through the game-over freeze
   (gravity must always be stoppable). steering needed nothing —
   level-read, not edge-consumed (verified). also observed, still
   unexplained: transient 5.3A short prints during buzz-adjacent event
   solves (console only, never in settled alerts). receipts: the
   five-part oscillator-gaps machine test, guarded spawn + hands-off
   fall + breathing wall + post-drain manual play all asserted by the
   driver, file/check green. no circuit changes (page + tests only).
   GRAVITY CORRECTED 2026-08-20 (user report: 4-5 row skips, phantom
   shapes): the oscillator-as-game-clock was WRONG under the sim's
   relaxation semantics. established by experiment (a follower relay
   and a two-cap cross-coupled astable both reproduced the identical
   trail): a self-oscillating pair's transition relaxations flutter —
   the cap companion is a soft resistor at game dt — and EVERY
   flutter cycle reaches the ring as a real tick edge, 3-4 rows in
   one solve; no relay topology escapes, because the quasi-static
   solver compresses the transition dynamics into one solve. the
   "phantom shapes" were the machine's own respawn re-arm doing its
   job at burst speed. fix: auto-gravity now cycles the TICK SLIDE
   on a timer (operator cadence, 700ms) — the exact single-step path
   manual play uses; the oscillator stays as a parity-exact physics
   demo, and the page's tick-low spawn guard + drain dance died with
   it. NEW RECEIPTS, user-shaped: the driver asserts NO fall ever
   advances more than one row between samples, and a STEP-EXACT
   scripted game checks the full 12x4 pixel grid against a rules
   model after EVERY keypress — three pieces, steering, a line
   clear, the collapse, the post-clear respawn. the harness caught
   the merged land+lock semantics on its first run. deploy-gate
   policy (user call): fast suite + the 5000-circuit dense-vs-fast
   sweep per deploy; the 47-min dense scenario becomes an occasional
   overnight receipt (zero engine disagreements ever, ~1e-10 mA max).
   WIDER WELL in progress: A+B landed byte-identical; the allocator,
   the step-tree emitter and the FAN emitters landed behaviorally
   green at 4 (file 32); the UP-transition emitter remains, then the
   cols=6 flip.
   THE DOUBLE CLEAR (CLEARP2) LANDED 2026-08-20, late session — a
   LIVE-GAME BUG the user hit within hours of the gravity deploy: a
   vertical lock completing BOTH its rows cleared only the token row,
   and the leftover full row was PERMANENT (clear sensing rode the
   rails = token row only; the clear/collapse select rows via the
   token, which dies at the reset; nothing can ever lock inside a full
   row again). the fix followed a clean-context design review that
   REFUTED three parts of my first plan (line-verified): no new phase
   tick is needed (the bottom clear itself works by holding the breaker
   rail from mid-press — the 'fires at reset' comment was stale), the
   sensing rides the PHASE-2 rails (a mask-OR chain under-senses
   symmetric verticals), and the collapse runs ONE two-hot walk (the
   elevator chain is already a shift register: seed masters r and r-1
   and the pair copies rows down by TWO, with a one-tick duplicate the
   beta wave kills — trace-verified in the sim before wiring; same
   tick cost as a single walk, so the page cap stands). the score grew
   a two-pulse clock (the old feed was electrically CLEARP's com — a
   parallel pulse would have false-re-latched it) with a CAUSAL latch
   (P2SM2) whose release is downstream of the CLEARP mirror's fall —
   the raw two-term gate raced at the reset and scored singles twice,
   caught by the driver's step-exact game, which also model-checks the
   whole double-clear scenario pixel-by-pixel now. top-only completions
   (the review's catch) clear and score too; SCBOOT latches away on
   them (its coil node is the E jack, not the com — found the hard
   way). the old 'top-full stays' test encoded the bug as intended
   behavior and is rewritten. receipts: the failing test flipped, the
   top-only test, the vertical suite under the NEW semantics, the
   whole clear battery green under the dense oracle too (the two-hot
   alpha is an electrical first: one hold contact feeding three
   parallel coils), driver end to end incl. the double-clear scenario.
   ~14 relays.
   THE WIDER WELL LANDED 2026-08-20 (the marathon session's close): the
   page plays 12x6 — cols joined rows as a generator parameter, with
   the three emitters compiling every column-class site from SHAPES.
   the bring-up found SEVEN collision classes, every one an annotated
   growth point that read past its 4-col bank: the per-row contact-set
   fans (MIRBX/MIRCX/MIRCTX/CUTX minted), a composite take's baked
   offsets (PIECET/LEGB), a hand splice at a chain's old tail (VMODEM),
   the topmask slides overflowing onto the WID slide's section (a slide
   T jack is a permanent tie — state mirrors leaked into the T fan as
   ghost columns), POSRST's re-home NCs indexing into TWIN (slaves 4-5
   survived resets -> multi-hot register, all-column pieces, mid-air
   locks), and the collapse beta trigger firing W(.,2) — breaker-0 at
   4 cols, a GATE at 6 (the cleared row's source never broke). every
   fix kept the (8,4) netlist BYTE-IDENTICAL. receipts: the six-wide
   suite test (fans/overhangs/bounds vs the geometry + the piece-built
   clear with one-hot asserts after every drop), the driver at 12x6
   end to end incl. the three-square double clear and the step-exact
   script. KNOWN DEBT: ~11 jack-capacity violations at 6 (physical
   buildability only — trigger entries at full jacks + over-tapped
   rail groups; the sim doesn't feel them). the buildability pass +
   the capacity audit in the six-wide test is the next unit.
   THE BUILDABILITY PASS landed same evening (7e27973, deployed with
   the key queue as a862408): zero jack-capacity violations at (8,6)
   AND (12,6), the audit welded into the six-wide suite test. all
   three violations were one disease — single 6-hole junction groups
   EXACTLY full at 4 cols (colFan, whose comment literally said 'spare
   6th hole', colFanT, collideNode) — grown into chained multi-group
   rails with spread taps that collapse back to the original wiring
   byte-for-byte at 4; the gate-coil chain re-entered through MIRA.G's
   free hole (W(r,1).E carries the alpha trigger). ALSO: the KEY QUEUE
   (game keys queue during solves instead of dropping — the 6-wide
   made real inputs vanish; driver burst receipt: 3 rapid downs all
   land) and the ROTATION GROUPS design (_notes/rotation-groups.md,
   alternative C: ring reorder for adjacent pairs + 4 D-feed muxes +
   NOTOK-gated cross-group roots) sent to adversarial review.
   ROTATION GROUPS landed 2026-08-20 late (0eff1da): UP turns the
   falling piece and chooses the shape pre-spawn, and the whole trick
   is that the ring's SUCCESSOR MAP is not in the clock network at all
   — each master's coil com is fed through its predecessor slave's
   set2, so the D-feed wires ARE the map. NOTOK ("no token anywhere",
   an NC-series chain over the ring-slave mirrors plus the row-0 mirror
   the SEEDM bank never had) re-aims them: energized pre-spawn they
   point at the selection successor (the 0..11 chooser), de-energized
   mid-fall at the rotation partner (1<->2, i<->i+3 across L/J/T).
   ELEVEN muxes, no root gating: a one-orientation state's mux NC is
   wired NOWHERE, so mid-fall no master is fed, the clock finds no
   branch, and 1x1/O/S/Z refuse rotation exactly as an out-of-range
   bound refuses. the cross-review earned its keep again — it killed
   the ring REORDER (states 6..11's spine is hand-laid by index across
   ~150 generator lines plus ~20 test/page/driver sites), caught that
   the NOTOK chain missed row 0 (where every piece spawns), and flagged
   that a plain root gate would kill the very flips it was meant to
   enable; the 11-mux variant sidesteps the roots entirely. receipts:
   rotation both ways + singleton refusal + the full chooser cycle, the
   mux flipping under a HELD up across both a spawn and a lock, the
   page driver turning L -> L flip -> L on a falling piece.
   THE SUPPLY-OVERLOAD FIX rode along (2f7c421, deployed 0bd4327): the
   "unexplained transient shorts" logged earlier were never shorts —
   they were SUPPLY OVERLOADS. CELL was allocated row-major, so one
   machine hosted up to a whole row of field cells, and since occupancy
   sensing draws through the cell coms, writing over a stacked row put
   that entire row's read load on ONE section's supply. measured on an
   L2 locking beside a two-cell stack: machine 9 peaked 3.44A BEFORE
   the rotation rung (alarm 3.5A; a genuine short here is 4.6-6.6A) and
   3.61A after rotation added one more read to the same rail — so the
   rung did not cause it, it exposed a design that was already at 98%
   of the alarm. allocating cells COLUMN-major spreads a row across
   supplies: peak 2.16A, every other machine's load bit-identical, the
   game behaviour byte-for-byte the same (verified by running the same
   scenario in both trees). the debugging path is worth remembering:
   same scenario clean on the deployed commit -> netlist bisect (muxes,
   not the NOTOK chain) -> remove the keypress so both trees hold
   IDENTICAL state -> fields matched exactly, so it was purely
   electrical -> per-machine current comparison isolated one supply.
   also learned, twice: a test scenario can be PHYSICALLY IMPOSSIBLE —
   for a 3-wide top over a 1-wide bottom, every cell that could block
   the rotation also sits where the piece's own top lands one row down,
   so the piece is already resting and written before the turn is
   asked for. the machine was right both times; the model was wrong.
   PIVOT-ORDER REUSE: MEASURED AND DEAD (2026-08-21). the lever only
   exists if sparsity patterns repeat across solves; measured on the
   12x6 game they essentially never do — an ordinary fall+lock is 91
   solves with 91 DISTINCT patterns (0.0% repeat), a clearing lock plus
   its collapse cascade is 182 solves with 180 distinct (1.1%). the
   instrument was validated first (four solves at an identical relay
   configuration collapse to one signature). mechanically: a closed
   contact is stamped as a wire, so the node merges — and the whole
   matrix structure — change whenever any relay flips, which a
   relaxation does by construction. symbolic-factorization reuse dies
   with it, since it needs the same stability. recorded in full in
   _notes/pivot-reuse.md; the decision rule was written down BEFORE the
   measurement so the answer could not be rationalised after the fact.
   SUBSTRUCTURING WAS MEASURED TOO, and the answer is "probably not":
   its reuse premise HOLDS beautifully — a solve touches a median of
   TWO machines out of 178 (1.1%), p90 13, and ~30% of solves change
   nothing — but its cost side does not: 49% of wires cross machines,
   the interface is 3446 boundary jacks against a matrix of N~=8950
   (~38% of the system), and each machine reduces to a DENSE 26-54
   block, so the reduced boundary system would carry far more fill than
   today's very sparse matrix. a fifth hypothesis (that most of those
   8950 nodes are unwired jacks carried for nothing) died in one
   measurement: only 1% of rows are isolated or dangling. so there is
   NO cheap solver lever; the cascade is near this architecture's
   floor. full numbers and the measurement kit in _notes/pivot-reuse.md.
   NEXT (game, not solver — that is where the same effort pays): the
   tall piece engine, then random dealing, then 10 columns.

41. THE "WHY NOT PORT AN FPGA TETRIS" QUESTION, ANSWERED WITH A
   BACKEND (2026-08-21). built one — scripts/relay-compiler/ — that
   maps a gate netlist to relays: one relay per input / gate output /
   DFF half, gate functions as contact networks, fan-out past two
   changeover sets minting parallel-coil mirrors, a + hole allocator
   (supplies are per-machine, the six section + jacks are one node).
   compiled the two hand-wired rungs already in the repo and compared:
   the 4-bit adder is 15 relays by hand and 32 compiled (2.13x,
   exhaustive over all 256 pairs), the 8-bit shift register 24 vs 29
   (1.21x). so DATAPATH is nearly free — my prior of 5-10x was wrong
   there. CONTROL logic is not: rung 4's 1-of-8 decoder is FOUR relays
   by hand (a transfer-contact tree whose eight leaves are plain
   JACKS) and 31 compiled naive / 20 with cones collapsed = 5-8x, of
   which NINE relays are pure fan-out mirrors. tetris is nearly all
   control logic, so a port is ~3600 relays and a solve cost that is
   already the visible pain. VERDICT: keep hand-designing the game;
   keep the backend for datapath-shaped subproblems. _notes/compiled-relays.md.

42. THE HORIZONTAL I (3b-4d) — the seventh tetromino. flat, so no new
   write phase, no new collision term, no new occupancy row: a 13th
   ring state, a fourth bottom-fan offset, and the cols-4 bound class
   the geometry-derived unions produce for free. the thing the design
   note did NOT predict, found by measuring: a 4-wide bottom has to
   join the EXISTING wide rails (WIDB and WID3M) for fan offsets 1 and
   2 — with neither joined the I masked only columns p and p+3.
   two consequences worth knowing: at FOUR columns no single column
   admits the whole ring any more (S needs column >= 1, the I fits only
   at column 0), so chooser walks steer; and widths 8-10 now exhaust
   the STPREAD pool, deliberately NOT fixed because stpReadBase is
   taken mid-sequence and widening it re-hosts every later coil (those
   widths already carried 6-12 jack violations — only 4 and 6 are
   clean, and 6 ships).

43. A LIVE BUG, found while designing the tall engine: a lock is three
   ticks and the TOKEN stays alive through all of them, so the rotation
   muxes are still aimed at the rotation partner — an UP landing
   between the lock press and phase 2 re-aimed the T fan and phase 2
   wrote the ROTATED shape's top over the already-written bottom. an L
   locked as SIX cells instead of four (reproduced before claiming it).
   plausibly the user's "new shapes appear? conflicts?" report, since
   the page's key queue drains at every settle including the ones
   between a lock's phases.

44. THE RELAY VIEWER'S KEYBOARD WAS WIRED TO A MACHINE THAT ISN'T THERE.
   /relays/ took its button numbers from the module-level TETRIS_IO,
   which bakes the DEFAULT 8x4 geometry's button machine (m124); the
   page builds 12x6, where they live on m178. no wire in that netlist
   touches m124's button jacks, so LEFT, RIGHT and UP were electrically
   silent (measured: zero wires match /m124\.[234][XY]/). tick and
   start sit on m1 in every geometry — which is exactly why those two
   worked and nothing else did, and why it read as "the page has no
   controls" rather than as a crash. three more, each reproduced before
   being fixed:
   - a second START mid-fall injects a SECOND token (the circuit has no
     interlock — the game page guards the KEY instead of spending eight
     contacts). two tokens 3 rows apart, one lock, rows 8 and 11 both
     written: a cell stranded in mid-air.
   - without the column clamp the shape chooser stops dead at the square:
     state 4 (S) needs column >= 1 and the contacts rightly refuse it at
     column 0. every piece on the page was a 1x1.
   - the well overlay shipped at 11px a cell (now 52, viewport-capped).
   also measured: a random deal is up to ~17 solves, and as ONE blocking
   call it froze the page for 13 SECONDS. every operation is a generator
   now, one press per frame — same work, worst frame gap ~0.7-1.0s (one
   solve), which is the floor without a worker.
   receipt: scripts/verify-relays-page.mjs, and it was checked in BOTH
   directions — red on the m124 buttons (ring stuck at 1x1, steps
   refused) and red with the START guard removed ("cells stranded above
   the floor: rows 8,9,10,11").


45. THE THIRD WRITE ROW (B1b), and a defect found right after shipping
   it. B1b-i added a fourth phase tick that writes nothing (TICKM4, V3M,
   ROW2M, ROW2X); B1b-ii added the TOPW2 bank that makes it write row
   r-2. two things had to be measured rather than reasoned: p2railA is
   TICK-HIGH ONLY, so ROW2's master cannot ride it into the tick-low
   transfer and must latch like P2M; and the first cut of the gate chain
   hung on that rail and WEDGED the machine, because the latch backfed
   through its own set path and held phase 2 on forever. RULE: a latched
   relay's set path must dead-end at a supply, never at a driven rail.
   TOPW2's output jacks had to be measured too — TOPW's own entries into
   a row's write-trigger nets are full at every row, and the spare hole
   is elsewhere on the same coil net (general for the breaker, width-
   conditional for the gate).
   THE DEFECT: with the V3 slide up and a line clear in flight, the
   phase-3 row is wiped instead of written and destroys pre-existing
   content. in main, pinned by an it.fails() case, and NOT reachable
   from either page (verified: the only slides they set are m1.5 and the
   oscillator's; V3M is on a relay machine). the fix is the third line
   sense, which is now the next rung ahead of the mask fan.


## display/input notes

- the canvas viewer reads relay states directly as pixels — the playfield does
  NOT need light bulbs (saves ~34 machines of light budget).
- input: buttons on a dedicated machine (left/right/rotate/drop), debounced by
  the game-tick FSM.
- browser stays on cktsim until the multivac ui lands (see multivac-ui.md).
