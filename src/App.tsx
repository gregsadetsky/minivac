import React from 'react';
import { Howl } from 'howler';
import MatrixConnector from './components/connectors/MatrixConnector';
import MatrixConnector6 from './components/connectors/MatrixConnector6';
import PortPair from './components/connectors/PortPair';
import TriplePortGroup, { LightCoilDecorations } from './components/connectors/TriplePortGroup';
import VerticalPortStack from './components/connectors/VerticalPortStack';
import DecimalWheel from './components/modules/DecimalWheel';
import Cable from './components/primitives/Cable';
import Hole from './components/primitives/Hole';
import Light from './components/primitives/Light';
import PushButton from './components/primitives/PushButton';
import Relay from './components/primitives/Relay';
import RotaryKnob from './components/primitives/RotaryKnob';
import SlideSwitch from './components/primitives/SlideSwitch';
import SlideSwitchVertical from './components/primitives/SlideSwitchVertical';
import { type CableData } from './utils/wire-utils';
import { MinIVACSimulator, type MinivacState } from './simulator/minivac-simulator';

function App() {
  const columns = [1, 2, 3, 4, 5, 6];
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [cables, setCables] = React.useState<CableData[]>([]);
  const [simulator, setSimulator] = React.useState<MinIVACSimulator | null>(null);
  const [simState, setSimState] = React.useState<MinivacState | null>(null);
  const [cumulativeRotation, setCumulativeRotation] = React.useState(0);
  const previousRelayStates = React.useRef<boolean[]>([]);
  const relayClickSound = React.useRef<Howl | null>(null);

  // Slide switch states (false = left, true = right)
  const [slideStates, setSlideStates] = React.useState<boolean[]>([false, false, false, false, false, false]);

  // Interactive wiring state
  const [isDraggingWire, setIsDraggingWire] = React.useState(false);
  const isDraggingWireRef = React.useRef(false);
  const dragStartHoleIdRef = React.useRef<string | null>(null);
  const dragStartHoleElement = React.useRef<Element | null>(null);
  const dragEndHoleElement = React.useRef<Element | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = React.useState<{ x: number; y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = React.useState<{ x: number; y: number } | null>(null);
  const hoveredHoleIdRef = React.useRef<string | null>(null);
  const [cableToDelete, setCableToDelete] = React.useState<number | null>(null);

  // Wire colors that cycle through
  const wireColors = ['#cc3333', '#3366cc', '#33cc66', '#dd8833', '#d4af37', '#9933cc', '#cc3399', '#33cccc'];
  const currentColorIndex = React.useRef(0);

  // Store preview cable properties to preserve them in final cable
  const previewCableRef = React.useRef<{ droop: number; color: string }>({ droop: 100, color: wireColors[0] });

  // Track which specific hole elements are connected (maps cable index to [startElement, endElement])
  const connectedHoleElements = React.useRef<Map<number, [Element, Element]>>(new Map());

  // Initialize relay click sound
  React.useEffect(() => {
    relayClickSound.current = new Howl({
      src: ['/relay-click.mp3'],
      volume: 0.5
    });
  }, []);

  // Recreate simulator whenever cables change (including initial mount)
  React.useEffect(() => {
    // Convert cables to circuit notation
    const circuitNotation = cables
      .filter(cable => cable.holeIds && cable.holeIds.length === 2)
      .map(cable => `${cable.holeIds![0]}/${cable.holeIds![1]}`);

    // Create new simulator with updated circuit
    const minivac = new MinIVACSimulator(circuitNotation);
    minivac.initialize();

    // Restore slide switch states (captures current slideStates via closure)
    // Note: slideStates is NOT in dependency array - we only recreate on cable changes
    // Slide changes use setSlide() API directly without recreation
    slideStates.forEach((isRight, index) => {
      minivac.setSlide(index + 1, isRight ? 'right' : 'left');
    });

    setSimulator(minivac);
    setSimState(minivac.getState());

    console.log('Simulator initialized with', circuitNotation.length, 'wires');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables]); // Only recreate when cables change

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

  // Polling loop to update simulation state
  React.useEffect(() => {
    if (!simulator) return;

    const interval = setInterval(() => {
      const newState = simulator.getState();

      // Detect relay state changes and play sound
      if (previousRelayStates.current.length > 0) {
        for (let i = 0; i < newState.relays.length; i++) {
          if (newState.relays[i] !== previousRelayStates.current[i]) {
            relayClickSound.current?.play();
            break; // Only play once per update even if multiple relays change
          }
        }
      }
      previousRelayStates.current = [...newState.relays];

      // Handle cumulative rotation to avoid 15→0 snap
      if (simState) {
        const currentPos = simState.motor.position;
        const newPos = newState.motor.position;

        // Detect wrap-around from 15 to 0 (forward rotation)
        if (currentPos === 15 && newPos === 0) {
          setCumulativeRotation(prev => prev + (360 / 16));
        }
        // Detect wrap-around from 0 to 15 (backward rotation)
        else if (currentPos === 0 && newPos === 15) {
          setCumulativeRotation(prev => prev - (360 / 16));
        }
        // Normal position change
        else if (newPos !== currentPos) {
          const positionDiff = newPos - currentPos;
          setCumulativeRotation(prev => prev + positionDiff * (360 / 16));
        }
      } else {
        // First time initialization
        setCumulativeRotation(newState.motor.position * (360 / 16));
      }

      setSimState(newState);
    }, 50); // Poll every 50ms

    return () => clearInterval(interval);
  }, [simulator, simState]);

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

    // Check if this hole is already connected
    if (isHoleConnected(holeElement)) {
      // Don't highlight or allow connection to already-connected holes
      return;
    }

    // Clear previous highlight
    if (dragEndHoleElement.current && dragEndHoleElement.current !== holeElement) {
      const prevHole = dragEndHoleElement.current as HTMLElement;
      prevHole.style.borderColor = '#737373';
      prevHole.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)';
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
        // Get the hole elements before deleting
        const elementsToDisconnect = connectedHoleElements.current.get(cableToDelete);
        if (elementsToDisconnect) {
          const [startHole, endHole] = elementsToDisconnect;
          // Remove data-connected attribute to re-enable hover
          (startHole as HTMLElement).removeAttribute('data-connected');
          (endHole as HTMLElement).removeAttribute('data-connected');
        }

        // Confirm deletion
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
      } else if (e.key === 'Escape') {
        // Cancel deletion
        setCableToDelete(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cableToDelete]);

  return (
    <div className="min-h-screen bg-neutral-800 overflow-auto p-8">
      {/* Minivac frame */}
      <div
        ref={containerRef}
        className="relative bg-[#1a1a1a] p-3 border-[5px] border-[#84B6C7] select-none overflow-hidden mx-auto"
        style={{ minWidth: '1200px', width: 'fit-content' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="flex gap-0">
          {/* LEFT PANEL - 6 columns */}
          <div className="flex flex-col gap-3">
            {/* Row: Numbers */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`num-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <div className="text-white font-mono text-2xl font-bold">{num}</div>
                </div>
              ))}
            </div>

            {/* Row: Lights with A and B */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`light-${num}`} className="flex items-center justify-center gap-2" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}A`, `${num}A`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">A</div>
                  </div>
                  <Light isOn={simState?.lights[num - 1] || false} />
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}B`, `${num}B`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">B</div>
                  </div>
                </div>
              ))}
            </div>

            {/* BINARY OUTPUT label */}
            <div className="text-white font-sans font-bold text-base tracking-wider text-center">BINARY OUTPUT</div>

            {/* Blue section with + and - ports - full width */}
            <div className="bg-[#84B6C7] p-2 flex gap-9">
              {columns.map(num => (
                <div key={`power-${num}`} className="flex justify-center gap-9" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-white font-mono text-sm font-bold">+</div>
                    <PortPair holeIds={[`${num}+`, `${num}+`]} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-white font-mono text-sm font-bold">−</div>
                    <PortPair holeIds={[`${num}-`, `${num}-`]} />
                  </div>
                </div>
              ))}
            </div>

            {/* Row: Light/Coil with C E F */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`coil-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <TriplePortGroup topRow={<LightCoilDecorations />} holeIds={[`${num}C`, `${num}C`, `${num}E`, `${num}E`, `${num}F`, `${num}F`]} />
                    <div className="flex justify-between w-full">
                      <div className="text-neutral-300 font-mono text-[10px] font-bold" style={{ marginLeft: '10px' }}>C</div>
                      <div className="text-neutral-300 font-mono text-[10px] font-bold">E</div>
                      <div className="text-neutral-300 font-mono text-[10px] font-bold" style={{ marginRight: '10px' }}>F</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row: Relays */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`relay-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <div style={{ marginLeft: '10px' }}>
                    <Relay isEnergized={simState?.relays[num - 1] || false} />
                  </div>
                </div>
              ))}
            </div>

            {/* Row: Indicator lights */}
            <div className="flex gap-9 -mt-2">
              {columns.map(num => (
                <div key={`indicator-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <Light isOn={simState?.relayIndicatorLights[num - 1] || false} />
                </div>
              ))}
            </div>

            {/* STORAGE/PROCESSING label */}
            <div className="text-white font-sans font-bold text-base tracking-wider text-center">STORAGE/PROCESSING</div>

            {/* Row: N.O. ARM N.C. with G H J */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`ghj-${num}`} className="flex justify-center gap-5" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">N.O.</div>
                    <PortPair holeIds={[`${num}G`, `${num}G`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">G</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">ARM</div>
                    <PortPair holeIds={[`${num}H`, `${num}H`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">H</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">N.C.</div>
                    <PortPair holeIds={[`${num}J`, `${num}J`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">J</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row: K L N */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`kln-${num}`} className="flex justify-center gap-5" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}K`, `${num}K`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">K</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}L`, `${num}L`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">L</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}N`, `${num}N`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">N</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Blue section with COMMON - full width */}
            <div className="bg-[#84B6C7] p-2 flex gap-9">
              {columns.map(num => (
                <div key={`common-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <PortPair label="COMMON" holeCount={4} holeIds={[`${num}com`, `${num}com`, `${num}com`, `${num}com`]} />
                </div>
              ))}
            </div>

            {/* SECONDARY STORAGE label */}
            <div className="text-white font-sans font-bold text-base tracking-wider text-center">SECONDARY STORAGE</div>

            {/* Row: R S T with arrows */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`rst-${num}`} className="flex justify-center gap-5" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">←</div>
                    <PortPair holeIds={[`${num}R`, `${num}R`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">R</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">ARM</div>
                    <PortPair holeIds={[`${num}S`, `${num}S`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">S</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">→</div>
                    <PortPair holeIds={[`${num}T`, `${num}T`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">T</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row: U V W */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`uvw-${num}`} className="flex justify-center gap-5" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}U`, `${num}U`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">U</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}V`, `${num}V`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">V</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <PortPair holeIds={[`${num}W`, `${num}W`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">W</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row: Slide switches */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`switch-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <SlideSwitch
                    isRight={slideStates[num - 1]}
                    onChange={(isRight) => {
                      // Update local state for visual
                      setSlideStates(prev => {
                        const newStates = [...prev];
                        newStates[num - 1] = isRight;
                        return newStates;
                      });
                      // Update simulator directly without recreation
                      if (simulator) {
                        simulator.setSlide(num, isRight ? 'right' : 'left');
                        setSimState(simulator.getState());
                      }
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Blue section empty - full width */}
            <div className="bg-[#84B6C7] p-2 h-3" />

            {/* BINARY INPUT label */}
            <div className="text-white font-sans font-bold text-base tracking-wider text-center">BINARY INPUT</div>

            {/* Row: X Y Z with N.O. ARM N.C. */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`xyz-${num}`} className="flex justify-center gap-5" style={{ width: '120px' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">N.O.</div>
                    <PortPair holeIds={[`${num}X`, `${num}X`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">X</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">ARM</div>
                    <PortPair holeIds={[`${num}Y`, `${num}Y`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">Y</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">N.C.</div>
                    <PortPair holeIds={[`${num}Z`, `${num}Z`]} />
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">Z</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row: Push buttons */}
            <div className="flex gap-9">
              {columns.map(num => (
                <div key={`button-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <PushButton
                    onPress={() => {
                      if (simulator) {
                        simulator.pressButton(num);
                        setSimState(simulator.getState());
                      }
                    }}
                    onRelease={() => {
                      if (simulator) {
                        simulator.releaseButton(num);
                        setSimState(simulator.getState());
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SEPARATOR */}
          <div className="w-[3px] bg-[#84B6C7]" />

          {/* RIGHT PANEL */}
          <div className="flex flex-col" style={{ width: '450px' }}>
            {/* Title section */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-white font-sans text-6xl font-bold tracking-wider" style={{ marginTop: '27px' }}>Minivac 601</div>
              <div className="text-neutral-400 font-mono text-xs">Simulator by Greg Technology</div>
            </div>

            {/* Spacer to align with left panel */}
            <div style={{ height: '25px' }} />

            {/* Power divider with +/- ports */}
            <div className="relative bg-[#84B6C7] p-2 flex">
              {/* Matrix space - left 78% */}
              <div className="flex justify-center items-center gap-16" style={{ width: '78%' }}>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="text-white font-mono text-sm font-bold">+</div>
                  <PortPair holeIds={['M+', 'M+']} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="text-white font-mono text-sm font-bold">−</div>
                  <PortPair holeIds={['M-', 'M-']} />
                </div>
              </div>
              {/* Power label - right 22% */}
              <div className="flex items-center justify-center" style={{ width: '22%' }}>
                <div className="text-white font-mono text-sm font-bold tracking-wider">POWER</div>
              </div>
            </div>

            {/* Matrix and Power section */}
            <div className="relative flex py-4 items-center" style={{ height: '320px' }}>
              {/* Matrix space - 78% */}
              <div className="flex items-center justify-center" style={{ width: '78%' }}>
                <div className="flex items-center justify-center" style={{ gap: '24px' }}>
                  {/* Group 10 - 6 holes */}
                  <MatrixConnector6 label="10" holeIds={['M10', 'M10', 'M10', 'M10', 'M10', 'M10']} />

                  {/* 3x3 Matrix grid with tic-tac-toe lines */}
                  <div className="relative flex items-center justify-center">
                    <div className="relative">
                      <div className="grid grid-cols-3 gap-8">
                        {[1, 2, 3, 8, 9, 4, 7, 6, 5].map((num) => (
                          <MatrixConnector key={num} label={num.toString()} holeIds={[`M${num}t`, `M${num}t`, `M${num}b`, `M${num}b`]} />
                        ))}
                      </div>
                      {/* Vertical tic-tac-toe lines */}
                      <div className="absolute bg-neutral-500" style={{ left: 'calc(33.33% - 1px)', top: 0, width: '2px', height: '100%' }} />
                      <div className="absolute bg-neutral-500" style={{ left: 'calc(66.66% - 1px)', top: 0, width: '2px', height: '100%' }} />
                      {/* Horizontal tic-tac-toe lines */}
                      <div className="absolute bg-neutral-500" style={{ top: 'calc(33.33% - 1px)', left: 0, height: '2px', width: '100%' }} />
                      <div className="absolute bg-neutral-500" style={{ top: 'calc(66.66% - 1px)', left: 0, height: '2px', width: '100%' }} />
                    </div>
                  </div>

                  {/* Group 11 - 6 holes */}
                  <MatrixConnector6 label="11" holeIds={['M11', 'M11', 'M11', 'M11', 'M11', 'M11']} />
                </div>
              </div>

              {/* White vertical line separator */}
              <div className="bg-white" style={{ width: '2px', height: '100%' }} />

              {/* Power section - 22% */}
              <div className="flex flex-col items-center justify-center" style={{ width: '22%' }}>
                <Light />
                <div style={{ height: '20px' }} />
                <div className="text-neutral-300 font-mono text-[9px] font-bold">ON</div>
                <div style={{ height: '2px' }} />
                <SlideSwitchVertical />
                <div style={{ height: '2px' }} />
                <div className="text-neutral-300 font-mono text-[9px] font-bold">OFF</div>
              </div>

              {/* MATRIX label at bottom left */}
              <div className="absolute text-white font-sans font-bold text-base tracking-wider" style={{ bottom: '4px', left: '16px' }}>MATRIX</div>
            </div>

            {/* Blue separator */}
            <div className="bg-[#84B6C7] h-[3px]" />

            {/* Decimal wheel section */}
            <div className="py-6 px-4 flex" style={{ gap: '10px' }}>
              {/* Left side: 16 ARM and 17/18/19 RUN/STOP */}
              <div className="flex flex-col gap-12" style={{ paddingTop: '120px' }}>
                {/* 16 ARM */}
                <div className="flex items-center gap-2">
                  <div className="text-neutral-300 font-mono text-[10px] font-bold w-4 text-right">16</div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex" style={{ gap: '6px' }}>
                      <Hole size={10} dataHoleId="D16" />
                      <Hole size={10} dataHoleId="D16" />
                    </div>
                    <div className="text-neutral-300 font-mono text-[10px] font-bold">ARM</div>
                  </div>
                </div>

                {/* 17/18/19 with RUN/STOP */}
                <VerticalPortStack
                  rows={[
                    { leftLabel: '17', labelAfter: 'RUN', holeIds: ['D17', 'D17'] },
                    { leftLabel: '18', labelAfter: 'STOP', holeIds: ['D18', 'D18'] },
                    { leftLabel: '19', holeIds: ['D19', 'D19'] }
                  ]}
                />
              </div>

              {/* Decimal wheel with rotary knob in center */}
              <div className="relative flex-1 flex items-center justify-center">
                <DecimalWheel diameter={320} currentValue={simState?.motor.position || 0} />
                {/* Rotary knob centered - rotates to point at current motor position */}
                <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <RotaryKnob
                    size={100}
                    angle={cumulativeRotation}
                  />
                </div>
              </div>
            </div>

            {/* DECIMAL INPUT-OUTPUT label */}
            <div className="text-white font-sans font-bold text-base tracking-wider text-center pb-2">DECIMAL INPUT-OUTPUT</div>
          </div>
        </div>

        {/* Cables connecting actual holes - positioned dynamically */}
        {cables.map((cable, idx) => (
          <Cable
            key={idx}
            startX={cable.start.x}
            startY={cable.start.y}
            endX={cable.end.x}
            endY={cable.end.y}
            color={cable.color}
            droop={cable.droop}
            onClick={isDraggingWire ? undefined : () => handleCableClick(idx)}
          />
        ))}

        {/* Preview wire while dragging - only show if mouse has moved */}
        {isDraggingWire && dragStartPos && dragCurrentPos &&
         (dragStartPos.x !== dragCurrentPos.x || dragStartPos.y !== dragCurrentPos.y) && (
          <Cable
            startX={dragStartPos.x}
            startY={dragStartPos.y}
            endX={dragCurrentPos.x}
            endY={dragCurrentPos.y}
            color={previewCableRef.current.color}
            droop={previewCableRef.current.droop}
          />
        )}

        {/* Delete confirmation dialog */}
        {cableToDelete !== null && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelDeleteCable();
            }}
          >
            <div className="bg-neutral-900 border-2 border-[#84B6C7] p-6 rounded-lg shadow-xl">
              <h3 className="text-white text-lg font-sans font-bold mb-4">Delete Wire?</h3>
              <p className="text-neutral-300 mb-6">Are you sure you want to delete this wire?</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDeleteCable}
                  className="px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCable}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Circuit alerts (short circuits, etc.) */}
        {simState?.alerts && simState.alerts.length > 0 && (
          <div
            className="absolute top-4 left-1/2 transform -translate-x-1/2"
            style={{ zIndex: 999 }}
          >
            <div className="bg-red-900 border-2 border-red-500 p-4 rounded-lg shadow-xl max-w-md">
              <div className="flex items-start gap-3">
                <div className="text-red-400 text-2xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-white text-sm font-sans font-bold mb-2">Circuit Alert</h3>
                  {simState.alerts.map((alert, idx) => (
                    <p key={idx} className="text-red-200 text-xs mb-1 font-mono">
                      {alert}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
