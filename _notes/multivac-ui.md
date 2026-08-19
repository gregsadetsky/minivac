# multivac ui direction (2026-08-19)

## decisions

- the existing browser simulator KEEPS the old dense solver (cktsim) for now.
  the sparse engine is fully validated (whole suite green under MINIVAC_SOLVER=sparse,
  5000 random circuits / 10,001 snapshots / zero mismatches / max diff 1.4e-10 mA,
  11-26x faster) but we switch the browser only when the multivac ui appears.
  switching = one line: setSolverEngine('sparse') or the env default in
  src/simulator/minivac-simulator.ts.

- the multivac ui will likely be CANVAS-based, not react. and possibly not
  editable — more "look at this relay computer running" than "wire it yourself".
  we control the drawing loop entirely, draw only what changed, whenever we want.
  no fighting react reconciliation at 120fps across N machines.

## claude's take (asked for)

agree, strongly, for the multivac viewer:
- N machines x hundreds of elements is exactly where the react panel's costs
  multiply — we spent a full session getting ONE panel to 120fps.
- a viewer has no wiring interaction, so react's actual strength here
  (hit-testing, hover, dialogs, per-hole interaction) isn't needed.
- canvas lets pixels BE the state: e.g. the tetris playfield can render relay
  states directly as pixels — no lights budget needed, no DOM nodes.

one nuance: keep the existing react single-minivac app as-is (it's good now, and
its interactivity is the point). the multivac viewer is a NEW surface, so canvas
there isn't a rewrite — it's a fresh start where we pick the right tool.

practical split that fell out of the perf work: the simulator is already fully
headless (all state, versioned via stateVersion, zero react dependencies), so a
canvas viewer is just: tick() -> if version changed, redraw dirty machines.
