/**
 * Test power control (pause/resume) functionality
 * Regression test for motor advancing when UI power is off
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

describe('Power Control - pause() and resume()', () => {
  it('should not advance motor when paused (power off)', async () => {
    // Minimal circuit: just power to motor
    const circuit = [
      '+/D17',  // Power to motor D17
      '-/D18',  // Ground to motor D18
    ];

    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // Motor should be running, poll a few times to let it run
    await new Promise(resolve => setTimeout(resolve, 50));
    let state = minivac.getState();
    expect(state.motor.running).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 50));
    state = minivac.getState();
    expect(state.motor.running).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 50));
    state = minivac.getState();
    expect(state.motor.running).toBe(true);
    const positionBeforePowerOff = state.motor.position;
    const angleBeforePowerOff = state.motor.angle;

    // UI turns power OFF - call pause() to stop motor advancement
    minivac.pause();

    // Simulate time passing (user delay before pressing button)
    await new Promise(resolve => setTimeout(resolve, 300));

    // User presses a button, which calls pressButton() then getState()
    minivac.pressButton(1);
    state = minivac.getState();

    // Motor should NOT have advanced because pause() was called
    expect(state.motor.position).toBe(positionBeforePowerOff);
    expect(state.motor.angle).toBe(angleBeforePowerOff);
  });

  it('should resume motor advancement after resume() is called', async () => {
    const circuit = [
      '+/D17',
      '-/D18',
    ];

    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // Let motor run
    await new Promise(resolve => setTimeout(resolve, 50));
    let state = minivac.getState();
    expect(state.motor.running).toBe(true);

    // Pause
    minivac.pause();

    // Wait
    await new Promise(resolve => setTimeout(resolve, 100));

    // Resume
    minivac.resume();

    // Now let it run
    await new Promise(resolve => setTimeout(resolve, 100));
    state = minivac.getState();

    // Motor should advance after resume
    expect(state.motor.running).toBe(true);
  });
});
