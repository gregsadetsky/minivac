# piece-register rung — design notes, 2026-08-20

goal, in three increments:
1. the COLUMN REGISTER: piece position becomes machine state (a
   bidirectional one-hot POS ring) stepped by momentary LEFT/RIGHT
   buttons; the PIECE column relays re-feed from the register; the page's
   pos variable becomes a readout. width/tall stay slides for now.
2. LATERAL COLLISION IN RELAYS: the step's D-path is gated by a legality
   contact network — target column free at the token row — deleting the
   bottom-row half of the page's JS overlap guard (buttons request,
   contacts decide, like the fall).
3. the full piece register (per-column row offsets): L/S/T/I shapes and
   rotation as register rewiring moves; the tall-top legality seam closes
   here too.

## increment 1: WHAT THE TRACE CHANGED (built 2026-08-20; 25 relays, MACHINES 42)

the ring as first wired failed its own trace test four separate ways, every
one of them the tie-point law wearing a new costume. final shape below;
lessons first:

1. the "safe wired-OR" of both button X-lines into ANYBM's coil jack was
   not safe: a coil jack is a tie, so RIGHT's + walked through it onto the
   LEFT button's line and energized LEFTM. the far side of that OR was
   never an open button — it was the other mirror's coil. fix: contact-OR
   (each mirror's spare K from its own +, outputs tied at ANYBM.E; far
   sides now dead-end at open contacts). ANYBM is depth 2 now.
2. transferring DURING the press cascades: the moment a second slave rises,
   its POSM's tap contacts close, and the master coms bridge each other
   through the DEAD direction chain (a dead chain still ties); observed as
   one held press -> ring [1,1,1,1]. fix: slaves frozen mid-press; the
   transfer runs in a one-wave RELEASE WINDOW owned by TWIN (coil = hold
   chain still hot x ANYBM's NC = "ANYBM already down, ANYBM2 still up").
   TWIN drops the same wave the masters do, so the idle holds re-close on
   the wave the transfer feed dies and the new slave is caught gap-free.
3. seeding through the START button's X line tied the SPAWN latch's com to
   slave 0's com (m1.6X is comOf(SPAWN)'s tie): the armed latch held slave
   0 up through the window, and a held slave 0 would have re-armed spawns
   forever. fix: POWER-ON seed — BOOTL's NC feeds slave 0's com from boot;
   the first press latches BOOTL away (via ANYBM2's spare K, waves before
   any release window), and every reset's POSRST re-home agrees with the
   seed while BOOTL is still down.
4. the wide taps armed from the slave-com node back-fed: at "wide, pos 2"
   the + on PIECE(2)'s coil jack walked BACKWARD through the closed WIDM
   contact into slave 1's com (ring re-lit [1,1,1,0]). a wired-OR into a
   coil jack is legal only while every far side dead-ends at an OPEN
   contact. fix: each wide tap is + through TWO series contacts, POSM2(j)
   (pos == j, one-hot guarantees the backward path hits an open one) then
   the WIDM set (wide).

## increment 1: the POS ring (original sketch, superseded above)

- POS slaves (4): one-hot, LKS-phased against the button line: copy the
  masters while the buttons are LOW, hold while a press is HIGH. set2
  feeds PIECE(j).E (+ via L, K out).
- POS masters (4): D-latch DURING the press. com = left-D in + right-D in
  + hold in + coil = exactly 4 holes. sample-on-press / commit-on-release
  (a press that would move sets the master mid-press; the release copies
  it into the slaves — the one-hot steps once per press, no autorepeat).
- POSM mirrors (4, parallel coils on the slave coms): set1 = the left-D
  tap (to master j-1), set2 = the right-D tap (to master j+1). direction
  gating rides LEFTM/RIGHTM.
- LEFTM/RIGHTM (2): button-line mirrors; their contacts gate the D taps.
  ANYBM (1): both button X-lines wired-OR into one coil (the jack tie is
  safe: each far side dead-ends at its open button) — clocks the slaves'
  hold-vs-copy the way TICKM clocks LKS.
- WIDM (1): width-slide mirror for PIECE(j).E's second feed
  (pos == j-1 AND wide), replacing the slide fan.
- POSRST (2) + SPAWNCLR's spare set: every spawn resets POS to the home
  column (slave 0) — correct tetris (pieces spawn at a home column, not
  wherever the last one died) and it solves one-hot seeding: break the
  slave holds on the ring clock via POSRST NCs, set slave 0 through
  SPAWNCLR.L/K (+-scoped, private, law-3 clean).
- PIECE(j).E feeds: slave(j) tap OR (WIDM AND slave(j-1)) tap — two
  contact outputs tied at the coil jack, each dead-ending at its open
  contact: a legal wired-OR (single consumer).
- the page: arrows press LEFT/RIGHT buttons; pos is READ from the POS
  slaves; the JS guard keeps working unchanged until increment 2 (it
  reads position the same way either way).

## increment 2: the legality gate (~20-24 relays)

- "target column c is free at the token row" enters the D-path in series.
- sensors: the field cells' J/N jacks are FREE on every cell (verified) —
  an NC closed = "this cell is OFF".
- row selection: a MIRC mirror bank on the ring slaves (the MIRB pattern,
  reading the token's OWN row instead of the row below) presents cell
  occupancy per column onto 4 legality rails; LEGINV(j) (coil per rail)
  gives "column j free at the token row" as an NC.
- the D gate chain per direction: button mirror -> edge-column LEGINV.NC
  -> master com. edge column = pos+width (right) / pos-1 (left) — the
  POSM taps already encode pos; width folds in via WIDM.
- SCOPE CUT, documented: legality checks the BOTTOM cell's row only; a
  tall piece's top cell can still be steered over stored content (the
  OR-write absorbs it). the page guard SHRINKS to exactly that case, with
  the full fix in increment 3's piece register.

## increment 2 — BUILT 2026-08-20 (22 relays, MACHINES 46; final form)

what shipped differs from the sketch in two places worth remembering:

1. the rails read OCCUPANCY, not freedom, and they read it from the CELL
   COMS (each field com had exactly one spare hole), not the J/N jacks.
   the "free J/N jacks" in the sketch are NC jacks whose arms carry the
   hold/readback feeds — a free JACK is not a free CONTACT. occupancy +
   LEGINV-as-blocked + NC-gating also fixes the default: no token row
   selected (pre-spawn, post-lock row 7, power-on) = rails dark = every
   step legal. MIRC coils chain off TOPW(r).E (rows 1-6; the MIRA coms
   are full) and MIRA(0)'s spare com hole (row 0). row 7 unmapped by
   design: the token only shows row 7 post-lock.
2. the gates are CHANGEOVERS, not blocks. a plain series NC would let a
   refused press latch NO master — and the release window then breaks
   every slave hold with nothing to transfer: ONE REFUSED PRESS WIPES THE
   RING. the LEGINV contact's NO side returns the blocked sample into the
   CURRENT master (a forced no-op step), so every single-button press
   latches some master and the ring always survives its own release.
   refusal returns collect on one matrix group per position and re-latch
   through POSA's coil-jack spare hole.
3. wide right-steps run a two-stage tree on the legal side: WIDM3
   {narrow -> com; wide -> LEGINV2(c+1) {free -> com; occupied ->
   return}}; right-into-3 is WIDM4 {narrow -> com; wide -> return} — the
   wall is in contacts and the page's wide-at-wall clamp died. left steps
   need no second check (gravity keeps piece cells off stored cells, so
   a wide piece's right cell enters its own old column).
4. test fallout, all semantic (the wiring passed its trace first try):
   the random model walks toward its wanted column with real presses and
   accepts wherever the register lands (partial walks are the machine's
   answer); wideness for the reset re-home comes from the tracked slide,
   not mask bits (a wall-degraded wide mask looks single-bit); the
   steer-into-overlap test's reported move became the REFUSAL receipt,
   with OR-absorption coverage moved to the reshape seam (a slide cannot
   be electrically refused — the page guards it).

## increment 3a — BUILT 2026-08-20: the tall TOP row refuses too

- second occupancy read, one row up: MIRCT(r) = "token at r" reading row
  r-1. the cell coms are 4/4 since increment 2, so the MIRCT arms tie to
  the SAME com nodes through the MIRC(r-1) ARM JACKS' spare holes (an arm
  jack is a tie point like any other — this time it worked FOR us).
  MIRCT coils chain off MIRC(r,1).E; rows 1..6 only (row 0 has no row
  above — the write clips there too; row 7 is post-lock). dark rails =
  no top constraint: flat pieces and no-token steering never feel it.
- every D-tap tree gains a VMODEM fork (4 mirror relays off VMODE.E —
  VMODE's one spare set can't serve six trees): flat skips the top check,
  tall runs LEGINVT(c) as one more changeover (occupied -> return). the
  2x2's wide branch gets a SECOND fork for the right edge's top
  (LEGINVT2(c+1)). the full right-into-c tree is now 4 checks deep with a
  return exit at every stage; the step wire joins collect on the WIDM3
  nc-jacks and VMODEM nc-jacks (2 holes each, exactly enough).
- refusal returns outgrew single matrix groups on the both-direction
  positions: ret(1)/ret(2) are two chained groups; position 3's two left
  refusals tie jack-to-jack and enter POSA(3).E as one wire.
- scoping decision, recorded: the FULL piece register (per-column row
  offsets, L/S/T, rotation) moves BEHIND field scaling — the tall-top
  seam is closed here, "lateral collision in relays" holds for every
  current shape with only the reshape slide as a page guard, and the
  bigger field is where new shapes earn their relays.
- the wiring passed its trace test on the first run (as did increment
  2's): the changeover-tree discipline + jack-budget audits on paper
  before pushing wires seem to be the difference vs increment 1's four
  traced bugs. the failing-first runs both failed for SCENARIO bugs
  (a top-block cell also blocking the bottom at another row; the model
  forgetting a stacked cell), which the traces caught immediately.

## increment 2 audit notes (2026-08-20, post-increment-1)

- gate placement: series-gate EACH D-tap, not the direction chain. LEGINV(c)
  has exactly the 2 sets needed: set1 gates the right-step tap into c
  (POSM(c-1).K -> LEGINV(c).H arm, J NC -> comOf(POSA(c))), set2 the
  left-step tap (POSM(c+1).G -> L arm, N NC -> com). the EDGE SELF-LOOPS
  stay ungated (stepping into your own column is a no-op, always legal).
- invariant that simplifies everything: piece cells never coincide with
  stored cells (gravity rests ON content, never inside; legality will keep
  sideways clean) => a LEFT step's right cell enters the piece's own old
  column, always clean => left steps check ONLY the left edge's target.
- RIGHT steps with a wide piece must also check c+1 (the right edge's
  target). LEGINV(c+1)'s sets are spoken for, so that read needs a small
  LEGINV2 mirror bank (parallel coils on the legality rails) for columns
  2-3, plus a narrow-bypass contact in parallel: tap -> LEGINV(c).J ->
  (WIDMx NC in parallel with LEGINV2(c+1).J) -> com. the parallel pair is
  the SAFE or-shape: two gates between the same two nodes (the dangerous
  OR is two different sources into a coil jack — see increment 1 bug 4).
- the wall: right-step into c=3 gets a WIDMx NC in series (narrow-only) —
  geometry in contacts, which DELETES the page's wide-at-wall clamp too.
- WIDM/WIDM2 sets are fully used by the wide PIECE taps; the bypass/wall
  NCs need a WIDM3 (and maybe WIDM4) mirror on the WID slide.

## open questions for increment 2 (audit before wiring)

- MIRC rails vs the data rails: entirely separate 4 rails, or reuse? keep
  SEPARATE (the data rails carry write/readback traffic mid-press; the
  legality must be readable during idle steering — mixing them re-invites
  every bridge lesson).
- LEGINV coil load on the MIRC taps; chatter check when a step lands the
  token beside content (LEGINV flips once per move ✓ under threshold).
- do steps during LOCKED/collapse need blocking? the LANE/LKS routing
  already ignores buttons (they only clock POS); a mid-collapse step
  changes the mask for later spawns only — benign, but VERIFY with the
  random test's mutation once buttons replace slides in it.
