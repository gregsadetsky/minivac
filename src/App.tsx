import React from 'react';
import { Howl } from 'howler';
import { MinivacSimulator, type MinivacState } from './simulator/minivac-simulator';
import { useCableManagement } from './hooks/useCableManagement';
import MinivacPanel from './components/panels/MinivacPanel';
import Sidebar from './components/Sidebar';
import LoadCircuitDialog from './components/dialogs/LoadCircuitDialog';
import { updateUrlWithCircuit, getCircuitFromUrl } from './utils/circuit-url';

function App() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [simulator, setSimulator] = React.useState<MinivacSimulator | null>(null);
  const [simState, setSimState] = React.useState<MinivacState | null>(null);
  const previousRelayStates = React.useRef<boolean[]>([]);
  const relayClickSound = React.useRef<Howl | null>(null);

  // Power state (true = on, false = off)
  const [isPowerOn, setIsPowerOn] = React.useState(true);

  // Slide switch states (false = left, true = right)
  const [slideStates, setSlideStates] = React.useState<boolean[]>([false, false, false, false, false, false]);

  // Load circuit dialog state
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);

  // Track when panel is ready for circuit loading
  const [isPanelReady, setIsPanelReady] = React.useState(false);

  // Use cable management hook
  const cableManagement = useCableManagement(containerRef);

  // Initialize relay click sound
  React.useEffect(() => {
    relayClickSound.current = new Howl({
      src: ['/relay-click.mp3'],
      volume: 0.5
    });
  }, []);

  // Track if we're currently loading from URL to prevent update loops
  const isLoadingFromUrl = React.useRef(false);
  // Track if we've attempted initial URL load (don't clear URL before this)
  const hasAttemptedUrlLoad = React.useRef(false);

  // Load circuit from URL when panel is ready
  React.useEffect(() => {
    console.log('[URL Loading Effect] Running, isPanelReady:', isPanelReady);
    console.log('[URL Loading Effect] window.location.href:', window.location.href);
    console.log('[URL Loading Effect] window.location.hash:', window.location.hash);

    if (!isPanelReady) {
      console.log('[URL Loading] Panel not ready yet');
      return;
    }

    console.log('[URL Loading] Panel is ready, getting circuit from URL...');
    const connections = getCircuitFromUrl();

    // Mark that we've attempted to load from URL (even if no connections found)
    hasAttemptedUrlLoad.current = true;

    if (connections.length === 0) {
      console.log('[URL Loading] No connections in URL');
      return;
    }

    console.log('[URL Loading] Found', connections.length, 'connections, loading...');
    if (containerRef.current) {
      isLoadingFromUrl.current = true;
      cableManagement.loadCircuitFromNotation(connections);
      // Reset flag after a tick to allow URL update
      setTimeout(() => {
        isLoadingFromUrl.current = false;
      }, 0);
    } else {
      console.warn('[URL Loading] Container not ready for circuit loading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanelReady]);

  // Listen for hash changes (when user manually changes URL)
  React.useEffect(() => {
    const handleHashChange = () => {
      console.log('[Hash Change] URL hash changed, reloading circuit');
      const connections = getCircuitFromUrl();
      if (connections.length > 0 && containerRef.current) {
        isLoadingFromUrl.current = true;
        cableManagement.loadCircuitFromNotation(connections);
        setTimeout(() => {
          isLoadingFromUrl.current = false;
        }, 0);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL whenever cables change (but not while loading from URL)
  React.useEffect(() => {
    // Skip update if we're currently loading from URL
    if (isLoadingFromUrl.current) {
      console.log('[URL Update] Skipping update - currently loading from URL');
      return;
    }

    // Skip update if we haven't attempted initial URL load yet
    // (prevents clearing hash before we've had a chance to load it)
    if (!hasAttemptedUrlLoad.current) {
      console.log('[URL Update] Skipping update - haven\'t attempted URL load yet');
      return;
    }

    console.log('[URL Update] Updating URL with', cableManagement.cables.length, 'cables');
    updateUrlWithCircuit(cableManagement.cables);
  }, [cableManagement.cables]);

  // Recreate simulator whenever cables change (including initial mount)
  React.useEffect(() => {
    // Convert cables to circuit notation
    const circuitNotation = cableManagement.cables
      .filter(cable => cable.holeIds && cable.holeIds.length === 2)
      .map(cable => `${cable.holeIds![0]}/${cable.holeIds![1]}`);

    // Preserve motor angle from old simulator
    const oldMotorAngle = simulator?.motorAngle || 0;

    // Create new simulator with updated circuit
    const minivac = new MinivacSimulator(circuitNotation);

    // Restore motor angle BEFORE initialization so the circuit simulates with correct position
    minivac.updateMotorAngle(oldMotorAngle);

    minivac.initialize();

    // Restore slide switch states (captures current slideStates via closure)
    // Note: slideStates is NOT in dependency array - we only recreate on cable changes
    // Slide changes use setSlide() API directly without recreation
    slideStates.forEach((isRight, index) => {
      minivac.setSlide(index + 1, isRight ? 'right' : 'left');
    });

    // Get final state after all restorations and before starting polling
    const finalState = minivac.getState();
    setSimulator(minivac);
    setSimState(finalState);

    // Keep previous relay states from before recreation so we can detect and hear
    // relay state changes caused by wiring changes. If this is the first init,
    // previousRelayStates will be empty and no sound will play (correct).
    // Don't reset it here - let the polling loop detect actual changes.

    console.log('Simulator initialized with', circuitNotation.length, 'wires');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cableManagement.cables]); // Only recreate when cables change

  // Polling loop to update simulation state
  React.useEffect(() => {
    if (!simulator || !isPowerOn) return;

    const interval = setInterval(() => {
      const newState = simulator.getState();

      // Check for short circuit and auto power-off
      if (newState.alerts && newState.alerts.some(alert => alert.includes('SHORT CIRCUIT'))) {
        setIsPowerOn(false);
        setSimState(newState);
        return; // Stop polling
      }

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

  const handleLoadCircuit = (circuit?: string[]) => {
    if (circuit) {
      // Load sample circuit directly
      cableManagement.loadCircuitFromNotation(circuit);
    } else {
      // Show manual load dialog
      setShowLoadDialog(true);
    }
  };

  return (
    <>
      <Sidebar onLoadCircuit={handleLoadCircuit} />

      <LoadCircuitDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoadCircuit={(notation) => cableManagement.loadCircuitFromNotation(notation)}
      />

      <MinivacPanel
        containerRef={containerRef}
        onPanelReady={() => setIsPanelReady(true)}
        simState={simState}
        simulator={simulator}
        setSimulator={setSimulator}
        setSimState={setSimState}
        isPowerOn={isPowerOn}
        setIsPowerOn={setIsPowerOn}
        slideStates={slideStates}
        setSlideStates={setSlideStates}
        previousRelayStatesRef={previousRelayStates}
        hasShortCircuit={simState?.alerts?.some(alert => alert.includes('SHORT CIRCUIT')) || false}
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
    </>
  );
}

export default App;
