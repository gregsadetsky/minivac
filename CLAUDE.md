# minivac simulator — hard-won invariants

faithful analog simulator of the Minivac 601 relay computer, plus "multivac"
(N machines ganged into one circuit) working toward relay tetris. live at
minivac.greg.technology (push to main = deploy via github pages action).

## commands

- `npm run check` = lint + typecheck + full test suite. run it as the gate.
- `MINIVAC_SOLVER=dense npm run test -- --run` = whole suite under the dense
  oracle engine (do this after touching anything numerical).
- `MINIVAC_MASS=1 npx vitest --run src/simulator/tests/sparse-mass-validation.test.ts`
  = heavy validators (5000 random circuits, perf race). `MASS_CASES=n` to scale.
- dev server `npm run dev` (:5173), prod preview `npm run build && npm run preview` (:4173).

## electrical model — measured, do not "fix"

all constants in minivac-simulator.ts were measured on a real Minivac 601 with a
multimeter and bench supply (2026-08-17): 13.3V supply + 1.8Ω internal, 55Ω coils,
bulb curve I=0.0208·V^0.625 (cold floor 14Ω), relay pickup 70mA / dropout 30mA.
pickup is deliberately BELOW the 90mA bench value: real measurements bracket
~80mA inconsistently (per-relay variance; book VII pp8-9 has a per-relay bias
calibration chart — the manufacturer knew). the 3-coils-in-series case is
knowingly mispredicted. see git history + SIMULATION-ERRATA.md before touching.

## solver engines

- default = 'sparse' (src/simulator/sparse-circuit.ts). dense cktsim
  (public/cktsimvsp_sn.js) is the permanent ORACLE: `MINIVAC_SOLVER=dense` or
  setSolverEngine('cktsim'). equivalence: full suite green under both + 5000
  random circuits, zero mismatches, max diff 1.4e-10 mA. 11-26x faster.
- shared conventions both engines MUST keep: ground node = -1 (skipped in
  stamps); v-source = one branch-current unknown, I(name) = that unknown;
  singular/floating islands (e.g. unwired lights) regularize with a 1e-12
  diagonal — in the sparse engine ONLY on a DEAD column (no remaining row
  references it), otherwise later eliminations divide by 1e-12 and currents
  explode to 1e24 (see 'previously-diverging comparator' regression test).
  threshold pivoting: reject pivots < 1e-3 of their column max.
- cktsim has a gated `Circuit.debug_newton` trace hook, and a documented
  epsilon fix in find_solution (zero-initial-residual pathology; original line
  kept in a comment for instant revert).

## THE TIE-POINT LAW (cost multiple debugging sessions; also bit the 1961 authors)

a jack is a permanent tie, not a switch output. a contact jack feeding two
consumers still BRIDGES those consumers when the contact is open — current
sneaks backward through one consumer's network into the other. fan a gated
signal from one contact only if every consumer's far side is guaranteed dead
when the contact opens; otherwise one contact per consumer (mint extra contacts
with parallel-coil mirror relays). victims: book IV flip-flop (physically
buzzes on real hardware, verified), the first multivac counter, the first
register draft. jack capacities are real: 2 holes/jack, 4 on COMMON, 6 on
M10/M11 — multivac tests enforce via assertJackCapacity().

## simulation semantics

- quasi-static: _simulate relaxes relays+bulbs to a fixed point; iteration
  count = relay cascade depth (exposed as lastRelaxationIterations). budget
  scales with machine count; long one-way cascades flip each relay ONCE and
  must not be pinned — only relays flipping >=3 times are chattering, and
  chatter resolves to DE-ENERGIZED (armature never seats; device-verified on
  the book IV flip-flop, which toggles through the buzz).
- capacitors: real (500uF sections 1-5, 1000uF section 6, jack notation
  `1cap`..`6cap`), backward-euler companions; time advances only via
  stepTime(ms) — nothing in the browser calls it yet.
- multivac: machineCount ctor arg; canonical wire prefix `m12.3G` (numeric,
  0-based, unbounded), letters a.-h. are legacy aliases for m0-m7; per-machine
  supplies; negative rails common; machine 0 unprefixed internally.

## UI performance invariants (react panel)

never push per-frame values through react state: motor angle goes through
MotorAngleStore straight to the DOM; frames are gated on simulator.tick()'s
stateVersion; panel static rows are module-constant elements; dynamic rows are
value-memoized. no live blur filters on animated elements (GPU stalls). the
future multivac viewer is planned as canvas, browser-side notes in _notes/
(gitignored, local).

## misc

- tests that wait on the wall-clock motor need generous timeouts (parallel
  workers starve them; known flake class).
- notation/circuits: samples live in src/circuits/ as the single source of
  truth for menu + tests. book circuit wire lists were transcribed and
  independently cross-validated against manual scans.
- TODO.md is the live backlog; _notes/tetris-roadmap.md has the multivac
  ladder status and next rungs.
