/**
 * Circuit Registry
 *
 * Single source of truth for all sample circuits.
 * Used by both tests and UI components.
 */

import { elevatorCircuit } from './elevator-3floor';
import { morseTransmitterCircuit } from './morse-transmitter';
import { ocrDigitRecognitionCircuit } from './ocr-digit-recognition';
import { threeBitCounterCircuit } from './three-bit-counter';

// Re-export individual circuits
export { elevatorCircuit } from './elevator-3floor';
export { morseTransmitterCircuit } from './morse-transmitter';
export { ocrDigitRecognitionCircuit } from './ocr-digit-recognition';
export { threeBitCounterCircuit } from './three-bit-counter';

// Export as a map for easy iteration in UI
export const SAMPLE_CIRCUITS = {
  elevator: elevatorCircuit,
  morse: morseTransmitterCircuit,
  ocr: ocrDigitRecognitionCircuit,
  counter: threeBitCounterCircuit,
} as const;
