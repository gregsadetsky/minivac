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

## REVIEW VERDICT (clean-context adversarial review #5, 2026-08-27)

NO-GO as drafted; GO with three free fixes. the full report is worth
keeping verbatim in the reviewer's transcript; the operative parts:

1. **D3 REFUTED THE DIRECT 0-FEED — the rung's real flaw.** "no token
   can exist with the ring at 0" is false by the ledger's own boot
   bullet: SPAWN gates on GAMEOVER only, so boot -> START -> tick
   drops a 1x1 with the ring at 0 and NOTOK down. an unmuxed
   slave0.K -> com3 feed would energize master 3 MID-FALL, and the
   read-free into-3 branch would step the ring 0 -> 3: the falling
   1x1 morphs into an O with zero occupancy checks (the buried-cell
   class). the seeded random diff game is the mechanical detector —
   it stays UNMODIFIED. fix: the 0-feed rides a takeNot() mux like
   every other edge, NC unwired. 8/12 mux sets (7 rho + entry; the
   old i=0 and i=1 muxes die). with the mux, no-reads is safe: both
   feeds NOTOK-gated, master 3 only up pre-spawn, dark rails.
2. **the unledgered MANDATORY wire:** slave 0's set2 ARM is fed today
   by clock 1's J — the into-1 D wire the plan deletes. left unfed,
   the first UP refuses forever (the machine wedges at state 0).
   feed it from clock 3's J second hole (its first goes to
   slave21.L); clocks 1 and 3 share segment 0 and rise together.
3. master 12's com is 4/4 by a SWAP (the dead i=0 mux NC leaves, the
   i=3 mux NC arrives) — both must land in one wiring session.
4. into-3's span = range(3) WHOLE (not range(21) n range(3) — at 4
   cols that loses p=2 and refuses a legal O entry); the carve-out
   must be ONE shared spec consumed by both the emitter and
   upResourceCounts.
5. missed consumers: wall-worker (third dealer: SELECTION walk +
   revolution count), verify-relays-page's hard 22-count,
   verify-tetris-page's SECOND site (the hardcoded SEL table at :433,
   besides the chooser-phase presses), tetris-reference.test's
   prevOf/%22 loop (crashes on undefined) + the same t=3 carve-out.
6. pools shrink 12 relays at 4 cols / 19 at 6 (UPPOS+UPREAD 72->60 /
   142->123): the re-host class in the SHRINK direction — audits +
   the manual column-2 supply probe (the 3.414A ceiling) re-measure
   by hand; the clock segment arm loads too. STPMIR does NOT shrink
   (frozen formulas; the toys' step trees stay wired-but-dark).
7. minors: SELECTION_NEXT must THROW on 1/2 or the "loud" claim is
   false; the emitter must skip t in {0,1,2} EXPLICITLY (ROT_PRED[1]
   and [2] survive, so an undefined-based skip would emit dead
   branches and blow the shrunken pools); "the 1<->2 mux dies" was
   mislabeled — 1->2 is a direct shared wire; the muxes that die are
   i=0's and i=1's.
CONFIRMED elsewhere: the 4-wire com budget on master 3, one-hot feed
legality with all backfeeds walked, LKM2/SHBOOT non-interaction,
power-cycle identity, the dead clocks/masters (coil current only),
the clamp math at 4/6/10, the pool arithmetic.
