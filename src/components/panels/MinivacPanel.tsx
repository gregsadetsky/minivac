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
import { type MotorAngleStore } from '../SimulatorCore';

/**
 * Render performance layout (measured 2026-08-18: a naive full-panel render costs
 * 30-70ms — hundreds of holes/labels — and the elevator's floor lights genuinely
 * blink at every motor position, several times a second):
 * - purely static rows (holes, labels, stripes, matrix, dial face) are module-level
 *   constant elements: identical element reference every render, so React bails out
 *   of those subtrees entirely
 * - dynamic rows (lights, relays, indicators, slides, buttons) are memoized on the
 *   VALUES of their state slices, so one blinking light re-renders one row
 * - the motor angle bypasses React state via MotorAngleStore (only the knob follows it)
 */

const COLUMNS = [1, 2, 3, 4, 5, 6];

// ---------- static rows (constant elements, never reconciled) ----------

const NUMBERS_ROW = (
  <div className="flex gap-9">
    {COLUMNS.map(num => (
      <div key={`num-${num}`} className="flex justify-center" style={{ width: '120px' }}>
        <div className="text-white font-mono text-2xl font-bold">{num}</div>
      </div>
    ))}
  </div>
);

const BINARY_OUTPUT_LABEL = (
  <div className="text-white font-sans font-bold text-sm tracking-wider text-center">BINARY OUTPUT</div>
);

const POWER_STRIPE_ROW = (
  <div className="bg-[#84B6C7] py-2 flex gap-9 -ml-8 pl-8">
    {COLUMNS.map(num => (
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
);

const CEF_ROW = (
  <div className="flex gap-9">
    {COLUMNS.map(num => (
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
);

const STORAGE_LABEL = (
  <div className="text-white font-sans font-bold text-sm tracking-wider text-center">STORAGE/PROCESSING</div>
);

const GHJ_ROW = (
  <div className="flex gap-9">
    {COLUMNS.map(num => (
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
);

const KLN_ROW = (
  <div className="flex gap-9">
    {COLUMNS.map(num => (
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
);

const COMMON_STRIPE_ROW = (
  <div className="bg-[#84B6C7] py-2 flex gap-9 -ml-8 pl-8">
    {COLUMNS.map(num => (
      <div key={`common-${num}`} className="flex justify-center" style={{ width: '120px' }}>
        <PortPair label="COMMON" holeCount={4} holeIds={[`${num}com`, `${num}com`, `${num}com`, `${num}com`]} />
      </div>
    ))}
  </div>
);

const SECONDARY_STORAGE_LABEL = (
  <div className="text-white font-sans font-bold text-sm tracking-wider text-center">SECONDARY STORAGE</div>
);

const RST_ROW = (
  <div className="flex gap-9">
    {COLUMNS.map(num => (
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
);

const UVW_ROW = (
  <div className="flex gap-9">
    {COLUMNS.map(num => (
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
);

const EMPTY_STRIPE_ROW = <div className="bg-[#84B6C7] py-2 h-3 -ml-8" />;

const BINARY_INPUT_LABEL = (
  <div className="text-white font-sans font-bold text-sm tracking-wider text-center">BINARY INPUT</div>
);

const XYZ_ROW = (
  <div className="flex gap-9">
    {COLUMNS.map(num => (
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
);

const TITLE_SECTION = (
  <div className="flex flex-col items-center gap-1">
    <div className="text-white font-sans text-5xl font-bold tracking-wider" style={{ marginTop: '27px' }}>Minivac 601</div>
    <div className="text-neutral-400 font-mono text-xs">Simulator by Greg Technology</div>
  </div>
);

const MATRIX_POWER_STRIPE = (
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
);

const MATRIX_BLOCK = (
  <div className="flex items-center justify-center" style={{ width: '78%' }}>
    <div className="flex items-center justify-center" style={{ gap: '12px' }}>
      {/* Group 10 - 6 holes */}
      <MatrixConnector6 label="10" holeIds={['M10', 'M10', 'M10', 'M10', 'M10', 'M10']} />

      {/* 3x3 Matrix grid with tic-tac-toe lines */}
      <div className="relative flex items-center justify-center">
        <div className="relative">
          <div className="grid grid-cols-3 gap-5">
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
);

const MOTOR_JACKS_BLOCK = (
  <div className="flex flex-col gap-9">
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
);

// measured: hole ring 9.4cm of the 16cm motor square; knob 3.9cm ≈ 80px
const DIAL_FACE = <DecimalWheel diameter={204} />;

const DECIMAL_IO_LABEL = (
  <div className="flex pb-2">
    <div style={{ width: '100px' }} />
    <div className="flex-1 text-white font-sans font-bold text-sm tracking-wider text-center">DECIMAL INPUT-OUTPUT</div>
  </div>
);

// ---------- memoized dynamic rows ----------

function arrEq<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const LightsRow = React.memo(
  function LightsRow({ lights, brightness, isPowerOn }: {
    lights: boolean[] | undefined;
    brightness: number[] | undefined;
    isPowerOn: boolean;
  }) {
    return (
      <div className="flex gap-9">
        {COLUMNS.map(num => (
          <div key={`light-${num}`} className="flex items-center justify-center gap-2" style={{ width: '120px' }}>
            <div className="flex flex-col items-center gap-0.5">
              <PortPair holeIds={[`${num}A`, `${num}A`]} />
              <div className="text-neutral-300 font-mono text-[10px] font-bold">A</div>
            </div>
            <Light
              isOn={isPowerOn && (lights?.[num - 1] || false)}
              brightness={isPowerOn ? brightness?.[num - 1] : 0}
            />
            <div className="flex flex-col items-center gap-0.5">
              <PortPair holeIds={[`${num}B`, `${num}B`]} />
              <div className="text-neutral-300 font-mono text-[10px] font-bold">B</div>
            </div>
          </div>
        ))}
      </div>
    );
  },
  (p, n) => p.isPowerOn === n.isPowerOn && arrEq(p.lights, n.lights) && arrEq(p.brightness, n.brightness)
);

const RelaysRow = React.memo(
  function RelaysRow({ relays, isPowerOn, simulator, setSimState }: {
    relays: boolean[] | undefined;
    isPowerOn: boolean;
    simulator: MinivacSimulator | null;
    setSimState: (state: MinivacState) => void;
  }) {
    return (
      <div className="flex gap-9">
        {COLUMNS.map(num => (
          <div key={`relay-${num}`} className="flex justify-center" style={{ width: '120px' }}>
            <div style={{ marginLeft: '10px' }}>
              <Relay
                height={70}
                isEnergized={isPowerOn && (relays?.[num - 1] || false)}
                onPointerDown={() => {
                  if (!simulator) return;
                  // Toggle current state (override)
                  const currentState = relays?.[num - 1] || false;
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
    );
  },
  (p, n) =>
    p.isPowerOn === n.isPowerOn &&
    p.simulator === n.simulator &&
    p.setSimState === n.setSimState &&
    arrEq(p.relays, n.relays)
);

const IndicatorsRow = React.memo(
  function IndicatorsRow({ indicators, brightness, isPowerOn }: {
    indicators: boolean[] | undefined;
    brightness: number[] | undefined;
    isPowerOn: boolean;
  }) {
    return (
      <div className="flex gap-9 -mt-2">
        {COLUMNS.map(num => (
          <div key={`indicator-${num}`} className="flex justify-center" style={{ width: '120px' }}>
            <Light
              isOn={isPowerOn && (indicators?.[num - 1] || false)}
              brightness={isPowerOn ? brightness?.[num - 1] : 0}
            />
          </div>
        ))}
      </div>
    );
  },
  (p, n) => p.isPowerOn === n.isPowerOn && arrEq(p.indicators, n.indicators) && arrEq(p.brightness, n.brightness)
);

const SlidesRow = React.memo(
  function SlidesRow({ slideStates, simulator, setSlideStates, setSimState }: {
    slideStates: boolean[];
    simulator: MinivacSimulator | null;
    setSlideStates: React.Dispatch<React.SetStateAction<boolean[]>>;
    setSimState: (state: MinivacState) => void;
  }) {
    return (
      <div className="flex gap-9">
        {COLUMNS.map(num => (
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
    );
  },
  (p, n) =>
    p.simulator === n.simulator &&
    p.setSlideStates === n.setSlideStates &&
    p.setSimState === n.setSimState &&
    arrEq(p.slideStates, n.slideStates)
);

const ButtonsRow = React.memo(
  function ButtonsRow({ buttons, simulator, setSimState, setButtonStates }: {
    buttons: boolean[] | undefined;
    simulator: MinivacSimulator | null;
    setSimState: (state: MinivacState) => void;
    setButtonStates: React.Dispatch<React.SetStateAction<boolean[]>>;
  }) {
    return (
      <div className="flex gap-9">
        {COLUMNS.map(num => (
          <div key={`button-${num}`} className="flex justify-center" style={{ width: '120px' }} data-testid={`push-button-${num}`}>
            <PushButton
              size={44}
              pressed={buttons?.[num - 1]}
              onPress={() => {
                if (simulator) {
                  simulator.pressButton(num);
                  setSimState(simulator.getState());
                  // Update button state tracking
                  setButtonStates(prev => {
                    const newStates = [...prev];
                    newStates[num - 1] = true;
                    return newStates;
                  });
                }
              }}
              onRelease={() => {
                if (simulator) {
                  simulator.releaseButton(num);
                  setSimState(simulator.getState());
                  // Update button state tracking
                  setButtonStates(prev => {
                    const newStates = [...prev];
                    newStates[num - 1] = false;
                    return newStates;
                  });
                }
              }}
            />
          </div>
        ))}
      </div>
    );
  },
  (p, n) =>
    p.simulator === n.simulator &&
    p.setSimState === n.setSimState &&
    p.setButtonStates === n.setButtonStates &&
    arrEq(p.buttons, n.buttons)
);

// Cables re-render only when the cable list or drag mode changes; the click handler
// is reached through a ref so its per-render identity doesn't defeat the memo.
const CablesLayer = React.memo(
  function CablesLayer({ cables, isDraggingWire, onCableClick }: {
    cables: CableData[];
    isDraggingWire: boolean;
    onCableClick: (index: number) => void;
  }) {
    return (
      <>
        {cables.map((cable, idx) => (
          <Cable
            key={idx}
            startX={cable.start.x}
            startY={cable.start.y}
            endX={cable.end.x}
            endY={cable.end.y}
            color={cable.color}
            droop={cable.droop}
            onClick={isDraggingWire ? undefined : () => onCableClick(idx)}
          />
        ))}
      </>
    );
  },
  (p, n) => p.cables === n.cables && p.isDraggingWire === n.isDraggingWire && p.onCableClick === n.onCableClick
);

// The motor angle changes every animation frame while running. React is bypassed
// entirely for the rotation: the store writes the wrapper's transform straight to
// the DOM, so a turning motor costs zero React work per frame.
function LiveRotaryKnob({
  store,
  size,
  isInteractive,
  onChange,
}: {
  store: MotorAngleStore;
  size: number;
  isInteractive: boolean;
  onChange: (angle: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const apply = () => {
      if (ref.current) ref.current.style.transform = `rotate(${store.getSnapshot()}deg)`;
    };
    apply();
    return store.subscribe(apply);
  }, [store]);
  return (
    <div ref={ref} style={{ willChange: 'transform' }}>
      <RotaryKnob size={size} angle={0} isInteractive={isInteractive} onChange={onChange} />
    </div>
  );
}

interface MinivacPanelProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  motorAngleStore: MotorAngleStore;
  onPanelReady: () => void;
  simState: MinivacState | null;
  simulator: MinivacSimulator | null;
  setSimulator: (sim: MinivacSimulator) => void;
  setSimState: (state: MinivacState) => void;
  isPowerOn: boolean;
  setIsPowerOn: (on: boolean) => void;
  slideStates: boolean[];
  setSlideStates: React.Dispatch<React.SetStateAction<boolean[]>>;
  setButtonStates: React.Dispatch<React.SetStateAction<boolean[]>>;
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
  motorAngleStore,
  onPanelReady,
  simState,
  simulator,
  setSimulator,
  setSimState,
  isPowerOn,
  setIsPowerOn,
  slideStates,
  setSlideStates,
  setButtonStates,
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
  // Signal when panel is mounted and ready
  React.useLayoutEffect(() => {
    onPanelReady();
  }, [onPanelReady]);

  // latest-ref so CablesLayer can memoize while always calling the current handler
  const cableClickRef = React.useRef(handleCableClick);
  cableClickRef.current = handleCableClick;
  const onCableClick = React.useCallback((idx: number) => cableClickRef.current(idx), []);

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
          {/* LEFT PANEL - 6 columns. pl-8: the real machine has ~1in between the frame
              and the first hole column; blue stripes compensate with -ml-8 to keep
              bleeding to the panel edge */}
          <div className="flex flex-col gap-2 pl-8 pr-3">
            {NUMBERS_ROW}
            <LightsRow lights={simState?.lights} brightness={simState?.lightBrightness} isPowerOn={isPowerOn} />
            {BINARY_OUTPUT_LABEL}
            {POWER_STRIPE_ROW}
            {CEF_ROW}
            <RelaysRow relays={simState?.relays} isPowerOn={isPowerOn} simulator={simulator} setSimState={setSimState} />
            <IndicatorsRow indicators={simState?.relayIndicatorLights} brightness={simState?.relayIndicatorBrightness} isPowerOn={isPowerOn} />
            {STORAGE_LABEL}
            {GHJ_ROW}
            {KLN_ROW}
            {COMMON_STRIPE_ROW}
            {SECONDARY_STORAGE_LABEL}
            {RST_ROW}
            {UVW_ROW}
            <SlidesRow slideStates={slideStates} simulator={simulator} setSlideStates={setSlideStates} setSimState={setSimState} />
            {EMPTY_STRIPE_ROW}
            {BINARY_INPUT_LABEL}
            {XYZ_ROW}
            <ButtonsRow buttons={simState?.buttons} simulator={simulator} setSimState={setSimState} setButtonStates={setButtonStates} />
          </div>

          {/* SEPARATOR */}
          <div className="w-[3px] bg-[#84B6C7]" />

          {/* RIGHT PANEL — measured 6.28in vs left 16.875in on the real device,
              i.e. 0.372 of the left panel's 912px ≈ 340px */}
          <div className="flex flex-col px-3" style={{ width: '340px' }}>
            {TITLE_SECTION}

            {/* Spacer to align with left panel */}
            <div style={{ height: '25px' }} />

            {MATRIX_POWER_STRIPE}

            {/* Matrix and Power section — on the real machine this is a 16x16cm square,
                same size as the motor square below it */}
            <div className="relative flex py-2 items-center" style={{ height: '330px' }}>
              {MATRIX_BLOCK}

              {/* White vertical line separator */}
              <div className="bg-white" style={{ width: '2px', height: '100%' }} />

              {/* Power section - 22% */}
              <div
                className="flex flex-col items-center justify-center"
                style={{ width: '22%' }}
                data-testid="power-section"
                data-power-on={isPowerOn}
              >
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
              <div className="absolute text-white font-sans font-bold text-sm tracking-wider" style={{ bottom: '4px', left: '16px' }}>MATRIX</div>
            </div>

            {/* Blue separator — a fat band on the real machine (~0.2in) */}
            <div className="bg-[#84B6C7] h-3 -mx-3" />

            {/* Decimal wheel section — the real machine's motor square is 16x16cm with
                the dial's hole ring at 9.4cm diameter, centered at (9.2cm, 7.3cm) */}
            <div className="flex-1 px-1 flex items-start" style={{ gap: '4px', paddingTop: '46px' }}>
              {MOTOR_JACKS_BLOCK}

              {/* Decimal wheel with rotary knob in center */}
              <div className="relative flex-1 flex items-center justify-center">
                {DIAL_FACE}
                {/* Rotary knob centered - rotates to point at current motor position */}
                <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <LiveRotaryKnob
                    store={motorAngleStore}
                    size={80}
                    isInteractive={!simState?.motor.running}
                    onChange={(newAngle) => {
                      // Only allow manual control when motor is not running
                      if (simulator && simState && !simState.motor.running) {
                        motorAngleStore.set(newAngle);
                        simulator.updateMotorAngle(newAngle);
                        // Force simulation with new angle (getState won't simulate when motor is stopped)
                        simulator.resimulate();
                        const newState = simulator.getState();
                        setSimState(newState);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {DECIMAL_IO_LABEL}
          </div>
        </div>

        {/* Cables connecting actual holes - positioned dynamically */}
        <CablesLayer cables={cables} isDraggingWire={isDraggingWire} onCableClick={onCableClick} />

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
