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


