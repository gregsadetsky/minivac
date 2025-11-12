/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getCircuitFromUrl, updateUrlWithCircuit } from './circuit-url';
import { type CableData } from './wire-utils';

describe('Circuit URL Management', () => {
  beforeEach(() => {
    // Clear URL before each test
    window.history.replaceState(null, '', window.location.pathname);
  });

  describe('getCircuitFromUrl', () => {
    it('should parse circuit from URL hash', () => {
      window.location.hash = '#wires=1A%2F2B%203C%2F4D';

      const connections = getCircuitFromUrl();

      expect(connections).toEqual(['1A/2B', '3C/4D']);
    });

    it('should return empty array when no hash', () => {
      const connections = getCircuitFromUrl();

      expect(connections).toEqual([]);
    });

    it('should return empty array when hash does not start with #wires=', () => {
      window.location.hash = '#other=something';

      const connections = getCircuitFromUrl();

      expect(connections).toEqual([]);
    });

    it('should handle single connection', () => {
      window.location.hash = '#wires=M%2B%2F1-';

      const connections = getCircuitFromUrl();

      expect(connections).toEqual(['M+/1-']);
    });

    it('should handle URL encoded special characters', () => {
      window.location.hash = '#wires=M%2B%2F1-%20M7t%2FD14';

      const connections = getCircuitFromUrl();

      expect(connections).toEqual(['M+/1-', 'M7t/D14']);
    });
  });

  describe('updateUrlWithCircuit', () => {
    it('should update URL with cables', () => {
      const cables: CableData[] = [
        {
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
          color: '#cc3333',
          droop: 50,
          holeIds: ['1A', '2B']
        },
        {
          start: { x: 50, y: 50 },
          end: { x: 150, y: 150 },
          color: '#3366cc',
          droop: 60,
          holeIds: ['3C', '4D']
        }
      ];

      updateUrlWithCircuit(cables);

      expect(window.location.hash).toBe('#wires=1A%2F2B%203C%2F4D');
    });

    it('should clear hash when no cables', () => {
      // First set a hash
      window.location.hash = '#wires=1A%2F2B';

      updateUrlWithCircuit([]);

      expect(window.location.hash).toBe('');
    });

    it('should ignore cables without holeIds', () => {
      const cables: CableData[] = [
        {
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
          color: '#cc3333',
          droop: 50,
          holeIds: ['1A', '2B']
        },
        {
          start: { x: 50, y: 50 },
          end: { x: 150, y: 150 },
          color: '#3366cc',
          droop: 60
          // No holeIds
        }
      ];

      updateUrlWithCircuit(cables);

      expect(window.location.hash).toBe('#wires=1A%2F2B');
    });
  });

  describe('Round-trip', () => {
    it('should preserve circuit through URL encode/decode cycle', () => {
      const originalCables: CableData[] = [
        {
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
          color: '#cc3333',
          droop: 50,
          holeIds: ['M+', '1-']
        },
        {
          start: { x: 50, y: 50 },
          end: { x: 150, y: 150 },
          color: '#3366cc',
          droop: 60,
          holeIds: ['M7t', 'D14']
        }
      ];

      // Encode to URL
      updateUrlWithCircuit(originalCables);

      // Decode from URL
      const connections = getCircuitFromUrl();

      expect(connections).toEqual(['M+/1-', 'M7t/D14']);
    });
  });
});
