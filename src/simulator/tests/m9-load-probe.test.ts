/**
 * TEMPORARY PROBE (B3): machine 9's supply current, key by key, through
 * the diff scripted game's opening — the 3.51A alert fired during
 * 'drop the L'. This copies the diff harness's own control flow (a
 * TetrisReference decides the loops) so the field states are EXACT.
 * Measures before naming. Deleted once the bill is paid.
 */
import { describe, it, expect } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import {
  tetrisCircuit,
  MACHINES,
  RING,
  LKS,
  LANE,
  NSTATES,
  SELECTION_NEXT,
  ROT_STATE,
  homeColumn,
  TETRIS_IO,
} from '../../circuits/multivac-mini-tetris';
import { TetrisReference, type RefKey } from '../../tetris/reference';

const ROWS = 8;
const COLS = 4;

describe('machine 9 load probe (temporary)', () => {
  it('prints supply currents per key through the scripted opening', { timeout: 1800000 }, () => {
    setSolverEngine('fast');
    const { wires } = tetrisCircuit();
    const m = new MinivacSimulator(wires, false, MACHINES);
    m.initialize();
    const rel = (n: number) => m.getMachineState(Math.floor(n / 6)).relays[n % 6];
    const supply = (k: number) =>
      Math.abs(((m as unknown as { lastResults: Record<string, number> | null }).lastResults?.[
        `I(${k === 0 ? '' : `m${k}.`}V_POWER)`
      ] ?? 0));
    let peak9 = 0;
    let peakLabel = '';
    const report = (label: string) => {
      const s9 = supply(9);
      if (s9 > peak9) {
        peak9 = s9;
        peakLabel = label;
      }
      if (s9 > 3.1) {
        const tops = Array.from({ length: MACHINES }, (_, k) => [k, supply(k)] as const)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k, v]) => `m${k}=${v.toFixed(2)}A`)
          .join(' ');
        const ms = m.getMachineState(9);
        const coils = ms.relayCurrents
          .map((c, i) => `CELL(${2 + i},2):${ms.relays[i] ? 'ON' : 'off'}:${c.toFixed(0)}mA`)
          .join(' ');
        console.log(`>>> ${label}: m9=${s9.toFixed(3)}A | top: ${tops}`);
        console.log(`    ${coils}`);
      }
    };
    const tokenRow = () => {
      for (let i = 0; i < ROWS; i++) if (rel(RING(i, 2))) return i;
      return -1;
    };
    const key = (k: RefKey, label: string) => {
      if (k === 'tick') {
        m.setSlide(TETRIS_IO.tick.slide, 'right', TETRIS_IO.tick.machine);
        report(`${label} [hi]`);
        m.setSlide(TETRIS_IO.tick.slide, 'left', TETRIS_IO.tick.machine);
        report(label);
        let guard = 3 * ROWS + 12;
        while ((rel(LKS) || rel(LANE)) && guard-- > 0) {
          m.setSlide(TETRIS_IO.tick.slide, 'right', TETRIS_IO.tick.machine);
          report(`${label} [owed hi]`);
          m.setSlide(TETRIS_IO.tick.slide, 'left', TETRIS_IO.tick.machine);
          report(`${label} [owed]`);
        }
      } else {
        const b =
          k === 'start' ? TETRIS_IO.start : k === 'left' ? TETRIS_IO.left : k === 'right' ? TETRIS_IO.right : TETRIS_IO.up;
        m.pressButton(b.button, b.machine);
        report(`${label} [held]`);
        m.releaseButton(b.button, b.machine);
        report(label);
      }
    };

    const ref = new TetrisReference({
      rows: ROWS,
      cols: COLS,
      shapes: NSTATES,
      rot: 'current',
      currentRot: ROT_STATE,
      selectionNext: SELECTION_NEXT,
      home: homeColumn(COLS),
    });
    const play = (keys: RefKey[], label: string) => {
      for (const k of keys) {
        key(k, label);
        ref.key(k);
      }
    };
    const steer = (col: number, label: string) => {
      let guard = COLS + 2;
      while (ref.pos !== col && guard-- > 0) play([ref.pos < col ? 'right' : 'left'], label);
    };
    const dropAt = (col: number, label: string) => {
      play(['tick'], `${label} spawn`);
      steer(col, label);
      let guard = ROWS + 4;
      while (ref.tokenRow >= 0 && guard-- > 0) play(['tick'], `${label} fall`);
    };
    const selectShape = (ix: number, label: string) => {
      let guard = NSTATES + 2;
      while (ref.shapeIx !== ix && guard-- > 0) play(['up'], label);
    };

    // the scripted opening, verbatim from tetris-reference-diff
    play(['start'], 'boot');
    dropAt(0, 'first cell');
    dropAt(0, 'second cell stacks');
    play(['left', 'left'], 'walk to the wall');
    dropAt(1, 'third');
    dropAt(2, 'fourth');
    dropAt(3, 'completes the bottom line');
    selectShape(1, 'choose 2 wide');
    play(['tick'], 'spawn the domino');
    play(['up'], 'flip to 2 tall');
    play(['up'], 'flip back');
    steer(2, 'steer the domino');
    while (ref.tokenRow >= 0) play(['tick'], 'drop the domino');
    steer(0, 'walk to the wall');
    selectShape(3, 'up to the square');
    play(['up'], 'S refused at column 0');
    steer(1, 'back to the home column');
    selectShape(4, 'S enters at the home column');
    play(['tick', 'left'], 'S spawned; left refused');
    play(['up'], 'S rotates VERTICAL');
    while (ref.tokenRow >= 0) play(['tick'], 'drop the S');
    selectShape(6, 'choose L');
    play(['tick'], 'spawn L');
    play(['up'], 'L -> L vert R');
    play(['up'], 'L vert R -> L flip');
    while (ref.tokenRow >= 0) play(['tick'], 'drop the L');
    selectShape(8, 'choose T');
    play(['tick', 'up'], 'spawn T, flip to T flip');
    while (ref.tokenRow >= 0) play(['tick'], 'drop the T');
    steer(0, 'walk left for I');
    selectShape(2, 'back to 2 tall');
    let guard = 12;
    while (!ref.gameOver && guard-- > 0) dropAt(ref.pos, 'stack to the sky');

    console.log(`PEAK m9: ${peak9.toFixed(3)}A at "${peakLabel}"`);
    console.log(`token ${tokenRow()}, alerts: ${JSON.stringify(m.getState().alerts)}`);
    expect(true).toBe(true);
  });
});
