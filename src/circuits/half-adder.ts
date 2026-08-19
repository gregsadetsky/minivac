/**
 * Half-Adder with Carry (Book 2-4, Experiment 4, page 75)
 *
 * - Slide switch 6 = input A (LEFT = 1)
 * - Button 6 = input B (pressed = 1)
 * - Light 6 = sum, Light 5 = carry out
 *
 * Wire list transcribed verbatim from the manual and independently
 * cross-validated against the scan (2026-08-18).
 */

export const halfAdderCircuit = {
  name: 'Half-Adder',
  description: 'Slide 6 = A, button 6 = B; light 6 = sum, light 5 = carry',
  circuit: ['5A/6U', '5B/5-', '6A/6S', '6B/6-', '6R/6Z', '6T/6X', '6T/6V', '6Y/6+'],
};
