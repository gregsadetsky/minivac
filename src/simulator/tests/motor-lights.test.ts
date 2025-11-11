/**
 * Test motor with rotating light sequence
 * Circuit: 6+/D16 D2/6A 6-/6B D1/5A 5B/6B 6+/5Y 5X/D17 5-/D18 6-/6Y 6X/D19
 */

import { describe, it, expect } from 'vitest';
import { MinIVACSimulator } from '../minivac-simulator';

describe('MinIVAC Simulator - Motor Lights', () => {
  const circuit = [
    '6+/D16',  // Power to motor arm D16
    'D2/6A',   // Motor position 2 to Light 6 A
    '6-/6B',   // Ground to Light 6 B
    'D1/5A',   // Motor position 1 to Light 5 A
    '5B/6B',   // Light 5 B to Ground (via 6B connection)
    '6+/5Y',   // Power to Button 5 common
    '5X/D17',  // Button 5 NO to motor RUN D17
    '5-/D18',  // Section 5 ground to motor D18
    '6-/6Y',   // Ground to Button 6 common
    '6X/D19',  // Button 6 NO to motor STOP D19
  ];

  it('should initialize with motor stopped and lights off', () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    const state = minivac.getState();
    expect(state.motor.running).toBe(false);
    expect(state.lights[4]).toBe(false); // Light 5
    expect(state.lights[5]).toBe(false); // Light 6
  });

  it('should run motor and light sequence when button 5 is pressed', async () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    // Press button 5 - motor should start
    minivac.pressButton(5);

    const stateAfterPress = minivac.getState();
    expect(stateAfterPress.motor.running).toBe(true);
    expect(stateAfterPress.buttons[4]).toBe(true);

    // Wait for motor to rotate and check light sequence
    const light5Positions: number[] = [];
    const light6Positions: number[] = [];
    let lastPosition = -1;

    // Poll for 3.5 seconds to observe one full rotation
    const startTime = Date.now();
    const duration = 3500;

    while (Date.now() - startTime < duration) {
      const state = minivac.getState();
      const pos = state.motor.position;

      // Track when position changes
      if (pos !== lastPosition) {
        if (state.lights[4]) {
          light5Positions.push(pos);
        }
        if (state.lights[5]) {
          light6Positions.push(pos);
        }
        lastPosition = pos;
      }

      // Wait 100ms before next poll
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Light 5 should turn on at motor position 1 (D1)
    expect(light5Positions).toContain(1);

    // Light 6 should turn on at motor position 2 (D2)
    expect(light6Positions).toContain(2);

    // Motor should still be running
    const finalState = minivac.getState();
    expect(finalState.motor.running).toBe(true);
  });

  it('should stop motor when button 6 is pressed while button 5 is held', () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.initialize();

    // Press button 5 - motor starts
    minivac.pressButton(5);

    let state = minivac.getState();
    expect(state.motor.running).toBe(true);

    // Press button 6 while holding button 5 - motor should stop
    minivac.pressButton(6);

    state = minivac.getState();
    expect(state.motor.running).toBe(false);
    expect(state.buttons[4]).toBe(true);  // Button 5 still pressed
    expect(state.buttons[5]).toBe(true);  // Button 6 pressed
  });
});
