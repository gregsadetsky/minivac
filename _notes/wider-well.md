# the wider well (column scaling) — scoping notes, 2026-08-20

second parameterization axis. rows landed earlier (ctor arg, grown()
groups, claim registry + eq gates); cols is baked at 4 in ~50 generator
sites plus the test file and the page. same medicine.

## per-column subsystem inventory (what scales)

- CELL(r,j): rows relays per column (the field).
- W(r,k): the write groups — one write coil per row PER COLUMN.
- LINE(j), PIECE(j), PIECET(j): line-full + bottom/top piece gates.
- POSA/POSS/POSM(j): the position register one-hots + edge no-op wiring.
- PRESSCUT(x)/P2CUT(x): per-column collision-mirror cuts.
- LEGINV/LEGINVT/LEGB(j) (+LEGB2/LEGB3 col classes): legality trees.
- POSM4/POSM5/POSM6: pos-CLASS mirrors — these encode SPECIFIC columns
  (edges, interior boundaries for bounds). the class map is a function
  of cols and must be DERIVED, not copied.
- bound contacts per ring state (SBND/ZBND/TRPBND/TTBND + the wrap
  check): which pos refuses which state moves with cols. the page
  already computes min/maxPos from SHAPES geometry:
    minPos = max(0, -bOff, -tOff)
    maxPos = min(c - bOff - bW, tW>0 ? c - tOff - tW : c - 1)
  the generator must emit the refusing contacts from the SAME formulas.
- M10/M11 rail groups: more columns = more taps/groups; budget grows
  with machine count, assertJackCapacity + the claim registry enforce.
- cols-independent: the shape ring itself (12 states), the score ring,
  the oscillator, the collapse row-walk (walks rows, reads all cols via
  the per-column machinery above).

## growth model (rows=12)

per added column ≈ CELL 12 + W 12 + LINE/PIECE/PIECET 3 + POS* 3 +
cuts 2 + trees ~3 + mirror shares ~2 ≈ ~37 relays ≈ 6.2 machines.
4 -> 6 cols: ~+75 relays, ~+13 machines (605/104 -> ~680/~117 at 12
rows). wall canvas auto-scales. page tick cost +~13% — fine.

## plan (each phase gated, committed separately)

- A: thread cols through tetrisLayout + claim registry + eq checks.
  GATE: netlist byte-identical at (8,4) (diff the sorted wire list
  before/after — the strongest refactor receipt).
- B: per-column loops take cols (fans, registers, trees, cuts, writes).
  GATE: still byte-identical at (8,4).
- C: column-CLASS sites re-derived from cols (POSM4/5/6 class maps,
  per-state bound contacts from the geometry formulas, edge no-ops).
  GATE: byte-identical at (8,4) — every hand-laid class must fall out
  of the formula at c=4 exactly, or the formula is wrong.
- D: cols=6 behavior: walk test at 6, steering/locks at columns 4-5,
  bounds at the new right edge, page COLS=6 + driver, receipts
  (fast file, check, playwright), then the dense scenario batch
  before any deploy.

increment decision: parameterize fully, bump the page 4 -> 6 (5 feels
cramped for the staggered family; 10 is the endpoint once perf at 6 is
measured).

## phase C framework (from reading the D-tap trees, 14:30Z)

step legality for a piece at pos p stepping to q = p+-1, token row r,
geometry (bOff, bW, tOff, tW):
- B(x) = {x+bOff .. x+bOff+bW-1} clipped to [0, cols); T(x) likewise
  with tOff/tW at row r-1.
- stored content can never coexist at the piece's OWN cells (gravity +
  entry checks), so checking T(q) whole equals checking the delta —
  the hand-laid trees mix both styles and carry some provably-redundant
  hops ("belt and braces", wired historically).
- bounds: q in [minPos, maxPos] from the geometry formulas; the trees
  refuse via state-mirror contacts where q is out of range.
- the current 4-col instantiation: shared bottom check LEGINV(entering
  col), VMODEM tall fork -> LEGINVT, WIDM3/4 wide fork -> LEGINV2(c+1),
  then per-state gated hops in series (LTS/LTZ/LTJ/LTT/LTB3/LTOT/LTOB/
  T2B), each dead-mode NC passing through. refusals return via retNode
  taps into the current master's coil.

IMPORTANT GATE CHANGE for C: a geometry-driven tree emitter emits the
MINIMAL correct checks, so the 4-col netlist will legitimately differ
from the hand-laid one (redundant hops dropped, tap orders shift).
phase C's gate is therefore NOT byte identity — it is the full
behavioral bar: whole fast file + check + playwright at 4, the dense
8-row scenario + sweep batch, all green BEFORE the width ever changes;
then the same bar again at 6. (A+B keep their byte-identity receipt.)

## per-state entering sets (derive the emitter from these)

with SHAPES geometry (label, bOff, bW, tOff, tW), stepping RIGHT p->q=p+1
enters bottom {q+bOff+bW-1} and top {q+tOff+tW-1} (tW>0); LEFT p->q=p-1
enters bottom {q+bOff} and top {q+tOff}. checks clip out of range.
reshape (ring step s1->s2 at pos p): check B2(p)\B1(p) and T2(p)\T1(p)
plus the bound clamp — exactly what the UP transition network wires
today as one-hot pos fans + series delta hops.

## the check tables (scratchpad/check-table.mjs; VERIFIED against the
## hand-laid trees on three states: S p1R, Z p0R + the NOT-Z gate, and
## the narrow single-column checks — formula reproduces the wiring)

at any cols, stepping RIGHT into target c checks rails at fixed offsets
from c per state: b = c + bOff + bW - 1, t = c + tOff + tW - 1 (tW>0);
LEFT into c: b = c + bOff, t = c + tOff. the tables are shift-invariant
across the interior — one pattern per state per direction, bounds at the
range edges. offsets (db, dt) per state, RIGHT:
1x1 (0,-)  2wide (1,-)  2tall (0,0)  O (1,1)  S (1,0)  Z (1,2)
L (2,0)  J (2,2)  T (2,1)  L2 (2,2)  J2 (0,2)  T2 (1,2)
emitter shape = the existing trunk generalized: shared bottom check at
c+0 -> tall fork -> shared top at c+0 -> wide fork -> b at c+1 -> tall-
wide t at c+1, with state-gated series hops for every staggered delta
(c+2 reads and the asymmetric combos), and bound refusals as state-
mirror contacts where c is outside the state's range. the resource half:
reads at c+2 (and repeated reads per column) need parallel-coil rail
copies where a relay's two contact sets run out — the LEGINV2 pattern,
allocated per column by CONSUMER COUNT, not hand-laid.

## phase C architecture (survey complete, 14:35Z)

five emitters, in dependency order:
1. the CONTACT ALLOCATOR (the deepest change): every source signal
   (state, pos class, mode) has a consumer list; mirrors are minted at
   ceil(consumers/2) and coil-jack chained; contact sets are assigned
   by the allocator — replacing every hand-laid POSM3/4/5/6-style set
   map (those doc comments ARE the hand allocator's ledger today).
2. the STEP-TREE emitter: shared trunk + state-gated series hops from
   the (db,dt) offset table + bound refusals at range edges; retNode
   groups sized by COUNTED refusals (incl. the tree's own — the 3b-4c
   lesson); rail COPIES (LEGINV2 pattern) minted by consumer count.
3. the UP-TRANSITION emitter: per state pair s -> s+1 (+ wrap), per
   pos p with clamped target q: delta sets B2(q)\B1(p), T2(q)\T1(p)
   as gated rail reads in series behind the one-hot pos fan; join ->
   clock com; no branch at out-of-range p = the bound refusal.
4. the B/T FAN emitters: bottom = base {p} + WIDM {p+1} + WID3 {p+2}
   with BCUT suppression for offset bottoms (L2/T2); top = per-state
   private pairs (state AND pos -> column net) over the geometry.
5. budgets: grown() gains a cols dimension per rail from counted
   consumers; slide machines checked (operator data slides cap at 4 on
   m1; PIECET top-mask slides fit 6/machine); M10/M11 groups + jack
   capacities enforced by the existing asserts + claim registry.

size estimate: a full rung arc (comparable to all of 3b). the gate per
emitter: behavior at 4 (file + check + driver + the dense batch), then
the width flip to 6 with new-edge tests.

## the contact allocator, first API sketch (pre-code)

data model:
- a SOURCE is a coil net that mirrors chain onto: a ring slave (state),
  a POSS slave (pos), a mode relay (WIDM/VMODE/STAG/WID3/TT/BCUT...).
- request(source, kind) -> a fresh contact set handle {relay, set1|2},
  minting a new mirror on the source's coil chain when all existing
  sets of that source's mirrors are spent. kind is 'changeover' (arm +
  both throws reserved) or 'gate' (arm + one throw; the OTHER throw of
  that set stays claimable by a later 'gate' on the SAME source only if
  electrically legal — default NO, the tie-point law: one consumer per
  set unless the second is a proven one-hot-safe join).
- the allocator EMITS the mirror coil wires itself (chain at the coil
  jacks, F -> minus) and returns jack names via R(relay, ...).
- every mint is claim()-registered; layout counts stop being hand-laid
  take() literals for these banks and become the allocator's tally,
  asserted == the take() size (the take sizes then derive from a dry
  ALLOCATION PASS: run the emitters' request stream once to count, then
  lay out — two-pass build, same shape as the existing grown() logic).
- ordering: mints must be deterministic (stable request order) so the
  netlist is reproducible run to run.

open questions for the next session:
- do the emitters run inside tetrisLayout (counts) AND tetrisCircuit
  (wires) — or does tetrisCircuit compute the whole thing and hand the
  layout back? leaning: a single build function that returns both, with
  tetrisLayout(rows, cols) becoming a thin wrapper that runs the count
  pass only (keeps the exported baked constants + eq gates intact).
- jack-hole budgets: request() must also track the 2-holes-per-jack
  spend on the THROW side when consumers chain at output jacks (the
  LEGB-output-tie pattern) — probably a second primitive join(handleA,
  handleB) that validates capacity.

## the ledger (scratchpad/contact-ledger.mjs -> contact-ledger-8.txt)

extracted the ACTUAL per-set spend from the hand-laid netlist: 113
mirror-bank relays, zero unwired, and the usage is exactly the two
kinds the allocator sketch guessed — gates spend GH/KL (arm+NO, 2
jacks), changeovers GHJ/KLN (all 3) — with a handful of half-spare
sets (ZM(3).set2, POSM3(3).set2, MMIR set2s...) as the hand's
headroom. the allocator's count model reproduces reality; its dry-run
at cols=4 must land within these counts (equal or tighter). the script
doubles as the C gate's cross-check: run it on the emitted netlist and
diff the spend per source family.

## gate tooling

- byte gate: scratchpad/dump-netlist.mjs (exact list order) — held for
  phases A+B.
- SET gate: scratchpad/dump-netlist-sorted.mjs (endpoints normalized,
  list sorted, duplicates kept = multiset) — two dumps equal iff the
  circuits are electrically identical regardless of push order. this is
  the gate for allocator conversions (MirrorBank emits coil wires
  lazily, so positions shift while the wire multiset must not).
- spend gate: scratchpad/contact-ledger.mjs — per-set usage diff.
- emitter 0 (MirrorBank, src/circuits/contact-alloc.ts) is LANDED and
  unit-tested, not yet wired in. pilot conversion target: VMODEM (its
  8 sets are spent in natural tree order — right-1 s1+s2, right-2
  s1+s2, wall s1, left-0 s2, left-1 s1... wait: left-1 and left-2 ride
  VMODEM(3); left-0 rides VMODEM(2).set2 — request order in tree order
  reproduces the hand map exactly, so the SET gate must hold).

## pilot outcome + strategy (14:55Z)

VMODEM is MirrorBank-managed (commit ab5472a): 8 requests in hand order,
wire-multiset identical at both geometries, ledger identical, walk test
green. the splice-tail nuance held (ring-state union enters at the
chain tail's E jack — the bank mints the same wires, the splice lands
on the same net).

DECISION: no more hand-order bank conversions — the plumbing is proven,
and the step-tree emitter will reassign sets anyway (its request order
is emitter order, gated behaviorally per the C gate). next unit: the
step-tree emitter — generate the right/wall/left trees from the check
table's (db,dt) offsets + bounds, requesting sets from MirrorBanks,
first reproducing behavior at cols=4 (suite + driver + dense batch),
then unlocking 5/6.

## mode rails are geometry predicates (design closed, 15:00Z)

verified against the wiring (2028-2092 + the splices): every mode rail
is a predicate over SHAPES, wired as a one-contact-per-state OR chain
into the coil net (the LEGB trick — each coil net takes ONE wire):
- WIDM  (wide fork)      = bW == 2   -> 2wide, O, S, Z
- WID3  (third column)   = bW == 3   -> L, J, T (the TRP rail)
- tall  (VMODEM union)   = tW > 0    -> everything but 1x1/2wide
- STAG  (phase-2 T fan)  = top footprint != bottom footprint
                           -> S, Z, triples, overhangs
- TT    (3-wide top)     = tW == 3   -> L2, J2, T2
- BCUT  (offset bottom)  = bOff > 0  -> L2, T2
so the emitter needs NO hand membership tables: rails, fans, trees,
bounds and transitions all derive from the SHAPES tuple; the allocator
owns every resource map. that closes the phase C design — remaining
work is implementation.

## prerequisite before the emitters: flip the constant direction — DONE
## (6a4a507: 151 exports derive from L8, eq block deleted, gates green)

the C emitters change bank SIZES at cols=4 (minimal checks drop the
belt-and-braces relays), which shifts every baked constant after the
first changed bank — the eq() gates would throw at module load. so
BEFORE any emitter lands: make tetrisLayout primary and DERIVE the
exported constants (`const L8 = tetrisLayout(8); export const SHR =
L8.SHR; ...`), delete the eq() block (tautological then), keep the
claim registry (it guards overlaps on the derived values). consumers
(TETRIS_IO, the test file) import names/functions, never hard numbers
— safe. gates: netlist byte-identity + tsc + fast file. bounded
(~250 lines of mechanical rewiring), do it as its own commit.

## the step-tree emitter: design settled, extraction inventory (15:45Z)

DESIGN DECISION — the uniform union-gated tree: no mode forks. every
check in a tree is a union-gated rail read in series; a dead union's NC
passes the sample through (the LTS pattern generalized to everything).
per tree (target c, direction d), from stepEntering():
- group the 12 states by their checked-column OFFSET per row: e.g.
  RIGHT bottom: d0 {1x1, 2tall, J2}, d1 {2wide, O, S, Z, T2},
  d2 {L, J, T, L2}; RIGHT top: d0 {2tall, S, L1}, d1 {O, T1},
  d2 {Z, J1, L2, J2, T2}. LEFT bottom: d0 {all but T2 (d1), L2 (d2)};
  LEFT top: d-1 {S}, d0 {2tall, O, L1, L2, J2, T2}, d1 {Z, T1}, d2 {J1}.
- one UNION RAIL per group (wired-OR of state-mirror contacts, the
  ZJT/SLJ/TT pattern), one GatedReadPool read per (tree, group) at
  rail column c+d, all in series, then the step. d0-bottom reuses the
  existing LEGINV(c) changeover (both sets: right tree set1, left set2).
- bounds are width-invariant: RIGHT tree at c = cols-2 refuses the
  max==cols-3 group {Z, triples, overhangs} (three group contacts);
  the wall tree (c = cols-1) refuses the WIDM-class {2wide, O, S}
  (max==cols-2; Z/triples/overhangs can't SIT at cols-2, one-hot);
  LEFT tree at c=0 refuses S (min 1). nothing else, at any width.
- relay cost at 6: ~55 reads + ~6 unions + member mirror sets; the
  hand's fork optimization is dropped for uniformity (more armatures
  for the wall, mechanical derivation, behavioral gate).

EXTRACTION INVENTORY (what the surgery touches — five sites):
1. the D-tap section (the trees proper, ~1563-1755).
2. 3b-3b coils: SG/ZG mirrors + LTS/LTZ gated coils (~2079-2092) —
   tree-only, dies with the trees (ZG(0,1)/SG(0) NOT-gates die too:
   the uniform tree has no shared-check gates).
3. 3b-4b: ZJT/SLJ unions + LTJ/LTT/LTB3 gated coils — ZJT/SLJ die
   (their gates die); LTJ/LTT/LTB3 die (reads re-minted from the pool).
4. 3b-4c: LTOT/LTOB/T2B gated coils die; BCUT/BCUTM (the OVR bypasses)
   DIE ENTIRELY — the uniform tree has no false-refusing shared bottom
   check to bypass (d0 reads are gated on the d0 union, which excludes
   L2/T2 on the right). TT/TTM survive (transition network + rails).
5. SHARED SEAMS that must survive unchanged: SM/ZM mirror sets feeding
   the T fan + WIDB rail; TRPM(0) rail feeds; TTM rail/transition sets;
   the LEGB occupancy-term feeds — today they chain off LEGINV(0)/(1)
   and LEGINV2(2)/(3) COIL jacks; LEGINV2 dies with the trees (the
   wide-fork copies), so the LEGB feeds for columns 2..3 must re-home
   to emitter-minted d1-read coils or their own rail taps. AUDIT THIS
   ONE FIRST when wiring.
new layout tail: union bank + state-mirror growth + GatedReadPool +
bound mirrors + ret groups (counted, generous caps, assert spent<=cap).
freed banks stay claimed-but-unwired (dead index space, zero netlist
cost; compaction later).

## step-tree emitter, final spec (audit resolved, 15:55Z)

- LEGB seam RESOLVED: LEGINV2 coils are parallel copies on the SAME
  rail nets, so all four LEGB feeds re-home to LEGINV(j).E (2-hole
  budgets fit once LEGINV2 dies). LEGB + its UP-network consumers
  survive untouched.
- per-tree chain ORDER: bound refusals FIRST, then the gated reads,
  then the step (a refused state must never reach a read that would
  index out of the well).
- reads CLIP: a read at column c+d with c+d outside [0, cols) is
  skipped — every member state is bound-refused before it anyway.
- d0-top reads REUSE LEGINVT(c) (coil re-wired PLAIN — the ZG NOT-gate
  dies; the T0/T0L union contacts gate the sample path instead). d0-
  bottom reuses LEGINV(c) the same way (gates in the path, coil as-is).
- union rails (10): B0{1x1,2tall,J2} B1{2wide,O,S,Z,T2} B2{L,J,T,L2}
  T0{2tall,S,L1} T1{O,T1} T2{Z,J1,L2,J2,T2} T0L{2tall,O,L1,L2,J2,T2}
  T1L{Z,T1} HIB{Z,L,J,T,L2,J2,T2} WALLB{2wide,O,S}; left singletons
  S(top c-1), J1(top c+2), T2(bottom c+1, changeover: NC chains the
  left-d0 gate), L2(bottom c+2, changeover ditto).
- counts at 4: pool reads 18, union rails 10, union-gate mirrors ~25,
  state-member mirrors ~24 -> tail ~106 relays (+18 machines at 8
  rows) while ~35 die unwired. uniformity costs ~3x the hand's tree
  relays; accepted (tick +~20%, more armatures on the wall).
- ret taps: ~6/tree; count exactly while emitting, assert <= cap.

## the step trees are EMITTED (16:05Z, landing in progress)

the uniform union-gated emitter replaced the hand-laid D-tap section:
ten union rails + per-state mirror banks (chained off each state's
EXISTING mirror-chain tails — the slave coil jacks were full), the
gated read pool, per-source ret groups (4 each — ~15 refusal taps
peak, width-invariant), pending-output coalescing before the master
coms (their budgets are exactly coil + hold + self-loop + step).
retired: LEGINV2/LEGINVT2/VMODEM-contacts/WIDM3-4-contacts/SG-ZG NOT
gates/LTS/LTZ/LTJ/LTT/LTB3/LTOT/LTOB/T2B (+their rail taps freed);
the VMODEM coil chain stays wired (it IS the tall compatibility-OR
splice point), WIDM3/4 coils stay (the WIDB splice rides them).
iteration bugs the capacity asserts caught, in order: L2/T2 mirror
caps undercounted the per-tree spends; POSA com overflow (fixed by
coalescing); slave-E overflow (fixed by tail-chaining); ret groups
ran dry at 3 (grown to 4).
growth: 8-row 499 -> 627 relays (85 -> 107 machines), 12-row 605 ->
733 (104 -> 125), dead banks included.
receipts: FULL SET GREEN at 4 — walk + all steering, the three legacy
failures fixed via slide-or-ring member pairs on the retired fork
relays' free sets (af97236), full file 32 green, check 210 green,
driver end to end (the wall breathes at 8 tile rows / 125 machines).
the dense batch on the emitter tip is running; its green gates the
deploy. the fence (cols !== 4) STAYS until the fan + transition
emitters land — those are the next work units.

## traps to respect (from the rows job + 3b)

- a borrowed contact set is free only if arm AND throws are unwired.
- ret-group counts must include the tree's own refusals.
- every ring accessor must know all index blocks (the 2-way/3-way bug
  shipped twice).
- one-hot sources make shared-net fan-outs legal; everything else is
  the tie-point law.
- jack capacities are real: 2/jack, 4/COM, 6/M10-M11.
