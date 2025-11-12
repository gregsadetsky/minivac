// TypeScript wrapper for cktsimvsp_sn.js
// Loads the circuit simulator for use in tests and Node.js

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import vm from 'vm';

// Mock i18n for circuit simulator
const i18n = {
  ckt_alert1: 'Warning!!! Circuit has a voltage source loop or shorted source.',
  ckt_alert2: 'Warning!!! Simulator might produce meaningless results with illegal circuits.'
};

// Capture alerts
export const alerts: string[] = [];
const alert = function(msg: string) {
  alerts.push(msg);
  console.log('⚠️  ALERT:', msg);
};

// Type definitions for the circuit simulator
export interface CircuitSimulator {
  Circuit: new () => Circuit;
}

export interface Circuit {
  gnd_node(): number;
  node(name: string, ntype: number, ic?: number): number;
  r(n1: number, n2: number, value: string, name: string): void;
  v(n1: number, n2: number, value: string, name: string): void;
  finalize(): boolean;
  dc(): Record<string, number> | null;
}

export const T_VOLTAGE = 0;
export const T_CURRENT = 1;

let cachedSimulator: CircuitSimulator | null = null;

export function loadSimulator(): CircuitSimulator {
  if (cachedSimulator) {
    return cachedSimulator;
  }

  // Read the simulator code
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const simulatorPath = join(__dirname, '../../public/cktsimvsp_sn.js');
  const simulatorCode = readFileSync(simulatorPath, 'utf8');

  // Create a sandbox with all necessary globals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sandbox: Record<string, any> = {
    console,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Function,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    ReferenceError,
    SyntaxError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    alert,
    i18n
  };

  // Create the context
  vm.createContext(sandbox);

  // Run the simulator code in the sandbox
  vm.runInContext(simulatorCode, sandbox);

  cachedSimulator = sandbox.cktsim as CircuitSimulator;
  return cachedSimulator;
}
