// Universal loader that works in both Node and Browser environments

// Type definitions
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
export const alerts: string[] = [];

// Browser environment detection
const isBrowser = typeof window !== 'undefined';

// Override window.alert in browser to capture alerts
if (isBrowser && !window.alert.toString().includes('alerts.push')) {
  const originalAlert = window.alert;
  window.alert = function(msg: string) {
    alerts.push(msg);
    originalAlert.call(window, msg);
  };
}

export function loadSimulator(): CircuitSimulator {
  // Browser environment - access globally loaded cktsim
  if (isBrowser) {
    const globalWindow = window as typeof window & { cktsim?: CircuitSimulator };
    if (!globalWindow.cktsim) {
      throw new Error('Circuit simulator not loaded. Make sure cktsimvsp_sn.js is loaded via script tag.');
    }
    return globalWindow.cktsim;
  }

  // Node environment - load via fs
  // Wrapped in try-catch for bundler compatibility
  try {
    // These will only be available in Node environment
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vm = require('vm');

    // Path to cktsimvsp_sn.js in public directory
    const scriptPath = path.join(__dirname, '../../public/cktsimvsp_sn.js');
    const code = fs.readFileSync(scriptPath, 'utf8');

    // Mock i18n for Node
    const i18n = {
      ckt_alert1: 'Warning!!! Circuit has a voltage source loop or shorted source.',
      ckt_alert2: 'Warning!!! Simulator might produce meaningless results with illegal circuits.'
    };

    // Mock alert to capture messages
    const alert = (msg: string) => {
      alerts.push(msg);
    };

    const context = { i18n, alert, cktsim: undefined };
    vm.createContext(context);
    vm.runInContext(code, context);

    if (!context.cktsim) {
      throw new Error('Failed to load circuit simulator');
    }

    return context.cktsim;
  } catch (error) {
    throw new Error(`Failed to load circuit simulator in Node environment: ${error}`);
  }
}
