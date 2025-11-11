/**
 * Test 3-Bit Binary Counter
 * Circuit: 1A/2E 2C/2- 3H/5A 5F/6F 1B/1C 2E/2J 3J/4H 5F/5H 1B/2B 2G/2N 3N/4N 5G/5+
 *          1C/2C 2H/3L 4B/5B 5H/6A 1E/2G 2L/2- 4C/4- 5J/6H 1F/2F 3A/6E 4E/4J 5N/6N
 *          1F/1H 3B/4B 4G/4N 6C/6- 1G/1+ 3C/4C 4H/5L 6E/6J 1H/4A 3E/4G 4L/4- 6G/6N
 *          1J/2H 3F/3H 5B/6B 6H/6X 2A/4E 3F/4F 5C/6C 6L/6- 2B/3B 3G/3+ 5E/6G 6Y/6+
 *
 * 3-Bit Binary Counter:
 * - Counts from 0 to 7 in binary
 * - Lights 4, 5, 6 represent binary digits (L4=MSB, L6=LSB)
 * - Button 6: Increment counter (press and release to advance)
 * - Cycles through: 000 → 001 → 010 → 011 → 100 → 101 → 110 → 111 → 000
 */

import { describe, it, expect } from 'vitest';
import { MinIVACSimulator } from '../minivac-simulator';

describe('MinIVAC Simulator - 3-Bit Binary Counter', () => {
  const circuit = [
    '1A/2E', '2C/2-', '3H/5A', '5F/6F', '1B/1C', '2E/2J', '3J/4H', '5F/5H',
    '1B/2B', '2G/2N', '3N/4N', '5G/5+', '1C/2C', '2H/3L', '4B/5B', '5H/6A',
    '1E/2G', '2L/2-', '4C/4-', '5J/6H', '1F/2F', '3A/6E', '4E/4J', '5N/6N',
    '1F/1H', '3B/4B', '4G/4N', '6C/6-', '1G/1+', '3C/4C', '4H/5L', '6E/6J',
    '1H/4A', '3E/4G', '4L/4-', '6G/6N', '1J/2H', '3F/3H', '5B/6B', '6H/6X',
    '2A/4E', '3F/4F', '5C/6C', '6L/6-', '2B/3B', '3G/3+', '5E/6G', '6Y/6+',
  ];

  // Helper to get 3-bit binary value from lights 4, 5, 6
  function getBinaryValue(lights: boolean[]): number {
    const l4 = lights[3] ? 1 : 0; // Light 4 (MSB)
    const l5 = lights[4] ? 1 : 0; // Light 5
    const l6 = lights[5] ? 1 : 0; // Light 6 (LSB)
    return (l4 << 2) | (l5 << 1) | l6;
  }

  it('should initialize with all lights off (000)', () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    const state = minivac.getState();
    const value = getBinaryValue(state.lights);

    expect(value).toBe(0);
    expect(state.lights[3]).toBe(false); // L4
    expect(state.lights[4]).toBe(false); // L5
    expect(state.lights[5]).toBe(false); // L6
  });

  it('should count from 0 to 7 when pressing button 6 eight times', () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    // Expected sequence after each press/release cycle
    const expectedSequence = [0, 1, 2, 3, 4, 5, 6, 7];

    // Initial state should be 0
    let state = minivac.getState();
    expect(getBinaryValue(state.lights)).toBe(0);

    // Perform 8 button press/release cycles
    for (let i = 0; i < 8; i++) {
      // Press button 6
      minivac.pressButton(6);

      // Release button 6
      minivac.releaseButton(6);

      // Check counter value after release
      state = minivac.getState();
      const value = getBinaryValue(state.lights);
      const expectedNext = (i + 1) % 8; // Wraps around at 8

      expect(value).toBe(expectedNext);
    }
  });

  it('should wrap around from 7 (111) to 0 (000)', () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    // Count up to 7
    for (let i = 0; i < 8; i++) {
      minivac.pressButton(6);
      minivac.releaseButton(6);
    }

    // Should now be at 0 (wrapped around)
    let state = minivac.getState();
    expect(getBinaryValue(state.lights)).toBe(0);

    // One more cycle should go to 1
    minivac.pressButton(6);
    minivac.releaseButton(6);
    state = minivac.getState();
    expect(getBinaryValue(state.lights)).toBe(1);
  });

  it('should maintain correct binary values for each count', () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    const expectedStates = [
      { count: 0, l4: false, l5: false, l6: false }, // 000
      { count: 1, l4: false, l5: false, l6: true  }, // 001
      { count: 2, l4: false, l5: true,  l6: false }, // 010
      { count: 3, l4: false, l5: true,  l6: true  }, // 011
      { count: 4, l4: true,  l5: false, l6: false }, // 100
      { count: 5, l4: true,  l5: false, l6: true  }, // 101
      { count: 6, l4: true,  l5: true,  l6: false }, // 110
      { count: 7, l4: true,  l5: true,  l6: true  }, // 111
    ];

    // Initial state
    let state = minivac.getState();
    expect(state.lights[3]).toBe(false);
    expect(state.lights[4]).toBe(false);
    expect(state.lights[5]).toBe(false);

    // Test each count
    for (const expected of expectedStates.slice(1)) { // Skip 0 since we already tested it
      minivac.pressButton(6);
      minivac.releaseButton(6);

      state = minivac.getState();
      expect(getBinaryValue(state.lights)).toBe(expected.count);
      expect(state.lights[3]).toBe(expected.l4); // Light 4 (MSB)
      expect(state.lights[4]).toBe(expected.l5); // Light 5
      expect(state.lights[5]).toBe(expected.l6); // Light 6 (LSB)
    }
  });

  it('should only increment on button release, not press', () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    // Initial value
    let state = minivac.getState();
    const initialValue = getBinaryValue(state.lights);
    expect(initialValue).toBe(0);

    // Press button but don't release yet
    minivac.pressButton(6);
    state = minivac.getState();
    const duringPress = getBinaryValue(state.lights);

    // Release button
    minivac.releaseButton(6);
    state = minivac.getState();
    const afterRelease = getBinaryValue(state.lights);

    // Counter should increment after release
    expect(afterRelease).toBe(1);
  });
});
