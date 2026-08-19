/**
 * multivac mini-tetris — the minimal viewer. No minivac drawings: just the
 * playfield as big pixels and a keyboard wired to the machine's inputs.
 * The pixels ARE relay armatures: each cell reads a field-cell relay, the
 * falling piece reads the token ring's slaves. Everything the game decides
 * (falling, landing, stacking, line clears) happens inside the 145-relay
 * circuit; this page only flips the tick slide, the column slides, and the
 * START button — exactly what a human at 25 real Minivacs would do.
 *
 * Per the UI performance invariants: no react, no per-frame state — plain
 * DOM, redrawn only after an interaction settles.
 */

import { MinivacSimulator, setSolverEngine } from './simulator/minivac-simulator';
import { tetrisCircuit, MACHINES, TETRIS_IO } from './circuits/multivac-mini-tetris';

setSolverEngine('sparse');

const ROWS = 8;
const COLS = 4;

const root = document.getElementById('root')!;
document.body.style.cssText =
  'margin:0;min-height:100vh;background:#101216;color:#c8cdd4;display:flex;' +
  'align-items:center;justify-content:center;font:14px/1.5 ui-monospace,Menlo,monospace;';
root.innerHTML = `
  <div style="text-align:center;padding:24px">
    <h1 style="font-size:16px;font-weight:600;letter-spacing:.06em;color:#e8e2d0;margin:0 0 4px">
      multivac tetris</h1>
    <div style="color:#7a828c;margin-bottom:18px">145 relays / ${MACHINES} minivacs — pure wiring</div>
    <div id="colrow" style="display:grid;grid-template-columns:repeat(${COLS},56px);gap:8px;justify-content:center;margin-bottom:6px"></div>
    <div id="grid" style="display:grid;grid-template-columns:repeat(${COLS},56px);gap:8px;justify-content:center"></div>
    <div id="status" style="margin-top:16px;color:#9aa3ad;min-height:1.5em">wiring the relays…</div>
    <div style="margin-top:10px;color:#5c646e">
      &larr;/&rarr; column &nbsp;&middot;&nbsp; &darr; or space = tick &nbsp;&middot;&nbsp; enter = start
    </div>
    <details style="margin-top:18px;color:#5c646e;text-align:left;max-width:520px">
      <summary style="cursor:pointer;text-align:center">dump the circuit</summary>
      <pre id="dump" style="font-size:10px;line-height:1.35;max-height:280px;overflow:auto;background:#0a0c0f;padding:10px;border-radius:8px"></pre>
    </details>
  </div>`;

const grid = document.getElementById('grid')!;
const colrow = document.getElementById('colrow')!;
const status = document.getElementById('status')!;

const pixels: HTMLDivElement[][] = [];
for (let r = 0; r < ROWS; r++) {
  pixels.push([]);
  for (let j = 0; j < COLS; j++) {
    const d = document.createElement('div');
    d.style.cssText =
      'width:56px;height:56px;border-radius:10px;background:#1b2027;transition:background .12s';
    grid.appendChild(d);
    pixels[r].push(d);
  }
}
const colMarks: HTMLDivElement[] = [];
for (let j = 0; j < COLS; j++) {
  const d = document.createElement('div');
  d.style.cssText = 'height:10px;border-radius:4px;background:transparent';
  colrow.appendChild(d);
  colMarks.push(d);
}

const { wires } = tetrisCircuit();
document.getElementById('dump')!.textContent =
  `${wires.length} wires, ${MACHINES} machines\n\n` + wires.join('\n');

let column = 0;
let busy = true;
let ticks = 0;
let sim: MinivacSimulator;

function relay(loc: { machine: number; index: number }): boolean {
  return sim.getMachineState(loc.machine).relays[loc.index];
}

function tokenRow(): number {
  for (let i = 0; i < ROWS; i++) if (relay(TETRIS_IO.tokenRelay(i))) return i;
  return -1;
}

function render(note?: string) {
  const tok = tokenRow();
  for (let r = 0; r < ROWS; r++) {
    for (let j = 0; j < COLS; j++) {
      const on = relay(TETRIS_IO.cellRelay(r, j));
      const isPiece = r === tok && j === column;
      pixels[r][j].style.background = isPiece ? '#7fd4ff' : on ? '#ffb000' : '#1b2027';
    }
  }
  for (let j = 0; j < COLS; j++) {
    colMarks[j].style.background = j === column ? '#7fd4ff' : 'transparent';
  }
  const alerts = sim.getState().alerts;
  status.textContent =
    note ??
    `tick ${ticks} — ${tok >= 0 ? `piece at row ${tok}` : 'no piece (enter to spawn)'}` +
      (alerts.length ? ` — ${alerts.join('; ')}` : '');
}

// the sparse solve is synchronous (~0.2s per relaxation at 25 machines), so
// interactions paint a "settling" note first, then run the solve
function act(label: string, fn: () => void) {
  if (busy) return;
  busy = true;
  status.textContent = `${label} — relays settling…`;
  setTimeout(() => {
    fn();
    busy = false;
    render();
  }, 15);
}

function setColumn(j: number) {
  for (let k = 0; k < COLS; k++) {
    const s = TETRIS_IO.pieceSlide(k);
    sim.setSlide(s.slide, k === j ? 'right' : 'left', s.machine);
  }
}

document.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const next = Math.min(COLS - 1, Math.max(0, column + (e.key === 'ArrowRight' ? 1 : -1)));
    if (next === column) return;
    act(`column ${next}`, () => {
      column = next;
      setColumn(column);
    });
  } else if (e.key === 'ArrowDown' || e.key === ' ') {
    act('tick', () => {
      const t = TETRIS_IO.tick;
      sim.setSlide(t.slide, 'right', t.machine);
      sim.setSlide(t.slide, 'left', t.machine);
      ticks++;
    });
  } else if (e.key === 'Enter') {
    act('start', () => {
      const b = TETRIS_IO.start;
      sim.pressButton(b.button, b.machine);
      sim.releaseButton(b.button, b.machine);
    });
  }
});

// boot: build + settle the machine off the main paint
setTimeout(() => {
  sim = new MinivacSimulator(wires, false, MACHINES);
  sim.initialize();
  setColumn(0);
  busy = false;
  render('ready — press enter to spawn a piece');
}, 30);
