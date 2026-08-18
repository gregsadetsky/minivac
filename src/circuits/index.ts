/**
 * Circuit Registry
 *
 * Single source of truth for all sample circuits.
 * Used by both tests and UI components.
 */

import { elevatorCircuit } from './elevator-3floor';
import { fullAdderCircuit } from './full-adder';
import { halfAdderCircuit } from './half-adder';
import { morseTransmitterCircuit } from './morse-transmitter';
import { ocrDigitRecognitionCircuit } from './ocr-digit-recognition';
import { threeBitAdderCircuit } from './three-bit-adder';
import { threeBitCounterCircuit } from './three-bit-counter';

// Re-export individual circuits
export { elevatorCircuit } from './elevator-3floor';
export { fullAdderCircuit } from './full-adder';
export { halfAdderCircuit } from './half-adder';
export { morseTransmitterCircuit } from './morse-transmitter';
export { ocrDigitRecognitionCircuit } from './ocr-digit-recognition';
export { threeBitAdderCircuit } from './three-bit-adder';
export { threeBitCounterCircuit } from './three-bit-counter';

// Export as a map for easy iteration in UI
export const SAMPLE_CIRCUITS = {
  elevator: elevatorCircuit,
  morse: morseTransmitterCircuit,
  ocr: ocrDigitRecognitionCircuit,
  counter: threeBitCounterCircuit,
  halfAdder: halfAdderCircuit,
  fullAdder: fullAdderCircuit,
  adder: threeBitAdderCircuit,
} as const;
