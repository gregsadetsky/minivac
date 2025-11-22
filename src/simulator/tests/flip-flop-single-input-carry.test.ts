/**
 * Test Single Input Flip Flop with Carry (Book 4, Page 70)
 *
 * Single Input Flip Flop with Carry:
 * - Button 6: Trigger input
 * - Relay 5 and 6: Flip-flop state
 * - Light 4: Carry output
 * - First button press: Sets both relays ON
 * - Second button press (while held): Relay 5 OFF, Relay 6 ON, Light 4 ON (carry)
 */

import { describe, expect, it } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

describe('Minivac Simulator - Single Input Flip Flop with Carry', () => {
  const circuit = [
    '5+/5G',
    '5H/5F',
    '5F/6F',
    '5C/6C',
    '6C/6-',
    '5J/6H',
    '6G/5E',
    '6J/6E',
    '6E/6A',
    '6B/6-',
    '5H/5A',
    '5B/5-',
    '6+/6Y',
    '6X/6H',
    '5G/5N',
    '5L/6L',
    '6K/4A',
    '4B/4-',
  ];

  it('should initialize with both relays off', () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    const state = minivac.getState();

    expect(state.relays[4]).toBe(false); // Relay 5 OFF
    expect(state.relays[5]).toBe(false); // Relay 6 OFF
  });

  it('should set both relays on after first button press/release cycle', () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // Initial state: both relays OFF
    let state = minivac.getState();
    expect(state.relays[4]).toBe(false); // Relay 5 OFF
    expect(state.relays[5]).toBe(false); // Relay 6 OFF

    // Press button 6
    minivac.pressButton(6);

    // Release button 6
    minivac.releaseButton(6);

    // After release: both relays ON
    state = minivac.getState();
    expect(state.relays[4]).toBe(true); // Relay 5 ON
    expect(state.relays[5]).toBe(true); // Relay 6 ON
  });

  it('should show carry output when button 6 is pressed a second time (while held)', () => {
    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // First cycle: press and release button 6
    minivac.pressButton(6);
    minivac.releaseButton(6);

    // Verify both relays are ON
    let state = minivac.getState();
    expect(state.relays[4]).toBe(true); // Relay 5 ON
    expect(state.relays[5]).toBe(true); // Relay 6 ON

    // Second press: press button 6 but DON'T release
    minivac.pressButton(6);

    // While button is held: Relay 5 OFF, Relay 6 ON, Light 4 ON
    state = minivac.getState();
    expect(state.relays[4]).toBe(false); // Relay 5 OFF
    expect(state.relays[5]).toBe(true);  // Relay 6 ON
    expect(state.lights[3]).toBe(true);  // Light 4 ON (carry)
  });
});
