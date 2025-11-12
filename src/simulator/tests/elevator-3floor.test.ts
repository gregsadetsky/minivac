/**
 * Test three-floor elevator circuit
 *
 * Three-floor elevator:
 * - Floor 1: D0-D1 (Light 1 ON)
 * - Floor 2: D6-D7 (Light 2 ON)
 * - Floor 3: D12-D13 (Light 3 ON)
 * - Button 1: Call to floor 1
 * - Button 2: Call to floor 2
 * - Button 3: Call to floor 3
 * - Buttons interlock during motion
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';
import { elevatorCircuit } from '../../circuits/elevator-3floor';

const circuit = elevatorCircuit.circuit;

function getFloorFromPosition(position: number): number {
  if (position >= 0 && position <= 1) return 1;
  if (position >= 6 && position <= 7) return 2;
  if (position >= 12 && position <= 13) return 3;
  return 0; // In transit
}

function waitForFloor(minivac: MinivacSimulator, targetFloor: number, timeoutMs = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      const state = minivac.getState();
      const elapsed = Date.now() - startTime;
      const currentFloor = getFloorFromPosition(state.motor.position);

      if (currentFloor === targetFloor && !state.motor.running) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 50);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('MinIVAC Simulator - Three-Floor Elevator', () => {
  it('should initialize at floor 1 with correct indicators', () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    const state = minivac.getState();
    const floor = getFloorFromPosition(state.motor.position);

    expect(floor).toBe(1);
    expect(state.motor.running).toBe(false);
    expect(state.lights[0]).toBe(true);  // Floor 1 light ON
    expect(state.lights[1]).toBe(false); // Floor 2 light OFF
    expect(state.lights[2]).toBe(false); // Floor 3 light OFF
  });

  it('should travel from floor 1 to floor 3', async () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    // Press and immediately release button 3 to call to floor 3
    minivac.pressButton(3);
    minivac.releaseButton(3);
    await sleep(200);

    const stateAfterPress = minivac.getState();
    expect(stateAfterPress.motor.running).toBe(true);

    // Wait for arrival at floor 3
    const arrived = await waitForFloor(minivac, 3);
    expect(arrived).toBe(true);

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(3);
    expect(finalState.lights[2]).toBe(true); // Floor 3 light ON
  });

  it('should travel from floor 3 to floor 2', async () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.motorPosition = 12; // Start at floor 3
    minivac.initialize();

    // Press and immediately release button 2 to call to floor 2
    minivac.pressButton(2);
    minivac.releaseButton(2);
    await sleep(200);

    // Wait for arrival at floor 2
    const arrived = await waitForFloor(minivac, 2);
    expect(arrived).toBe(true);

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(2);
    expect(finalState.lights[1]).toBe(true); // Floor 2 light ON
  });

  it('should travel from floor 2 to floor 1', async () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.motorPosition = 6; // Start at floor 2
    minivac.initialize();

    // Press and immediately release button 1 to call to floor 1
    minivac.pressButton(1);
    minivac.releaseButton(1);
    await sleep(200);

    // Wait for arrival at floor 1
    const arrived = await waitForFloor(minivac, 1);
    expect(arrived).toBe(true);

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(1);
    expect(finalState.lights[0]).toBe(true); // Floor 1 light ON
  });

  it('should not move when calling current floor', async () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.motorPosition = 0; // At floor 1
    minivac.initialize();

    const positionBefore = minivac.getState().motor.position;

    // Press and immediately release button 1 (already at floor 1)
    minivac.pressButton(1);
    minivac.releaseButton(1);
    await sleep(500);

    const state = minivac.getState();
    expect(state.motor.position).toBe(positionBefore);
    expect(state.motor.running).toBe(false);
    expect(state.lights[0]).toBe(true); // Floor 1 light still ON
  });

  it('should handle interlock during motion', async () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    // Start moving to floor 3 (press and release)
    minivac.pressButton(3);
    minivac.releaseButton(3);
    await sleep(300);

    const stateWhileMoving = minivac.getState();
    expect(stateWhileMoving.motor.running).toBe(true);

    // Try to press button 2 while moving (should be ignored by interlock)
    minivac.pressButton(2);
    minivac.releaseButton(2);
    await sleep(100);

    const stateAfterInterrupt = minivac.getState();
    // Motor should still be running toward floor 3
    expect(stateAfterInterrupt.motor.running).toBe(true);

    // Wait for arrival at floor 3
    const arrived = await waitForFloor(minivac, 3);
    expect(arrived).toBe(true);
  });

  it('should handle long trip from floor 1 to floor 3', async () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    // Press and immediately release button 3
    minivac.pressButton(3);
    minivac.releaseButton(3);
    await sleep(100);

    const tripStart = Date.now();
    const arrived = await waitForFloor(minivac, 3);
    const tripDuration = Date.now() - tripStart;

    expect(arrived).toBe(true);
    expect(tripDuration).toBeLessThan(10000); // Should complete within 10 seconds

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(3);
    expect(finalState.lights[2]).toBe(true); // Floor 3 light ON
  });
});
