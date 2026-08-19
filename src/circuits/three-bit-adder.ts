/**
 * Three-Bit Adder (Book 2-4, Experiment 6, page 77)
 *
 * Three full adders sharing five relays (relays 2-6; relay 1 is unused).
 * - Slide switches 4-6 = first number (LEFT = 1; slide 4 is the high bit)
 * - Buttons 4-6 = second number (hold pressed = 1; button 4 is the high bit)
 * - Answer on lights 3 (MSB), 4, 5, 6 (LSB) — e.g. lights 3+6 on = 1001 = 9
 *
 * The M10 connections are the "end-around carry", used when the adder is
 * converted to a subtractor in experiment 7 (per the book's errata sheet).
 *
 * Wire list transcribed verbatim from the manual and independently
 * cross-validated against the scan (2026-08-18). Verified: all 64 sums
 * correct (see tests/adder-circuits.test.ts). github issue #8 traced to a
 * miswired reproduction (5Y wired to 5V instead of 6V), not the book.
 */

export const threeBitAdderCircuit = {
  name: '3-Bit Adder',
  description: 'Slides 4-6 = first number (left = 1), hold buttons 4-6 = second; result on lights 3-6',
  circuit: [
    '2C/3G', '2F/3F', '2G/4S', '2H/4Y', '2K/4W', '2L/2+', '2N/4U', '3A/M10',
    '3B/3-', '3C/4G', '3F/4E', '3G/3N', '3H/4Z', '3J/4T', '3K/4R', '3K/M10',
    '3L/4X', '4A/4V', '4B/4-', '4E/5F', '4F/5S', '4G/5U', '4H/4N', '4K/5Z',
    '4L/5A', '4N/5X', '4Y/5Y', '5B/5-', '5C/6K', '5F/6E', '5G/6S', '5H/5+',
    '5K/6W', '5L/6A', '5N/6U', '5R/6T', '5T/6R', '5T/5V', '5Y/6V', '6B/6-',
    '6E/6-', '6G/6R', '6H/6X', '6J/6K', '6L/6Z', '6N/6T', '6V/6Y', '6Y/6+',
  ],
};
