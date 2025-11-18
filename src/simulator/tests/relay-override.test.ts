import { describe, it, expect } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';

describe('Relay Manual Override', () => {
  it('should toggle OFF relay to ON when override is set', () => {
    const minivac = new MinivacSimulator([]);

    // Initially relay 1 is OFF
    let state = minivac.getState();
    expect(state.relays[0]).toBe(false);

    // Set override to ON
    minivac.setRelayOverride(1, true);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true);
  });

  it('should return relay to simulation state when override is cleared', () => {
    const minivac = new MinivacSimulator([]);

    // Set override to ON
    minivac.setRelayOverride(1, true);
    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);

    // Clear override - should return to OFF (simulation state)
    minivac.clearRelayOverride(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false);
  });

  it('should handle multiple simultaneous relay overrides', () => {
    const minivac = new MinivacSimulator([]);

    // Override multiple relays
    minivac.setRelayOverride(1, true);
    minivac.setRelayOverride(3, true);
    minivac.setRelayOverride(5, true);

    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);
    expect(state.relays[1]).toBe(false);
    expect(state.relays[2]).toBe(true);
    expect(state.relays[3]).toBe(false);
    expect(state.relays[4]).toBe(true);
    expect(state.relays[5]).toBe(false);

    // Clear one override
    minivac.clearRelayOverride(3);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true);  // Still overridden
    expect(state.relays[2]).toBe(false); // Cleared
    expect(state.relays[4]).toBe(true);  // Still overridden
  });

  it('should throw error for invalid relay number', () => {
    const minivac = new MinivacSimulator([]);

    expect(() => minivac.setRelayOverride(0, true)).toThrow('Invalid relay number');
    expect(() => minivac.setRelayOverride(7, true)).toThrow('Invalid relay number');
    expect(() => minivac.clearRelayOverride(0)).toThrow('Invalid relay number');
    expect(() => minivac.clearRelayOverride(7)).toThrow('Invalid relay number');
  });

  it('should clear all overrides on reset', () => {
    const minivac = new MinivacSimulator([]);

    // Set some overrides
    minivac.setRelayOverride(1, true);
    minivac.setRelayOverride(2, true);

    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);
    expect(state.relays[1]).toBe(true);

    // Reset should clear overrides
    minivac.reset();
    state = minivac.getState();
    expect(state.relays[0]).toBe(false);
    expect(state.relays[1]).toBe(false);
  });

  it('should toggle energized relay OFF temporarily (circuit: relay energized by default)', () => {
    // Circuit: relay 1 energized directly from power
    // 1+/1C connects power to relay coil +
    // 1-/1F connects ground to relay coil -
    const minivac = new MinivacSimulator([
      '+/1C',   // Power to relay 1 coil +
      '-/1F'    // Ground to relay 1 coil -
    ]);
    minivac.initialize();

    // Relay 1 should be energized (circuit powers it)
    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);

    // Override to OFF (manual press while energized)
    minivac.setRelayOverride(1, false);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false); // Temporarily OFF

    // Clear override (release) - should return to ON (circuit still powers it)
    minivac.clearRelayOverride(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true); // Back to energized state
  });

  it('should toggle de-energized relay ON temporarily (circuit: relay energized by default)', () => {
    // Same circuit as above - relay energized by default
    const minivac = new MinivacSimulator([
      '+/1C',
      '-/1F'
    ]);
    minivac.initialize();

    // Verify relay is ON
    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);

    // Override to OFF
    minivac.setRelayOverride(1, false);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false);

    // Now while override is OFF, try to override it back to ON
    // (This tests toggling from the overridden state)
    minivac.setRelayOverride(1, true);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true);

    // Clear override - returns to circuit state (ON)
    minivac.clearRelayOverride(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true);
  });

  it('should handle relay controlled by pushbutton - override while button not pressed', () => {
    // Circuit: relay 1 controlled by button 1
    // +/1X connects power to button 1 NO contact
    // 1Y/1C connects button 1 common to relay coil +
    // -/1F connects ground to relay coil -
    const minivac = new MinivacSimulator([
      '+/1X',   // Power to button 1 NO
      '1Y/1C',  // Button 1 common to relay 1 coil +
      '-/1F'    // Ground to relay 1 coil -
    ]);
    minivac.initialize();

    // Initially button not pressed, relay OFF
    let state = minivac.getState();
    expect(state.relays[0]).toBe(false);

    // Override to ON (manually engage relay)
    minivac.setRelayOverride(1, true);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true);

    // Clear override (release) - should return to OFF (button not pressed)
    minivac.clearRelayOverride(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false);
  });

  it('should handle relay controlled by pushbutton - override while button IS pressed', () => {
    // Same circuit: relay controlled by button
    const minivac = new MinivacSimulator([
      '+/1X',
      '1Y/1C',
      '-/1F'
    ]);
    minivac.initialize();

    // Press button - relay should energize
    minivac.pressButton(1);
    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);

    // Override to OFF (manually disengage while button held)
    minivac.setRelayOverride(1, false);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false); // Temporarily OFF

    // Clear override (release relay) - should return to ON (button still pressed)
    minivac.clearRelayOverride(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true); // Back to ON because button energizes it

    // Release button - relay should de-energize
    minivac.releaseButton(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false);
  });

  it('should handle complex interaction: button press -> override -> button release -> clear override', () => {
    // Circuit: relay controlled by button
    const minivac = new MinivacSimulator([
      '+/1X',
      '1Y/1C',
      '-/1F'
    ]);
    minivac.initialize();

    // Press button - relay ON
    minivac.pressButton(1);
    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);

    // Override to OFF while button pressed
    minivac.setRelayOverride(1, false);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false);

    // Release button (while override still active)
    minivac.releaseButton(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false); // Still OFF (override active)

    // Clear override - should stay OFF (button no longer pressed)
    minivac.clearRelayOverride(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false);
  });

  it('should update relay contacts when override changes - relay 1 controls relay 2', () => {
    // Circuit: relay 1 always on, relay 2 controlled by relay 1's NO contact
    // 1+/1C - Power to relay 1 coil +
    // 1-/1F - Ground to relay 1 coil -
    // 2+/1H - Power to relay 1 contact 1 common
    // 1G/2C - Relay 1 contact 1 NO to relay 2 coil +
    // 2F/2- - Relay 2 coil - to ground
    const minivac = new MinivacSimulator([
      '+/1C',   // Power to relay 1 coil +
      '-/1F',   // Ground to relay 1 coil -
      '+/1H',   // Power to relay 1 contact 1 common
      '1G/2C',  // Relay 1 NO to relay 2 coil +
      '2F/-'    // Relay 2 coil - to ground
    ]);
    minivac.initialize();

    // Initially: relay 1 ON (energized), relay 2 ON (energized through relay 1 NO contact)
    let state = minivac.getState();
    expect(state.relays[0]).toBe(true);  // Relay 1 ON
    expect(state.relays[1]).toBe(true);  // Relay 2 ON (through relay 1 contact)

    // Override relay 1 to OFF - this should switch contacts from NO to NC
    // Breaking the circuit to relay 2
    minivac.setRelayOverride(1, false);
    state = minivac.getState();
    expect(state.relays[0]).toBe(false); // Relay 1 OFF (override)
    expect(state.relays[1]).toBe(false); // Relay 2 should be OFF (contact now on NC)

    // Clear override - relay 1 returns to ON, relay 2 should re-energize
    minivac.clearRelayOverride(1);
    state = minivac.getState();
    expect(state.relays[0]).toBe(true);  // Relay 1 back to ON
    expect(state.relays[1]).toBe(true);  // Relay 2 back to ON
  });

});

