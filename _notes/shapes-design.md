# the shapes rung (L/S/Z/T + rotation) — design notes, 2026-08-20

## the shape algebra

every standard tetromino EXCEPT I fits in a 2-row box, so on this machine
a shape is a PAIR (bottomMask, topMask) over <=3 adjacent columns at the
register position:

- O  = (11, 11)     - already playable (2x2)
- I2 = (11, 00)/(1,1 tall) - already playable (domino / 1x2)
- L  = (111, 100), J = (111, 001)
- S  = (011, 110), Z = (110, 011)
- T  = (111, 010)
- I  = (1111, 0000) horizontal / needs a 4-tall register vertically — OUT
  of scope (the 2-row box is the rung's boundary; I stays the 2-wide bar)

rotation = stepping through a shape's distinct (bottom, top) orientation
list; on a 2-row box each shape has at most 4, e.g.
L: (111,100) -> (11,01)+tall column arrangement... NOTE: 2-row-box
rotations of L/J/S/Z/T include 3-wide x 2-tall and 2-wide x 3-TALL forms —
the 3-tall forms do NOT fit the box. scope cut: this rung ships the
2-ROW-BOX ORIENTATIONS ONLY (each shape gets its two horizontal-ish
orientations: normal + 180째; S/Z get their one distinct flip; T gets up +
down). full 4-orientation rotation needs a 3-row register — behind column
scaling.

## what the machine already has

- the phase-2 top write samples the mask LIVE at the phase-2 tick — the
  write path for (bottom, top) pairs exists end to end. a human on real
  hardware could already lock an S by flipping the mask slides between
  the two ticks of a lock.
- the legality rails already read occupancy at the token row (bottom) AND
  one row above (top bank) per column.
- the register holds pos (one-hot) + WID; PIECE(j) fans pos+wide into the
  data-rail gates.

## what the rung needs

1. a SHAPE register: one-hot over {flat, tall, square, L, J, S, Z, T} x
   orientation — realistically a one-hot ring of ~10-14 states stepped by
   the UP button (the score-ring pattern; the WID/VMODE slides retire or
   become readouts). each state's contacts assemble TWO mask fans:
   PIECE-B(j) (bottom) and PIECE-T(j) (top) from pos via the POSM taps —
   the wide-tap POSM2/WIDM pattern generalized to per-state row offsets.
   relay estimate: ring ~3/state (~36) + two mask fan banks (~8-12) +
   state-contact mirrors (~10-20). the big spend.
2. collision gains the TOP-ONLY term: the piece rests when
   (row below) ∩ PIECE-B  OR  (token row) ∩ (PIECE-T \ PIECE-B) — the
   second term reads the SAME cell coms the legality bank taps (spare
   holes are gone there: needs its own mirror row-bank or a re-share
   audit).
3. the lock writes: bottom press uses PIECE-B (today's path); phase 2
   uses PIECE-T (today it re-reads the SAME mask — the phase-2 column
   feed must switch to the T bank; VMODE becomes "topMask nonempty",
   i.e. a contact off the shape ring, not a slide).
4. lateral legality: bottom checks stay; the top checks apply per
   TOP-mask column (today they apply per bottom-mask column when tall) —
   the changeover trees' VMODEM forks generalize to T-bank gates.
5. the page: UP steps the shape ring (a machine button, like LEFT/RIGHT);
   the preview paints B/T masks; the JS reshape guard DIES ENTIRELY
   (stepping the shape ring becomes contact-gated legality like steps —
   the last seam closes).

## increments

- 3b-1: PIECE-T bank + phase-2 rerouting, driven by a TOPMASK slide trio
  (operator hardware, like WID) — S/Z/L/J/T lockable by hand, tests for
  staggered writes; collision unchanged (documented overhang gap). LANDED.
- 3b-2: top-only collision term (the machine stops burying overhangs). LANDED.
- 3b-3: the shape ring replaces the slides. split further (the full rung
  with transition legality is too big for one landing):
  - 3b-3a: a 6-STATE one-hot ring (1x1, 2wide, 2tall, O, S, Z — today's
    page set) stepped by the UP button, score-ring pattern. the ring
    DERIVES the rails the slides drove: WIDM3/WIDM4 coils re-fed from a
    wide-states wired-OR (one-hot source, far sides dead-end at open
    contacts — tie-point-law-clean by construction), VMODEM from the
    tall-states OR, STAGM/STAGM2/CUT gating from S-or-Z, and the PIECET
    coils re-fed from ring-state x pos-mirror branches instead of the
    TOPMASK slides (the T fan becomes computed: T(j) = 2tall*pos(j) or
    O*(pos j | j-1) or S*(pos j | j+1) or Z*(pos j-1 | j-2)). the WID /
    VMODE / STAG / TOPMASK slides all retire. the page's UP presses a
    machine button; applyShape dies. page guards remaining: reshape
    overlap + stag lateral (both narrowed, both documented).
  - 3b-3b: legality trees re-gated per T-mask column (LEGINVT column
    selection from the T fan instead of the bottom mask) — the stag
    lateral seam dies, false refusals die with it.
  - 3b-3c: UP-transition legality: entering state s+1 is contact-refused
    when its footprint at the current pos hits stored cells or the walls
    (LEGINV-style refusal returns on the ring's sample path; bounds =
    refuse, not auto-step — operator steps first). the reshape guard
    dies; the page is a pure operator.
  - 3b-4: grow the ring to the full 2-row-box family (12 states: +L/J/T
    x 2 orientations each) — the fans gain 3-wide and offset-single
    patterns via per-pattern group rails (states sharing a mask pattern
    share a rail, so branches stay 2 contacts deep).

each increment lands with the usual receipts; MASS at 3b-3c and 3b-4.

## 3b-3a worked plan (paper pass, 2026-08-20)

- COMPATIBILITY-OR, not replacement: the ring's rails wire INTO the same
  coil jacks the slides feed (WIDM.E, VMODE.E, STAGM.E, PIECET(j).E).
  each branch dead-ends at an open contact when inactive, so slide+ring
  coexist tie-point-legally; if an operator raises a slide AND the ring
  disagrees the masks UNION (real-hardware semantics, documented). the
  existing slide-driven tests stay green untouched; the page switches to
  UP presses; the ring seeds at 1x1 = all rails off = today's defaults.
- the T fan needs ONLY S/Z branches: symmetric tall shapes route phase 2
  through colFan (STAGM NC side) and never consult PIECET; the 3b-2 term
  is STAGM2-scoped. dropping the symmetric branches killed SYMT + PIECE
  mirrors from the budget.
- S/Z states IMPLY wide bottoms, so the fan gates on POS directly:
  T(j) = S*(pos j | pos j+1) | Z*(pos j-1 | pos j-2), invalid-pos terms
  omitted (8 branches, each state-mirror contact x pos-mirror contact,
  PRIVATE series pairs — a shared state rail feeding multiple coil jacks
  through per-branch pos contacts backfeeds through dead rails, the
  counter trap again).
- PIECE(j).E jacks are FULL (narrow + wide feeds) — that killed the
  PIECE-mirror factorization; POSM2 set2 (L/K/N) is free for j=0..2 and
  POSM3 mirrors chain off POSM2.E's spare hole.
- contact-use ledger: S 7 (4 fan + WIDB + VMODE + STAGM) -> SM x4;
  Z 7 -> ZM x4; O 2 (WIDB+VMODE) -> OM x1; I2t 1 (VMODE) -> I2TM x1;
  I2w 1 (WIDB) -> I2WM x1; pos0 x2 / pos1 x4 / pos2 x2 -> POSM3 x4 after
  POSM2 set2. ring 6x3 + UPM (button mirror: set1 clock chain, set2 K
  = SHBOOT pulse, the CLEARPM pattern) + SHBOOT (BOOTL idiom, private).
  TOTAL 35 relays (~6 machines). allocation tail: SHR(i,part)=346+3i+part,
  UPM=364, SHBOOT=365, SM 366-369, ZM 370-373, OM 374, I2TM 375,
  I2WM 376, POSM3 377-380 -> MACHINES 65.
- UP = button 2 on the button machine (buttons 3/4 = LEFT/RIGHT). press+
  release = one ring step (masters sample low, slaves copy high).
- the ring survives resets (a latch bank, unlike POS): the selected shape
  persists across locks, matching today's page.
