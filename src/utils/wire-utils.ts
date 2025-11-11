/**
 * Wire utility functions for cable generation and positioning
 */

export interface CableData {
  start: { x: number; y: number };
  end: { x: number; y: number };
  color: string;
  droop: number;
}

export interface Position {
  x: number;
  y: number;
}

/**
 * Calculate relative position of an element within a container
 * @param element - The DOM element to position
 * @param container - The container element
 * @param containerRect - Pre-calculated container bounding rect (for performance)
 * @returns Position relative to container
 */
export function getRelativePosition(
  element: Element,
  container: HTMLDivElement,
  containerRect: DOMRect
): Position {
  const elemRect = element.getBoundingClientRect();
  return {
    x: elemRect.left - containerRect.left + elemRect.width / 2 - 5,
    y: elemRect.top - containerRect.top + elemRect.height / 2 - 4
  };
}

/**
 * Find all hole elements within a container
 * @param container - The container element to search within
 * @returns Array of hole elements
 */
export function findHoleElements(container: HTMLDivElement): Element[] {
  return Array.from(container.querySelectorAll('.rounded-full')).filter(el => {
    const classes = el.className;
    return classes.includes('bg-neutral-900') && classes.includes('border-neutral-500');
  });
}

/**
 * Find hole elements by data-hole-id attribute
 * @param container - The container element to search within
 * @param holeId - The hole ID to search for (e.g., "6A", "D16")
 * @returns Array of hole elements with matching data-hole-id
 */
export function findHolesByDataId(container: HTMLDivElement, holeId: string): Element[] {
  const selector = `[data-hole-id="${holeId}"]`;
  return Array.from(container.querySelectorAll(selector));
}

/**
 * Generate random cables between holes
 * @param container - The container element
 * @param options - Configuration options
 * @returns Array of cable data
 */
export function generateRandomCables(
  container: HTMLDivElement,
  options: {
    count?: number;
    colors?: string[];
    droopMin?: number;
    droopMax?: number;
  } = {}
): CableData[] {
  const {
    count = 30,
    colors = ['#cc3333', '#3366cc', '#33cc66', '#dd8833', '#d4af37', '#9933cc', '#cc3399', '#33cccc'],
    droopMin = 150,
    droopMax = 250
  } = options;

  const rect = container.getBoundingClientRect();
  const holes = findHoleElements(container);
  const cables: CableData[] = [];

  console.log('Found holes:', holes.length);

  if (holes.length < 2) {
    return cables;
  }

  const usedPairs = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 5;

  while (cables.length < count && attempts < maxAttempts) {
    attempts++;

    // Pick two random holes
    const idx1 = Math.floor(Math.random() * holes.length);
    const idx2 = Math.floor(Math.random() * holes.length);

    // Make sure they're different and we haven't used this pair
    if (idx1 === idx2) continue;
    const pairKey = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`;
    if (usedPairs.has(pairKey)) continue;

    usedPairs.add(pairKey);

    const p1 = getRelativePosition(holes[idx1], container, rect);
    const p2 = getRelativePosition(holes[idx2], container, rect);

    if (p1 && p2) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const droop = droopMin + Math.random() * (droopMax - droopMin);
      cables.push({ start: p1, end: p2, color, droop });
    }
  }

  return cables;
}

/**
 * Generate cables from circuit notation
 * @param container - The container element
 * @param circuitNotation - Array of wire pairs in terminal notation (e.g., [["6A", "6com"], ["D4", "D5"]])
 * @param options - Configuration options
 * @returns Array of cable data
 */
export function generateCablesFromCircuit(
  container: HTMLDivElement,
  circuitNotation: Array<[string, string]>,
  options: {
    colors?: string[];
    droopMin?: number;
    droopMax?: number;
  } = {}
): CableData[] {
  const {
    colors = ['#cc3333', '#3366cc', '#33cc66', '#dd8833', '#d4af37', '#9933cc', '#cc3399', '#33cccc'],
    droopMin = 150,
    droopMax = 250
  } = options;

  const rect = container.getBoundingClientRect();
  const cables: CableData[] = [];

  // Track how many times each hole ID has been used
  const holeUsageCount: Record<string, number> = {};

  for (const [term1, term2] of circuitNotation) {
    // Find holes for each terminal
    const holes1 = findHolesByDataId(container, term1);
    const holes2 = findHolesByDataId(container, term2);

    if (holes1.length === 0) {
      console.warn(`No holes found for terminal: ${term1}`);
      continue;
    }
    if (holes2.length === 0) {
      console.warn(`No holes found for terminal: ${term2}`);
      continue;
    }

    // Get the nth occurrence of each hole based on usage count
    const usage1 = holeUsageCount[term1] || 0;
    const usage2 = holeUsageCount[term2] || 0;

    if (usage1 >= holes1.length) {
      console.error(`Terminal ${term1} used more times (${usage1 + 1}) than available holes (${holes1.length})`);
      continue;
    }
    if (usage2 >= holes2.length) {
      console.error(`Terminal ${term2} used more times (${usage2 + 1}) than available holes (${holes2.length})`);
      continue;
    }

    // Get positions
    const p1 = getRelativePosition(holes1[usage1], container, rect);
    const p2 = getRelativePosition(holes2[usage2], container, rect);

    // Increment usage counters
    holeUsageCount[term1] = usage1 + 1;
    holeUsageCount[term2] = usage2 + 1;

    // Calculate droop based on cable orientation
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate vertical ratio (0 = horizontal, 1 = vertical)
    const verticalRatio = distance > 0 ? dy / distance : 0;

    // More vertical cables get more droop, horizontal cables get less
    // verticalRatio of 1.0 (vertical) -> use droopMax
    // verticalRatio of 0.0 (horizontal) -> use droopMin * 0.3
    const minDroop = droopMin * 0.3;
    const adjustedDroopMin = minDroop + verticalRatio * (droopMin - minDroop);
    const adjustedDroopMax = droopMin + verticalRatio * (droopMax - droopMin);

    const droop = adjustedDroopMin + Math.random() * (adjustedDroopMax - adjustedDroopMin);

    // Create cable
    const color = colors[cables.length % colors.length];
    cables.push({ start: p1, end: p2, color, droop });
  }

  return cables;
}
