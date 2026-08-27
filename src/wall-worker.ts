/**
 * THE WALL'S ENGINE ROOM (web worker). The user's trace receipt
 * (2026-08-27): the sparse solver owned 24.5s of a 26s trace ON THE
 * MAIN THREAD (dc 13.7s + rowMaxAbs 10.8s; draw() was 0.04s) — the
 * spin dealer solves the whole 176-machine circuit continuously, so
 * pointer events starved behind 3-second timer bursts. The sim and
 * the whole game loop live HERE now; the page only draws and sends
 * keys. Snapshots go out after every solve step: relay/light/button
 * bitmasks per machine, the well cells, and the wire currents the
 * canvas colors the cables with.
 */
import { MinivacSimulator } from './simulator/minivac-simulator';
import {
  tetrisCircuit,
  SHAPES,
  SELECTION_NEXT,
  shapeRange,
  ringPart,
} from './circuits/multivac-mini-tetris';

const ROWS = 8;
const COLS = 4;
const built = tetrisCircuit(ROWS, COLS);
const L = built.layout;
const N_MACHINES = L.machines;
const sim = new MinivacSimulator(built.wires, false, N_MACHINES);
sim.initialize();

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
    gameOver: rel(L.GAMEOVER),
    status,
    wireCur: wireCur.slice(),
  });
}
function press(b: { button: number; machine: number }) {
  sim.pressButton(b.button, b.machine);
  sim.releaseButton(b.button, b.machine);
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
        deal();
      }
    }, 60);
  };
  step(0);
}

// the free-run dealer (the /tetris/ design: the crank never chooses).
// SPIN PACE: ~8 presses/s — the 16ms aspiration was solve-bound anyway
// and burned a core; the show reads better at a visible cadence.
let dealing = false;
let serveReq = false;
let autoServeReq = false;
function deal() {
  if (busy || dealing || rel(L.GAMEOVER) || tokenRow() >= 0) return;
  dealing = true;
  busy = true;
  serveReq = false;
  autoServeReq = false;
  let steps = 0;
  const step = () =>
    setTimeout(() => {
      if (rel(L.GAMEOVER)) { dealing = false; busy = false; post('game over — reload'); return; }
      if (serveReq || (autoServeReq && steps >= SHAPES.length)) {
        dealing = false;
        if (tokenRow() < 0) press(IO.start);
        busy = false;
        post(`dealt: ${SHAPES[shapeAt()]?.label}`);
        return;
      }
      const cur = shapeAt();
      const nIx = SELECTION_NEXT(cur);
      const { min, max } = shapeRange(SHAPES[nIx], COLS);
      const p = posAt();
      const nPos = Math.min(max, Math.max(min, p));
      if (p !== nPos) press(p < nPos ? IO.right : IO.left);
      else {
        press(IO.up);
        if (shapeAt() !== cur) steps++;
      }
      post();
      step();
    }, 120);
  step();
}
let autoOn = false;
let autoTimer: ReturnType<typeof setInterval> | undefined;
function setAuto(on: boolean) {
  autoOn = on;
  if (on && autoTimer === undefined) {
    autoTimer = setInterval(() => {
      if (rel(L.GAMEOVER)) return;
      if (dealing) { autoServeReq = true; return; }
      if (busy) return;
      runTick();
    }, 900);
  } else if (!on && autoTimer !== undefined) {
    clearInterval(autoTimer);
    autoTimer = undefined;
  }
}

onmessage = (e: MessageEvent) => {
  const d = e.data as { type: string; key?: string };
  if (d.type !== 'key') return;
  const key = d.key as string;
  if (key === 'a') { setAuto(!autoOn); return; }
  if (dealing && (key === 'ArrowDown' || key === ' ' || key === 'Enter')) { serveReq = true; return; }
  if (busy) return;
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
};

// boot
busy = false;
post('ready — the ring spins');
deal();
setAuto(true);
