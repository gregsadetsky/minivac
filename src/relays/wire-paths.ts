/**
 * WIRE ROUTING, computed ONCE.
 *
 * Two looks, both static geometry: nothing here runs per frame. The
 * points are baked into flat typed arrays at build time so the draw loop
 * is a tight walk with no allocation and no per-wire branching.
 *
 *  - MANHATTAN: orthogonal, three segments, routed along the long axis.
 *    Reads like a wiring diagram.
 *  - DROOPY: a quadratic sag, as if the wire were hanging between two
 *    jacks. NOT physics — the sag is a fixed function of span, evaluated
 *    once, so it costs the same as the straight version at draw time.
 */

export type WireStyle = 'manhattan' | 'droopy';

export interface WirePaths {
  /** points, x,y interleaved */
  pts: Float32Array;
  /** wire i occupies pts[start[i] .. start[i+1]) */
  start: Uint32Array;
  count: number;
}

const SAG_FRACTION = 0.28;
const SAG_MAX = 90;
/** points along each droopy curve — enough to look hung, few enough to be cheap */
const DROOP_STEPS = 7;

export function buildWirePaths(
  ends: ReadonlyArray<readonly [number, number, number, number] | null>,
  style: WireStyle,
  /** non-zero entries are SUPPLY STUBS: a straight segment in both styles */
  railKind?: Int8Array
): WirePaths {
  const n = ends.length;
  const per = style === 'manhattan' ? 4 : DROOP_STEPS + 1;
  const pts = new Float32Array(n * per * 2);
  const start = new Uint32Array(n + 1);
  let w = 0;
  for (let i = 0; i < n; i++) {
    start[i] = w;
    const e = ends[i];
    if (!e) continue;
    const [ax, ay, bx, by] = e;
    if (railKind && railKind[i] !== 0) {
      pts[w++] = ax; pts[w++] = ay;
      pts[w++] = bx; pts[w++] = by;
    } else if (style === 'manhattan') {
      // route along the LONG axis so the elbow lands away from the jacks
      if (Math.abs(bx - ax) >= Math.abs(by - ay)) {
        const mx = (ax + bx) / 2;
        pts[w++] = ax; pts[w++] = ay;
        pts[w++] = mx; pts[w++] = ay;
        pts[w++] = mx; pts[w++] = by;
        pts[w++] = bx; pts[w++] = by;
      } else {
        const my = (ay + by) / 2;
        pts[w++] = ax; pts[w++] = ay;
        pts[w++] = ax; pts[w++] = my;
        pts[w++] = bx; pts[w++] = my;
        pts[w++] = bx; pts[w++] = by;
      }
    } else {
      const dx = bx - ax, dy = by - ay;
      const span = Math.hypot(dx, dy);
      const sag = Math.min(span * SAG_FRACTION, SAG_MAX);
      // quadratic with the control point pushed DOWN by the sag: the
      // curve's lowest point ends up sag/2 below the chord, which is
      // what a slack wire between two posts actually looks like
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2 + sag * 2;
      for (let k = 0; k <= DROOP_STEPS; k++) {
        const t = k / DROOP_STEPS;
        const u = 1 - t;
        pts[w++] = u * u * ax + 2 * u * t * cx + t * t * bx;
        pts[w++] = u * u * ay + 2 * u * t * cy + t * t * by;
      }
    }
  }
  start[n] = w;
  return { pts, start, count: n };
}
