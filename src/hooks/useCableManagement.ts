import React from 'react';
import { type CableData } from '../utils/wire-utils';

const wireColors = ['#cc3333', '#3366cc', '#33cc66', '#dd8833', '#d4af37', '#9933cc', '#cc3399', '#33cccc'];

export function useCableManagement(containerRef: React.RefObject<HTMLDivElement>) {
  const [cables, setCables] = React.useState<CableData[]>([]);
  const [isDraggingWire, setIsDraggingWire] = React.useState(false);
  const isDraggingWireRef = React.useRef(false);
  const dragStartHoleIdRef = React.useRef<string | null>(null);
  const dragStartHoleElement = React.useRef<Element | null>(null);
  const dragEndHoleElement = React.useRef<Element | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = React.useState<{ x: number; y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = React.useState<{ x: number; y: number } | null>(null);
  const hoveredHoleIdRef = React.useRef<string | null>(null);
  const [cableToDelete, setCableToDelete] = React.useState<number | null>(null);

  const currentColorIndex = React.useRef(0);
  const previewCableRef = React.useRef<{ droop: number; color: string }>({ droop: 100, color: wireColors[0] });
  const connectedHoleElements = React.useRef<Map<number, [Element, Element]>>(new Map());

  // Check if a hole element is already connected
  const isHoleConnected = (holeElement: Element): boolean => {
    for (const [startEl, endEl] of connectedHoleElements.current.values()) {
      if (startEl === holeElement || endEl === holeElement) {
        return true;
      }
    }
    return false;
  };

  // Interactive wiring handlers
  const handleHoleMouseDown = (holeId: string, event: React.MouseEvent) => {
    if (!containerRef.current) return;

    const hole = (event.target as HTMLElement).closest('[data-hole-id]');
    if (!hole) return;

    // Check if this hole is already connected
    if (isHoleConnected(hole)) {
      return; // Don't allow starting from a connected hole
    }

    const rect = hole.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const startPos = {
      x: rect.left + rect.width / 2 - containerRect.left - 5,
      y: rect.top + rect.height / 2 - containerRect.top - 5
    };

    // Set the color for this new wire
    const currentColor = wireColors[currentColorIndex.current];
    previewCableRef.current.color = currentColor;

    setIsDraggingWire(true);
    isDraggingWireRef.current = true;
    dragStartHoleIdRef.current = holeId;
    dragStartHoleElement.current = hole;
    setDragStartPos(startPos);
    setDragCurrentPos(startPos);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDraggingWire || !containerRef.current || !dragStartPos) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const currentPos = {
      x: event.clientX - containerRect.left - 5,
      y: event.clientY - containerRect.top - 5
    };

    setDragCurrentPos(currentPos);

    // Calculate droop based on distance for preview (keep existing color)
    const dx = currentPos.x - dragStartPos.x;
    const dy = currentPos.y - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const calculatedDroop = Math.min(distance * 0.4, 200);

    previewCableRef.current.droop = calculatedDroop;
  };

  const handleHoleMouseEnterElement = (holeElement: Element, holeId: string) => {
    if (!isDraggingWireRef.current || !containerRef.current) return;

    // Clear previous highlight first
    if (dragEndHoleElement.current && dragEndHoleElement.current !== holeElement) {
      const prevHole = dragEndHoleElement.current as HTMLElement;
      prevHole.style.borderColor = '#737373';
      prevHole.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)';
    }

    // Check if this hole is already connected
    if (isHoleConnected(holeElement)) {
      // Clear refs since we can't connect to this hole
      hoveredHoleIdRef.current = null;
      dragEndHoleElement.current = null;
      return;
    }

    hoveredHoleIdRef.current = holeId;
    dragEndHoleElement.current = holeElement;

    // Highlight the hovered hole
    const hole = holeElement as HTMLElement;
    hole.style.borderColor = '#84B6C7';
    hole.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 2px rgba(132, 182, 199, 0.5), 0 0 12px rgba(132, 182, 199, 0.6)';
  };

  const handleHoleMouseLeave = () => {
    if (!isDraggingWireRef.current || !dragEndHoleElement.current) return;

    // Remove highlight from the previously hovered hole
    const hole = dragEndHoleElement.current as HTMLElement;
    hole.style.borderColor = '#737373';
    hole.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)';

    hoveredHoleIdRef.current = null;
    dragEndHoleElement.current = null;
  };

  const handleMouseUp = () => {
    // Always clear highlight when mouse is released
    if (dragEndHoleElement.current) {
      const endHole = dragEndHoleElement.current as HTMLElement;
      endHole.style.borderColor = '#737373';
      endHole.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)';
    }

    if (isDraggingWireRef.current && dragStartHoleElement.current && dragEndHoleElement.current &&
        dragStartHoleIdRef.current && hoveredHoleIdRef.current && containerRef.current) {

      // Use the stored element references
      const startHole = dragStartHoleElement.current;
      const endHole = dragEndHoleElement.current;

      // Double check neither is already connected (safety check)
      if (!isHoleConnected(startHole) && !isHoleConnected(endHole)) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const startRect = startHole.getBoundingClientRect();
        const endRect = endHole.getBoundingClientRect();

        // Verify container rect is valid
        if (containerRect.width > 0 && containerRect.height > 0) {
          // Calculate positions relative to container with offset
          const startX = startRect.left + startRect.width / 2 - containerRect.left - 5;
          const startY = startRect.top + startRect.height / 2 - containerRect.top - 5;
          const endX = endRect.left + endRect.width / 2 - containerRect.left - 5;
          const endY = endRect.top + endRect.height / 2 - containerRect.top - 5;

          // Only create cable if we got valid coordinates
          if (!isNaN(startX) && !isNaN(startY) && !isNaN(endX) && !isNaN(endY)) {
            const newCable: CableData = {
              start: { x: startX, y: startY },
              end: { x: endX, y: endY },
              color: previewCableRef.current.color,
              droop: previewCableRef.current.droop,
              holeIds: [dragStartHoleIdRef.current, hoveredHoleIdRef.current]
            };

            setCables(prev => {
              const newCables = [...prev, newCable];
              // Track the connected hole elements
              connectedHoleElements.current.set(newCables.length - 1, [startHole, endHole]);

              // Mark holes as connected to prevent CSS hover effects
              (startHole as HTMLElement).setAttribute('data-connected', 'true');
              (endHole as HTMLElement).setAttribute('data-connected', 'true');

              return newCables;
            });

            // Advance to next color in the cycle
            currentColorIndex.current = (currentColorIndex.current + 1) % wireColors.length;
          } else {
            console.warn('Invalid cable coordinates:', { startX, startY, endX, endY });
          }
        } else {
          console.warn('Invalid container dimensions:', containerRect);
        }
      }
    }

    // Reset dragging state
    setIsDraggingWire(false);
    isDraggingWireRef.current = false;
    dragStartHoleIdRef.current = null;
    dragStartHoleElement.current = null;
    dragEndHoleElement.current = null;
    setDragStartPos(null);
    setDragCurrentPos(null);
    hoveredHoleIdRef.current = null;
  };

  const handleCableClick = (index: number) => {
    setCableToDelete(index);
  };

  const confirmDeleteCable = () => {
    if (cableToDelete !== null) {
      // Get the hole elements before deleting
      const elementsToDisconnect = connectedHoleElements.current.get(cableToDelete);
      if (elementsToDisconnect) {
        const [startHole, endHole] = elementsToDisconnect;
        // Remove data-connected attribute to re-enable hover
        (startHole as HTMLElement).removeAttribute('data-connected');
        (endHole as HTMLElement).removeAttribute('data-connected');
      }

      setCables(prev => {
        const newCables = prev.filter((_, i) => i !== cableToDelete);

        // Remove from connected elements map and rebuild indices
        const newMap = new Map<number, [Element, Element]>();
        let newIndex = 0;
        for (let i = 0; i < prev.length; i++) {
          if (i !== cableToDelete) {
            const elements = connectedHoleElements.current.get(i);
            if (elements) {
              newMap.set(newIndex, elements);
            }
            newIndex++;
          }
        }
        connectedHoleElements.current = newMap;

        return newCables;
      });
      setCableToDelete(null);
    }
  };

  const cancelDeleteCable = () => {
    setCableToDelete(null);
  };

  // Handle keyboard events for delete dialog
  React.useEffect(() => {
    if (cableToDelete === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        confirmDeleteCable();
      } else if (e.key === 'Escape') {
        cancelDeleteCable();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cableToDelete]);

  // Set up event delegation for holes
  React.useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const handleMouseDownCapture = (e: MouseEvent) => {
      const hole = (e.target as HTMLElement).closest('[data-hole-id]');
      if (!hole) return;

      const holeId = hole.getAttribute('data-hole-id');
      if (!holeId) return;

      handleHoleMouseDown(holeId, e as unknown as React.MouseEvent);
    };

    const handleMouseOverCapture = (e: MouseEvent) => {
      const hole = (e.target as HTMLElement).closest('[data-hole-id]');
      if (!hole) {
        handleHoleMouseLeave();
        return;
      }

      const holeId = hole.getAttribute('data-hole-id');
      if (!holeId) return;

      // Check if we're dragging and if this specific element is different from what we're hovering
      if (isDraggingWireRef.current) {
        if (dragEndHoleElement.current !== hole) {
          handleHoleMouseEnterElement(hole, holeId);
        }
      }
    };

    // Use capture phase to catch events before they're consumed
    container.addEventListener('mousedown', handleMouseDownCapture, true);
    container.addEventListener('mouseover', handleMouseOverCapture, true);

    return () => {
      container.removeEventListener('mousedown', handleMouseDownCapture, true);
      container.removeEventListener('mouseover', handleMouseOverCapture, true);
    };
  }, []);

  return {
    cables,
    setCables,
    isDraggingWire,
    dragCurrentPos,
    dragStartPos,
    cableToDelete,
    handleMouseMove,
    handleMouseUp,
    handleCableClick,
    confirmDeleteCable,
    cancelDeleteCable,
    previewCableRef
  };
}
