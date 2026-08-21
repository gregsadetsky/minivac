/**
 * WHERE EVERY JACK SITS.
 *
 * The relay viewer draws real wires between real jacks, so the geometry
 * has to be a function, not a picture: given a jack name out of the
 * netlist ("m37.4G", "m12.M10") it returns a point in panel space. Every
 * wire in the circuit is then just a line between two of those points.
 *
 * A section is drawn as an actual relay rather than a dot: a coil block
 * on the left, and two armatures that pivot from their arm jack (H, L)
 * and land on the NO jack (G, K) when the coil pulls or the NC jack
 * (J, N) when it lets go. That is the whole visible state — no
 * animation, the arm is simply somewhere.
 */

// ---- one section, in its own local box ----
export const SEC_W = 148;
export const SEC_H = 92;

/**
 * Jack offsets inside a section box.
 *
 * Laid out so the ARMATURE READS: each contact set is a pivot on the left
 * (H, L) with its two possible landings stacked well apart on the right —
 * NC above, NO below — so the arm's angle alone tells you the state from
 * across the wall. The coil sits to the left of the pivots because that is
 * the direction it pulls.
 */
export const SEC_JACKS: Record<string, readonly [number, number]> = {
  '+': [14, 11],
  '-': [34, 11],
  com: [54, 11],
  // the coil block is x 8..56, y 24..58; its two leads hang below it
  E: [16, 66],
  F: [48, 66],
  // contact set 1: pivot H, released onto J (up), pulled onto G (down)
  H: [76, 24],
  J: [128, 14],
  G: [128, 40],
  // contact set 2: same shape, lower
  L: [76, 60],
  N: [128, 50],
  K: [128, 76],
  // the slide, the button, the capacitor tap
  S: [16, 84],
  T: [34, 84],
  X: [52, 84],
  Y: [66, 84],
  cap: [100, 84],
  // the indicator lamp
  A: [100, 11],
  B: [114, 11],
};

/** the two landings of each contact set, for drawing the fixed contacts */
export const CONTACT_SETS = [
  { pivot: 'H', nc: 'J', no: 'G' },
  { pivot: 'L', nc: 'N', no: 'K' },
] as const;

export const COIL_BOX = { x: 8, y: 24, w: 48, h: 34 } as const;

// ---- one machine: six sections in 2 columns x 3 rows, plus the matrix ----
const COL_GAP = 10;
const ROW_GAP = 8;
export const MACH_W = 2 * SEC_W + COL_GAP + 24;
const MATRIX_H = 34;
export const MACH_H = 3 * SEC_H + 2 * ROW_GAP + MATRIX_H + 28;

/** section 1..6 -> its box origin inside the machine */
export function sectionOrigin(sec: number): readonly [number, number] {
  const i = sec - 1;
  const col = i % 2;
  const row = (i / 2) | 0;
  return [12 + col * (SEC_W + COL_GAP), 20 + row * (SEC_H + ROW_GAP)];
}

/** matrix group n (1..11) -> its point inside the machine */
export function matrixPoint(n: number): readonly [number, number] {
  const y = MACH_H - MATRIX_H + 14;
  const span = MACH_W - 40;
  return [20 + ((n - 1) / 10) * span, y];
}

// ---- the wall of machines ----
export interface PanelLayout {
  machines: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  machineOrigin(m: number): readonly [number, number];
  /** panel-space point for a SOLVER node name, or null if unplaceable */
  jack(name: string): readonly [number, number] | null;
  /**
   * Both ends of a wire at once, plus whether one end is a SUPPLY RAIL.
   *
   * Power_Negative is a single node shared by all 180 machines and 925
   * wires end on it; Power_Positive is per-machine but nearly as busy.
   * Routing those anywhere makes a hairball that says nothing, so a rail
   * end is not routed at all: it becomes a short stub out of the jack to
   * a drawn "-" or "+" symbol, the way a schematic does it. That takes
   * ~1400 of the 4782 wires out of the picture without hiding anything.
   */
  ends(a: string, b: string): WireEnds | null;
}

/** a rail end is a stub of this length out of its jack, then a symbol */
export const RAIL_STUB = 13;

export interface WireEnds {
  ax: number; ay: number; bx: number; by: number;
  /** '+' or '-' when the B end is a supply symbol rather than a jack */
  rail: '+' | '-' | null;
}

const MACH_GAP = 26;

export function panelLayout(machines: number): PanelLayout {
  // a wall a little wider than tall reads better on a landscape screen
  const cols = Math.max(1, Math.ceil(Math.sqrt(machines * 1.35)));
  const rows = Math.ceil(machines / cols);
  const machineOrigin = (m: number): readonly [number, number] => [
    (m % cols) * (MACH_W + MACH_GAP) + MACH_GAP,
    ((m / cols) | 0) * (MACH_H + MACH_GAP) + MACH_GAP,
  ];

  // The SOLVER's node vocabulary, which is what a wire actually connects.
  // Machine 0 is unprefixed internally, so the machine part is optional.
  const RE =
    /^(?:m(\d+)\.)?(?:Relay(\d)_(?:Coil_(Input|Output)|Contact(\d)_(Common|NO|NC))|Common_(\d)|Matrix_M(\d+)|Capacitor_(\d)|Slide(\d)_(?:Common|Right|Left)\d|Button(\d)_\w+|(Power_Positive))$/;

  type Parsed = { machine: number; rail: 'plus' | null; off: readonly [number, number] | null };
  const cache = new Map<string, Parsed | null>();

  function parse(name: string): Parsed | null {
    const hit = cache.get(name);
    if (hit !== undefined) return hit;
    let out: Parsed | null = null;
    if (name === 'Power_Negative') {
      out = { machine: -1, rail: null, off: null }; // resolved from its partner
    } else {
      const g = RE.exec(name);
      if (g) {
        const machine = g[1] === undefined ? 0 : +g[1];
        let key: string | null = null;
        let sec = 0;
        if (g[3]) { key = g[3] === 'Input' ? 'E' : 'F'; sec = +g[2]; }
        else if (g[5]) {
          sec = +g[2];
          const set1 = g[4] === '1';
          key = g[5] === 'Common' ? (set1 ? 'H' : 'L') : g[5] === 'NO' ? (set1 ? 'G' : 'K') : set1 ? 'J' : 'N';
        } else if (g[6]) { key = 'com'; sec = +g[6]; }
        else if (g[7]) { key = null; sec = 0; }
        else if (g[8]) { key = 'cap'; sec = +g[8]; }
        else if (g[9]) { key = 'S'; sec = +g[9]; }
        else if (g[10]) { key = 'X'; sec = +g[10]; }
        else if (g[11]) { out = { machine, rail: 'plus', off: null }; }
        if (!out) {
          if (g[7]) {
            // a matrix group belongs to the machine, not to a section
            const p = matrixPoint(Math.min(11, Math.max(1, +g[7])));
            out = { machine, rail: null, off: p };
          } else if (key) {
            const o = SEC_JACKS[key];
            const [sx, sy] = sectionOrigin(sec);
            out = { machine, rail: null, off: [sx + o[0], sy + o[1]] };
          }
        }
      }
    }
    cache.set(name, out);
    return out;
  }

  const at = (p: Parsed, hostMachine: number): readonly [number, number] => {
    const m = p.machine < 0 ? hostMachine : p.machine;
    const [mx, my] = machineOrigin(m);
    const off = p.off ?? ([MACH_W - 26, p.rail === 'plus' ? 12 : MACH_H - 12] as const);
    return [mx + off[0], my + off[1]];
  };

  const jack = (name: string): readonly [number, number] | null => {
    const p = parse(name);
    return p ? at(p, 0) : null;
  };

  const ends = (a: string, b: string): WireEnds | null => {
    const pa = parse(a), pb = parse(b);
    if (!pa || !pb) return null;
    // put the rail end second so the caller only has one case to draw
    const aIsRail = pa.off === null, bIsRail = pb.off === null;
    const [p, q] = aIsRail && !bIsRail ? [pb, pa] : [pa, pb];
    const host = p.machine >= 0 ? p.machine : q.machine >= 0 ? q.machine : 0;
    const [ax, ay] = at(p, host);
    if (!(aIsRail || bIsRail) || (aIsRail && bIsRail)) {
      const [bx, by] = at(q, host);
      return { ax, ay, bx, by, rail: null };
    }
    // a rail end: a stub DOWN for minus, UP for plus, then its symbol
    const minus = q.machine < 0;
    return { ax, ay, bx: ax, by: ay + (minus ? RAIL_STUB : -RAIL_STUB), rail: minus ? '-' : '+' };
  };

  return {
    machines,
    cols,
    rows,
    width: cols * (MACH_W + MACH_GAP) + MACH_GAP,
    height: rows * (MACH_H + MACH_GAP) + MACH_GAP,
    machineOrigin,
    jack,
    ends,
  };
}
