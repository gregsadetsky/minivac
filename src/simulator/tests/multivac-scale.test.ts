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
