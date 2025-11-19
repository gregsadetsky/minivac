import { describe, it, expect } from 'vitest';
import { MinivacSimulator } from '../minivac-simulator';
import { threeBitCounterCircuit } from '../../circuits/three-bit-counter';

describe('Circuit Recreation State Preservation', () => {
  it('should preserve latched relay states when adding unrelated wires', () => {
    // Load 3-bit counter circuit
    const circuit = threeBitCounterCircuit.circuit;
    const minivac = new MinivacSimulator(circuit);
    minivac.initialize();

    // Initial state - all relays and lights should be off
    let state = minivac.getState();
    expect(state.lights.every(l => !l)).toBe(true);
    expect(state.relays.every(r => !r)).toBe(true);

    // Press button 6
    minivac.pressButton(6);
    state = minivac.getState();

    // Some relays and lights should now be on
    const relaysOnAfterPress = state.relays.filter(r => r).length;
    const lightsOnAfterPress = state.lights.filter(l => l).length;

    console.log(`After pressing button 6: ${relaysOnAfterPress} relays on, ${lightsOnAfterPress} lights on`);
    expect(relaysOnAfterPress).toBeGreaterThan(0);

    // Release button 6 - relays should STAY latched
    minivac.releaseButton(6);
    state = minivac.getState();

    const relaysOnAfterRelease = state.relays.filter(r => r).length;
    const lightsOnAfterRelease = state.lights.filter(l => l).length;

    console.log(`After releasing button 6: ${relaysOnAfterRelease} relays on, ${lightsOnAfterRelease} lights on`);
    expect(relaysOnAfterRelease).toBeGreaterThan(0); // Relays should still be on (latched)

    // Now simulate adding a wire by creating a new simulator with an extra wire
    // Add M+/D17 which should NOT affect the circuit
    const circuitWithMotor = [...circuit, 'M+/D17'];
    const minivac2 = new MinivacSimulator(circuitWithMotor);

    // Preserve relay states BEFORE initialization (this is what SimulatorCore now does)
    minivac2.setRelayStates(state.relays);

    minivac2.initialize();

    // Simulate preserving button state (button 6 is still released)
    // No buttons pressed in new simulator

    const newState = minivac2.getState();
    const relaysOnAfterRecreate = newState.relays.filter(r => r).length;
    const lightsOnAfterRecreate = newState.lights.filter(l => l).length;

    console.log(`After recreating simulator with motor wire: ${relaysOnAfterRecreate} relays on, ${lightsOnAfterRecreate} lights on`);

    // BUG: Relays should still be latched, but they turn off!
    expect(relaysOnAfterRecreate).toBe(relaysOnAfterRelease);
    expect(lightsOnAfterRecreate).toBe(lightsOnAfterRelease);
  });
});
