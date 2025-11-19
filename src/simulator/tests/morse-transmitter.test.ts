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

describe('Minivac Simulator - Morse Code Transmitter', () => {
  const circuit = morseTransmitterCircuit.circuit;

  it('should have break-before-make gaps between symbols', { timeout: 20000 }, () => {
    // This test verifies that when the motor moves between positions,
    // there's a brief moment where no contact is made (break-before-make).
    // This is critical for morse code - without it, consecutive dots or dashes
    // would appear as one continuous signal.
    const minivac = new MinivacSimulator(circuit);
    minivac.updateMotorAngle(0);
    minivac.initialize();

    // Press button 6 to start transmission
    minivac.pressButton(6);

    // Sample at high frequency to catch the brief OFF periods
    const samples: Array<{ pos: number; L5: boolean; L6: boolean; angle: number }> = [];
    const stepDelay = 10; // Sample every 10ms (much faster than position changes)
    const maxSamples = 300; // Just need enough to find a few gaps

    for (let i = 0; i < maxSamples; i++) {
      const state = minivac.getState();
      samples.push({
        pos: state.motor.position,
        L5: state.lights[4], // dash
        L6: state.lights[5], // dot
        angle: state.motor.angle,
      });

      if (!state.motor.running) {
        break;
      }

      const now = Date.now();
      while (Date.now() - now < stepDelay) {
        // Busy wait
      }
    }

    minivac.releaseButton(6);

    // Find sequences where we transition from one position to the next
    // and verify there's a gap where both lights are OFF
    let foundBreakGap = false;
    let gapCount = 0;
    for (let i = 1; i < samples.length - 1; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const next = samples[i + 1];

      // Look for pattern: light ON -> light OFF -> light ON (as position changes)
      const prevLightOn = prev.L5 || prev.L6;
      const currLightOff = !curr.L5 && !curr.L6;
      const nextLightOn = next.L5 || next.L6;

      if (prevLightOn && currLightOff && nextLightOn) {
        foundBreakGap = true;
        gapCount++;
        if (gapCount >= 3) break; // Found enough examples
      }
    }

    // Should find at least one break gap in the morse transmission
    expect(foundBreakGap).toBe(true);
  });

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
