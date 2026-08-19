/**
 * Multivac at scale: 16 machines with canonical numeric prefixes (m0.-m15.),
 * a 16-relay cross-machine cascade, verified under BOTH solver engines.
 * Also guards the chatter rule: a long one-way cascade flips each relay once
 * and must NOT be pinned as oscillation.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { MinivacSimulator, setSolverEngine, type SolverEngine } from '../minivac-simulator';

afterEach(() => setSolverEngine('sparse'));

function cascadeCircuit(k: number): string[] {
  const w: string[] = ['m0.1+/m0.1S', 'm0.1T/m0.1E', 'm0.1F/m0.1-'];
  for (let m = 1; m < k; m++) {
    w.push(`m${m - 1}.1+/m${m - 1}.1H`);            // previous machine's contact arm
    w.push(`m${m - 1}.1G/m${m}.1E`, `m${m}.1F/m${m}.1-`);  // NO contact drives next coil
  }
  return w;
}

describe('Multivac scale: 32 machines (roadmap rung 1 perf point)', () => {
  // cktsim at 16 machines already takes ~1 min (the test below anchors engine
  // equivalence); at 32 the dense solve is minutes-long, so every suite pass
  // runs sparse alone and the cktsim variant is MINIVAC_MASS=1-gated.
  const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env || {};
  const heavy = env.MINIVAC_MASS === '1' ? it : it.skip;
  function run32(engine: SolverEngine, budgetMs: number) {
    setSolverEngine(engine);
    const K = 32;
    const m = new MinivacSimulator(cascadeCircuit(K), false, K);
    m.initialize();
    const allOn = () => Array.from({ length: K }, (_, i) => m.getMachineState(i).relays[0]);

    const t0 = performance.now();
    m.setSlide(1, 'right', 0);
    const settleMs = performance.now() - t0;

    const after = allOn();
    expect(after.every(r => r), `all 32 on, got ${after.map(r => (r ? 1 : 0)).join('')}`).toBe(true);
    expect(m.lastRelaxationIterations).toBeGreaterThanOrEqual(K);
    expect(m.getState().alerts).toEqual([]);
    // perf point: a 32-deep cascade is 32 sequential solves in one
    // interaction. generous runaway guard only — wall-clock asserts flake
    // under parallel test workers (2026-08-19: whole sparse test ~18s incl.
    // init; the 16-machine sparse test runs ~2.5s on the same box).
    expect(settleMs, `32-machine cascade settled in ${settleMs.toFixed(0)}ms`).toBeLessThan(budgetMs);

    m.setSlide(1, 'left', 0);
    expect(allOn().every(r => !r), 'all off again').toBe(true);
    expect(m.getState().alerts).toEqual([]);
  }

  it('32-relay cascade settles past the letter-alias range', { timeout: 120000 }, () => {
    run32('sparse', 60000);
  });

  heavy('32-relay cascade under the dense oracle (MINIVAC_MASS=1)', { timeout: 3600000 }, () => {
    run32('cktsim', 3000000);
  });
});

describe('Multivac scale: 16 machines, numeric prefixes, both engines', () => {
  for (const engine of ['sparse', 'cktsim'] as SolverEngine[]) {
    it(`16-relay cross-machine cascade settles correctly (${engine})`, { timeout: 300000 }, () => {
      setSolverEngine(engine);
      const K = 16;
      const m = new MinivacSimulator(cascadeCircuit(K), false, K);
      m.initialize();
      const allRelays = () => Array.from({ length: K }, (_, i) => m.getMachineState(i).relays[0]);

      expect(allRelays().every(r => !r), 'all off initially').toBe(true);

      m.setSlide(1, 'right', 0);  // trigger the cascade
      const after = allRelays();
      expect(after.every(r => r), `all 16 on, got ${after.map(r => r ? 1 : 0).join('')}`).toBe(true);
      // one relay flips per iteration: settle depth ~cascade length, and the
      // chatter rule must not have fired (no oscillation alert)
      expect(m.lastRelaxationIterations).toBeGreaterThanOrEqual(K);
      expect(m.getState().alerts).toEqual([]);

      m.setSlide(1, 'left', 0);   // cascade of drop-outs
      expect(allRelays().every(r => !r), 'all off again').toBe(true);
      expect(m.getState().alerts).toEqual([]);
    });
  }
});
