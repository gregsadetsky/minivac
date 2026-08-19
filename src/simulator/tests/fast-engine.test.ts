/**
 * Fast (typed-array) MNA engine vs the vendored dense cktsim solver.
 *
 * The fast engine (fast-circuit.ts) is a typed-array rewrite of the sparse
 * engine with the same pivot policy; this file keeps a fast permanent subset
 * of its validation. The heavy sweep is fast-mass-validation.test.ts
 * (MINIVAC_MASS=1), same methodology as the sparse engine's 5000-case run.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';
import { FastCircuit } from '../fast-circuit';
import { loadSimulator, T_VOLTAGE } from '../simulator-loader-universal';

afterEach(() => setSolverEngine('cktsim'));

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const JACKS = ['A','B','C','E','F','G','H','J','K','L','N','R','S','T','U','V','W','X','Y','Z','+','-','com'];

function randCircuit(rnd: () => number, machines: number): string[] {
  const letters = 'abc'.slice(0, machines);
  const term = () => `${letters[Math.floor(rnd() * machines)]}.${1 + Math.floor(rnd() * 6)}${JACKS[Math.floor(rnd() * JACKS.length)]}`;
  const wires: string[] = [];
  const n = 8 + Math.floor(rnd() * 22);
  for (let i = 0; i < n; i++) {
    const t1 = term(); const t2 = term();
    if (t1 !== t2) wires.push(`${t1}/${t2}`);
  }
  return wires;
}

function snapshot(m: MinivacSimulator, machines: number) {
  let s = '';
  const cur: number[] = [];
  for (let k = 0; k < machines; k++) {
    const st = m.getMachineState(k);
    s += st.relays.map(r => r ? 1 : 0).join('') + st.lights.map(l => l ? 1 : 0).join('')
      + st.relayIndicatorLights.map(l => l ? 1 : 0).join('');
    cur.push(...st.relayCurrents);
  }
  return { s, cur };
}

describe('fast engine equivalence', () => {
  it('solves the exact same MNA system as cktsim on a shared element list', () => {
    const build = (ckt: { gnd_node(): number; node(n: string, t: number): number; r(a: number, b: number, v: string, n: string): void; v(a: number, b: number, v: string, n: string): void; finalize(): boolean; dc(): Record<string, number> | null }) => {
      const gnd = ckt.gnd_node();
      const A = ckt.node('A', T_VOLTAGE);
      const B = ckt.node('B', T_VOLTAGE);
      const C = ckt.node('C', T_VOLTAGE);
      ckt.v(A, gnd, '13.3', 'VP');
      ckt.r(A, B, '1.8', 'RINT');
      ckt.v(B, C, '0', 'PROBE');
      ckt.r(C, gnd, '55', 'COIL');
      ckt.finalize();
      return ckt.dc()!;
    };
    const dense = build(new (loadSimulator().Circuit)());
    const fast = build(new FastCircuit() as never);
    for (const k of ['I(VP)', 'I(PROBE)', 'A', 'B', 'C']) {
      expect(Math.abs(dense[k] - fast[k]), k).toBeLessThan(1e-9);
    }
  });

  it('matches cktsim on 150 seeded random circuits', { timeout: 240000 }, () => {
    const rnd = lcg(20260819);
    for (let caseNo = 0; caseNo < 150; caseNo++) {
      const machines = caseNo % 10 < 7 ? 1 : caseNo % 10 < 9 ? 2 : 3;
      const wires = randCircuit(rnd, machines);
      const snaps: Record<string, ReturnType<typeof snapshot>> = {};
      for (const eng of ['cktsim', 'fast'] as const) {
        setSolverEngine(eng);
        const m = new MinivacSimulator(wires, false, machines);
        m.initialize();
        snaps[eng] = snapshot(m, machines);
      }
      expect(snaps.fast.s, `case ${caseNo}: ${wires.join(' ')}`).toBe(snaps.cktsim.s);
      for (let j = 0; j < snaps.cktsim.cur.length; j++) {
        expect(Math.abs(snaps.cktsim.cur[j] - snaps.fast.cur[j]), `case ${caseNo} current ${j}`).toBeLessThan(1e-6);
      }
    }
  });

  it('passes the previously-diverging comparator case (pivot stability regression)', { timeout: 120000 }, () => {
    // A=6 B=2 blew up to 2e24 mA in the sparse engine before threshold
    // pivoting + dead-column regularization; the fast engine keeps both rules
    const w: string[] = [];
    for (let i = 1; i <= 4; i++) {
      w.push(`a.${i}+/a.${i}S`, `a.${i}T/a.${i}E`, `a.${i}F/a.${i}-`);
      w.push(`b.${i}+/b.${i}S`, `b.${i}T/b.${i}E`, `b.${i}F/b.${i}-`);
      w.push(`a.${i}G/b.${i}H`, `a.${i}J/b.${i}L`, `b.${i}+/b.${i}K`);
      if (i > 1) w.push(`a.${i - 1}H/b.${i}com`, `b.${i}com/b.${i}G`, `b.${i}com/b.${i}N`);
    }
    w.push('a.4H/b.5A', 'b.5B/b.5-');
    setSolverEngine('fast');
    const m = new MinivacSimulator(w, false, 2);
    m.initialize();
    for (const [A, B] of [[6, 2], [2, 6], [15, 0], [0, 15], [7, 7]]) {
      for (let i = 0; i < 4; i++) {
        m.setSlide(i + 1, (A >> i) & 1 ? 'right' : 'left', 0);
        m.setSlide(i + 1, (B >> i) & 1 ? 'right' : 'left', 1);
      }
      expect(m.getMachineState(1).lights[4] ? 1 : 0, `A=${A} B=${B}`).toBe(A < B ? 1 : 0);
    }
  });
});
