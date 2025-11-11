import React from 'react';
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
import { generateCablesFromCircuit, type CableData } from './utils/wire-utils';
import { parseMinivacNotationForUI } from './simulator/circuit-notation-parser';
import { MinIVACSimulator, type MinivacState } from './simulator/minivac-simulator';

function App() {
  const columns = [1, 2, 3, 4, 5, 6];
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [cables, setCables] = React.useState<CableData[]>([]);
  const [simulator, setSimulator] = React.useState<MinIVACSimulator | null>(null);
  const [simState, setSimState] = React.useState<MinivacState | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    // Wait a bit for the DOM to fully render
    setTimeout(() => {
      if (!containerRef.current) return;

      // Prompt user for circuit notation
      const circuitInput = prompt(
        'Enter circuit notation (space-separated wire pairs):\n\nExample: 6A/6com D4/D5 3J/6com 5A/5com 6B/6-'
      );

      if (!circuitInput || circuitInput.trim() === '') {
        console.log('No circuit entered');
        return;
      }

      try {
        // Parse the circuit notation
        const circuitArray = circuitInput.trim().split(/\s+/);
        const wirePairs = parseMinivacNotationForUI(circuitArray);

        console.log('Parsed circuit:', wirePairs);

        // Generate cables from circuit
        const newCables = generateCablesFromCircuit(containerRef.current, wirePairs, {
          droopMin: 150,
          droopMax: 250
        });

        setCables(newCables);

        // Create and initialize the simulator
        const minivac = new MinIVACSimulator(circuitArray);
        minivac.initialize();
        setSimulator(minivac);
        setSimState(minivac.getState());

        console.log('Simulator initialized:', minivac.getState());
      } catch (error) {
        alert(`Error parsing circuit: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Circuit parsing error:', error);
      }
    }, 100);
  }, []);

  // Polling loop to update simulation state
  React.useEffect(() => {
    if (!simulator) return;

    const interval = setInterval(() => {
      setSimState(simulator.getState());
    }, 50); // Poll every 50ms

    return () => clearInterval(interval);
  }, [simulator]);

  return (
    <div className="min-h-screen bg-neutral-800 overflow-auto p-8">
      {/* Minivac frame */}
      <div ref={containerRef} className="relative bg-[#1a1a1a] p-3 border-[5px] border-[#84B6C7] select-none overflow-hidden mx-auto" style={{ minWidth: '1200px', width: 'fit-content' }}>
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
                  <SlideSwitch />
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
                {/* Rotary knob centered */}
                <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <RotaryKnob size={100} />
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
          />
        ))}
      </div>
    </div>
  );
}

export default App;
