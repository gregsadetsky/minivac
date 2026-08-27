/**
 * THE WALL'S ENGINE ROOM (web worker). Two measured lessons live here:
 * - the user's first trace: the solver on the MAIN thread starved
 *   navigation (3.2s timer bursts) -> the sim lives in this worker.
 * - the user's second trace pair: /wall/ was ~10x slower PER SOLVE
 *   than /tetris/ — because /tetris/ runs setSolverEngine('fast') (the
 *   typed-array engine; rowMaxAbs ~0) and the wall ran the default
 *   Map-based 'sparse' (rowMaxAbs = 10.7s of the trace). the wall now
 *   runs 'fast', and the SAME geometry as /tetris/ (12x6): it is the
 *   same machine, not a smaller cousin.
 * KEYS QUEUE (<=4) while a solve chain runs and drain at settle —
 * dropping them made the wall "unplayable" (the user's word; /tetris/
 * has queued since the 6-column bring-up).
 */
import { MinivacSimulator, setSolverEngine } from './simulator/minivac-simulator';
import {
  tetrisCircuit,
  SHAPES,
  SELECTION_CYCLE,
  SELECTION_NEXT,
  shapeRange,
  ringPart,
} from './circuits/multivac-mini-tetris';

const ROWS = 12;
const COLS = 6;
setSolverEngine('fast');
const built = tetrisCircuit(ROWS, COLS);
const L = built.layout;
const N_MACHINES = L.machines;
// THE WHEEL (user call, 2026-08-27: "did you not use a wheel at some
// point? just let it rotate"): the Minivac 601's motorized rotary dial
// is the kit's OWN 1961 randomizer — the manual's games say "spin the
// dial, read the number". power machine 0's motor from the button
// machine's free section-1 supply so it spins continuously; the dealer
// below reads its position (wall-clock physics, not Math.random) and
// cranks the ring there through the contacts.
built.wires.push(`m${built.btnMachine}.1+/D17`, `m${built.btnMachine}.1-/D18`);
const sim = new MinivacSimulator(built.wires, false, N_MACHINES);
sim.initialize();
// the dial has 16 positions; tetris deals 7 pieces (spawn orientations).
// 16 = 2x7 + 2: the two extra slots go to the I and the O — documented
// bias, the price of a 16-tooth wheel dealing a 7-piece game.
const WHEEL_TABLE = [3, 4, 5, 6, 7, 8, 12, 3, 4, 5, 6, 7, 8, 12, 12, 3];

const IO = {
  tick: { slide: 5, machine: 1 },
  start: { button: 6, machine: 1 },
  left: { button: 3, machine: built.btnMachine },
  right: { button: 4, machine: built.btnMachine },
  up: { button: 2, machine: built.btnMachine },
};
const rel = (n: number) => sim.getMachineState(Math.floor(n / 6)).relays[n % 6];
const tokenRow = () => {
  for (let i = 0; i < ROWS; i++) if (rel(L.RING(i, 2))) return i;
  return -1;
};
const shapeAt = () => {
  for (let i = 0; i < SHAPES.length; i++) if (rel(ringPart(L, i, 2))) return i;
  return -1;
};
const posAt = () => {
  for (let j = 0; j < COLS; j++) if (rel(L.POSS(j))) return j;
  return -1;
};

let wireCur: Float32Array | undefined;
function post(status?: string) {
  const relays = new Uint8Array(N_MACHINES);
  const lights = new Uint8Array(N_MACHINES);
  const buttons = new Uint8Array(N_MACHINES);
  for (let m = 0; m < N_MACHINES; m++) {
    const st = sim.getMachineState(m);
    let r = 0, li = 0, b = 0;
    for (let i = 0; i < 6; i++) {
      if (st.relays[i]) r |= 1 << i;
      if (st.lights[i]) li |= 1 << i;
      if (st.buttons[i]) b |= 1 << i;
    }
    relays[m] = r;
    lights[m] = li;
    buttons[m] = b;
  }
  const cells = new Uint8Array(ROWS * COLS);
  for (let r = 0; r < ROWS; r++)
    for (let j = 0; j < COLS; j++) cells[r * COLS + j] = rel(L.CELL(r, j)) ? 1 : 0;
  wireCur = sim.getWireCurrents(wireCur);
  postMessage({
    type: 'state',
    relays,
    lights,
    buttons,
    cells,
    tok: tokenRow(),
    shapeIx: shapeAt(),
    pos: posAt(),
    dealing,
    autoOn,
    gameOver: rel(L.GAMEOVER),
    motorAngle: sim.motorAngle,
    status,
    wireCur: wireCur.slice(),
  });
}
function press(b: { button: number; machine: number }) {
  sim.pressButton(b.button, b.machine);
  sim.releaseButton(b.button, b.machine);
}

// keys queue while the machine is mid-chain, exactly like /tetris/
const keyQueue: string[] = [];
function drainKeys() {
  if (busy || keyQueue.length === 0) return;
  if (rel(L.GAMEOVER)) { keyQueue.length = 0; return; }
  handleKey(keyQueue.shift() as string);
}

let busy = true;
function runTick() {
  if (busy) return;
  busy = true;
  const step = (n: number) => {
    sim.setSlide(IO.tick.slide, 'right', IO.tick.machine);
    post();
    setTimeout(() => {
      sim.setSlide(IO.tick.slide, 'left', IO.tick.machine);
      post();
      if ((rel(L.LKS) || rel(L.LANE)) && n < 3 * ROWS + 6) setTimeout(() => step(n + 1), 16);
      else {
        busy = false;
        drainKeys();
        deal();
      }
    }, 50);
  };
  step(0);
}

// THE WHEEL DEALER: at deal time the motor's CURRENT position — a
// wall-clock physical value, the dial having spun freely since the
// last read — names the piece, and the worker cranks the ring to it
// with real clamped UP presses (every transition still allowed or
// refused by the contacts). JS is the operator's eyes and hand, the
// 1961 manual's own procedure; the CHOICE is the wheel's phase. a
// piece appears in about a second. Enter during the crank serves the
// moment it lands.
let dealing = false;
function deal() {
  if (busy || dealing || rel(L.GAMEOVER) || tokenRow() >= 0) return;
  dealing = true;
  busy = true;
  sim.tick(); // advance the motor by wall-clock and read the dial
  const target = WHEEL_TABLE[sim.motorPosition % 16];
  let guard = 3 * SELECTION_CYCLE.length;
  const step = () =>
    setTimeout(() => {
      if (rel(L.GAMEOVER)) { dealing = false; busy = false; post('game over — reload'); return; }
      const cur = shapeAt();
      if (cur === target || guard-- <= 0) {
        dealing = false;
        if (tokenRow() < 0) press(IO.start); // the wheel chose; serve now
        busy = false;
        post(`dealt: ${SHAPES[shapeAt()]?.label}`);
        drainKeys();
        return;
      }
      const nIx = SELECTION_NEXT(cur);
      const { min, max } = shapeRange(SHAPES[nIx], COLS);
      const p = posAt();
      const nPos = Math.min(max, Math.max(min, p));
      if (p !== nPos) press(p < nPos ? IO.right : IO.left);
      else press(IO.up);
      post();
      step();
    }, 30);
  step();
}
let autoOn = false;
let autoTimer: ReturnType<typeof setInterval> | undefined;
function setAuto(on: boolean) {
  autoOn = on;
  if (on && autoTimer === undefined) {
    autoTimer = setInterval(() => {
      if (rel(L.GAMEOVER)) return;
      if (busy) return;
      runTick();
    }, 900);
  } else if (!on && autoTimer !== undefined) {
    clearInterval(autoTimer);
    autoTimer = undefined;
  }
}

function handleKey(key: string) {
  if (key === 'a') { setAuto(!autoOn); return; }
  if (dealing && (key === 'ArrowDown' || key === ' ' || key === 'Enter')) return; // the crank serves itself on arrival
  if (busy) {
    if (keyQueue.length < 4) keyQueue.push(key);
    return;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (posAt() < 0) return;
    press(key === 'ArrowRight' ? IO.right : IO.left);
    post();
  } else if (key === 'ArrowUp') {
    press(IO.up);
    post();
  } else if (key === 'ArrowDown' || key === ' ') {
    runTick();
  } else if (key === 'Enter') {
    if (tokenRow() < 0 && !rel(L.GAMEOVER)) { press(IO.start); post(); }
  }
}
onmessage = (e: MessageEvent) => {
  const d = e.data as { type: string; key?: string };
  if (d.type === 'go') go();
  else if (d.type === 'key') {
    if (!started) go(); // a key is as good as Play
    handleKey(d.key as string);
  }
};

// the dial spins visibly on the canvas: light angle pings between solves
setInterval(() => {
  sim.tick();
  postMessage({ type: 'motor', angle: sim.motorAngle });
}, 120);

// boot: the wall renders and the wheel spins, but the GAME holds until
// the page's Play button sends 'go' (the user's call: fully paused
// under the load modal)
busy = false;
post('ready');
let started = false;
function go() {
  if (started) return;
  started = true;
  deal();
  setAuto(true);
}
