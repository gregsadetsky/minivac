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

  it('should have break-before-make gaps between symbols', { timeout: 60000 }, () => {
    // This test verifies that when the motor moves between positions,
    // there's a brief moment where no contact is made (break-before-make).
    // This is critical for morse code - without it, consecutive dots or dashes
    // would appear as one continuous signal.
    //
    // The gap is a function of motor ANGLE (commutator geometry: 20° of
    // contact per 22.5° position, 1.25° dead zone each side), not of wall
    // time. This test used to sample the free-running motor every 10ms and
    // hope a sample landed inside each ~2.5° gap; under parallel suite load
    // the worker gets descheduled and its samples straddle every gap (the
    // known wall-clock flake class — it went near-deterministic when the
    // multivac suite grew, 2026-08-19). Driving the angle deterministically
    // checks the same electrical property at every position boundary.
    const minivac = new MinivacSimulator(circuit);
    minivac.updateMotorAngle(0);
    minivac.initialize();

    minivac.pressButton(6); // energize the transmission path
    minivac.pause(); // freeze wall-clock motor advance; the sweep drives the angle

    const step = 0.5; // degrees; the 2.5° dead zone spans ~5 samples
    const lit: boolean[] = [];
    for (let a = 0; a <= 360; a += step) {
      minivac.updateMotorAngle(a);
      minivac.resimulate();
      const state = minivac.getState();
      lit.push(state.lights[4] || state.lights[5]);
    }
    minivac.releaseButton(6);

    // Break-before-make gaps are SHORT off-runs bounded by lit samples
    // (long off-runs are legitimate letter spacing in the message).
    const maxGapSamples = Math.ceil(4 / step); // anything under 4° is a contact gap
    let breakGaps = 0;
    let i = 0;
    while (i < lit.length) {
      if (!lit[i]) {
        const start = i;
        while (i < lit.length && !lit[i]) i++;
        const bounded = start > 0 && i < lit.length;
        if (bounded && i - start <= maxGapSamples) breakGaps++;
      } else {
        i++;
      }
    }

    // JOHN has runs of consecutive lit symbols (J = .---, H = ....), so a
    // full revolution must show several break gaps between lit positions
    expect(breakGaps).toBeGreaterThanOrEqual(3);
  });

  it('should transmit morse code and cycle through message', { timeout: 60000 }, () => {
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
