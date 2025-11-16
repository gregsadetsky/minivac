/**
 * Minivac Circuit Notation Parser
 * Parses Minivac terminal notation (e.g., "6A", "D16", "3J") into internal node names
 */

/**
 * Parse terminal identifier from Minivac notation
 * @param identifier - Terminal identifier (e.g., "6A", "D16", "3J", "6com", "+", "-")
 * @returns Internal node name (e.g., "Light6_A", "Motor_D16", "Relay3_Contact1_NC")
 * @throws Error if identifier is invalid
 */
export function parseTerminalIdentifier(identifier: string): string {
  const trimmed = identifier.trim();

  // Power rails
  if (trimmed === '+') return 'Power_Positive';
  if (trimmed === '-' || trimmed === '—') return 'Power_Negative';

  // Motor terminals (D0-D19)
  if (trimmed.startsWith('D')) {
    const motorNum = parseInt(trimmed.substring(1), 10);
    if (!isNaN(motorNum) && motorNum >= 0 && motorNum <= 19) {
      return `Motor_D${motorNum}`;
    }
    throw new Error(`Invalid motor terminal: "${identifier}"`);
  }

  // Matrix terminals
  if (trimmed.startsWith('M')) {
    const rest = trimmed.substring(1);

    // M+ and M-
    if (rest === '+') return 'Power_Positive';
    if (rest === '-' || rest === '—') return 'Power_Negative';

    // M10 or M11
    if (rest === '10') return 'Matrix_M10';
    if (rest === '11') return 'Matrix_M11';

    // M1t, M1b through M9t, M9b
    const matrixMatch = rest.match(/^([1-9])(t|b)$/i);
    if (matrixMatch) {
      const num = matrixMatch[1];
      const position = matrixMatch[2].toLowerCase() === 't' ? 'Top' : 'Bottom';
      return `Matrix_M${num}_${position}`;
    }

    throw new Error(`Invalid matrix terminal: "${identifier}"`);
  }

  // Common nodes
  const comMatch = trimmed.match(/^([1-6])com$/i);
  if (comMatch) {
    const num = comMatch[1];
    return `Common_${num}`;
  }

  if (trimmed.length < 2) {
    throw new Error(`Invalid terminal identifier: "${identifier}"`);
  }

  const sectionNum = parseInt(trimmed[0], 10);
  if (isNaN(sectionNum) || sectionNum < 1 || sectionNum > 6) {
    throw new Error(`Invalid section number: "${trimmed[0]}"`);
  }

  const letter = trimmed.substring(1).toUpperCase();

  const mappings: Record<string, string> = {
    '+': 'Power_Positive',
    '-': 'Power_Negative',
    'A': `Light${sectionNum}_A`,
    'B': `Light${sectionNum}_B`,
    'C': `Relay${sectionNum}_IndicatorLamp_Input`,
    'E': `Relay${sectionNum}_Coil_Input`,
    'F': `Relay${sectionNum}_Coil_Output`,
    'G': `Relay${sectionNum}_Contact1_NO`,
    'H': `Relay${sectionNum}_Contact1_Common`,
    'J': `Relay${sectionNum}_Contact1_NC`,
    'K': `Relay${sectionNum}_Contact2_NO`,
    'L': `Relay${sectionNum}_Contact2_Common`,
    'N': `Relay${sectionNum}_Contact2_NC`,
    'R': `Slide${sectionNum}_Left1`,
    'S': `Slide${sectionNum}_Common1`,
    'T': `Slide${sectionNum}_Right1`,
    'U': `Slide${sectionNum}_Left2`,
    'V': `Slide${sectionNum}_Common2`,
    'W': `Slide${sectionNum}_Right2`,
    'X': `Button${sectionNum}_NormallyOpen`,
    'Y': `Button${sectionNum}_Common`,
    'Z': `Button${sectionNum}_NormallyClosed`,
  };

  if (!(letter in mappings)) {
    throw new Error(`Invalid terminal letter: "${letter}"`);
  }

  return mappings[letter];
}

/**
 * Parse Minivac notation into wire pairs
 * @param instructions - Array of wire instructions (e.g., ["6A/6com", "D4/D5"])
 * @returns Array of wire pairs as internal node names
 * @throws Error if any instruction is invalid
 */
export function parseMinivacNotation(instructions: string[]): Array<[string, string]> {
  const wires: Array<[string, string]> = [];
  for (const instruction of instructions) {
    const parts = instruction.trim().split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid wire format: "${instruction}"`);
    }
    const term1 = parseTerminalIdentifier(parts[0]);
    const term2 = parseTerminalIdentifier(parts[1]);
    wires.push([term1, term2]);
  }
  return wires;
}

/**
 * Parse Minivac notation and return terminal identifiers (for UI wiring)
 * @param instructions - Array of wire instructions (e.g., ["6A/6com", "D4/D5"])
 * @returns Array of wire pairs as terminal identifiers (not internal node names)
 */
export function parseMinivacNotationForUI(instructions: string[]): Array<[string, string]> {
  const wires: Array<[string, string]> = [];
  for (const instruction of instructions) {
    const parts = instruction.trim().split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid wire format: "${instruction}"`);
    }
    // Validate by parsing, but return the original terminal identifiers
    parseTerminalIdentifier(parts[0]);
    parseTerminalIdentifier(parts[1]);
    wires.push([parts[0].trim(), parts[1].trim()]);
  }
  return wires;
}
