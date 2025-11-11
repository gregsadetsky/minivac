// Browser-compatible TypeScript wrapper for cktsimvsp_sn.js
// Accesses the circuit simulator loaded via script tag in index.html

// Mock i18n for circuit simulator (must be set before cktsim is loaded)
declare global {
  interface Window {
    i18n: {
      ckt_alert1: string;
      ckt_alert2: string;
    };
    cktsim: CircuitSimulator;
    alert: (msg: string) => void;
  }
}

// Set up i18n on window before script loads
if (typeof window !== 'undefined' && !window.i18n) {
  window.i18n = {
    ckt_alert1: 'Warning!!! Circuit has a voltage source loop or shorted source.',
    ckt_alert2: 'Warning!!! Simulator might produce meaningless results with illegal circuits.'
  };
}

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

// Override window.alert to capture alerts
if (typeof window !== 'undefined' && !window.alert.toString().includes('alerts.push')) {
  const originalAlert = window.alert;
  window.alert = function(msg: string) {
    alerts.push(msg);
    originalAlert.call(window, msg);
  };
}

export function loadSimulator(): CircuitSimulator {
  if (typeof window === 'undefined') {
    throw new Error('Browser simulator loader can only be used in browser environment');
  }

  if (!window.cktsim) {
    throw new Error('Circuit simulator not loaded. Make sure cktsimvsp_sn.js is loaded via script tag.');
  }

  return window.cktsim;
}

export const alerts: string[] = [];
