/**
 * Test reset functionality
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

describe('MinivacSimulator - Reset', () => {
  it('should reset all relays, buttons, lights, and motor to initial state', () => {
    const circuit = [
      '6+/1A',   // Power to relay 1
      '6-/1B',   // Ground
      '1X/2A',   // Relay 1 contact to relay 2
      '2B/6-',   // Relay 2 to ground
      '6+/3Y',   // Power to button 3
      '3X/4A',   // Button 3 to light 4
      '4B/6-',   // Light 4 to ground
    ];

    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // Activate some components
    minivac.pressButton(3);
    minivac.setSlide(1, 'right');

    let state = minivac.getState();

    // Verify some things are active
    expect(state.buttons[2]).toBe(true);  // Button 3 pressed
    expect(state.slides[0]).toBe('right'); // Slide 1 right

    // Reset
    minivac.reset();

    state = minivac.getState();

    // All buttons should be up
    expect(state.buttons).toEqual([false, false, false, false, false, false]);

    // All relays should be off
    expect(state.relays).toEqual([false, false, false, false, false, false]);

    // All lights should be off
    expect(state.lights).toEqual([false, false, false, false, false, false]);

    // All relay indicator lights should be off
    expect(state.relayIndicatorLights).toEqual([false, false, false, false, false, false]);

    // All slides should be left
    expect(state.slides).toEqual(['left', 'left', 'left', 'left', 'left', 'left']);

    // Motor should be at position 0
    expect(state.motor.position).toBe(0);
    expect(state.motor.angle).toBe(0);
    expect(state.motor.running).toBe(false);
  });

  it('should reset motor position when it was running', async () => {
    const circuit = [
      '+/D17',  // Power to motor
      '-/D18',  // Ground
    ];

    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // Motor should be running
    await new Promise(resolve => setTimeout(resolve, 100));
    let state = minivac.getState();
    expect(state.motor.running).toBe(true);

    // Let it advance
    await new Promise(resolve => setTimeout(resolve, 200));
    state = minivac.getState();
    expect(state.motor.running).toBe(true);

    // Position should have advanced from initial position
    const positionBeforeReset = state.motor.position;
    expect(positionBeforeReset).toBeGreaterThan(0);

    // Reset
    minivac.reset();

    state = minivac.getState();

    // Motor should be back at position 0 and stopped
    expect(state.motor.position).toBe(0);
    expect(state.motor.angle).toBe(0);
    expect(state.motor.running).toBe(false);
  });

  it('should reset all component states without changing the circuit', () => {
    // Circuit that lights up light 1 when we have wires
    const circuit = [
      '6+/1A',
      '1B/6-',
    ];

    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // Get initial state
    let state = minivac.getState();

    // Press some buttons and move some slides
    minivac.pressButton(1);
    minivac.pressButton(3);
    minivac.setSlide(2, 'right');

    state = minivac.getState();
    expect(state.buttons[0]).toBe(true);
    expect(state.buttons[2]).toBe(true);
    expect(state.slides[1]).toBe('right');

    // Reset
    minivac.reset();

    // All interactive components should be reset
    state = minivac.getState();
    expect(state.buttons).toEqual([false, false, false, false, false, false]);
    expect(state.slides).toEqual(['left', 'left', 'left', 'left', 'left', 'left']);

    // Circuit still exists - if we press button again, it should work
    minivac.pressButton(5);
    state = minivac.getState();
    expect(state.buttons[4]).toBe(true);
  });
});
