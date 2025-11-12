/**
 * Test Break-Before-Make Logic
 *
 * Verifies that the motor arm actually disconnects during transitions
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

describe('Break-Before-Make Logic', () => {
  it('should disconnect motor arm during dead zones between positions', () => {
    // Simple circuit: Power flows from + through light to D16 (selector arm)
    // Selector arm connects D16 to current position (D0, D1, etc.)
    // Then D0/D1 connect to ground completing the circuit
    const circuit = [
      '6A/6+',  // Power to light input
      'D16/6B', // Light output to selector arm input
      'D0/6-',  // Position D0 to ground (when selector touches D0)
      'D1/6-'   // Position D1 to ground (when selector touches D1)
    ];

    const minivac = new MinivacSimulator(circuit);
    minivac.updateMotorAngle(0); // Start at D0
    minivac.initialize();

    console.log('\n=== Testing Break-Before-Make ===');

    // Test at key angles as motor moves from D0 to D1
    // Position 0 centered at 0°, contact from -10° to +10°, dead zone from +10° to +12.5°
    const testAngles = [
      { angle: 0,      expectedPos: 0, shouldBeConnected: true,  desc: 'Center of D0' },
      { angle: 9,      expectedPos: 0, shouldBeConnected: true,  desc: 'Still in D0 contact' },
      { angle: 10,     expectedPos: 0, shouldBeConnected: true,  desc: 'Edge of D0 contact' },
      { angle: 10.5,   expectedPos: 0, shouldBeConnected: false, desc: 'Dead zone (between D0 and D1)' },
      { angle: 11,     expectedPos: 0, shouldBeConnected: false, desc: 'Dead zone' },
      { angle: 12,     expectedPos: 1, shouldBeConnected: false, desc: 'Dead zone (pos changed to D1)' },
      { angle: 12.5,   expectedPos: 1, shouldBeConnected: true,  desc: 'D1 contact starts (edge)' },
      { angle: 13,     expectedPos: 1, shouldBeConnected: true,  desc: 'D1 contact' },
      { angle: 22.5,   expectedPos: 1, shouldBeConnected: true,  desc: 'Center of D1' },
    ];

    const results: Array<{ angle: number; pos: number; lightOn: boolean; desc: string }> = [];

    for (const test of testAngles) {
      minivac.updateMotorAngle(test.angle);
      minivac.resimulate(); // Resimulate circuit with new angle (no time advancement)
      // Note: accessing private field for testing - prevents time-based motor updates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (minivac as any).lastMotorUpdateTime = null;
      const state = minivac.getState();
      const lightOn = state.lights[5]; // Light 6 (0-indexed)

      results.push({
        angle: test.angle,
        pos: state.motor.position,
        lightOn,
        desc: test.desc
      });

      console.log(`  ${test.angle.toFixed(2)}° (${test.desc}): pos=${state.motor.position} Light6=${lightOn ? 'ON' : 'OFF'} (expected ${test.shouldBeConnected ? 'ON' : 'OFF'})`);

      // Verify position
      expect(state.motor.position).toBe(test.expectedPos);

      // Verify light state matches expected connection state
      if (test.shouldBeConnected) {
        expect(lightOn).toBe(true);
      } else {
        expect(lightOn).toBe(false);
      }
    }

    console.log('');

    // Count transitions
    let onToOffCount = 0;
    let offToOnCount = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i-1].lightOn && !results[i].lightOn) onToOffCount++;
      if (!results[i-1].lightOn && results[i].lightOn) offToOnCount++;
    }

    console.log(`  Detected ${onToOffCount} ON→OFF transitions and ${offToOnCount} OFF→ON transitions`);

    // Should have at least one ON→OFF and one OFF→ON transition
    expect(onToOffCount).toBeGreaterThanOrEqual(1);
    expect(offToOnCount).toBeGreaterThanOrEqual(1);
  });
});
