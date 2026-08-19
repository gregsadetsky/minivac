/**
 * Multivac: multiple Minivac 601s ganged into one analog circuit, wired jack-to-jack
 * with "b.3G" cross-machine notation. Everything below is PURE WIRING — relay
 * contacts, slides, buttons, lights — analog-simulated end to end. No resistors,
 * no capacitors, no logic shortcuts.
 *
 * Ladder: gates -> SR latch -> clocked D flip-flop (2 machines) -> 2-bit
 * synchronous counter (4 machines, 24 cycles).
 *
 * Hard-won wiring lesson (cost one debugging session, same disease as the book IV
 * flip-flop): a contact jack with two consumers is a TIE POINT — when the contact
 * is open, the jack still bridges the consumers, and current sneaks between them.
 * Every gated signal here gets its own contact (hence TWO parallel clock relays).
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

// real hardware: 2 holes per jack, 4 on COMMON, 6 on matrix groups 10/11
function assertJackCapacity(wires: string[]) {
  const uses = new Map<string, number>();
  for (const w of wires) {
    for (const t of w.split('/')) {
      uses.set(t, (uses.get(t) || 0) + 1);
    }
  }
  for (const [jack, n] of uses) {
    const cap = jack.endsWith('com') ? 4 : /M1[01]$/.test(jack) ? 6 : 2;
    expect(n, `jack ${jack} used ${n}x (capacity ${cap})`).toBeLessThanOrEqual(cap);
  }
}

const bit = (b: boolean) => (b ? 1 : 0);

describe('Multivac: logic gates from pure relay wiring', () => {
  it('NOT', () => {
    const ckt = ['1+/1S', '1T/1E', '1F/1-', '1+/1H', '1J/1A', '1B/1-'];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt);
    m.initialize();
    for (const a of [0, 1]) {
      m.setSlide(1, a ? 'right' : 'left');
      expect(bit(m.getState().lights[0]), `NOT(${a})`).toBe(a ? 0 : 1);
      expect(m.lastRelaxationIterations).toBeLessThanOrEqual(6);
    }
  });

  it('AND', () => {
    const ckt = ['1+/1S', '1T/1E', '1F/1-', '2+/2S', '2T/2E', '2F/2-',
      '1+/1H', '1G/2H', '2G/1A', '1B/1-'];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt);
    m.initialize();
    for (const a of [0, 1]) for (const b of [0, 1]) {
      m.setSlide(1, a ? 'right' : 'left');
      m.setSlide(2, b ? 'right' : 'left');
      expect(bit(m.getState().lights[0]), `AND(${a},${b})`).toBe(a & b);
    }
  });

  it('OR', () => {
    const ckt = ['1+/1S', '1T/1E', '1F/1-', '2+/2S', '2T/2E', '2F/2-',
      '1+/1H', '1G/1A', '2+/2H', '2G/1A', '1B/1-'];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt);
    m.initialize();
    for (const a of [0, 1]) for (const b of [0, 1]) {
      m.setSlide(1, a ? 'right' : 'left');
      m.setSlide(2, b ? 'right' : 'left');
      expect(bit(m.getState().lights[0]), `OR(${a},${b})`).toBe(a | b);
    }
  });

  it('XOR (both contact sets of both relays)', () => {
    const ckt = ['1+/1S', '1T/1E', '1F/1-', '2+/2S', '2T/2E', '2F/2-',
      '1+/1H', '1G/2L', '2N/1A',
      '2+/2H', '2G/1L', '1N/1A', '1B/1-'];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt);
    m.initialize();
    for (const a of [0, 1]) for (const b of [0, 1]) {
      m.setSlide(1, a ? 'right' : 'left');
      m.setSlide(2, b ? 'right' : 'left');
      expect(bit(m.getState().lights[0]), `XOR(${a},${b})`).toBe(a ^ b);
    }
  });

  it('XOR across two machines (relays and light on different Minivacs)', () => {
    const ckt = ['a.1+/a.1S', 'a.1T/a.1E', 'a.1F/a.1-',
      'b.1+/b.1S', 'b.1T/b.1E', 'b.1F/b.1-',
      'a.1+/a.1H', 'a.1G/b.1L', 'b.1N/b.1A',
      'b.1+/b.1H', 'b.1G/a.1L', 'a.1N/b.1A', 'b.1B/b.1-'];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt, false, 2);
    m.initialize();
    for (const a of [0, 1]) for (const b of [0, 1]) {
      m.setSlide(1, a ? 'right' : 'left', 0);
      m.setSlide(1, b ? 'right' : 'left', 1);
      expect(bit(m.getMachineState(1).lights[0]), `XOR(${a},${b})`).toBe(a ^ b);
    }
  });
});

describe('Multivac: sequential logic', () => {
  it('SR latch: set, reset, hold', () => {
    const ckt = ['1+/1Y', '1X/1E', '1F/1-',
      '2+/2Y', '2Z/1H', '1G/1E',
      '3+/1L', '1K/1A', '1B/1-'];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt);
    m.initialize();
    const q = () => bit(m.getState().lights[0]);
    expect(q()).toBe(0);
    m.pressButton(1); m.releaseButton(1);
    expect(q(), 'after SET').toBe(1);
    m.pressButton(2); m.releaseButton(2);
    expect(q(), 'after RESET').toBe(0);
    m.pressButton(1); m.releaseButton(1);
    expect(q(), 'after SET again').toBe(1);
  });

  it('clocked D flip-flop across two machines: capture, hold, D-immunity', { timeout: 60000 }, () => {
    const ckt = [
      'a.1+/a.1S', 'a.1T/a.1E', 'a.1F/a.1-',
      'a.2+/a.1H', 'a.1J/a.2S', 'a.2T/a.2com', 'a.2com/a.2E', 'a.2F/a.2-',
      'a.1G/a.2H', 'a.2G/a.2com',
      'a.3+/a.1L', 'a.1K/a.2L', 'a.2K/b.1com', 'b.1com/b.1E', 'b.1F/b.1-',
      'a.1N/b.1H', 'b.1G/b.1com',
      'b.2+/b.1L', 'b.1K/b.1A', 'b.1B/b.1-',
    ];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt, false, 2);
    m.initialize();
    const q = () => bit(m.getMachineState(1).lights[0]);
    const setD = (v: number) => m.setSlide(2, v ? 'right' : 'left', 0);
    const setClk = (v: number) => m.setSlide(1, v ? 'right' : 'left', 0);

    expect(q()).toBe(0);
    setD(1);
    expect(q(), 'D=1 before clock').toBe(0);
    setClk(1);
    expect(q(), 'captured 1 on clock rise').toBe(1);
    setClk(0);
    expect(q(), 'held through clock fall').toBe(1);
    setD(0);
    expect(q(), 'immune to D while CLK low').toBe(1);
    setClk(1);
    expect(q(), 'captured 0').toBe(0);
    setClk(0);
    setD(1); setD(0); setD(1);
    expect(q(), 'immune to D wiggles').toBe(0);
  });

  it('2-bit synchronous counter across FOUR machines, 24 clock cycles', { timeout: 240000 }, () => {
    const ckt = [
      'c.1+/c.1S', 'c.1T/c.1com', 'c.1com/c.1E', 'c.1F/c.1-', 'c.1com/c.2E', 'c.2F/c.2-',
      'c.2+/c.1H', 'c.3+/c.1L', 'c.4+/c.2H', 'c.5+/c.2L',
      'c.1J/a.2L', 'a.2N/a.1com', 'a.1com/a.1E', 'a.1F/a.1-',
      'c.1G/a.1H', 'a.1G/a.1com',
      'c.1K/a.1L', 'a.1K/a.2com', 'a.2com/a.2E', 'a.2F/a.2-',
      'c.1N/a.2H', 'a.2G/a.2com',
      'a.2com/d.1com', 'd.1com/d.1E', 'd.1F/d.1-',
      'c.2J/d.1H', 'd.1G/b.2N', 'd.1J/b.2K',
      'b.2L/b.1com', 'b.1com/b.1E', 'b.1F/b.1-',
      'c.2G/b.1H', 'b.1G/b.1com',
      'c.2K/b.1L', 'b.1K/b.2com', 'b.2com/b.2E', 'b.2F/b.2-',
      'c.2N/b.2H', 'b.2G/b.2com',
      'b.2com/d.2com', 'd.2com/d.2E', 'd.2F/d.2-',
      'd.3+/d.1L', 'd.1K/d.1A', 'd.1B/d.1-',
      'd.4+/d.2L', 'd.2K/d.2A', 'd.2B/d.2-',
    ];
    assertJackCapacity(ckt);
    const m = new MinivacSimulator(ckt, false, 4);
    m.initialize();
    const count = () => {
      const d = m.getMachineState(3);
      return (d.relays[1] ? 2 : 0) + (d.relays[0] ? 1 : 0);
    };
    for (let cycle = 1; cycle <= 24; cycle++) {
      m.setSlide(1, 'right', 2);
      m.setSlide(1, 'left', 2);
      expect(count(), `after cycle ${cycle}`).toBe(cycle % 4);
      expect(m.lastRelaxationIterations).toBeLessThanOrEqual(8);
    }
    // count lights on machine d agree with the relay states
    const d = m.getMachineState(3);
    expect(bit(d.lights[0])).toBe(bit(d.relays[0]));
    expect(bit(d.lights[1])).toBe(bit(d.relays[1]));
  });
});
