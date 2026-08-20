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

## traps to respect (from the rows job + 3b)

- a borrowed contact set is free only if arm AND throws are unwired.
- ret-group counts must include the tree's own refusals.
- every ring accessor must know all index blocks (the 2-way/3-way bug
  shipped twice).
- one-hot sources make shared-net fan-outs legal; everything else is
  the tie-point law.
- jack capacities are real: 2/jack, 4/COM, 6/M10-M11.
