import { type CableData } from './wire-utils';

export function updateUrlWithCircuit(cables: CableData[]): void {
  // Convert cables to simple Minivac notation separated by spaces
  const notation = cables
    .filter(cable => cable.holeIds && cable.holeIds.length === 2)
    .map(cable => `${cable.holeIds![0]}/${cable.holeIds![1]}`)
    .join(' ');

  if (notation.length === 0) {
    // Clear hash if no wires
    window.history.replaceState(null, '', window.location.pathname);
    return;
  }

  const newUrl = `${window.location.pathname}#wires=${encodeURIComponent(notation)}`;
  // Use replaceState to avoid polluting browser history
  window.history.replaceState(null, '', newUrl);
}

export function getCircuitFromUrl(): string[] {
  const hash = window.location.hash;

  if (!hash.startsWith('#wires=')) {
    return [];
  }
  const encoded = hash.substring(7); // Remove '#wires='

  const notation = decodeURIComponent(encoded);

  // Parse space-separated connections
  const connections = notation
    .split(/[\s\n]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return connections;
}
