/**
 * OCR Digit Recognition
 *
 * "Draw" a digit on matrix terminals M1t-M9t by connecting M10 to specific positions
 * - Each digit has a unique pattern (like 7-segment display encoding)
 * - Press button 6 to recognize the digit
 * - Motor moves to position D0-D9 corresponding to recognized digit
 *
 * This is the base circuit. Connect M10 to different matrix terminals
 * to test recognition. For example:
 * - Digit 0: M10 to M2t, M4t, M6t, M8t
 * - Digit 1: M10 to M2t, M6t, M9t
 * - etc.
 */

export const ocrDigitRecognitionCircuit = {
  name: 'OCR Digit Recognition',
  description: 'Connect M10 to matrix terminals to draw digits, press button 6 to recognize',
  circuit: [
    '1C/2C', '3C/4C', '4H/5J', '6H/6-', '1F/M9t', '3F/M6t', '4L/5K', '6X/M10',
    '1G/6com', '3G/D6', '5C/6C', '6X/D17', '1H/4K', '3H/4N', '5F/M4t', '6Y/6+',
    '1J/D0', '3J/D9', '5G/D5', '6com/D4', '2C/3C', '3K/D8', '5H/6G', 'M10/M11',
    '2F/M5t', '3L/4J', '5L/6J', 'D16/D19', '2G/D2', '3N/D7', '5N/D1', 'D18/M-',
    '2H/4G', '4C/5C', '6C/6-', '2J/D3', '4F/M8t', '6F/M7t',
  ],
};
