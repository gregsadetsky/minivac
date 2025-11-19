import React from 'react';
import { Howl } from 'howler';
import { MinivacSimulator, type MinivacState } from '../simulator/minivac-simulator';
import { useCableManagement } from '../hooks/useCableManagement';
import MinivacPanel from './panels/MinivacPanel';

export interface SimulatorCoreProps {
  // Circuit configuration
  initialCircuit?: string[];
  onCircuitChange?: (circuit: string[]) => void;
  onReset?: () => void;

  // Display options
  scale?: number;
  cableOffsetX?: number;
  cableOffsetY?: number;

  // Behavior
  enableAudio?: boolean;
  audioSrc?: string;
  muted?: boolean;

  // Callbacks
  onStateChange?: (state: MinivacState) => void;
  onSimulatorReady?: (simulator: MinivacSimulator) => void;
}

export default function SimulatorCore({
  initialCircuit = [],
  onCircuitChange,
  scale = 1,
  cableOffsetX = 0,
  cableOffsetY = 0,
  enableAudio = true,
  audioSrc = '/relay-click.mp3',
  muted = false,
  onStateChange,
  onSimulatorReady
}: SimulatorCoreProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [simulator, setSimulator] = React.useState<MinivacSimulator | null>(null);
  const [simState, setSimState] = React.useState<MinivacState | null>(null);
  const previousRelayStates = React.useRef<boolean[]>([]);
  const relayClickSound = React.useRef<Howl | null>(null);

  // Power state (true = on, false = off)
  const [isPowerOn, setIsPowerOn] = React.useState(true);

  // Slide switch states (false = left, true = right)
  const [slideStates, setSlideStates] = React.useState<boolean[]>([false, false, false, false, false, false]);

  // Button states (false = released, true = pressed)
  const [buttonStates, setButtonStates] = React.useState<boolean[]>([false, false, false, false, false, false]);

  // Track when panel is ready for circuit loading
  const [isPanelReady, setIsPanelReady] = React.useState(false);

  // Use cable management hook
  const cableManagement = useCableManagement(containerRef, scale, cableOffsetX, cableOffsetY);

  // Initialize relay click sound (only if audio enabled)
  React.useEffect(() => {
    if (enableAudio) {
      relayClickSound.current = new Howl({
        src: [audioSrc],
        volume: 0.5,
        mute: muted
      });
    }
    return () => {
      relayClickSound.current?.unload();
    };
  }, [enableAudio, audioSrc, muted]);

  // Update mute state when muted prop changes
  React.useEffect(() => {
    if (relayClickSound.current) {
      if (muted) {
        // When muting, just mute immediately
        relayClickSound.current.mute(true);
      } else {
        // When unmuting, start at 0 volume and ramp up to avoid loud clicks
        relayClickSound.current.volume(0);
        relayClickSound.current.mute(false);

        // Resume audio context (required for browser autoplay policies)
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ctx = (window as any).Howler?.ctx;
          if (ctx && ctx.state === 'suspended') {
            ctx.resume();
          }
        }

        // Ramp volume from 0 to 0.5 over 100ms
        relayClickSound.current.fade(0, 0.5, 100);
      }
    }
  }, [muted]);

  // Load initial circuit when panel is ready or when initialCircuit changes
  React.useEffect(() => {
    if (!isPanelReady) return;

    if (containerRef.current) {
      cableManagement.loadCircuitFromNotation(initialCircuit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanelReady, initialCircuit]);

  // Notify parent when circuit changes
  React.useEffect(() => {
    if (!isPanelReady) return; // Don't notify until initial load is complete

    const circuitNotation = cableManagement.cables
      .filter(cable => cable.holeIds && cable.holeIds.length === 2)
      .map(cable => `${cable.holeIds![0]}/${cable.holeIds![1]}`);

    onCircuitChange?.(circuitNotation);
  }, [cableManagement.cables, isPanelReady, onCircuitChange]);

  // Recreate simulator whenever cables change
  React.useEffect(() => {
    // Convert cables to circuit notation
    const circuitNotation = cableManagement.cables
      .filter(cable => cable.holeIds && cable.holeIds.length === 2)
      .map(cable => `${cable.holeIds![0]}/${cable.holeIds![1]}`);

    // If circuit is empty (reset), don't preserve motor angle or slide states
    const isReset = circuitNotation.length === 0;

    // Preserve state from old simulator (unless resetting)
    const oldMotorAngle = isReset ? 0 : (simulator?.motorAngle || 0);
    const oldRelayStates = isReset ? [false, false, false, false, false, false] : (simulator?.getState().relays || [false, false, false, false, false, false]);

    // Create new simulator with updated circuit
    const minivac = new MinivacSimulator(circuitNotation);

    // Restore motor angle BEFORE initialization so the circuit simulates with correct position
    minivac.updateMotorAngle(oldMotorAngle);

    // Restore relay states BEFORE initialization to preserve latched relays
    minivac.setRelayStates(oldRelayStates);

    minivac.initialize();

    // Restore slide switch states (unless resetting)
    if (!isReset) {
      slideStates.forEach((isRight, index) => {
        minivac.setSlide(index + 1, isRight ? 'right' : 'left');
      });
    } else {
      // Reset slide states in UI when circuit is reset
      setSlideStates([false, false, false, false, false, false]);
    }

    // Restore button states (unless resetting)
    if (!isReset) {
      buttonStates.forEach((isPressed, index) => {
        if (isPressed) {
          minivac.pressButton(index + 1);
        }
      });
    } else {
      // Reset button states in UI when circuit is reset
      setButtonStates([false, false, false, false, false, false]);
    }

    // Get final state after all restorations
    const finalState = minivac.getState();
    setSimulator(minivac);
    setSimState(finalState);

    // Notify parent that simulator is ready
    onSimulatorReady?.(minivac);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cableManagement.cables]);

  // Notify parent whenever simulator changes (including when power is toggled)
  React.useEffect(() => {
    if (simulator) {
      onSimulatorReady?.(simulator);
    }
  }, [simulator, onSimulatorReady]);

  // Handle power on/off - pause/resume simulator
  React.useEffect(() => {
    if (!simulator) return;

    if (isPowerOn) {
      simulator.resume();
    } else {
      simulator.pause();
    }
  }, [simulator, isPowerOn]);

  // Animation loop to update simulation state (using RAF for smooth motor updates)
  React.useEffect(() => {
    if (!simulator || !isPowerOn) return;

    let rafId: number;
    let isRunning = true;

    const frame = () => {
      if (!isRunning) return;

      const newState = simulator.getState();

      // Check for short circuit and auto power-off
      if (newState.alerts && newState.alerts.some(alert => alert.includes('SHORT CIRCUIT'))) {
        setIsPowerOn(false);
        setSimState(newState);
        isRunning = false;
        return; // Stop animation loop
      }

      // Detect relay state changes and play sound
      if (enableAudio && previousRelayStates.current.length > 0) {
        for (let i = 0; i < newState.relays.length; i++) {
          if (newState.relays[i] !== previousRelayStates.current[i]) {
            relayClickSound.current?.play();
            break; // Only play once per update even if multiple relays change
          }
        }
      }
      previousRelayStates.current = [...newState.relays];

      setSimState(newState);
      onStateChange?.(newState);

      // Request next frame
      rafId = requestAnimationFrame(frame);
    };

    // Start animation loop
    rafId = requestAnimationFrame(frame);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
    };
  }, [simulator, isPowerOn, enableAudio, onStateChange]);

  const hasShortCircuit = simState?.alerts?.some(alert => alert.includes('SHORT CIRCUIT')) || false;

  return (
    <div style={{
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      width: `${100 / scale}%`,
      height: `${100 / scale}%`
    }}>
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
        setButtonStates={setButtonStates}
        previousRelayStatesRef={previousRelayStates}
        hasShortCircuit={hasShortCircuit}
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
    </div>
  );
}
