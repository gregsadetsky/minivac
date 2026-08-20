// TEMPORARY debug trace for the rung-10 collapse — deleted before the rung
// lands. Replays the acceptance scenario and dumps the field + collapse
// machinery per tick, with no assertions except the setup.
import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import {
  tetrisCircuit, MACHINES, CELL, RING, ELEVSL, ELEVA, LANE, TGM, TGS,
  CGA, CGB, CGB2, CLEARPM, PIECE, VMODE,
} from '../../circuits/multivac-mini-tetris';

afterEach(() => setSolverEngine('sparse'));

describe('collapse debug trace', () => {
  it('dump the acceptance scenario tick by tick', { timeout: 900000 }, () => {
    setSolverEngine('sparse');
    const { wires } = tetrisCircuit();
    const m = new MinivacSimulator(wires, false, MACHINES);
    m.initialize();
    const on = (n: number) => (m.getMachineState(Math.floor(n / 6)).relays[n % 6] ? 1 : 0);
    const row = (r: number) => {
      let v = 0;
      for (let j = 0; j < 4; j++) v |= on(CELL(r, j)) << j;
      return v;
    };
    const field = () => Array.from({ length: 8 }, (_, r) => row(r).toString(2).padStart(4, '0')).join(' ');
    const elev = () => Array.from({ length: 7 }, (_, i) => on(ELEVSL(i + 1))).join('');
    const masters = () => Array.from({ length: 7 }, (_, i) => on(ELEVA(i + 1))).join('');
    const token = () => {
      const hot: number[] = [];
      for (let i = 0; i < 8; i++) if (on(RING(i, 2))) hot.push(i);
      return hot.join(',') || '-';
    };
    const dump = (tag: string) =>
      console.log(
        `${tag} field=${field()} tok=${token()} elevS=${elev()} elevM=${masters()} ` +
        `LANE=${on(LANE)} TGM=${on(TGM)} TGS=${on(TGS)} CGA=${on(CGA)} CGB=${on(CGB)} CGB2=${on(CGB2)} CLEARPM=${on(CLEARPM)} it=${m.lastRelaxationIterations}`
      );

    const setSlide = (s: number, dir: 'left' | 'right', mach: number) => m.setSlide(s, dir, mach);
    const opWrite = (r: number, v: number) => {
      setSlide(1, r & 1 ? 'right' : 'left', 0);
      setSlide(2, r & 2 ? 'right' : 'left', 0);
      setSlide(3, r & 4 ? 'right' : 'left', 0);
      for (let j = 0; j < 4; j++) setSlide(j + 1, (v >> j) & 1 ? 'right' : 'left', 1);
      m.pressButton(4, 0);
      m.releaseButton(4, 0);
      for (let j = 0; j < 4; j++) setSlide(j + 1, 'left', 1);
    };
    const setMask = (mask: number) => {
      for (let k = 0; k < 4; k++) {
        const p = PIECE(k);
        setSlide((p % 6) + 1, (mask >> k) & 1 ? 'right' : 'left', Math.floor(p / 6));
      }
    };

    opWrite(7, 0b1110);
    opWrite(6, 0b0110);
    opWrite(5, 0b0010);
    setSlide((VMODE % 6) + 1, 'left', Math.floor(VMODE / 6));
    m.pressButton(6, 1);
    m.releaseButton(6, 1);
    setMask(0b0001);
    dump('setup   ');
    expect(row(7)).toBe(0b1110);

    for (let k = 1; k <= 36; k++) {
      setSlide(5, 'right', 1);
      const riseIt = m.lastRelaxationIterations;
      dump(`t${String(k).padStart(2)} high (rise it=${riseIt})`);
      setSlide(5, 'left', 1);
      dump(`t${String(k).padStart(2)} low `);
    }
  });
});
