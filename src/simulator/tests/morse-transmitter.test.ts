/**
 * Test Automatic Morse Code Transmitter
 * Circuit: 3C/4C 4F/5N 5L/D0 6H/6+ 3F/4G 4H/5H 5X/6E 6H/6Y 3G/3K 4K/5F 5Y/6Y 6com/D2
 *          3G/5com 4L/D15 5com/D11 D3/D4 3H/D12 4N/5E 6A/6com D4/D5 3J/6com 5A/5com
 *          6B/6- D5/D12 3L/D13 5B/6B 6C/6- D16/D17 4C/5C 5C/6C 6F/6G D18/M- 4E/5K
 *          5F/5G 6F/6X 4F/4G 5H/5+ 6G/D17
 *
 * Automatic Morse Code Transmitter:
 * - Transmits "JOHN" in Morse code automatically
 * - Light 5 ON = dash (-)
 * - Light 6 ON = dot (.)
 * - Button 6: Start transmission
 *
 * Morse code:
 * J = . - - -
 * O = - - -
 * H = . . . .
 * N = - .
 */

import { describe, it, expect } from 'vitest';
import { MinIVACSimulator } from '../minivac-simulator';

describe('MinIVAC Simulator - Morse Code Transmitter', () => {
  const circuit = [
    '3C/4C',   '4F/5N',   '5L/D0',   '6H/6+',   '3F/4G',   '4H/5H',   '5X/6E',   '6H/6Y',
    '3G/3K',   '4K/5F',   '5Y/6Y',   '6com/D2', '3G/5com', '4L/D15',  '5com/D11','D3/D4',
    '3H/D12',  '4N/5E',   '6A/6com', 'D4/D5',   '3J/6com', '5A/5com', '6B/6-',   'D5/D12',
    '3L/D13',  '5B/6B',   '6C/6-',   'D16/D17', '4C/5C',   '5C/6C',   '6F/6G',   'D18/M-',
    '4E/5K',   '5F/5G',   '6F/6X',   '4F/4G',   '5H/5+',   '6G/D17',
  ];

  it('should transmit morse code and cycle through message', { timeout: 20000 }, () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    // Press button 6 to start transmission
    minivac.pressButton(6);

    // Record transmission - watch for motor returning to D0 to detect cycles
    const cycles: string[][] = [];
    let currentCycle: string[] = [];
    let lastPos = -1;
    const stepDelay = 50; // ms
    const maxIterations = 1000;

    for (let i = 0; i < maxIterations; i++) {
      const state = minivac.getState();
      const pos = state.motor.position;
      const L5 = state.lights[4]; // dash
      const L6 = state.lights[5]; // dot

      // Only record when position changes
      if (pos !== lastPos) {
        let symbol = ' ';
        if (L5 && !L6) symbol = '-';
        else if (L6 && !L5) symbol = '.';

        // Detect new cycle when motor returns to D0
        if (pos === 0 && lastPos !== -1 && lastPos !== 0 && currentCycle.length > 0) {
          cycles.push([...currentCycle]);
          currentCycle = [];

          if (cycles.length >= 5) break;
        }

        currentCycle.push(symbol);
        lastPos = pos;
      }

      if (!state.motor.running) {
        break;
      }

      // Wait for next step
      const now = Date.now();
      while (Date.now() - now < stepDelay) {}
    }

    // Add final cycle if any
    if (currentCycle.length > 0) {
      cycles.push(currentCycle);
    }

    minivac.releaseButton(6);

    // Verify that we got multiple cycles (transmission is cycling)
    expect(cycles.length).toBeGreaterThanOrEqual(2);

    // Verify that each cycle has some symbols
    for (const cycle of cycles) {
      const symbols = cycle.filter(s => s !== ' ');
      expect(symbols.length).toBeGreaterThan(0);
    }
  });
});
