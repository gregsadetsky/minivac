/**
 * THE PARTS OF THE CIRCUIT, derived rather than drawn.
 *
 * This is not a microprocessor and it has no datapath/control split, so
 * a hand-drawn floorplan would be an opinion. Instead every block below
 * is read straight off the LAYOUT's own accessors at the geometry being
 * viewed, so the picture cannot drift from the circuit: if a bank moves,
 * the map moves with it.
 *
 * The visual6502 part is the edges, not the fill: once every relay has an
 * owner, a wire is INTERNAL when both its ends sit in the same block and
 * a CROSSING when they do not. A block's crossings are exactly its I/O.
 */

import type { TetrisLayout } from '../circuits/multivac-mini-tetris';

export interface Block {
  name: string;
  colour: string;
  /** what it does, in the generator's own terms */
  note: string;
  relays: number[];
}

const rangeOf = (n: number, f: (i: number) => number): number[] =>
  Array.from({ length: n }, (_, i) => f(i));

/** collect from an accessor that may be out of domain at the edges */
function safe(f: () => number[]): number[] {
  try {
    return f().filter((n) => Number.isInteger(n) && n >= 0);
  } catch {
    return [];
  }
}

export function circuitBlocks(L: TetrisLayout, rows: number, cols: number): Block[] {
  const grid = (f: (r: number, j: number) => number, a: number, b: number) => {
    const out: number[] = [];
    for (let r = 0; r < a; r++) for (let j = 0; j < b; j++) out.push(f(r, j));
    return out;
  };
  const defs: Array<[string, string, string, () => number[]]> = [
    ['field', '#4ea3ff', 'the playfield itself: one relay per cell, latched', () => grid(L.CELL, rows, cols)],
    ['write', '#7a6cff', 'the addressed write path: decoder + per-row write groups', () =>
      [L.A0, L.A0m, L.A1, L.A2, ...grid(L.W, rows, 4)]],
    ['gravity', '#31d0aa', 'the token ring — where the falling piece IS', () =>
      rangeOf(rows, (i) => L.RING(i, 0)).concat(rangeOf(rows, (i) => L.RING(i, 1)), rangeOf(rows, (i) => L.RING(i, 2)))],
    ['readback', '#2f9e8f', 'row mirrors that read stored cells back out', () =>
      rangeOf(rows, L.MIRA).concat(rangeOf(rows, L.MIRB), rangeOf(rows, L.MIRB2))],
    ['collision', '#ff6b6b', 'the lock decision: collide, lock master/slave, reset', () =>
      [L.COLLIDE, L.COLLIDEM, L.COLLIDEM2, L.LKM, L.LKS, L.LKM2, L.LKM3, L.RSTM, L.RSTM2, L.TICKM, L.READGATE]],
    ['write phases', '#ffa94d', 'phase 2 (and the inert ROW2 changeover toward a third row)', () =>
      [L.P2M, L.P2S, L.P2CLR, L.P2GATE, L.P2COL, L.TICKM2, L.ROW2, ...rangeOf(rows, L.TOPW)]],
    ['line clear', '#ffd43b', 'full-row sense and the two clear latches', () =>
      rangeOf(cols, L.LINE).concat([L.CPSET, L.CLEARP, L.CPSET2, L.CLEARP2, L.CLEARPM, L.CLEARPM2, L.LINEDLY, L.LINEDLY2])],
    ['collapse', '#f783ac', 'the elevator that walks the hole up the field', () =>
      rangeOf(rows, L.ELEVC).concat(rangeOf(rows, L.ELEVA), rangeOf(rows, L.ELEVSL), rangeOf(rows, L.SEEDM), [L.LANE, L.TICKM3, L.TGM, L.TGS])],
    ['position', '#845ef7', 'the column register: where the piece is, laterally', () =>
      rangeOf(cols, L.POSA).concat(rangeOf(cols, L.POSS), rangeOf(cols, L.POSM), [L.LEFTM, L.RIGHTM, L.ANYBM, L.ANYBM2, L.BOOTL, L.TWIN])],
    ['shape ring', '#20c997', 'the thirteen-state one-hot ring holding the current piece', () =>
      rangeOf(6, (i) => L.SHR(i, 0)).concat(
        rangeOf(6, (i) => L.SHR(i, 1)), rangeOf(6, (i) => L.SHR(i, 2)),
        [6, 7, 8].flatMap((i) => [L.SHR2(i, 0), L.SHR2(i, 1), L.SHR2(i, 2)]),
        [9, 10, 11].flatMap((i) => [L.SHR3(i, 0), L.SHR3(i, 1), L.SHR3(i, 2)]),
        [L.SHR4(12, 0), L.SHR4(12, 1), L.SHR4(12, 2), L.UPM, L.SHBOOT])],
    ['rotation', '#e599f7', 'NOTOK and the D-feed muxes that re-aim the ring mid-fall', () =>
      [L.NOTOK, L.TOKM0, ...rangeOf(5, L.NOTM)]],
    ['legality', '#74c0fc', 'the step trees: contacts that refuse an illegal move', () =>
      rangeOf(L.STPMIR_CAP, (k) => L.STPMIR + k).concat(
        rangeOf(L.STPUNION_CAP, (k) => L.STPUNION + k),
        rangeOf(L.STPUGATE_CAP, (k) => L.STPUGATE + k),
        rangeOf(L.STPREAD_CAP, (k) => L.STPREAD + k))],
    ['fans', '#a9e34b', 'the mask fans that turn (shape, column) into lit cells', () =>
      rangeOf(L.FANPOS_CAP, (k) => L.FANPOS + k).concat(
        rangeOf(L.FANRAIL_CAP, (k) => L.FANRAIL + k),
        rangeOf(L.FANMIR_CAP, (k) => L.FANMIR + k),
        rangeOf(cols, L.PIECE), rangeOf(cols, L.PIECET))],
    ['score', '#ffe066', 'the decimal score ring, one step per clear', () =>
      rangeOf(10, (i) => L.SCR(i, 0)).concat(rangeOf(10, (i) => L.SCR(i, 1)), rangeOf(10, (i) => L.SCR(i, 2)), [L.SCBOOT])],
    ['clock', '#ff922b', 'the capacitor oscillator: the machine ticking itself', () => [L.TOSC, L.TDRV]],
    ['game over', '#868e96', 'the top-out latch that blocks every future spawn', () => [L.GOM, L.GAMEOVER]],
  ];
  return defs.map(([name, colour, note, f]) => ({ name, colour, note, relays: safe(f) }));
}

/** relay index -> block index, and -1 for anything no block claims */
export function ownerMap(blocks: Block[], nSections: number): Int8Array {
  const owner = new Int8Array(nSections).fill(-1);
  blocks.forEach((b, bi) => {
    for (const r of b.relays) if (r >= 0 && r < nSections && owner[r] === -1) owner[r] = bi;
  });
  return owner;
}
