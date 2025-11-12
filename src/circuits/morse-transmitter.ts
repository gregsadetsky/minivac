/**
 * Automatic Morse Code Transmitter
 *
 * Transmits "JOHN" in Morse code automatically
 * - Light 5 ON = dash (-)
 * - Light 6 ON = dot (.)
 *
 * Controls:
 * - Button 6: Start transmission
 *
 * Morse code:
 * - J = . - - -
 * - O = - - -
 * - H = . . . .
 * - N = - .
 */

export const morseTransmitterCircuit = {
  name: 'Morse Code Transmitter',
  description: 'Press button 6 to transmit "JOHN" in Morse code',
  circuit: [
    '3C/4C', '4F/5N', '5L/D0', '6H/6+', '3F/4G', '4H/5H', '5X/6E', '6H/6Y',
    '3G/3K', '4K/5F', '5Y/6Y', '6com/D2', '3G/5com', '4L/D15', '5com/D11', 'D3/D4',
    '3H/D12', '4N/5E', '6A/6com', 'D4/D5', '3J/6com', '5A/5com', '6B/6-', 'D5/D12',
    '3L/D13', '5B/6B', '6C/6-', 'D16/D17', '4C/5C', '5C/6C', '6F/6G', 'D18/M-',
    '4E/5K', '5F/5G', '6F/6X', '4F/4G', '5H/5+', '6G/D17',
  ],
};
