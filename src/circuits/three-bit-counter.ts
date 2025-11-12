/**
 * 3-Bit Binary Counter
 *
 * Counts from 0 to 7 in binary
 * - Lights 4, 5, 6 represent binary digits (L4=MSB, L6=LSB)
 * - Button 6: Increment counter (press and release to advance)
 * - Cycles through: 000 → 001 → 010 → 011 → 100 → 101 → 110 → 111 → 000
 *
 * Example readings:
 * - 000 = 0 (all lights off)
 * - 001 = 1 (only L6 on)
 * - 101 = 5 (L4 and L6 on)
 * - 111 = 7 (all lights on)
 */

export const threeBitCounterCircuit = {
  name: '3-Bit Binary Counter',
  description: 'Press button 6 to increment binary counter (lights 4-6)',
  circuit: [
    '1A/2E', '2C/2-', '3H/5A', '5F/6F', '1B/1C', '2E/2J', '3J/4H', '5F/5H',
    '1B/2B', '2G/2N', '3N/4N', '5G/5+', '1C/2C', '2H/3L', '4B/5B', '5H/6A',
    '1E/2G', '2L/2-', '4C/4-', '5J/6H', '1F/2F', '3A/6E', '4E/4J', '5N/6N',
    '1F/1H', '3B/4B', '4G/4N', '6C/6-', '1G/1+', '3C/4C', '4H/5L', '6E/6J',
    '1H/4A', '3E/4G', '4L/4-', '6G/6N', '1J/2H', '3F/3H', '5B/6B', '6H/6X',
    '2A/4E', '3F/4F', '5C/6C', '6L/6-', '2B/3B', '3G/3+', '5E/6G', '6Y/6+',
  ],
};
