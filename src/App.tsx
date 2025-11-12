import React from 'react';
import { Howl } from 'howler';
import { MinIVACSimulator, type MinivacState } from './simulator/minivac-simulator';
import { useCableManagement } from './hooks/useCableManagement';
import MinivacPanel from './components/panels/MinivacPanel';

function App() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [simulator, setSimulator] = React.useState<MinIVACSimulator | null>(null);
  const [simState, setSimState] = React.useState<MinivacState | null>(null);
  const previousRelayStates = React.useRef<boolean[]>([]);
  const relayClickSound = React.useRef<Howl | null>(null);

  // Power state (true = on, false = off)
  const [isPowerOn, setIsPowerOn] = React.useState(true);

  // Slide switch states (false = left, true = right)
  const [slideStates, setSlideStates] = React.useState<boolean[]>([false, false, false, false, false, false]);

  // Use cable management hook
  const cableManagement = useCableManagement(containerRef);

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
    const circuitNotation = cableManagement.cables
      .filter(cable => cable.holeIds && cable.holeIds.length === 2)
      .map(cable => `${cable.holeIds![0]}/${cable.holeIds![1]}`);

    // Preserve motor angle from old simulator
    const oldMotorAngle = simulator?.motorAngle || 0;

    // Create new simulator with updated circuit
    const minivac = new MinIVACSimulator(circuitNotation);
    minivac.initialize();

    // Restore motor angle to prevent visual snap-back
    minivac.motorAngle = oldMotorAngle;

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
  }, [cableManagement.cables]); // Only recreate when cables change

  // Polling loop to update simulation state
  React.useEffect(() => {
    if (!simulator || !isPowerOn) return;

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

      setSimState(newState);
    }, 50); // Poll every 50ms

    return () => clearInterval(interval);
  }, [simulator, simState, isPowerOn]);

  return (
    <MinivacPanel
      containerRef={containerRef}
      simState={simState}
      simulator={simulator}
      setSimulator={setSimulator}
      setSimState={setSimState}
      isPowerOn={isPowerOn}
      setIsPowerOn={setIsPowerOn}
      slideStates={slideStates}
      setSlideStates={setSlideStates}
      cables={cableManagement.cables}
      isDraggingWire={cableManagement.isDraggingWire}
      dragStartPos={cableManagement.dragStartPos}
      dragCurrentPos={cableManagement.dragCurrentPos}
      cableToDelete={cableManagement.cableToDelete}
      handleMouseMove={cableManagement.handleMouseMove}
      handleMouseUp={cableManagement.handleMouseUp}
      handleCableClick={cableManagement.handleCableClick}
      confirmDeleteCable={cableManagement.confirmDeleteCable}
      cancelDeleteCable={cableManagement.cancelDeleteCable}
      previewCableRef={cableManagement.previewCableRef}
    />
  );
}

export default App;
