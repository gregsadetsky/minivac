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

## tetris io thoughts (greg, 2026-08-19, during the rung-7 build)

- keyboard presses must work to play tetris. input is "just" a few buttons on
  a dedicated machine (left / right / down / change shape) — keypresses map to
  those buttons, and the viewer should SHOW that routing: an input panel with
  'extra' wires running to the buttons they drive.
- output: a very small display of just big pixels — no need to skeuomorphically
  invent a thing. could also optionally be made out of 'bulbs'.
- show all minivacs with and without wiring. without wiring doesn't really
  make sense... but with wiring will be impossible to see. so: wiring drawn
  manhattan-style (x/y-only runs), plus an optional 'droppy' cable mode
  (one-time catenary, not animated) just to show off.
- ability to dump the circuit — read the whole circuit spec out of the
  running sim.
- ability to see the circuit in terms of its LOGICAL gates. (the tetris
  netlist is generated from logical building blocks — dff stages, decoder
  tree, write groups, detectors — so the generator can emit that gate-level
  description alongside the wire list; the wire list is the compiled output.)
