/**
 * HEAVY fast-engine validators — skipped by default, kept runnable forever.
 * Same methodology (same seed, same case generator, same snapshot compare) as
 * sparse-mass-validation.test.ts, with the fast typed-array engine standing in
 * for the sparse one against the dense cktsim oracle.
 *
 *   MINIVAC_MASS=1 npx vitest --run src/simulator/tests/fast-mass-validation.test.ts
 *   MINIVAC_MASS=1 MASS_CASES=10000 ...          (more cases)
 *   MINIVAC_SOLVER=fast npm run test -- --run    (whole suite under fast engine)
 *
 * Results on 2026-08-19 (run incrementally: 5 -> 50 -> 500 -> 5000 cases):
 * 5000 cases / 10,001 snapshots, zero mismatches, max current disagreement
 * 1.1e-10 mA (sparse's record on the same sweep: 1.4e-10). Full suite green
 * under MINIVAC_SOLVER=fast (177 passed / 8 skipped). Perf at 25 machines:
 * 159ms -> 9.6ms per solve (16.7x); a mini-tetris game tick 1223ms -> 68ms.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine } from '../minivac-simulator';

const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env || {};
const RUN = env.MINIVAC_MASS === '1';
const CASES = parseInt(env.MASS_CASES || '5000', 10);
const d = RUN ? describe : describe.skip;

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

d('MASS fast-engine validation (env-gated)', () => {
  it(`${CASES} random circuits with interaction sequences`, { timeout: 4 * 3600 * 1000 }, () => {
    const rnd = lcg(20260819);
    let snapshots = 0;
    let maxCurDiff = 0;
    for (let caseNo = 0; caseNo < CASES; caseNo++) {
      const machines = caseNo % 10 < 7 ? 1 : caseNo % 10 < 9 ? 2 : 3;
      const wires = randCircuit(rnd, machines);
      const nActions = caseNo % 3 === 0 ? 3 : 0;
      const actions: Array<[string, number, number, number]> = [];
      for (let a = 0; a < nActions; a++) {
        actions.push([
          rnd() < 0.5 ? 'slide' : 'button',
          1 + Math.floor(rnd() * 6),
          Math.floor(rnd() * machines),
          rnd() < 0.5 ? 0 : 1,
        ]);
      }
      const per: Record<string, Array<ReturnType<typeof snapshot>>> = {};
      for (const eng of ['cktsim', 'fast'] as const) {
        setSolverEngine(eng);
        const m = new MinivacSimulator(wires, false, machines);
        m.initialize();
        const snaps = [snapshot(m, machines)];
        for (const [kind, num, mach, dir] of actions) {
          if (kind === 'slide') m.setSlide(num, dir ? 'right' : 'left', mach);
          else if (dir) m.pressButton(num, mach);
          else m.releaseButton(num, mach);
          snaps.push(snapshot(m, machines));
        }
        per[eng] = snaps;
      }
      for (let i = 0; i < per.cktsim.length; i++) {
        snapshots++;
        expect(per.fast[i].s, `case ${caseNo} snap ${i}: ${wires.join(' ')}`).toBe(per.cktsim[i].s);
        for (let j = 0; j < per.cktsim[i].cur.length; j++) {
          const diff = Math.abs(per.cktsim[i].cur[j] - per.fast[i].cur[j]);
          if (diff > maxCurDiff) maxCurDiff = diff;
          expect(diff, `case ${caseNo} snap ${i} current ${j}`).toBeLessThan(1e-6);
        }
      }
    }
    console.log(`mass validation (fast): ${CASES} cases, ${snapshots} snapshots, max current diff ${maxCurDiff.toExponential(2)} mA`);
  });

  it('perf race: fast must beat dense at 4+ machines', { timeout: 900000 }, () => {
    const times: Record<string, number> = {};
    for (const eng of ['cktsim', 'fast'] as const) {
      setSolverEngine(eng);
      const w: string[] = [];
      const letters = 'abcd';
      for (let m = 0; m < 4; m++) {
        const p = letters[m];
        w.push(`${p}.1+/${p}.1S`, `${p}.1T/${p}.1E`, `${p}.1F/${p}.1-`);
        if (m > 0) w.push(`${letters[m - 1]}.1G/${p}.2H`);
      }
      const m = new MinivacSimulator(w, false, 4);
      m.initialize();
      for (let i = 0; i < 3; i++) m.resimulate();
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        const t = performance.now();
        m.resimulate();
        samples.push(performance.now() - t);
      }
      samples.sort((a, b) => a - b);
      times[eng] = samples[5];
    }
    console.log(`4 machines: dense=${times.cktsim.toFixed(1)}ms fast=${times.fast.toFixed(1)}ms`);
    expect(times.fast).toBeLessThan(times.cktsim);
  });
});
