/**
 * Stateful Minivac Circuit Simulator
 * Maintains relay state between button presses
 */

import { loadSimulator, T_VOLTAGE, alerts, type Circuit } from './simulator-loader-universal';
import { parseMinivacNotation } from './circuit-notation-parser';

// Minivac component specifications
const RELAY_COIL_RESISTANCE = 400;  // Ohms
const RELAY_PICKUP_CURRENT = 0.020;  // 20mA threshold (with indicator lamp in series)
const LIGHT_RESISTANCE = 100;  // Ohms
const LIGHT_ON_CURRENT = 0.010;  // 10mA threshold
const WIRE_RESISTANCE = 0.1;  // Ohms

// Motor specifications
const MOTOR_RESISTANCE = 200;  // Ohms
const MOTOR_R1 = 100;  // Ohms
const MOTOR_R2 = 100;  // Ohms
const MOTOR_RUN_CURRENT = 0.010;  // 10mA threshold
const MOTOR_STEP_TIME = 187.5;  // milliseconds per step

/**
 * Circuit builder
 */
class CircuitBuilder {
  private ckt: Circuit;
  private nodes: Record<string, number> = {};

  constructor(circuit: Circuit) {
    this.ckt = circuit;
    this.nodes['Power_Negative'] = circuit.gnd_node();
  }

  getNode(name: string): number {
    if (!(name in this.nodes)) {
      this.nodes[name] = this.ckt.node(name, T_VOLTAGE);
    }
    return this.nodes[name];
  }

  addWire(n1Name: string, n2Name: string, wireName: string): void {
    const n1 = this.getNode(n1Name);
    const n2 = this.getNode(n2Name);
    this.ckt.r(n1, n2, WIRE_RESISTANCE.toString(), wireName);
  }

  addResistor(n1Name: string, n2Name: string, resistance: number, compName: string): void {
    const n1 = this.getNode(n1Name);
    const n2 = this.getNode(n2Name);
    this.ckt.r(n1, n2, resistance.toString(), compName);
  }

  addCurrentProbe(n1Name: string, n2Name: string, probeName: string): void {
    const n1 = this.getNode(n1Name);
    const n2 = this.getNode(n2Name);
    this.ckt.v(n1, n2, '0', probeName);
  }
}

export interface MinivacState {
  relays: boolean[];
  buttons: boolean[];
  lights: boolean[];
  relayIndicatorLights: boolean[];
  slides: string[];
  motor: {
    position: number;
    angle: number;
    running: boolean;
    direction: string;
  };
  alerts: string[];
}

/**
 * Stateful Minivac Simulator
 */
export class MinivacSimulator {
  private wires: Array<[string, string]>;
  private buttonStates: boolean[] = [false, false, false, false, false, false];
  private relayStates: boolean[] = [false, false, false, false, false, false];
  private lightStates: boolean[] = [false, false, false, false, false, false];
  private relayIndicatorLightStates: boolean[] = [false, false, false, false, false, false];
  private slideStates: boolean[] = [false, false, false, false, false, false];
  public motorPosition: number = 0;
  public motorAngle: number = 0;  // Continuous angle in degrees (0° is north/top)
  private motorRunning: boolean = false;
  private motorDirection: number = 1;
  private lastMotorUpdateTime: number | null = null;
  private lastMotorContactState: boolean = true;  // Track if motor arm was making contact
  public verbose: boolean = false;

  constructor(circuitNotation: string[], verbose = false) {
    this.wires = parseMinivacNotation(circuitNotation);
    this.verbose = verbose;
    if (this.verbose) {
      console.log(`Minivac initialized with ${this.wires.length} wires`);
    }
  }

  private _buildCircuit(): { circuit: Circuit; builder: CircuitBuilder } {
    const cktsim = loadSimulator();
    const ckt = new cktsim.Circuit();
    const builder = new CircuitBuilder(ckt);

    // Power supply
    const vccNode = builder.getNode('Power_Positive');
    const gnd = ckt.gnd_node();
    ckt.v(vccNode, gnd, '12', 'V_POWER');

    // Add all 6 lights
    for (let i = 1; i <= 6; i++) {
      const lightA = `Light${i}_A`;
      const lightB = `Light${i}_B`;
      const probeNode = `Light${i}_Probe`;
      builder.addCurrentProbe(lightA, probeNode, `LIGHT${i}_PROBE`);
      builder.addResistor(probeNode, lightB, LIGHT_RESISTANCE, `LIGHT${i}`);
    }

    // Add all 6 relays
    for (let i = 1; i <= 6; i++) {
      const lampInput = `Relay${i}_IndicatorLamp_Input`;
      const lampProbeNode = `Relay${i}_LampProbe`;
      const coilInput = `Relay${i}_Coil_Input`;
      const coilOutput = `Relay${i}_Coil_Output`;
      const coilProbeNode = `Relay${i}_CoilProbe`;

      builder.addCurrentProbe(lampInput, lampProbeNode, `RELAY${i}_INDICATOR_LAMP_PROBE`);
      builder.addResistor(lampProbeNode, coilInput, LIGHT_RESISTANCE, `RELAY${i}_INDICATOR_LAMP`);
      builder.addCurrentProbe(coilInput, coilProbeNode, `RELAY${i}_COIL_PROBE`);
      builder.addResistor(coilProbeNode, coilOutput, RELAY_COIL_RESISTANCE, `RELAY${i}_COIL`);

      const h1 = `Relay${i}_Contact1_Common`;
      const g1 = `Relay${i}_Contact1_NO`;
      const j1 = `Relay${i}_Contact1_NC`;

      if (this.relayStates[i - 1]) {
        builder.addWire(h1, g1, `RELAY${i}_CONTACT1_NO_CLOSED`);
      } else {
        builder.addWire(h1, j1, `RELAY${i}_CONTACT1_NC_CLOSED`);
      }

      const l2 = `Relay${i}_Contact2_Common`;
      const k2 = `Relay${i}_Contact2_NO`;
      const n2 = `Relay${i}_Contact2_NC`;

      if (this.relayStates[i - 1]) {
        builder.addWire(l2, k2, `RELAY${i}_CONTACT2_NO_CLOSED`);
      } else {
        builder.addWire(l2, n2, `RELAY${i}_CONTACT2_NC_CLOSED`);
      }
    }

    // Add all 6 pushbuttons
    for (let i = 1; i <= 6; i++) {
      const y = `Button${i}_Common`;
      const x = `Button${i}_NormallyOpen`;
      const z = `Button${i}_NormallyClosed`;

      if (this.buttonStates[i - 1]) {
        builder.addWire(y, x, `BUTTON${i}_NO_CLOSED`);
      } else {
        builder.addWire(y, z, `BUTTON${i}_NC_CLOSED`);
      }
    }

    // Add all 6 slide switches
    for (let i = 1; i <= 6; i++) {
      const s = `Slide${i}_Common1`;
      const r = `Slide${i}_Left1`;
      const t = `Slide${i}_Right1`;
      const v = `Slide${i}_Common2`;
      const u = `Slide${i}_Left2`;
      const w = `Slide${i}_Right2`;

      if (this.slideStates[i - 1]) {
        builder.addWire(s, t, `SLIDE${i}_SET1_RIGHT`);
        builder.addWire(v, w, `SLIDE${i}_SET2_RIGHT`);
      } else {
        builder.addWire(s, r, `SLIDE${i}_SET1_LEFT`);
        builder.addWire(v, u, `SLIDE${i}_SET2_LEFT`);
      }
    }

    // Add motor circuit
    const d17 = 'Motor_D17';
    const d18 = 'Motor_D18';
    const d19 = 'Motor_D19';
    const junction = 'Motor_Junction';
    const motorProbe = 'Motor_Probe';
    const r1Probe = 'Motor_R1_Probe';
    const r2Probe = 'Motor_R2_Probe';

    builder.addCurrentProbe(d17, r1Probe, 'MOTOR_R1_PROBE');
    builder.addResistor(r1Probe, junction, MOTOR_R1, 'MOTOR_R1');
    builder.addWire(junction, d19, 'MOTOR_JUNCTION_TO_D19');
    builder.addCurrentProbe(junction, r2Probe, 'MOTOR_R2_PROBE');
    builder.addResistor(r2Probe, d18, MOTOR_R2, 'MOTOR_R2');
    builder.addCurrentProbe(junction, motorProbe, 'MOTOR_PROBE');
    builder.addResistor(motorProbe, d18, MOTOR_RESISTANCE, 'MOTOR');

    // Motor rotary selector (with break-before-make)
    // Only connect when motor arm is making contact (not in dead zone)
    if (this._isMotorMakingContact()) {
      const d16 = 'Motor_D16';
      const currentContact = `Motor_D${this.motorPosition}`;
      builder.addWire(d16, currentContact, 'MOTOR_SELECTOR_ARM');
    }

    // Add user-defined wires
    for (let i = 0; i < this.wires.length; i++) {
      const [term1, term2] = this.wires[i];
      builder.addWire(term1, term2, `USER_WIRE_${i + 1}`);
    }

    return { circuit: ckt, builder };
  }

  private _simulate(): boolean {
    alerts.length = 0;

    let iteration = 0;
    const maxIterations = 10;

    while (iteration < maxIterations) {
      if (this.verbose) console.log(`\n=== Iteration ${iteration + 1} ===`);

      const { circuit } = this._buildCircuit();

      if (this.verbose) console.log('Finalizing circuit...');
      const finalized = circuit.finalize();

      if (!finalized) {
        console.error('❌ Circuit finalization failed!');
        if (alerts.length > 0) {
          alerts.forEach(alert => console.error('  ' + alert));
        }
        return false;
      }

      if (this.verbose) console.log('Running DC analysis...');
      const results = circuit.dc();

      if (!results) {
        console.error('❌ DC analysis failed!');
        if (alerts.length > 0) {
          alerts.forEach(alert => console.error('  ' + alert));
        }
        return false;
      }

      // Check for short circuit (excessive power supply current)
      const powerCurrent = Math.abs(results['I(V_POWER)'] || 0);
      if (powerCurrent > 1.0) {  // More than 1 amp indicates likely short circuit
        const message = 'SHORT CIRCUIT DETECTED!';
        if (!alerts.includes(message)) {
          alerts.push(message);
        }
        console.warn(`${message} Power supply current: ${powerCurrent.toFixed(2)}A (normal: <0.5A)`);
      }

      // Extract new relay states
      const newRelayStates: boolean[] = [];
      for (let i = 1; i <= 6; i++) {
        const current = Math.abs(results[`I(RELAY${i}_COIL_PROBE)`] || 0);
        const energized = current >= RELAY_PICKUP_CURRENT;
        newRelayStates.push(energized);
      }

      // Check if relay states changed
      let changed = false;
      for (let i = 0; i < 6; i++) {
        if (this.relayStates[i] !== newRelayStates[i]) {
          changed = true;
          const current = Math.abs(results[`I(RELAY${i+1}_COIL_PROBE)`] || 0);
          if (this.verbose) {
            console.log(`  Relay ${i + 1}: ${this.relayStates[i] ? 'ON' : 'OFF'} -> ${newRelayStates[i] ? 'ON' : 'OFF'} (${(current * 1000).toFixed(3)} mA)`);
          }
        }
      }

      this.relayStates = newRelayStates;

      // Extract light states
      for (let i = 1; i <= 6; i++) {
        const current = Math.abs(results[`I(LIGHT${i}_PROBE)`] || 0);
        this.lightStates[i - 1] = current >= LIGHT_ON_CURRENT;
      }

      // Extract relay indicator light states
      for (let i = 1; i <= 6; i++) {
        const current = Math.abs(results[`I(RELAY${i}_INDICATOR_LAMP_PROBE)`] || 0);
        this.relayIndicatorLightStates[i - 1] = current >= LIGHT_ON_CURRENT;
      }

      // Extract motor state
      const motorCurrent = results[`I(MOTOR_PROBE)`] || 0;
      const motorCurrentAbs = Math.abs(motorCurrent);

      const wasRunning = this.motorRunning;

      if (motorCurrentAbs >= MOTOR_RUN_CURRENT) {
        this.motorRunning = true;
        this.motorDirection = motorCurrent > 0 ? 1 : -1;

        if (!wasRunning) {
          this.lastMotorUpdateTime = Date.now();
        }

        if (this.verbose) {
          const direction = this.motorDirection > 0 ? 'CW' : 'CCW';
          console.log(`  Motor: RUNNING ${direction} (${(motorCurrentAbs * 1000).toFixed(3)} mA)`);
        }
      } else {
        if (this.motorRunning && this.verbose) {
          console.log(`  Motor: STOPPED (${(motorCurrentAbs * 1000).toFixed(3)} mA)`);
        }
        this.motorRunning = false;
        this.lastMotorUpdateTime = null;
      }

      if (!changed) {
        if (this.verbose) console.log('  Relay states stable!');
        return true;
      }

      iteration++;
    }

    if (this.verbose) console.log('⚠️  Maximum iterations reached');
    return false;
  }

  pressButton(buttonNum: number): void {
    if (buttonNum < 1 || buttonNum > 6) {
      throw new Error(`Invalid button number: ${buttonNum}`);
    }
    if (this.verbose) console.log(`\n🔘 Press button ${buttonNum}`);
    this.buttonStates[buttonNum - 1] = true;
    this._simulate();
    if (this.verbose) this._printState();
  }

  releaseButton(buttonNum: number): void {
    if (buttonNum < 1 || buttonNum > 6) {
      throw new Error(`Invalid button number: ${buttonNum}`);
    }
    if (this.verbose) console.log(`\n🔘 Release button ${buttonNum}`);
    this.buttonStates[buttonNum - 1] = false;
    this._simulate();
    if (this.verbose) this._printState();
  }

  setSlide(slideNum: number, position: 'left' | 'right'): void {
    if (slideNum < 1 || slideNum > 6) {
      throw new Error(`Invalid slide number: ${slideNum}`);
    }
    const newState = position === 'right';
    const oldState = this.slideStates[slideNum - 1];

    if (oldState !== newState) {
      if (this.verbose) console.log(`\n🔀 Slide switch ${slideNum} moved to ${position.toUpperCase()}`);
      this.slideStates[slideNum - 1] = newState;
      this._simulate();
      if (this.verbose) this._printState();
    }
  }

  // Calculate motor position from current angle
  private _calculatePositionFromAngle(): void {
    // 0° is north (top). Section 0 is centered at 0°, spanning from -11.25° to +11.25°
    // Each section is 22.5° wide (360° / 16 positions)
    const normalizedAngle = ((this.motorAngle % 360) + 360) % 360;
    // Shift by +11.25° so section boundaries align with multiples of 22.5°
    const adjustedAngle = (normalizedAngle + 11.25) % 360;
    this.motorPosition = Math.floor(adjustedAngle / 22.5) % 16;
  }

  // Check if motor arm is making contact (break-before-make logic)
  // Each position occupies 20° of contact out of 22.5° total per position
  // This leaves ~2.5° dead zones between positions where no contact is made
  private _isMotorMakingContact(): boolean {
    const normalizedAngle = ((this.motorAngle % 360) + 360) % 360;
    // Each position is centered at multiples of 22.5° (0°, 22.5°, 45°, etc.)
    // Contact is made for 20° (from -10° to +10° relative to center)
    // No contact for remaining 2.5° on each side
    const adjustedAngle = (normalizedAngle + 11.25) % 360;
    const withinSection = adjustedAngle % 22.5;
    // Dead zone: first 1.25° and last 1.25° of each 22.5° section
    return withinSection >= 1.25 && withinSection <= 21.25;
  }

  private _updateMotorPosition(): boolean {
    if (!this.motorRunning || !this.lastMotorUpdateTime) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - this.lastMotorUpdateTime;
    this.lastMotorUpdateTime = now;

    // Update angle continuously
    // Speed: (360 degrees / 16 positions) / 187.5 ms per position = 0.12 degrees/ms
    const degreesPerMs = (360 / 16) / MOTOR_STEP_TIME;
    const angleDelta = elapsed * degreesPerMs * this.motorDirection;
    this.motorAngle += angleDelta;

    const oldPosition = this.motorPosition;
    const oldContactState = this.lastMotorContactState;
    this._calculatePositionFromAngle();
    const newContactState = this._isMotorMakingContact();
    this.lastMotorContactState = newContactState;

    // Return true if position OR contact state changed (circuit needs resimulation)
    return oldPosition !== this.motorPosition || oldContactState !== newContactState;
  }

  // Pause the simulator (called when UI power is turned off)
  pause(): void {
    // Clear motor update time to prevent catch-up when resumed
    this.lastMotorUpdateTime = null;
  }

  // Resume the simulator (called when UI power is turned on)
  resume(): void {
    // If motor is running, reset the timer to now
    if (this.motorRunning) {
      this.lastMotorUpdateTime = Date.now();
    }
  }

  getState(): MinivacState {
    const needsResimulation = this._updateMotorPosition();

    if (needsResimulation) {
      this._simulate();
    }

    return {
      relays: [...this.relayStates],
      buttons: [...this.buttonStates],
      lights: [...this.lightStates],
      relayIndicatorLights: [...this.relayIndicatorLightStates],
      slides: this.slideStates.map(s => s ? 'right' : 'left'),
      motor: {
        position: this.motorPosition,
        angle: this.motorAngle,
        running: this.motorRunning,
        direction: this.motorDirection > 0 ? 'CW' : 'CCW',
      },
      alerts: [...alerts],
    };
  }

  private _printState(): void {
    if (!this.verbose) return;

    console.log('\n📊 STATE:');
    console.log('  Relays: ', this.relayStates.map((r, i) => `R${i+1}:${r?'ON':'OFF'}`).join(' '));
    console.log('  Lights: ', this.lightStates.map((l, i) => `L${i+1}:${l?'ON':'OFF'}`).join(' '));
    console.log('  RelayIndicatorLights:', this.relayIndicatorLightStates.map((l, i) => `RL${i+1}:${l?'ON':'OFF'}`).join(' '));
    console.log('  Buttons:', this.buttonStates.map((b, i) => `B${i+1}:${b?'DOWN':'UP'}`).join(' '));
    console.log('  Slides: ', this.slideStates.map((s, i) => `S${i+1}:${s?'RIGHT':'LEFT'}`).join(' '));

    const motorStatus = this.motorRunning ?
      `RUNNING ${this.motorDirection > 0 ? 'CW' : 'CCW'}` : 'STOPPED';
    console.log(`  Motor:   Position=${this.motorPosition} (D${this.motorPosition}) Status=${motorStatus}`);
  }

  initialize(): void {
    if (this.verbose) console.log('\n⚡ Initializing circuit...');
    this._simulate();
    if (this.verbose) this._printState();
  }

  // Force resimulation (for testing - doesn't update motor based on time)
  resimulate(): void {
    this._simulate();
  }

  // Update motor angle and recalculate position
  // Use this instead of directly setting motorAngle to ensure position stays in sync
  updateMotorAngle(angle: number): void {
    this.motorAngle = angle;
    this._calculatePositionFromAngle();
    this.lastMotorContactState = this._isMotorMakingContact();
  }
}
