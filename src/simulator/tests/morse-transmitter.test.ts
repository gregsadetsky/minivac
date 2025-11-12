/**
 * Test Automatic Morse Code Transmitter
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

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';
import { morseTransmitterCircuit } from '../../circuits/morse-transmitter';

describe('MinIVAC Simulator - Morse Code Transmitter', () => {
  const circuit = morseTransmitterCircuit.circuit;

  it('should transmit morse code and cycle through message', { timeout: 20000 }, () => {
    const minivac = new MinivacSimulator(circuit);
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
      while (Date.now() - now < stepDelay) {
        // Busy wait
      }
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
