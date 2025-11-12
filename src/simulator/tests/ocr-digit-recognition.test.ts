/**
 * Test OCR Digit Recognition Circuit
 *
 * OCR Digit Recognition:
 * - "Draw" a digit on matrix terminals M1t-M9t by connecting M10 to specific positions
 * - Each digit has a unique pattern (like 7-segment display encoding)
 * - Press button 6 to recognize the digit
 * - Motor moves to position D0-D9 corresponding to recognized digit
 *
 * Digit patterns (which matrix terminals to connect to M10):
 * 0 → M2t, M4t, M6t, M8t
 * 1 → M2t, M6t, M9t
 * 2 → M2t, M3t, M5t, M6t, M7t, M8t, M9t
 * 3 → M1t, M2t, M6t, M7t, M8t, M9t
 * 4 → M2t, M4t, M6t, M8t, M9t
 * 5 → M2t, M3t, M4t, M5t, M6t, M7t, M9t
 * 6 → M2t, M4t, M5t, M6t, M9t
 * 7 → M1t, M2t, M3t, M7t, M9t
 * 8 → M2t, M3t, M6t, M7t, M9t
 * 9 → M2t, M3t, M4t, M5t, M9t
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';
import { ocrDigitRecognitionCircuit } from '../../circuits/ocr-digit-recognition';

const baseCircuit = ocrDigitRecognitionCircuit.circuit;

// Digit patterns - which matrix terminals to connect to M10
const digitPatterns = [
  { digit: 0, segments: [2, 4, 6, 8], position: 0 },  // D0
  { digit: 1, segments: [2, 6, 9], position: 1 },  // D1
  { digit: 2, segments: [2, 3, 5, 6, 7, 8, 9], position: 2 },  // D2
  { digit: 3, segments: [1, 2, 6, 7, 8, 9], position: 3 },  // D3
  { digit: 4, segments: [2, 4, 6, 8, 9], position: 4 },  // D4 (note: different from 0 by M9t)
  { digit: 5, segments: [2, 3, 4, 5, 6, 7, 9], position: 5 },  // D5
  { digit: 6, segments: [2, 4, 5, 6, 9], position: 6 },  // D6
  { digit: 7, segments: [1, 2, 3, 7, 9], position: 7 },  // D7
  { digit: 8, segments: [2, 3, 6, 7, 9], position: 8 },  // D8
  { digit: 9, segments: [2, 3, 4, 5, 9], position: 9 },  // D9
];

// Helper to wait for motor to reach target position
function waitForMotorPosition(minivac: MinivacSimulator, targetPosition: number, maxWaitMs = 5000): boolean {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const state = minivac.getState();
    if (state.motor.position === targetPosition && !state.motor.running) {
      return true;
    }
    // Small delay to allow motor to step
    const now = Date.now();
    while (Date.now() - now < 50) {
      // Busy wait 50ms
    }
  }
  return false;
}

describe('MinIVAC Simulator - OCR Digit Recognition', () => {
  for (const pattern of digitPatterns) {
    it(`should recognize digit ${pattern.digit} and move motor to D${pattern.position}`, () => {
      // Create circuit with digit connections
      const digitConnections = pattern.segments.map(seg => `M10/M${seg}t`);
      const testCircuit = [...baseCircuit, ...digitConnections];

      const minivac = new MinivacSimulator(testCircuit);

      // Set motor to a different starting position to ensure movement
      const startPosition = pattern.position === 0 ? 5 : 0;
      minivac.updateMotorAngle(startPosition * 22.5); // Convert position to angle
      minivac.initialize();

      const initialState = minivac.getState();
      expect(initialState.motor.position).toBe(startPosition);

      // Press button 6 to trigger recognition
      minivac.pressButton(6);

      const afterPress = minivac.getState();
      expect(afterPress.motor.running).toBe(true);

      // Wait for motor to reach target position
      const motorReached = waitForMotorPosition(minivac, pattern.position);
      expect(motorReached).toBe(true);

      const finalState = minivac.getState();
      expect(finalState.motor.position).toBe(pattern.position);
      expect(finalState.motor.running).toBe(false);

      minivac.releaseButton(6);
    });
  }

  it('should distinguish between digit 0 and digit 4', () => {
    // Both have M2t, M4t, M6t, M8t but only 4 has M9t
    // Digit 0: segments [2, 4, 6, 8] → D0
    // Digit 4: segments [2, 4, 6, 8, 9] → D4

    // Test digit 0
    const circuit0 = [...baseCircuit, ...['M10/M2t', 'M10/M4t', 'M10/M6t', 'M10/M8t']];
    const minivac0 = new MinivacSimulator(circuit0);
    minivac0.motorPosition = 0;
    minivac0.initialize();
    minivac0.pressButton(6);
    const reached0 = waitForMotorPosition(minivac0, 0);
    expect(reached0).toBe(true);
    expect(minivac0.getState().motor.position).toBe(0);
    minivac0.releaseButton(6);

    // Test digit 4
    const circuit4 = [...baseCircuit, ...['M10/M2t', 'M10/M4t', 'M10/M6t', 'M10/M8t', 'M10/M9t']];
    const minivac4 = new MinivacSimulator(circuit4);
    minivac4.motorPosition = 0;
    minivac4.initialize();
    minivac4.pressButton(6);
    const reached4 = waitForMotorPosition(minivac4, 4);
    expect(reached4).toBe(true);
    expect(minivac4.getState().motor.position).toBe(4);
    minivac4.releaseButton(6);
  });
});
