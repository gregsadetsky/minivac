/**
 * Tests for Minivac circuit notation parser
 */

import { describe, it, expect } from 'vitest';
import { parseTerminalIdentifier, parseMinivacNotation, parseMinivacNotationForUI } from '../circuit-notation-parser';

describe('Circuit Notation Parser', () => {
  describe('parseTerminalIdentifier', () => {
    it('should parse power rails', () => {
      expect(parseTerminalIdentifier('+')).toBe('Power_Positive');
      expect(parseTerminalIdentifier('-')).toBe('Power_Negative');
    });

    it('should parse motor terminals D0-D19', () => {
      expect(parseTerminalIdentifier('D0')).toBe('Motor_D0');
      expect(parseTerminalIdentifier('D4')).toBe('Motor_D4');
      expect(parseTerminalIdentifier('D16')).toBe('Motor_D16');
      expect(parseTerminalIdentifier('D19')).toBe('Motor_D19');
    });

    it('should parse common nodes', () => {
      expect(parseTerminalIdentifier('1com')).toBe('Common_1');
      expect(parseTerminalIdentifier('6com')).toBe('Common_6');
    });

    it('should parse section terminals', () => {
      expect(parseTerminalIdentifier('6A')).toBe('Light6_A');
      expect(parseTerminalIdentifier('6B')).toBe('Light6_B');
      expect(parseTerminalIdentifier('3J')).toBe('Relay3_Contact1_NC');
      expect(parseTerminalIdentifier('5A')).toBe('Light5_A');
      expect(parseTerminalIdentifier('6-')).toBe('Power_Negative');
    });

    it('should throw error for invalid section number', () => {
      expect(() => parseTerminalIdentifier('8+')).toThrow('Invalid section number');
      expect(() => parseTerminalIdentifier('8A')).toThrow('Invalid section number');
      expect(() => parseTerminalIdentifier('0A')).toThrow('Invalid section number');
      expect(() => parseTerminalIdentifier('7B')).toThrow('Invalid section number');
    });

    it('should throw error for invalid terminal letter', () => {
      expect(() => parseTerminalIdentifier('6Q')).toThrow('Invalid terminal letter');
      expect(() => parseTerminalIdentifier('1P')).toThrow('Invalid terminal letter');
    });

    it('should throw error for invalid motor terminal', () => {
      expect(() => parseTerminalIdentifier('D20')).toThrow('Invalid motor terminal');
      expect(() => parseTerminalIdentifier('D99')).toThrow('Invalid motor terminal');
      expect(() => parseTerminalIdentifier('DX')).toThrow('Invalid motor terminal');
    });
  });

  describe('parseMinivacNotation', () => {
    it('should parse valid circuit notation', () => {
      const circuit = ['6A/6com', 'D4/D5', '3J/6com', '5A/5com', '6B/6-'];
      const result = parseMinivacNotation(circuit);

      expect(result).toEqual([
        ['Light6_A', 'Common_6'],
        ['Motor_D4', 'Motor_D5'],
        ['Relay3_Contact1_NC', 'Common_6'],
        ['Light5_A', 'Common_5'],
        ['Light6_B', 'Power_Negative'],
      ]);
    });

    it('should parse motor circuit with buttons', () => {
      const circuit = [
        '6+/D16',
        'D2/6A',
        '6-/6B',
        'D1/5A',
        '5B/6B',
        '6+/5Y',
        '5X/D17',
        '5-/D18',
        '6-/6Y',
        '6X/D19',
      ];
      const result = parseMinivacNotation(circuit);

      expect(result).toHaveLength(10);
      expect(result[0]).toEqual(['Power_Positive', 'Motor_D16']);
      expect(result[1]).toEqual(['Motor_D2', 'Light6_A']);
      expect(result[6]).toEqual(['Button5_NormallyOpen', 'Motor_D17']);
    });

    it('should throw error for invalid wire format', () => {
      expect(() => parseMinivacNotation(['6A'])).toThrow('Invalid wire format');
      expect(() => parseMinivacNotation(['6A/6B/6C'])).toThrow('Invalid wire format');
    });

    it('should throw error for invalid terminals in circuit', () => {
      expect(() => parseMinivacNotation(['8+/6A'])).toThrow('Invalid section number');
      expect(() => parseMinivacNotation(['6A/8A'])).toThrow('Invalid section number');
      expect(() => parseMinivacNotation(['D99/6A'])).toThrow('Invalid motor terminal');
    });
  });

  describe('parseMinivacNotationForUI', () => {
    it('should return terminal identifiers for UI wiring', () => {
      const circuit = ['6A/6com', 'D4/D5', '3J/6com'];
      const result = parseMinivacNotationForUI(circuit);

      expect(result).toEqual([
        ['6A', '6com'],
        ['D4', 'D5'],
        ['3J', '6com'],
      ]);
    });

    it('should validate but preserve original notation', () => {
      const circuit = ['6A / 6com', ' D4/D5 ']; // with spaces
      const result = parseMinivacNotationForUI(circuit);

      expect(result).toEqual([
        ['6A', '6com'],
        ['D4', 'D5'],
      ]);
    });

    it('should throw error for invalid terminals', () => {
      expect(() => parseMinivacNotationForUI(['8A/6B'])).toThrow('Invalid section number');
    });
  });
});
