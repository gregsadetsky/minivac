# THE TOYS RETIRE (2026-08-27, user call) — ledger, REVIEW BEFORE WIRING

the user: "remove the single piece and the two bit piece which are not
part of tetris - can they be 'commented out' of the relay circuit?"
states 0 (1x1), 1 (2 wide), 2 (2 tall) become UNREACHABLE from the
chooser. their relays STAY wired on the wall — literally commented
out. O (state 3) stays: it is the real tetromino. NSTATES stays 22.

## the design: a RHO-shaped chooser

SELECTION_CYCLE becomes the 19 tetromino states
  [3, 4,13, 5,14, 6,15, 9,16, 7,17, 10,18, 8,19, 11,20, 12,21]
(wrap 21 -> 3), PLUS a ONE-WAY ENTRY EDGE 0 -> 3. SHBOOT keeps seeding
slave 0, so power-on is exactly today's (all mode rails down, every
legacy slide procedure still valid AT BOOT — the whole reason the rho
beats deleting the states: state 0 remains the neutral boot anchor and
the legacy compatibility pairs on stBanks[0] stay meaningful there).
the first UP leaves 0 for 3 and the ring can never come back.

## wiring deltas

1. THE D-FEED LOOP emits per-state feeds from SELECTION_PREV. new:
   - masters 1 and 2 get NO feed at all (their D wires simply not
     emitted; slaves/clocks stay wired — dead weight by design).
   - master 3 gets TWO feeds: slave 21 set2 (the cycle edge, through
     the standard NOTOK mux since ROT_STATE(21)=12 != 3) AND slave 0
     set2 DIRECT to comOf(master 3) (state 0 has no rotation meaning
     and no mid-fall existence after this rung — no mux needed).
     one-hot legality: at 21 slave 0 is open, at 0 slave 21 is open.
     com budget on master 3: coil tie + hold + two feeds = 4 = the
     COMMON jack's capacity exactly — assertJackCapacity is the gate.
   - the 1<->2 domino-flip mux dies with the feeds (its ROT_MAP
     entries stay as documentation of the dead edge).
2. THE UP EMITTER iterates cycle members only (into-1/into-2 branches
   vanish). into-3 is special: TWO selection predecessors (0 and 21),
   NO rotation into 3 -> its branch carries NO reads (selection rides
   dark rails; there is no live consumer) and spans range(3) whole
   (= range(0) n range(3)); the shared-branch assert gets a documented
   carve-out for t=3.
3. upResourceCounts: count cycle members only; t=3 as above. pools
   SHRINK -> the accepted mid-sequence re-host class (audits receipt).
4. the wrap emitter detail: SELECTION_PREV(3) = 21 canonically (the
   cycle edge); the 0->3 edge is emitted separately, not via SEL_PREV.
5. SELECTION_NEXT(0) = 3 exported (the pages' spin walks out of boot);
   SELECTION_NEXT(1)/(2) undefined -> loud if consulted.
6. the cycle load assert changes: members unique, toys excluded,
   19 + the entry edge.

## consumers

- reference: TARGET_SELECTION_CYCLE -> the same rho; the lockstep
  test's cycle-equality assertion updates; the reference's selNext
  comes from the circuit map (knob) so gameplay follows automatically.
- diff harness: the scripted game OPENS with 1x1 drops — rewrite the
  opening on O/tetromino drops (the toys' scenario value shifts to
  operator writes). selectShape(1)/(2) calls die.
- drivers: the tetris driver's early chooser phase presses UP twice
  expecting '2 tall' — re-derive to the rho (first UP: 1x1 -> O). the
  relays viewer's named-state picker omits the toys (unreachable).
- pages: boot shows 1x1 until the first spin press (fine, honest);
  the spin's revolution count reads SELECTION_CYCLE.length (19), not
  SHAPES.length.
- tests: every scenario that SELECTS a toy re-derives (ring walks,
  chooser arrays, 1x1/domino gameplay openings). scenarios that only
  BOOT at 1x1 without pressing UP stay valid verbatim.

## deliverables for the reviewer

1. refute the rho (is the double-feed on master 3's com legal in every
   phase? walk the backfeeds: slave 0 K's far side with the ring at
   21 and NOTOK in both states; the mux NC side of the 21 feed).
2. the entry edge vs LKM2's UP freeze and vs SHBOOT's first-press
   latch: any interaction?
3. into-3 with no reads: is there ANY reachable mid-fall meaning?
   (claim: no token can exist with the ring at 0 or at 21-rotating-
   into-3; verify the NOTOK-down case cannot conduct into master 3.)
4. count what shrinks (UPPOS/UPREAD/muxes) and what the re-host moves;
   name the supply audits to re-run.
5. the boot UX: from 0 the FIRST spin press enters at 3 — confirm the
   chooser clamp math never strands the register (range(3) at 4/6/10).
