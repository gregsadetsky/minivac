/**
 * Full Adder (Book 2-4, Experiment 5, page 76)
 *
 * Two half-adders plus an OR circuit.
 * - Slide switch 6 = input A (LEFT = 1)
 * - Button 6 = input B (pressed = 1)
 * - Relay 6 = carry in (click and hold the relay to set carry in = 1)
 * - Light 6 = sum, Light 5 = carry out
 *
 * Wire list transcribed verbatim from the manual and independently
 * cross-validated against the scan (2026-08-18).
 */

export const fullAdderCircuit = {
  name: 'Full Adder',
  description: 'Slide 6 = A, button 6 = B, hold relay 6 = carry in; light 6 = sum, light 5 = carry',
  circuit: [
    '5A/6U', '5B/5-', '5C/6S', '5F/5-', '5G/6J',
    '5H/5+', '5J/6G', '6A/6H', '6B/6-', '6J/6L',
    '6K/6U', '6R/6Z', '6T/6X', '6T/6V', '6Y/6+',
  ],
};
