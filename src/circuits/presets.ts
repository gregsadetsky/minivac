/**
 * Circuit Presets for Landing Page Embeds
 *
 * These are simplified circuit configurations used for embedded demos
 * on the landing page. They're exported as string arrays for easy use.
 */

import { threeBitCounterCircuit } from './three-bit-counter';
import { elevatorCircuit } from './elevator-3floor';

/**
 * 3-bit binary counter - counts from 0-7 when button 6 is pressed
 * Used in hero section with auto-play
 */
export const THREEBIT_COUNTER = threeBitCounterCircuit.circuit;

/**
 * 3-floor elevator controller - press buttons 1, 2, or 3 to call elevator
 * Used in interactive elevator demo section
 */
export const ELEVATOR_3FLOOR = elevatorCircuit.circuit;

/**
 * Simple button → relay → light circuit for Exercise 1
 * "Ring the Bell" - demonstrates basic relay operation
 */
export const SIMPLE_BELL = [
  '1Y/1+',  // Button 1 Y-contact to power
  '1X/1C',  // Button 1 NO-contact to relay 1 coil
  '1C/1-',  // Relay 1 coil to ground
  '1+/1A',  // Power to light 1 input
  '1G/1B',  // Relay 1 NO-contact to light 1 output
  '1B/1-',  // Light 1 output to ground
];

/**
 * AND gate using two buttons
 * Light only turns on when BOTH buttons are pressed
 */
export const AND_GATE = [
  '1Y/1+',   // Button 1 to power
  '1X/2Y',   // Button 1 NO → Button 2 Y
  '2X/1C',   // Button 2 NO → Relay 1 coil
  '1C/1-',   // Relay coil to ground
  '1+/1A',   // Power to light
  '1G/1B',   // Relay NO to light
  '1B/1-',   // Light to ground
];
