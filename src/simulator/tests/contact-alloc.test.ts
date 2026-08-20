import { describe, expect, it } from 'vitest';
import { MirrorBank } from '../../circuits/contact-alloc';

// jack-name helpers mirroring the circuit file's conventions
const R = (n: number, jack: string) => `m${Math.floor(n / 6)}.${(n % 6) + 1}${jack}`;
const minusOf = (n: number) => `m${Math.floor(n / 6)}.${(n % 6) + 1}-`;

describe('the contact allocator (wider-well emitter 0)', () => {
  it('mints mirrors on demand, chains coils, hands out sets in order', () => {
    const w: string[] = [];
    const bank = new MirrorBank({ name: 'TESTM', source: 10, base: 20, capacity: 3, w, R, minusOf });
    // no wires until the first request forces a mint
    expect(w).toEqual([]);
    const a = bank.request('gate');
    expect(a).toEqual({ relay: 20, set: 1, arm: 'H', no: 'G', nc: 'J' });
    // first mirror: coil parallels the SOURCE's coil net, F to its minus
    expect(w).toEqual([`${R(10, 'E')}/${R(20, 'E')}`, `${R(20, 'F')}/${minusOf(20)}`]);
    const b = bank.request('changeover');
    expect(b).toEqual({ relay: 20, set: 2, arm: 'L', no: 'K', nc: 'N' });
    expect(w.length, 'second set of the same mirror needs no new coil').toBe(2);
    const c = bank.request('gate');
    expect(c.relay, 'third set mints mirror #2').toBe(21);
    expect(c.set).toBe(1);
    // mirror #2 chains at the coil jacks off mirror #1
    expect(w.slice(2)).toEqual([`${R(20, 'E')}/${R(21, 'E')}`, `${R(21, 'F')}/${minusOf(21)}`]);
    expect(bank.spent()).toMatchObject({ relays: 2, sets: 3 });
    expect(bank.spent().kinds).toEqual(['gate', 'changeover', 'gate']);
  });

  it('throws at capacity instead of silently overflowing', () => {
    const w: string[] = [];
    const bank = new MirrorBank({ name: 'TESTM', source: 0, base: 6, capacity: 2, w, R, minusOf });
    for (let i = 0; i < 4; i++) bank.request('gate');
    expect(() => bank.request('gate')).toThrowError(/TESTM: bank exhausted \(2 mirrors \/ 4 sets; request #5\)/);
  });

  it('source: null banks leave the first coil feed to the caller', () => {
    const w: string[] = [];
    const bank = new MirrorBank({ name: 'GATED', source: null, base: 30, capacity: 2, w, R, minusOf });
    bank.request('gate');
    // only the F/minus wire: the caller wires the gated coil feed itself
    expect(w).toEqual([`${R(30, 'F')}/${minusOf(30)}`]);
    bank.request('gate');
    bank.request('gate');
    // the SECOND mirror still chains off the first (one gated feed serves the bank)
    expect(w.slice(1)).toEqual([`${R(30, 'E')}/${R(31, 'E')}`, `${R(31, 'F')}/${minusOf(31)}`]);
  });
});
