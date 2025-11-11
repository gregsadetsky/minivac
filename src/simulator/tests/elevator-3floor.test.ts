/**
 * Test three-floor elevator circuit
 * Circuit: 1A/1E 2B/2— 3F/3G 5F/6C 1B/1- 2C/3C 3G/3X 5G/5N 1C/2C 2E/D7 3J/4E
 *          5J/5K 1E/D1 2F/2G 3Y/4J 5J/D17 1F/1G 2G/2X 4C/5F 5L/5— 1G/1X 2J/3H
 *          4F/4+ 5N/D18 1H/1+ 2X/6H 4G/4H 6C/6— 1H/1L 2Y/3Y 4H/4+ 6F/D12 1J/2H
 *          3A/3E 4L/D19 D0/D1 1K/5E 3B/3— 4N/D18 D6/D7 1Y/2Y 3C/4C 5C/5G D12/D13
 *          2A/2E 3E/D13 5E/6G D16/M—
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

import { describe, it, expect } from 'vitest';
import { MinIVACSimulator } from '../minivac-simulator';

const circuit = [
  '1A/1E',   '2B/2-',   '3F/3G',   '5F/6C',   '1B/1-',   '2C/3C',   '3G/3X',   '5G/5N',
  '1C/2C',   '2E/D7',   '3J/4E',   '5J/5K',   '1E/D1',   '2F/2G',   '3Y/4J',   '5J/D17',
  '1F/1G',   '2G/2X',   '4C/5F',   '5L/5-',   '1G/1X',   '2J/3H',   '4F/4+',   '5N/D18',
  '1H/1+',   '2X/6H',   '4G/5H',   '6C/6-',   '1H/1L',   '2Y/3Y',   '4H/4+',   '6F/D12',
  '1J/2H',   '3A/3E',   '4L/D19',  'D0/D1',   '1K/5E',   '3B/3-',   '4N/D18',  'D6/D7',
  '1Y/2Y',   '3C/4C',   '5C/5G',   'D12/D13', '2A/2E',   '3E/D13',  '5E/6G',   'D16/M+',
];

function getFloorFromPosition(position: number): number {
  if (position >= 0 && position <= 1) return 1;
  if (position >= 6 && position <= 7) return 2;
  if (position >= 12 && position <= 13) return 3;
  return 0; // In transit
}

function waitForFloor(minivac: MinIVACSimulator, targetFloor: number, timeoutMs = 10000): Promise<boolean> {
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
    const minivac = new MinIVACSimulator(circuit);
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
    const minivac = new MinIVACSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    // Press button 3 to call to floor 3
    minivac.pressButton(3);
    await sleep(200);

    const stateAfterPress = minivac.getState();
    expect(stateAfterPress.motor.running).toBe(true);

    // Wait for arrival at floor 3
    const arrived = await waitForFloor(minivac, 3);
    expect(arrived).toBe(true);

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(3);
    expect(finalState.lights[2]).toBe(true); // Floor 3 light ON

    minivac.releaseButton(3);
  });

  it('should travel from floor 3 to floor 2', async () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.motorPosition = 12; // Start at floor 3
    minivac.initialize();

    // Press button 2 to call to floor 2
    minivac.pressButton(2);
    await sleep(200);

    // Wait for arrival at floor 2
    const arrived = await waitForFloor(minivac, 2);
    expect(arrived).toBe(true);

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(2);
    expect(finalState.lights[1]).toBe(true); // Floor 2 light ON

    minivac.releaseButton(2);
  });

  it('should travel from floor 2 to floor 1', async () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.motorPosition = 6; // Start at floor 2
    minivac.initialize();

    // Press button 1 to call to floor 1
    minivac.pressButton(1);
    await sleep(200);

    // Wait for arrival at floor 1
    const arrived = await waitForFloor(minivac, 1);
    expect(arrived).toBe(true);

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(1);
    expect(finalState.lights[0]).toBe(true); // Floor 1 light ON

    minivac.releaseButton(1);
  });

  it('should not move when calling current floor', async () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.motorPosition = 0; // At floor 1
    minivac.initialize();

    const positionBefore = minivac.getState().motor.position;

    // Press button 1 (already at floor 1)
    minivac.pressButton(1);
    await sleep(500);

    const state = minivac.getState();
    expect(state.motor.position).toBe(positionBefore);
    expect(state.motor.running).toBe(false);
    expect(state.lights[0]).toBe(true); // Floor 1 light still ON

    minivac.releaseButton(1);
  });

  it('should handle interlock during motion', async () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    // Start moving to floor 3
    minivac.pressButton(3);
    await sleep(300);

    const stateWhileMoving = minivac.getState();
    expect(stateWhileMoving.motor.running).toBe(true);

    // Try to press button 2 while moving (should be ignored by interlock)
    minivac.pressButton(2);
    await sleep(100);

    const stateAfterInterrupt = minivac.getState();
    // Motor should still be running toward floor 3
    expect(stateAfterInterrupt.motor.running).toBe(true);

    minivac.releaseButton(2);

    // Wait for arrival at floor 3
    const arrived = await waitForFloor(minivac, 3);
    expect(arrived).toBe(true);

    minivac.releaseButton(3);
  });

  it('should handle long trip from floor 1 to floor 3', async () => {
    const minivac = new MinIVACSimulator(circuit);
    minivac.motorPosition = 0;
    minivac.initialize();

    minivac.pressButton(3);
    await sleep(100);

    const tripStart = Date.now();
    const arrived = await waitForFloor(minivac, 3);
    const tripDuration = Date.now() - tripStart;

    expect(arrived).toBe(true);
    expect(tripDuration).toBeLessThan(10000); // Should complete within 10 seconds

    const finalState = minivac.getState();
    expect(getFloorFromPosition(finalState.motor.position)).toBe(3);
    expect(finalState.lights[2]).toBe(true); // Floor 3 light ON

    minivac.releaseButton(3);
  });
});
