import React from 'react';
import { Howl } from 'howler';
import { MinivacSimulator, type MinivacState } from '../simulator/minivac-simulator';
import { useCableManagement } from '../hooks/useCableManagement';
import MinivacPanel from './panels/MinivacPanel';

// Tiny external store for the motor angle: it changes every animation frame while
// the motor runs, and pushing it through React state would re-render the whole
// panel at display rate. Only the rotary knob subscribes to this.
export interface MotorAngleStore {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => number;
  set: (angle: number) => void;
}

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
  audioSrcOn?: string;   // relay pull-in click (recorded from a real Minivac 601)
  audioSrcOff?: string;  // relay release click
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
  audioSrcOn = '/relay-on.mp3',
  audioSrcOff = '/relay-off.mp3',
  muted = false,
  onStateChange,
  onSimulatorReady
}: SimulatorCoreProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [simulator, setSimulator] = React.useState<MinivacSimulator | null>(null);
  const [simState, setSimState] = React.useState<MinivacState | null>(null);
  const previousRelayStates = React.useRef<boolean[]>([]);
  const lastStateSignature = React.useRef<string>('');
  const motorAngleStore = React.useRef<MotorAngleStore | null>(null);
  if (!motorAngleStore.current) {
    let angle = 0;
    const listeners = new Set<() => void>();
    motorAngleStore.current = {
      subscribe: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      getSnapshot: () => angle,
      set: (a) => {
        if (a !== angle) {
          angle = a;
          listeners.forEach(l => l());
        }
      },
    };
  }
  const relayOnSound = React.useRef<Howl | null>(null);
  const relayOffSound = React.useRef<Howl | null>(null);

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

  // Initialize relay click sounds (only if audio enabled)
  React.useEffect(() => {
    if (enableAudio) {
      relayOnSound.current = new Howl({
        src: [audioSrcOn],
        volume: 0.5,
        mute: muted
      });
      relayOffSound.current = new Howl({
        src: [audioSrcOff],
        volume: 0.5,
        mute: muted
      });
    }
    return () => {
      relayOnSound.current?.unload();
      relayOffSound.current?.unload();
    };
  }, [enableAudio, audioSrcOn, audioSrcOff, muted]);

  // Update mute state when muted prop changes
  React.useEffect(() => {
    const sounds = [relayOnSound.current, relayOffSound.current].filter(Boolean) as Howl[];
    if (sounds.length === 0) return;
    if (muted) {
      // When muting, just mute immediately
      sounds.forEach(s => s.mute(true));
    } else {
      // When unmuting, start at 0 volume and ramp up to avoid loud clicks
      sounds.forEach(s => {
        s.volume(0);
        s.mute(false);
      });

      // Resume audio context (required for browser autoplay policies)
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (window as any).Howler?.ctx;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
      }

      // Ramp volume from 0 to 0.5 over 100ms
      sounds.forEach(s => s.fade(0, 0.5, 100));
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
      // cutting power drops any energized relays — play the release click (issue #9)
      if (enableAudio && previousRelayStates.current.some(Boolean)) {
        relayOffSound.current?.play();
      }
      previousRelayStates.current = previousRelayStates.current.map(() => false);
    }
  }, [simulator, isPowerOn, enableAudio]);

  // Animation loop to update simulation state (using RAF for smooth motor updates)
  React.useEffect(() => {
    if (!simulator || !isPowerOn) return;

    let rafId: number;
    let isRunning = true;

    // TEMP perf instrumentation: log frame-gap and sim-solve variability
    let lastFrameAt = 0;
    let statFrames = 0;
    let statWorstGap = 0;
    let statWorstSim = 0;
    let statSimTotal = 0;
    let statRenders = 0;
    let statWindowStart = performance.now();

    const frame = () => {
      if (!isRunning) return;

      const frameStart = performance.now();
      const gap = lastFrameAt ? frameStart - lastFrameAt : 0;
      lastFrameAt = frameStart;

      const newState = simulator.getState();

      const simMs = performance.now() - frameStart;
      statFrames++;
      statSimTotal += simMs;
      if (gap > statWorstGap) statWorstGap = gap;
      if (simMs > statWorstSim) statWorstSim = simMs;
      if (simMs > 5 || gap > 30) {
        console.log(`[perf] frame gap=${gap.toFixed(1)}ms sim=${simMs.toFixed(1)}ms motor=${newState.motor.running ? 'RUN' : 'stop'} pos=${newState.motor.position}`);
      }
      if (frameStart - statWindowStart > 1000) {
        console.log(`[perf 1s] frames=${statFrames} renders=${statRenders} avgSim=${(statSimTotal / statFrames).toFixed(1)}ms worstSim=${statWorstSim.toFixed(1)}ms worstGap=${statWorstGap.toFixed(1)}ms`);
        statFrames = 0;
        statRenders = 0;
        statWorstGap = 0;
        statWorstSim = 0;
        statSimTotal = 0;
        statWindowStart = frameStart;
      }

      // Check for short circuit and auto power-off
      if (newState.alerts && newState.alerts.some(alert => alert.includes('SHORT CIRCUIT'))) {
        setIsPowerOn(false);
        setSimState(newState);
        isRunning = false;
        return; // Stop animation loop
      }

      // Detect relay state changes and play the matching (pull-in vs release) sound.
      // Each direction plays at most once per update; simultaneous pull-in and
      // release just play together.
      if (enableAudio && previousRelayStates.current.length > 0) {
        let anyPullIn = false;
        let anyRelease = false;
        for (let i = 0; i < newState.relays.length; i++) {
          if (newState.relays[i] !== previousRelayStates.current[i]) {
            if (newState.relays[i]) anyPullIn = true;
            else anyRelease = true;
          }
        }
        if (anyPullIn) relayOnSound.current?.play();
        if (anyRelease) relayOffSound.current?.play();
      }
      previousRelayStates.current = [...newState.relays];

      // The continuously-changing motor angle goes through the lightweight store
      // (only the knob re-renders); everything else re-renders the panel only when
      // it actually changed — at idle the state is identical every frame, and pushing
      // a fresh object into React 60-120x/s reconciled the whole panel for nothing
      // (measured: rhythmic ~66ms GC stalls).
      motorAngleStore.current!.set(newState.motor.angle);
      // signature covers only what the panel visibly renders: relayCurrents and raw
      // brightness floats wiggle on every solve and would trigger full re-renders
      // for imperceptible changes, so currents are excluded and brightness quantized
      const signature = JSON.stringify({
        relays: newState.relays,
        buttons: newState.buttons,
        lights: newState.lights,
        relayIndicatorLights: newState.relayIndicatorLights,
        lightBrightness: newState.lightBrightness.map(b => Math.round(b * 20)),
        relayIndicatorBrightness: newState.relayIndicatorBrightness.map(b => Math.round(b * 20)),
        slides: newState.slides,
        // motor.angle goes through the store; motor.position isn't rendered anywhere
        // (the pointer is the angle, floor lights are just lights) — only `running`
        // matters visually (knob interactivity)
        motorRunning: newState.motor.running,
        alerts: newState.alerts,
      });
      if (signature !== lastStateSignature.current) {
        // TEMP: log which state fields drove this render
        try {
          const prev = JSON.parse(lastStateSignature.current || '{}');
          const next = JSON.parse(signature);
          const changed = Object.keys(next).filter(
            k => JSON.stringify(next[k]) !== JSON.stringify(prev[k])
          );
          console.log(`[render] changed: ${changed.join(', ')}`);
        } catch { /* first frame */ }
        lastStateSignature.current = signature;
        statRenders++;
        setSimState(newState);
        onStateChange?.(newState);
      }

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
        motorAngleStore={motorAngleStore.current!}
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
