/**
 * Multivac roadmap rung 4: 1-of-8 DECODER (relay tree) + 8x4 REGISTER FILE
 * with addressed write — the playfield storage pattern. Pure wiring.
 *
 * Decoder: a 3-level transfer-contact tree. A2 spends 1 set, A1 both sets,
 * A0 needs 4 sets so it gets a parallel-coil mirror (the contact-minting
 * idiom). Exactly one leaf is live for each address.
 *
 * Register file (68 relays = 12 machines, formula-packed relay n ->
 * m{n/6}.{n%6+1}): each decoder leaf energizes a per-row write group of FOUR
 * relays (coils parallel across two chained coms). W+W' contribute the 4 data
 * gates, W''+W''' the 4 hold-break contacts — one PRIVATE contact per cell
 * for BOTH paths. A write press clears the row and sets the data=1 cells
 * atomically; on release each energized cell re-latches through its own hold
 * contact, the same handoff the proven DFF slave relies on. Data rails (4)
 * ride the 6-hole M10 matrix groups.
 *
 * TIE-POINT LAW, CAUGHT AGAIN (2026-08-19, by this very test): the first
 * draft broke each row's hold current with ONE shared contact feeding a
 * per-row hold rail. On a mixed overwrite (3 -> 10), a cell being SET
 * backfed the "broken" rail through its own closed hold contact and kept the
 * sibling cell that should have cleared alive. A jack is a permanent tie: the
 * rail bridged all four cells whenever ANY of them was live. Fix: the hold
 * break is per-cell — + from the cell's own section, through a private W''
 * or W''' contact, into the cell's hold arm. No shared hold node exists.
 *
 * Rung 6 composition also lives here: the detectors read STORED state
 * through the cells' spare second contact sets. line-full on row 2 = series
 * chain of its four cells' NO contacts; collision on row 3 = four
 * piece-AND-cell series branches joined on a free M11 group (piece = 4
 * slide-driven relays on m11's spare sections). The standalone exhaustive
 * version is multivac-collision-line.test.ts.
 *
 * The full exercise below runs sparse-pinned: at 12 machines a single dense
 * pass over ~90 interactions costs minutes (cf. the 16-machine cascade at
 * ~52s under cktsim), so the dense oracle instead covers the short
 * ambient-engine sample test — same stamps, same topology class.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine, type SolverEngine } from '../minivac-simulator';

afterEach(() => setSolverEngine('sparse'));

// real hardware: 2 holes per jack, 4 on COMMON, 6 on matrix groups 10/11
function assertJackCapacity(wires: string[]) {
  const uses = new Map<string, number>();
  for (const w of wires) for (const t of w.split('/')) uses.set(t, (uses.get(t) || 0) + 1);
  for (const [jack, n] of uses) {
    const cap = jack.endsWith('com') ? 4 : /M1[01]$/.test(jack) ? 6 : 2;
    expect(n, `jack ${jack} used ${n}x (capacity ${cap})`).toBeLessThanOrEqual(cap);
  }
}

// relay n lives at machine floor(n/6), section n%6+1
const R = (n: number, jack: string) => `m${Math.floor(n / 6)}.${(n % 6) + 1}${jack}`;
const A0 = 0, A0m = 1, A1 = 2, A2 = 3; // address relays + A0 mirror
const W = (r: number, k: number) => 4 + 4 * r + k; // write group, k = 0..3
const CELL = (r: number, j: number) => 36 + 4 * r + j;
const comOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}com`;

// address slides live on m0 sections 1-3; the WRITE button on m0 section 4;
// data slides on m1 sections 1-4 (sections' slides/buttons are independent
// of whatever relay occupies the section)
function addressAndTree(root: string): { wires: string[]; sel: string[] } {
  const wires = [
    'm0.1+/m0.1S', `m0.1T/${R(A0, 'com')}`, `${R(A0, 'com')}/${R(A0, 'E')}`,
    `${R(A0, 'com')}/${R(A0m, 'E')}`, `${R(A0, 'F')}/${R(A0, '-')}`,
    `${R(A0m, 'F')}/m0.2-`,
    'm0.2+/m0.2S', `m0.2T/${R(A1, 'E')}`, `${R(A1, 'F')}/m0.3-`,
    'm0.3+/m0.3S', `m0.3T/${R(A2, 'E')}`, `${R(A2, 'F')}/m0.4-`,
    // tree: root -> A2 -> A1 (both sets) -> A0/A0' (four sets)
    `${root}/${R(A2, 'H')}`,
    `${R(A2, 'J')}/${R(A1, 'H')}`, `${R(A2, 'G')}/${R(A1, 'L')}`,
    `${R(A1, 'J')}/${R(A0, 'H')}`, `${R(A1, 'G')}/${R(A0, 'L')}`,
    `${R(A1, 'N')}/${R(A0m, 'H')}`, `${R(A1, 'K')}/${R(A0m, 'L')}`,
  ];
  const sel = [
    R(A0, 'J'), R(A0, 'G'), R(A0, 'N'), R(A0, 'K'),
    R(A0m, 'J'), R(A0m, 'G'), R(A0m, 'N'), R(A0m, 'K'),
  ];
  return { wires, sel };
}

function decoderDemoCircuit(): string[] {
  // standalone: tree root wired straight to +, each leaf drives a light
  const { wires, sel } = addressAndTree('m0.5+');
  for (let k = 0; k < 8; k++) {
    const light = k < 6 ? `m0.${k + 1}` : `m1.${k - 5}`;
    wires.push(`${sel[k]}/${light}A`, `${light}B/${light}-`);
  }
  return wires;
}

function registerFileCircuit(): string[] {
  // root gated by the WRITE button on m0 section 4
  const { wires: w, sel } = addressAndTree('m0.4X');
  w.push('m0.4+/m0.4Y');
  for (let r = 0; r < 8; r++) {
    // four write-group coils in parallel: leaf com chained to a second com
    const comA = comOf(W(r, 0));
    const comB = comOf(W(r, 2));
    w.push(`${sel[r]}/${comA}`, `${comA}/${comB}`);
    for (let k = 0; k < 4; k++) {
      const src = k < 2 ? comA : comB;
      w.push(`${src}/${R(W(r, k), 'E')}`, `${R(W(r, k), 'F')}/${R(W(r, k), '-')}`);
    }
    for (let j = 0; j < 4; j++) {
      const c = CELL(r, j);
      const cCom = comOf(c);
      const [arm, no, nc] = j % 2 === 0 ? ['H', 'G', 'J'] : ['L', 'K', 'N'];
      // data gate: rail -> private W/W' contact -> cell com
      const g = W(r, j < 2 ? 0 : 1);
      const railGroup = r < 4 ? `m${j}.M10` : `m${j + 4}.M10`;
      w.push(`${railGroup}/${R(g, arm)}`, `${R(g, no)}/${cCom}`);
      // private hold break: cell's own + -> W''/W''' NC contact -> cell hold arm
      const b = W(r, j < 2 ? 2 : 3);
      w.push(`${R(c, '+')}/${R(b, arm)}`, `${R(b, nc)}/${R(c, 'H')}`);
      // cell latches through its own contact
      w.push(`${R(c, 'G')}/${cCom}`);
      w.push(`${cCom}/${R(c, 'E')}`, `${R(c, 'F')}/${R(c, '-')}`);
    }
  }
  // data rails: slide sources on m1, each rail = two M10 groups linked
  for (let j = 0; j < 4; j++) {
    w.push(`m1.${j + 1}+/m1.${j + 1}S`, `m1.${j + 1}T/m${j}.M10`, `m${j}.M10/m${j + 4}.M10`);
  }
  return w;
}

function playfieldCircuit(): string[] {
  const w = registerFileCircuit();
  // line-full on row 2 (cells at m7.3-6): series AND through the cells'
  // spare second contact sets, light at the end of the chain
  w.push('m7.3+/m7.3L', 'm7.3K/m7.4L', 'm7.4K/m7.5L', 'm7.5K/m7.6L');
  w.push('m7.6K/m11.3A', 'm11.3B/m11.3-');
  // piece register: 4 slide-driven relays on m11's spare sections 3-6
  for (let j = 0; j < 4; j++) {
    const s = `m11.${3 + j}`;
    w.push(`${s}+/${s}S`, `${s}T/${s}E`, `${s}F/${s}-`);
    // collision branch: + -> piece contact -> row-3 cell contact -> join
    w.push(`${s}+/${s}H`, `${s}G/m8.${1 + j}L`, `m8.${1 + j}K/m8.M11`);
  }
  w.push('m8.M11/m11.4A', 'm11.4B/m11.4-'); // collision light
  return w;
}

function makeRegisterFile() {
  const wires = playfieldCircuit();
  assertJackCapacity(wires);
  const m = new MinivacSimulator(wires, false, 12);
  m.initialize();
  const cellState = (r: number, j: number) => {
    const c = CELL(r, j);
    return m.getMachineState(Math.floor(c / 6)).relays[c % 6] ? 1 : 0;
  };
  const row = (r: number) =>
    cellState(r, 0) + 2 * cellState(r, 1) + 4 * cellState(r, 2) + 8 * cellState(r, 3);
  const setAddr = (r: number) => {
    m.setSlide(1, r & 1 ? 'right' : 'left', 0);
    m.setSlide(2, r & 2 ? 'right' : 'left', 0);
    m.setSlide(3, r & 4 ? 'right' : 'left', 0);
  };
  const setData = (v: number) => {
    for (let j = 0; j < 4; j++) m.setSlide(j + 1, (v >> j) & 1 ? 'right' : 'left', 1);
  };
  const write = (r: number, v: number) => {
    setAddr(r);
    setData(v);
    m.pressButton(4, 0);
    m.releaseButton(4, 0);
    expect(m.lastRelaxationIterations).toBeLessThanOrEqual(10);
    expect(m.getState().alerts).toEqual([]);
  };
  const setPiece = (v: number) => {
    for (let j = 0; j < 4; j++) m.setSlide(3 + j, (v >> j) & 1 ? 'right' : 'left', 11);
  };
  const lineFull = () => (m.getMachineState(11).lights[2] ? 1 : 0);
  const collision = () => (m.getMachineState(11).lights[3] ? 1 : 0);
  return { m, row, setAddr, setData, write, setPiece, lineFull, collision };
}

describe('Multivac: 1-of-8 decoder tree (2 machines), both engines', () => {
  for (const engine of ['sparse', 'cktsim'] as SolverEngine[]) {
    it(`selects exactly one output per address (${engine})`, { timeout: 300000 }, () => {
      setSolverEngine(engine);
      const wires = decoderDemoCircuit();
      assertJackCapacity(wires);
      const m = new MinivacSimulator(wires, false, 2);
      m.initialize();
      for (let addr = 0; addr < 8; addr++) {
        m.setSlide(1, addr & 1 ? 'right' : 'left', 0);
        m.setSlide(2, addr & 2 ? 'right' : 'left', 0);
        m.setSlide(3, addr & 4 ? 'right' : 'left', 0);
        const lights = [
          ...m.getMachineState(0).lights.slice(0, 6),
          ...m.getMachineState(1).lights.slice(0, 2),
        ].map(l => (l ? 1 : 0));
        const expected = Array.from({ length: 8 }, (_, k) => (k === addr ? 1 : 0));
        expect(lights, `address ${addr}`).toEqual(expected);
      }
    });
  }
});

describe('Multivac: 8x4 register file with addressed write (10 machines)', () => {
  it('writes, holds, overwrites and clears every row (sparse)', { timeout: 300000 }, () => {
    setSolverEngine('sparse');
    const { m, row, setAddr, setData, write, setPiece, lineFull, collision } = makeRegisterFile();
    const model = Array(8).fill(0);
    const checkAll = (label: string) => {
      for (let r = 0; r < 8; r++) expect(row(r), `${label}: row ${r}`).toBe(model[r]);
    };
    checkAll('initial');

    // every row gets a distinct value; every write re-verifies the whole file
    for (let r = 0; r < 8; r++) {
      const v = (r * 5 + 3) % 16;
      write(r, v);
      model[r] = v;
      checkAll(`wrote ${v} to row ${r}`);
    }
    // overwrites, including full set and full clear of the same row
    for (const [r, v] of [[5, 15], [5, 0], [0, 10], [0, 5], [7, 9]] as const) {
      write(r, v);
      model[r] = v;
      checkAll(`overwrote row ${r} with ${v}`);
    }
    // address/data wiggles without the button must not touch storage
    setAddr(3);
    setData(15);
    checkAll('immune to slide wiggles');
    // one relay per cell: the whole file is parallel-readable state
    expect(m.getMachineState(11).relays.length).toBe(6);

    // rung 6 composition: detectors read the STORED rows
    expect(lineFull(), `line light with row 2 = ${model[2]}`).toBe(0);
    write(2, 15);
    model[2] = 15;
    checkAll('filled row 2');
    expect(lineFull(), 'line-full fires on a full stored row').toBe(1);
    write(2, 7);
    model[2] = 7;
    expect(lineFull(), 'line-full clears when a hole appears').toBe(0);

    expect(row(3), 'row 3 as stored').toBe(2);
    setPiece(0b0010);
    expect(collision(), 'piece overlaps stored row 3').toBe(1);
    setPiece(0b1101);
    expect(collision(), 'disjoint piece does not collide').toBe(0);
    setPiece(0);
    expect(collision()).toBe(0);
    checkAll('piece wiggles never touch storage');
  });

  // short ambient-engine sample: THIS is the register-file test the
  // MINIVAC_SOLVER=dense oracle pass exercises end to end (the full sweep
  // above would cost minutes per pass at 10 machines under cktsim)
  it('write/hold/clear sample (ambient engine)', { timeout: 600000 }, () => {
    const { row, write, setPiece, lineFull, collision } = makeRegisterFile();
    write(0, 0b1011);
    write(5, 0b0110);
    expect(row(0), 'row 0 after two writes').toBe(0b1011);
    expect(row(5), 'row 5').toBe(0b0110);
    write(0, 0b0100); // overwrite: clears bits 0,1,3 and keeps a new bit set
    expect(row(0), 'row 0 overwritten').toBe(0b0100);
    expect(row(5), 'row 5 untouched').toBe(0b0110);
    for (let r = 0; r < 8; r++) {
      if (r !== 0 && r !== 5) expect(row(r), `row ${r} never written`).toBe(0);
    }
    // detectors on stored state, dense-oracle covered
    write(2, 15);
    expect(lineFull(), 'line-full on stored row 2').toBe(1);
    write(2, 14);
    expect(lineFull(), 'line no longer full').toBe(0);
    setPiece(0b1000);
    expect(collision(), 'row 3 is empty').toBe(0);
    write(3, 0b1000);
    expect(collision(), 'piece meets stored row 3').toBe(1);
  });
});
