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
  console.log('[getCircuitFromUrl] Raw hash:', hash);
  console.log('[getCircuitFromUrl] Hash length:', hash.length);
  console.log('[getCircuitFromUrl] Starts with #wires=?', hash.startsWith('#wires='));

  if (!hash.startsWith('#wires=')) {
    console.log('[getCircuitFromUrl] Hash does not start with #wires=, returning empty');
    return [];
  }
  const encoded = hash.substring(7); // Remove '#wires='
  console.log('[getCircuitFromUrl] Encoded part:', encoded);

  const notation = decodeURIComponent(encoded);
  console.log('[getCircuitFromUrl] Decoded notation:', notation);

  // Parse space-separated connections
  const connections = notation
    .split(/[\s\n]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log('[getCircuitFromUrl] Parsed connections count:', connections.length);
  console.log('[getCircuitFromUrl] First 3 connections:', connections.slice(0, 3));

  return connections;
}
