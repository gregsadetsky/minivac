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

## traps to respect (from the rows job + 3b)

- a borrowed contact set is free only if arm AND throws are unwired.
- ret-group counts must include the tree's own refusals.
- every ring accessor must know all index blocks (the 2-way/3-way bug
  shipped twice).
- one-hot sources make shared-net fan-outs legal; everything else is
  the tie-point law.
- jack capacities are real: 2/jack, 4/COM, 6/M10-M11.
