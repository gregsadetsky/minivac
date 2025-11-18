import React from 'react';
import MatrixConnector from '../connectors/MatrixConnector';
import MatrixConnector6 from '../connectors/MatrixConnector6';
import PortPair from '../connectors/PortPair';
import TriplePortGroup, { LightCoilDecorations } from '../connectors/TriplePortGroup';
import VerticalPortStack from '../connectors/VerticalPortStack';
import DecimalWheel from '../modules/DecimalWheel';
import Cable from '../primitives/Cable';
import Hole from '../primitives/Hole';
import Light from '../primitives/Light';
import PushButton from '../primitives/PushButton';
import Relay from '../primitives/Relay';
import RotaryKnob from '../primitives/RotaryKnob';
import SlideSwitch from '../primitives/SlideSwitch';
import SlideSwitchVertical from '../primitives/SlideSwitchVertical';
import { type CableData } from '../../utils/wire-utils';
import { MinivacSimulator, type MinivacState } from '../../simulator/minivac-simulator';

interface MinivacPanelProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPanelReady: () => void;
  simState: MinivacState | null;
  simulator: MinivacSimulator | null;
  setSimulator: (sim: MinivacSimulator) => void;
  setSimState: (state: MinivacState) => void;
  isPowerOn: boolean;
  setIsPowerOn: (on: boolean) => void;
  slideStates: boolean[];
  setSlideStates: React.Dispatch<React.SetStateAction<boolean[]>>;
  previousRelayStatesRef: React.MutableRefObject<boolean[]>;
  hasShortCircuit: boolean;
  cables: CableData[];
  isDraggingWire: boolean;
  dragStartPos: { x: number; y: number } | null;
  dragCurrentPos: { x: number; y: number } | null;
  cableToDelete: number | null;
  handleMouseMove: (event: React.MouseEvent | React.PointerEvent) => void;
  handleMouseUp: () => void;
  handleCableClick: (index: number) => void;
  confirmDeleteCable: () => void;
  cancelDeleteCable: () => void;
  previewCableRef: React.MutableRefObject<{ droop: number; color: string }>;
}

export default function MinivacPanel({
  containerRef,
  onPanelReady,
  simState,
  simulator,
  setSimulator,
  setSimState,
  isPowerOn,
  setIsPowerOn,
  slideStates,
  setSlideStates,
  previousRelayStatesRef,
  hasShortCircuit,
  cables,
  isDraggingWire,
  dragStartPos,
  dragCurrentPos,
  cableToDelete,
  handleMouseMove,
  handleMouseUp,
  handleCableClick,
  confirmDeleteCable,
  cancelDeleteCable,
  previewCableRef
}: MinivacPanelProps) {
  const columns = [1, 2, 3, 4, 5, 6];

  // Signal when panel is mounted and ready
  React.useLayoutEffect(() => {
    onPanelReady();
  }, [onPanelReady]);

  return (
    <div className="min-h-screen bg-neutral-800 overflow-auto p-8">
      {/* Minivac frame */}
      <div
        ref={containerRef}
        className="relative bg-[#1a1a1a] p-3 border-[5px] border-[#84B6C7] select-none overflow-hidden mx-auto"
        style={{
          minWidth: '1200px',
          width: 'fit-content',
          touchAction: isDraggingWire ? 'none' : 'auto', // Prevent pan during wire drag
        }}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
      >
        <div className="flex gap-0">
          {/* LEFT PANEL - 6 columns */}
          <div className="flex flex-col gap-3 pr-3">
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
                  <Light isOn={isPowerOn && (simState?.lights[num - 1] || false)} />
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
            <div className="bg-[#84B6C7] py-2 flex gap-9">
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
                    <Relay
                      isEnergized={isPowerOn && (simState?.relays[num - 1] || false)}
                      onPointerDown={() => {
                        if (!simulator) return;
                        // Toggle current state (override)
                        const currentState = simState?.relays[num - 1] || false;
                        simulator.setRelayOverride(num, !currentState);
                        setSimState(simulator.getState());
                      }}
                      onPointerUp={() => {
                        if (!simulator) return;
                        // Clear override, return to simulation control
                        simulator.clearRelayOverride(num);
                        setSimState(simulator.getState());
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Row: Indicator lights */}
            <div className="flex gap-9 -mt-2">
              {columns.map(num => (
                <div key={`indicator-${num}`} className="flex justify-center" style={{ width: '120px' }}>
                  <Light isOn={isPowerOn && (simState?.relayIndicatorLights[num - 1] || false)} />
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
            <div className="bg-[#84B6C7] py-2 flex gap-9">
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
            <div className="bg-[#84B6C7] py-2 h-3" />

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
                    pressed={simState?.buttons[num - 1]}
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
          <div className="flex flex-col px-3" style={{ width: '450px' }}>
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
                <div className="text-white font-mono text-sm font-bold tracking-wider" style={{ marginLeft: '8px' }}>POWER</div>
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
                <Light isOn={isPowerOn} />
                <div style={{ height: '20px' }} />
                <div className="text-neutral-300 font-mono text-[9px] font-bold">ON</div>
                <div style={{ height: '2px' }} />
                <SlideSwitchVertical
                  isBottom={!isPowerOn}
                  disabled={hasShortCircuit}
                  onChange={(isBottom) => {
                    setIsPowerOn(!isBottom);
                    if (!isBottom) {
                      // Power turned on - recreate simulator with current wiring
                      // Preserve motor angle from old simulator
                      const oldMotorAngle = simulator?.motorAngle || 0;

                      const circuitNotation = cables
                        .filter(cable => cable.holeIds && cable.holeIds.length === 2)
                        .map(cable => `${cable.holeIds![0]}/${cable.holeIds![1]}`);
                      const minivac = new MinivacSimulator(circuitNotation);

                      // Restore motor angle BEFORE initialization so the circuit simulates with correct position
                      minivac.updateMotorAngle(oldMotorAngle);

                      minivac.initialize();

                      // Restore slide switch states
                      slideStates.forEach((isRight, index) => {
                        minivac.setSlide(index + 1, isRight ? 'right' : 'left');
                      });

                      const newState = minivac.getState();

                      // Set previousRelayStates to "all off" (power-off state) so the polling loop
                      // can detect relay activation and play the click sound
                      previousRelayStatesRef.current = [false, false, false, false, false, false];

                      setSimulator(minivac);
                      setSimState(newState);
                    }
                  }}
                />
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
                <DecimalWheel diameter={320} currentValue={simState?.motor.position || 0} angle={simState?.motor.angle || 0} />
                {/* Rotary knob centered - rotates to point at current motor position */}
                <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <RotaryKnob
                    size={100}
                    angle={simState?.motor.angle || 0}
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

        {/* Delete confirmation dialog (desktop only - mobile uses window.confirm) */}
        {cableToDelete !== null && (
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelDeleteCable();
            }}
          >
            <div className="bg-neutral-900 border-2 border-[#84B6C7] p-6 rounded-lg shadow-xl max-w-[90vw] max-h-[90vh] overflow-auto">
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
