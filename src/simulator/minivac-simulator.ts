/**
 * Stateful Minivac Circuit Simulator
 * Maintains relay state between button presses
 */

import { loadSimulator, T_VOLTAGE, alerts, type Circuit } from './simulator-loader-universal';
import { parseMinivacNotation, parseTerminalIdentifier } from './circuit-notation-parser';
import { SparseCircuit } from './sparse-circuit';
import { FastCircuit } from './fast-circuit';

// Solver engine. DEFAULT IS 'sparse' (validated equivalent to the vendored dense
// cktsim solver: full suite green under both, 5000 random circuits / 10,001
// snapshots / zero mismatches / max diff 1.4e-10 mA; 11-26x faster). The dense
// engine remains permanently available as the ORACLE — escape hatch:
// MINIVAC_SOLVER=dense (or =cktsim), or setSolverEngine('cktsim').
// 'fast' is the typed-array rewrite of the sparse engine (same pivot policy,
// flat-array elimination — see fast-circuit.ts): MINIVAC_SOLVER=fast, or
// setSolverEngine('fast').
export type SolverEngine = 'cktsim' | 'sparse' | 'fast';
const envSolver = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.MINIVAC_SOLVER;
let solverEngine: SolverEngine =
  (envSolver === 'cktsim' || envSolver === 'dense') ? 'cktsim'
  : envSolver === 'fast' ? 'fast'
  : 'sparse';
export function setSolverEngine(engine: SolverEngine): void {
  solverEngine = engine;
}
export function getSolverEngine(): SolverEngine {
  return solverEngine;
}

// Minivac component specifications
// measured on a real Minivac 601 with a multimeter and bench supply, 2026-08-17
const SUPPLY_VOLTAGE = 13.3;  // Volts, measured open-circuit (was 12, a guess)
// derived from measured sag: 13.3->13.15 V at ~100mA (1.5 Ohm), 13.3->12.88 V at ~230mA (1.8 Ohm)
const SUPPLY_INTERNAL_RESISTANCE = 1.8;  // Ohms
const RELAY_COIL_RESISTANCE = 55;  // Ohms, measured (was 400, a guess)
// bench-measured on the coil: picks up at ~5.0-5.1V (~90mA), drops out at ~1.6-1.7V (~30mA).
// pickup measurements on the real device don't fully agree with each other:
//   - bench slow-ramp on one coil: clicks at 5.0-5.1V ≈ 90mA
//   - 3 coils in series (~80mA each): "at the limit — really no"
//   - coil behind an ALREADY-WARM bulb (~73-80mA model current): picks up reliably,
//     verified 2026-08-17 by shorting the coil with a button, bulb hot, then releasing —
//     relay clicks and its contacts drive a light
// the last two bracket ~80mA from opposite sides; a single threshold can't do both
// (per-relay variance would explain it, unproven). realistic circuits look like the
// warm-bulb case, so the threshold sits below it; the 3-coil-series edge case is
// knowingly mispredicted. dropout as measured (1.6-1.7V ≈ 30mA).
const RELAY_PICKUP_CURRENT = 0.070;
const RELAY_DROPOUT_CURRENT = 0.030;

// bulb i-v curve, bench-measured 2026-08-17: I(A) = 0.0208 * V^0.625
// reproduces all 6 measured points within ~1.5%:
//   2V/32mA  4V/50mA  6V/64mA  8V/77mA  10V/88mA  13V/103mA
// solved by relaxation: each bulb's resistance is re-fit to its operating voltage
// every solver iteration until stable.
const BULB_IV_COEFF = 0.0208;
const BULB_IV_EXPONENT = 0.625;
const BULB_COLD_RESISTANCE = 14;  // Ohms, measured with ohmmeter — floor of the curve
const BULB_INITIAL_RESISTANCE = BULB_COLD_RESISTANCE;  // bulbs start cold, like reality
// full brightness = bulb directly across the supply (measured 13.11V @ 100mA).
// luminous output of an incandescent scales ~V^3.4 (standard approximation, not measured)
const BULB_NOMINAL_VOLTS = 13.1;
const BULB_LUMINOSITY_EXPONENT = 3.4;
const LIGHT_ON_CURRENT = 0.010;  // 10mA threshold — still a guess, not measured
const WIRE_RESISTANCE = 0.1;  // Ohms — not measured, kept as is

// Motor specifications
const MOTOR_RESISTANCE = 200;  // Ohms
const MOTOR_R1 = 100;  // Ohms
const MOTOR_R2 = 100;  // Ohms
const MOTOR_RUN_CURRENT = 0.010;  // 10mA threshold
const MOTOR_STEP_TIME = 187.5;  // milliseconds per step

// Internal capacitors behind the CAPACITOR jacks (book VII, p12):
// 500uF on sections 1-5, 1000uF on section 6. One terminal is the jack, the other is −.
const CAPACITOR_FARADS = [500e-6, 500e-6, 500e-6, 500e-6, 500e-6, 1000e-6];
// Capacitors are simulated with a backward-Euler companion model: a voltage source at
// the stored voltage in series with dt/C. For instantaneous (event) solves — button
// presses etc. — dt is tiny, making the companion resistance negligible, i.e. the
// capacitor momentarily behaves as an ideal voltage source, which is physically right.
const CAP_EVENT_DT_SECONDS = 1e-4;

// resistance of a bulb operating at the given voltage, per the measured i-v curve:
// R = V / I(V) = V^(1-0.625) / 0.0208, floored at the measured cold resistance
function bulbResistanceAtVoltage(volts: number): number {
  const r = Math.pow(Math.abs(volts), 1 - BULB_IV_EXPONENT) / BULB_IV_COEFF;
  return Math.max(BULB_COLD_RESISTANCE, r);
}

// relative luminance (0-1) of a bulb operating at the given voltage
function bulbBrightnessAtVoltage(volts: number): number {
  return Math.min(1, Math.pow(Math.abs(volts) / BULB_NOMINAL_VOLTS, BULB_LUMINOSITY_EXPONENT));
}

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
  lightBrightness: number[];  // 0-1 relative luminance per light
  relayIndicatorBrightness: number[];  // 0-1 relative luminance per relay indicator lamp
  slides: string[];
  motor: {
    position: number;
    angle: number;
    running: boolean;
    direction: string;
  };
  alerts: string[];
  relayCurrents: number[];  // Relay coil currents in mA
}

/**
 * Stateful Minivac Simulator
 */
export class MinivacSimulator {
  private wires: Array<[string, string]>;
  private buttonStates!: boolean[];
  private relayStates!: boolean[];
  private relayCurrents!: number[];  // Relay coil currents in mA
  private relayOverrides!: Array<boolean | null>;  // Manual override states (null = no override)
  private lightStates!: boolean[];
  private relayIndicatorLightStates!: boolean[];
  private lightBrightness!: number[];
  private relayIndicatorBrightness!: number[];
  private bulbResistances!: Record<string, number>;  // per-bulb, keys LIGHT1-6 / LAMP1-6
  private stateVersion = 0;  // bumped on every solve; lets the UI skip idle frames cheaply
  private capVoltages!: number[];  // stored voltage of each section's internal capacitor
  private capDtSeconds = CAP_EVENT_DT_SECONDS;  // timestep for the capacitor companion model
  private externalResistors: Array<[string, string, number]> = [];  // [node1, node2, ohms]
  private lastResults: Record<string, number> | null = null;
  private slideStates!: boolean[];
  public motorPosition!: number;
  public motorAngle!: number;  // Continuous angle in degrees (0° is north/top)
  private motorRunning!: boolean;
  private motorDirection!: number;
  private lastMotorUpdateTime!: number | null;
  private lastMotorContactState!: boolean;  // Track if motor arm was making contact
  public verbose: boolean = false;
  // Multivac: number of ganged machines in one circuit (wires may cross machines via
  // "b.3G" notation; supplies are per-machine, negative rails are common). All state
  // arrays are flat, length 6*machineCount; machine m section s = index m*6+s-1.
  private machineCount: number;
  // relaxation iterations of the last solve — the relay cascade depth (settle metric)
  public lastRelaxationIterations = 0;

  constructor(circuitNotation: string[], verbose = false, machineCount = 1) {
    this.machineCount = machineCount;
    this.wires = parseMinivacNotation(circuitNotation);
    this.verbose = verbose;
    this.reset(); // Initialize all state to defaults
    if (this.verbose) {
      console.log(`Minivac initialized with ${this.wires.length} wires`);
    }
  }

  private get sectionCount(): number {
    return 6 * this.machineCount;
  }

  // global 1-based section index → node-name prefix + per-machine section number
  private _loc(i: number): { p: string; sec: number } {
    const machine = Math.floor((i - 1) / 6);
    return { p: machine === 0 ? '' : `m${machine}.`, sec: ((i - 1) % 6) + 1 };
  }

  private _buildCircuit(): { circuit: Circuit; builder: CircuitBuilder } {
    const ckt = solverEngine === 'sparse'
      ? (new SparseCircuit() as unknown as Circuit)
      : solverEngine === 'fast'
        ? (new FastCircuit() as unknown as Circuit)
        : new (loadSimulator().Circuit)();
    const builder = new CircuitBuilder(ckt);

    // DEAD-HARDWARE TRIM (exact, all engines see the same netlist): hardware
    // whose every jack is untouched by user wiring is a floating island — it
    // carries zero current and solves to zero — so emitting it only inflates
    // the MNA system (each PROBE is a whole extra unknown). At 50 built
    // machines a tetris tick spent most of its matrix on never-wired lights,
    // indicator lamps, idle button/slide contacts and empty supplies
    // (measured: +50 empty machines tripled the solve). Every state reader
    // already defaults a missing probe to 0 (`|| 0`), which is exactly the
    // island's answer. The capacitor block below has trimmed this way since
    // it landed; this extends the same wiredNodes rule to the rest.
    const gnd = ckt.gnd_node();
    const wiredNodes = new Set(this.wires.flat().concat(this.externalResistors.flatMap(r => [r[0], r[1]])));
    const touched = (...nodes: string[]) => nodes.some(n => wiredNodes.has(n));

    // Power supplies: one ideal source behind measured internal resistance PER
    // MACHINE (negative rails are common — see the parser note on
    // Power_Negative). A machine whose + rail is never wired feeds nothing:
    // its source + internal R would island (the − side is the common node,
    // but with no + path there is no loop). Machine 0's supply is ALWAYS
    // emitted: with no user wires at all the netlist would otherwise be
    // EMPTY, and the dense oracle's matrix code crashes on zero unknowns
    // where sparse/fast return an empty solution — and physically the
    // supply is live the moment the machine is switched on.
    for (let m = 0; m < this.machineCount; m++) {
      const p = m === 0 ? '' : `m${m}.`;
      if (m > 0 && !touched(`${p}Power_Positive`)) continue;
      const vsrcNode = builder.getNode(`${p}Power_Source_Internal`);
      ckt.v(vsrcNode, gnd, SUPPLY_VOLTAGE.toString(), `${p}V_POWER`);
      builder.addResistor(`${p}Power_Source_Internal`, `${p}Power_Positive`, SUPPLY_INTERNAL_RESISTANCE, `${p}V_POWER_INTERNAL_R`);
    }

    // Add the wired lights
    for (let i = 1; i <= this.sectionCount; i++) {
      const { p, sec } = this._loc(i);
      const lightA = `${p}Light${sec}_A`;
      const lightB = `${p}Light${sec}_B`;
      if (!touched(lightA, lightB)) continue;
      const probeNode = `${p}Light${sec}_Probe`;
      builder.addCurrentProbe(lightA, probeNode, `${p}LIGHT${sec}_PROBE`);
      builder.addResistor(probeNode, lightB, this.bulbResistances[`${p}LIGHT${sec}`], `${p}LIGHT${sec}`);
    }

    // Add all relays
    for (let i = 1; i <= this.sectionCount; i++) {
      const { p, sec } = this._loc(i);
      const lampInput = `${p}Relay${sec}_IndicatorLamp_Input`;
      const lampProbeNode = `${p}Relay${sec}_LampProbe`;
      const coilInput = `${p}Relay${sec}_Coil_Input`;
      const coilOutput = `${p}Relay${sec}_Coil_Output`;
      const coilProbeNode = `${p}Relay${sec}_CoilProbe`;

      // the indicator lamp is a SERIES feed from its own jack into the coil
      // input: with the lamp jack unwired it can never conduct, wired or not
      // coil — so the lamp (and its probe unknown) is emitted only when its
      // jack is touched; the coil block whenever any of the three coil-path
      // jacks is (a lamp-only wiring still conducts THROUGH the coil).
      const lampWired = touched(lampInput);
      if (lampWired) {
        builder.addCurrentProbe(lampInput, lampProbeNode, `${p}RELAY${sec}_INDICATOR_LAMP_PROBE`);
        builder.addResistor(lampProbeNode, coilInput, this.bulbResistances[`${p}LAMP${sec}`], `${p}RELAY${sec}_INDICATOR_LAMP`);
      }
      if (lampWired || touched(coilInput, coilOutput)) {
        builder.addCurrentProbe(coilInput, coilProbeNode, `${p}RELAY${sec}_COIL_PROBE`);
        builder.addResistor(coilProbeNode, coilOutput, RELAY_COIL_RESISTANCE, `${p}RELAY${sec}_COIL`);
      }

      const h1 = `${p}Relay${sec}_Contact1_Common`;
      const g1 = `${p}Relay${sec}_Contact1_NO`;
      const j1 = `${p}Relay${sec}_Contact1_NC`;

      // Use override state if present, otherwise use simulated relay state
      const effectiveRelayState = this.relayOverrides[i - 1] !== null
        ? this.relayOverrides[i - 1]
        : this.relayStates[i - 1];

      if (touched(h1, g1, j1)) {
        if (effectiveRelayState) {
          builder.addWire(h1, g1, `${p}RELAY${sec}_CONTACT1_NO_CLOSED`);
        } else {
          builder.addWire(h1, j1, `${p}RELAY${sec}_CONTACT1_NC_CLOSED`);
        }
      }

      const l2 = `${p}Relay${sec}_Contact2_Common`;
      const k2 = `${p}Relay${sec}_Contact2_NO`;
      const n2 = `${p}Relay${sec}_Contact2_NC`;

      if (touched(l2, k2, n2)) {
        if (effectiveRelayState) {
          builder.addWire(l2, k2, `${p}RELAY${sec}_CONTACT2_NO_CLOSED`);
        } else {
          builder.addWire(l2, n2, `${p}RELAY${sec}_CONTACT2_NC_CLOSED`);
        }
      }
    }

    // Add the wired pushbuttons
    for (let i = 1; i <= this.sectionCount; i++) {
      const { p, sec } = this._loc(i);
      const y = `${p}Button${sec}_Common`;
      const x = `${p}Button${sec}_NormallyOpen`;
      const z = `${p}Button${sec}_NormallyClosed`;
      if (!touched(y, x, z)) continue;

      if (this.buttonStates[i - 1]) {
        builder.addWire(y, x, `${p}BUTTON${sec}_NO_CLOSED`);
      } else {
        builder.addWire(y, z, `${p}BUTTON${sec}_NC_CLOSED`);
      }
    }

    // Add the wired slide switches (each set trims independently)
    for (let i = 1; i <= this.sectionCount; i++) {
      const { p, sec } = this._loc(i);
      const s = `${p}Slide${sec}_Common1`;
      const r = `${p}Slide${sec}_Left1`;
      const t = `${p}Slide${sec}_Right1`;
      const v = `${p}Slide${sec}_Common2`;
      const u = `${p}Slide${sec}_Left2`;
      const w = `${p}Slide${sec}_Right2`;

      if (touched(s, r, t)) {
        builder.addWire(s, this.slideStates[i - 1] ? t : r, `${p}SLIDE${sec}_SET1_${this.slideStates[i - 1] ? 'RIGHT' : 'LEFT'}`);
      }
      if (touched(v, u, w)) {
        builder.addWire(v, this.slideStates[i - 1] ? w : u, `${p}SLIDE${sec}_SET2_${this.slideStates[i - 1] ? 'RIGHT' : 'LEFT'}`);
      }
    }

    // Add the motor circuit when any of its jacks is wired
    if (touched('Motor_D16', 'Motor_D17', 'Motor_D18', 'Motor_D19')) {
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
    }

    // Add user-defined wires
    for (let i = 0; i < this.wires.length; i++) {
      const [term1, term2] = this.wires[i];
      builder.addWire(term1, term2, `USER_WIRE_${i + 1}`);
    }

    // External resistors (book VII kit: clipped between jacks)
    for (let i = 0; i < this.externalResistors.length; i++) {
      const [n1, n2, ohms] = this.externalResistors[i];
      builder.addResistor(n1, n2, ohms, `EXT_RESISTOR_${i + 1}`);
    }

    // Internal capacitors, one per section that is actually wired to.
    // Backward-Euler companion: stored-voltage source in series with dt/C.
    // (wiredNodes is hoisted above — the whole builder trims by it now)
    for (let i = 1; i <= this.sectionCount; i++) {
      const { p, sec } = this._loc(i);
      const capNode = `${p}Capacitor_${sec}`;
      if (!wiredNodes.has(capNode)) continue;
      const probeNode = `${p}Capacitor_${sec}_Probe`;
      const srcNode = `${p}Capacitor_${sec}_Source`;
      builder.addCurrentProbe(capNode, probeNode, `${p}CAP${sec}_PROBE`);
      builder.addResistor(probeNode, srcNode, this.capDtSeconds / CAPACITOR_FARADS[sec - 1], `${p}CAP${sec}_REQ`);
      ckt.v(builder.getNode(srcNode), gnd, this.capVoltages[i - 1].toString(), `${p}CAP${sec}_V`);
    }

    return { circuit: ckt, builder };
  }

  /**
   * Advance the motor by wall-clock time (resimulating if its position or contact
   * state changed) and return the state version. The version bumps on every solve,
   * so the UI can skip all per-frame allocation when nothing has changed —
   * getState() builds a fresh ~10-array object, which at 120fps is pure GC churn.
   */
  tick(): number {
    if (this._updateMotorPosition()) {
      this._simulate();
    }
    return this.stateVersion;
  }

  private _simulate(): boolean {
    alerts.length = 0;
    this.stateVersion++;

    let iteration = 0;
    // bulb relaxation (1% tolerance) needs ~5 iterations on top of relay settling;
    // budget scales with total relay count so deep multivac cascades can converge
    // (a k-relay chain legitimately takes ~k iterations, one flip per iteration)
    const maxIterations = Math.max(20, this.sectionCount + 10);
    // a relay flipping REPEATEDLY this deep into the relaxation is genuinely
    // chattering (verified on a real Minivac 601: the book IV single-input
    // flip-flop physically buzzes at this exact condition). a buzzing armature
    // never seats its contacts, so chattering relays are pinned de-energized and
    // the rest of the circuit settles. the >=3 flip-count requirement keeps
    // long one-way cascades (which flip each relay only once) from being pinned.
    const chatterPinIteration = 14;
    const flipCounts = new Array(this.sectionCount).fill(0);
    const pinnedChatter = new Set<number>();  // relay indices (0-based) pinned off

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
      this.lastResults = results;

      if (!results) {
        console.error('❌ DC analysis failed!');
        if (alerts.length > 0) {
          alerts.forEach(alert => console.error('  ' + alert));
        }
        return false;
      }

      // Extract new relay states and currents
      const newRelayStates: boolean[] = [];
      const newRelayCurrents: number[] = [];
      for (let i = 1; i <= this.sectionCount; i++) {
        const { p, sec } = this._loc(i);
        const current = Math.abs(results[`I(${p}RELAY${sec}_COIL_PROBE)`] || 0);
        // hysteresis: an energized relay holds down to the (lower) dropout current
        const energized = pinnedChatter.has(i - 1)
          ? false
          : this.relayStates[i - 1]
            ? current >= RELAY_DROPOUT_CURRENT
            : current >= RELAY_PICKUP_CURRENT;
        newRelayStates.push(energized);
        newRelayCurrents.push(current * 1000);  // Store in mA
      }

      // Store relay currents
      this.relayCurrents = newRelayCurrents;

      // Check if relay states changed
      let changed = false;
      const flippedNow: number[] = [];
      for (let i = 0; i < this.sectionCount; i++) {
        if (this.relayStates[i] !== newRelayStates[i]) {
          changed = true;
          flippedNow.push(i);
          if (this.verbose) {
            const { p, sec } = this._loc(i + 1);
            console.log(`  Relay ${p}${sec}: ${this.relayStates[i] ? 'ON' : 'OFF'} -> ${newRelayStates[i] ? 'ON' : 'OFF'} (${newRelayCurrents[i].toFixed(3)} mA)`);
          }
        }
      }

      this.relayStates = newRelayStates;

      // Relays still flipping this deep into the relaxation are chattering — buzz them
      // (alert, since the real machine audibly buzzes here) and pin them de-energized
      // so the rest of the circuit can settle.
      for (const i of flippedNow) flipCounts[i]++;
      if (changed && iteration >= chatterPinIteration) {
        const chattering = flippedNow.filter(i => flipCounts[i] >= 3);
        if (chattering.length > 0) {
          const message = 'RELAY OSCILLATION DETECTED!';
          if (!alerts.includes(message)) {
            alerts.push(message);
            console.warn(`${message} Relay(s) ${chattering.map(i => i + 1).join(', ')} are chattering; resolving to de-energized (a buzzing armature never seats its contacts)`);
          }
          for (const i of chattering) {
            pinnedChatter.add(i);
            this.relayStates[i] = false;
          }
        }
      }

      // Extract light states
      for (let i = 1; i <= this.sectionCount; i++) {
        const { p, sec } = this._loc(i);
        const current = Math.abs(results[`I(${p}LIGHT${sec}_PROBE)`] || 0);
        this.lightStates[i - 1] = current >= LIGHT_ON_CURRENT;
      }

      // Extract relay indicator light states
      for (let i = 1; i <= this.sectionCount; i++) {
        const { p, sec } = this._loc(i);
        const current = Math.abs(results[`I(${p}RELAY${sec}_INDICATOR_LAMP_PROBE)`] || 0);
        this.relayIndicatorLightStates[i - 1] = current >= LIGHT_ON_CURRENT;
      }

      // Relax bulb resistances toward the measured i-v curve at their present voltage
      let bulbsConverged = true;
      for (let i = 1; i <= this.sectionCount; i++) {
        const { p, sec } = this._loc(i);
        const probes: Array<[string, string]> = [
          [`${p}LIGHT${sec}`, `I(${p}LIGHT${sec}_PROBE)`],
          [`${p}LAMP${sec}`, `I(${p}RELAY${sec}_INDICATOR_LAMP_PROBE)`],
        ];
        for (const [key, probe] of probes) {
          const oldR = this.bulbResistances[key];
          const volts = Math.abs(results[probe] || 0) * oldR;
          // undamped: the R(V) map contracts (sensitivity <= 0.375/iteration), so this
          // converges geometrically without oscillating
          const newR = bulbResistanceAtVoltage(volts);
          if (Math.abs(newR - oldR) / oldR > 0.01) {
            bulbsConverged = false;
          }
          this.bulbResistances[key] = newR;
          const brightness = bulbBrightnessAtVoltage(volts);
          if (key.includes('LIGHT')) {
            this.lightBrightness[i - 1] = brightness;
          } else {
            this.relayIndicatorBrightness[i - 1] = brightness;
          }
        }
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

      if (!changed && bulbsConverged) {
        // Check for short circuit only at the converged (warm-bulb) solution — cold-bulb
        // warm-up inrush legitimately exceeds this for the first iterations. At real
        // measured currents a busy panel draws ~1A (e.g. 3 coils + 3 lights ≈ 0.97A) and
        // everything-on computes ~2.2A, while a true short is limited only by supply
        // internal + wire resistance (≥ ~4.6A, typically ~6.6A).
        for (let m = 0; m < this.machineCount; m++) {
          const p = m === 0 ? '' : `m${m}.`;
          const powerCurrent = Math.abs(results[`I(${p}V_POWER)`] || 0);
          if (powerCurrent > 3.5) {
            const message = 'SHORT CIRCUIT DETECTED!';
            if (!alerts.includes(message)) {
              alerts.push(message);
            }
            console.warn(`${message} Power supply current: ${powerCurrent.toFixed(2)}A (normal: <2.5A)`);
          }
        }
        if (this.verbose) console.log('  Relay states and bulb resistances stable!');
        this.lastRelaxationIterations = iteration + 1;
        return true;
      }

      iteration++;
    }

    // Maximum iterations reached - likely relay oscillation
    this.lastRelaxationIterations = maxIterations;
    const message = 'RELAY OSCILLATION DETECTED!';
    if (!alerts.includes(message)) {
      alerts.push(message);
    }
    if (this.verbose) console.log('⚠️  Maximum iterations reached');
    console.warn(`${message} Circuit did not stabilize after ${maxIterations} iterations (relays may be oscillating)`);
    return false;
  }

  /**
   * Add an external resistor between two jacks (book VII kit resistors),
   * e.g. addExternalResistor('1J', '1X', 22).
   */
  addExternalResistor(term1: string, term2: string, ohms: number): void {
    this.externalResistors.push([
      parseTerminalIdentifier(term1),
      parseTerminalIdentifier(term2),
      ohms,
    ]);
  }

  /** Stored voltage of a section's internal capacitor (for tests/debugging). */
  getCapVoltage(sectionNum: number): number {
    return this.capVoltages[sectionNum - 1];
  }

  /**
   * Advance simulated time by dtMs, letting capacitors charge/discharge.
   * Uses the backward-Euler companion (series dt/C) for the solve, then
   * integrates each capacitor's current into its stored voltage.
   */
  stepTime(dtMs: number): void {
    const dt = dtMs / 1000;
    this.capDtSeconds = dt;
    this._simulate();
    for (let i = 1; i <= this.sectionCount; i++) {
      const { p, sec } = this._loc(i);
      const current = this.lastResults?.[`I(${p}CAP${sec}_PROBE)`];
      if (current !== undefined) {
        this.capVoltages[i - 1] += (current * dt) / CAPACITOR_FARADS[sec - 1];
      }
    }
    this.capDtSeconds = CAP_EVENT_DT_SECONDS;
  }

  pressButton(buttonNum: number, machine = 0): void {
    if (buttonNum < 1 || buttonNum > 6) {
      throw new Error(`Invalid button number: ${buttonNum}`);
    }
    if (this.verbose) console.log(`\n🔘 Press button ${buttonNum} (machine ${machine})`);
    this.buttonStates[machine * 6 + buttonNum - 1] = true;
    this._simulate();
    if (this.verbose) this._printState();
  }

  releaseButton(buttonNum: number, machine = 0): void {
    if (buttonNum < 1 || buttonNum > 6) {
      throw new Error(`Invalid button number: ${buttonNum}`);
    }
    if (this.verbose) console.log(`\n🔘 Release button ${buttonNum} (machine ${machine})`);
    this.buttonStates[machine * 6 + buttonNum - 1] = false;
    this._simulate();
    if (this.verbose) this._printState();
  }

  setSlide(slideNum: number, position: 'left' | 'right', machine = 0): void {
    if (slideNum < 1 || slideNum > 6) {
      throw new Error(`Invalid slide number: ${slideNum}`);
    }
    const idx = machine * 6 + slideNum - 1;
    const newState = position === 'right';
    const oldState = this.slideStates[idx];

    if (oldState !== newState) {
      if (this.verbose) console.log(`\n🔀 Slide switch ${slideNum} (machine ${machine}) moved to ${position.toUpperCase()}`);
      this.slideStates[idx] = newState;
      this._simulate();
      if (this.verbose) this._printState();
    }
  }

  /** Per-machine slice of the flat state arrays (for multivac tests/tools). */
  getMachineState(machine: number): {
    relays: boolean[]; lights: boolean[]; relayIndicatorLights: boolean[];
    buttons: boolean[]; relayCurrents: number[];
  } {
    const a = machine * 6;
    const b = a + 6;
    return {
      relays: this.relayStates.slice(a, b),
      lights: this.lightStates.slice(a, b),
      relayIndicatorLights: this.relayIndicatorLightStates.slice(a, b),
      buttons: this.buttonStates.slice(a, b),
      relayCurrents: this.relayCurrents.slice(a, b),
    };
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

    // Compute effective relay states (override takes precedence)
    const effectiveRelayStates = this.relayStates.map((state, i) =>
      this.relayOverrides[i] !== null ? this.relayOverrides[i]! : state
    );

    return {
      relays: effectiveRelayStates,
      buttons: [...this.buttonStates],
      lights: [...this.lightStates],
      relayIndicatorLights: [...this.relayIndicatorLightStates],
      lightBrightness: [...this.lightBrightness],
      relayIndicatorBrightness: [...this.relayIndicatorBrightness],
      slides: this.slideStates.map(s => s ? 'right' : 'left'),
      motor: {
        position: this.motorPosition,
        angle: this.motorAngle,
        running: this.motorRunning,
        direction: this.motorDirection > 0 ? 'CW' : 'CCW',
      },
      alerts: [...alerts],
      relayCurrents: [...this.relayCurrents],
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

  // Manually override relay state (for manual relay control)
  setRelayOverride(relayNum: number, state: boolean): void {
    if (relayNum < 1 || relayNum > 6) {
      throw new Error(`Invalid relay number: ${relayNum}`);
    }
    if (this.verbose) console.log(`\n🔧 Manual override: Relay ${relayNum} → ${state ? 'ON' : 'OFF'}`);
    this.relayOverrides[relayNum - 1] = state;

    // Re-simulate to update relay contacts with new override state
    this._simulate();
  }

  // Clear manual relay override (return to simulation control)
  clearRelayOverride(relayNum: number): void {
    if (relayNum < 1 || relayNum > 6) {
      throw new Error(`Invalid relay number: ${relayNum}`);
    }
    if (this.verbose) console.log(`\n🔧 Clear override: Relay ${relayNum} → simulation control`);
    this.relayOverrides[relayNum - 1] = null;

    // Re-simulate to update relay contacts back to simulation control
    this._simulate();
  }

  // Set initial relay states (for restoring state when circuit is modified)
  // Call this BEFORE initialize() to preserve latched relay states
  setRelayStates(states: boolean[]): void {
    if (states.length !== 6) {
      throw new Error(`Expected 6 relay states, got ${states.length}`);
    }
    this.relayStates = [...states];
    if (this.verbose) console.log(`\n🔧 Set initial relay states: ${states.map((s, i) => `R${i+1}:${s?'ON':'OFF'}`).join(' ')}`);
  }

  // Reset simulator to initial state (all relays off, buttons up, motor at position 0)
  reset(): void {
    const n = this.sectionCount;
    this.buttonStates = new Array(n).fill(false);
    this.relayStates = new Array(n).fill(false);
    this.relayCurrents = new Array(n).fill(0);
    this.relayOverrides = new Array(n).fill(null);
    this.lightStates = new Array(n).fill(false);
    this.relayIndicatorLightStates = new Array(n).fill(false);
    this.lightBrightness = new Array(n).fill(0);
    this.relayIndicatorBrightness = new Array(n).fill(0);
    this.capVoltages = new Array(n).fill(0);
    this.bulbResistances = {};
    for (let i = 1; i <= n; i++) {
      const { p, sec } = this._loc(i);
      this.bulbResistances[`${p}LIGHT${sec}`] = BULB_INITIAL_RESISTANCE;
      this.bulbResistances[`${p}LAMP${sec}`] = BULB_INITIAL_RESISTANCE;
    }
    this.slideStates = new Array(n).fill(false);
    this.motorPosition = 0;
    this.motorAngle = 0;
    this.motorRunning = false;
    this.motorDirection = 1;
    this.lastMotorUpdateTime = null;
    this.lastMotorContactState = true;

    if (this.verbose) console.log('\n🔄 Simulator reset to initial state');
  }
}
