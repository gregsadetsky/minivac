/**
 * multivac mini-tetris — the minimal viewer. No minivac drawings: just the
 * playfield as big pixels and a keyboard wired to the machine's inputs.
 * The pixels ARE relay armatures: each cell reads a field-cell relay, the
 * falling piece reads the token ring's slaves. Everything the game decides
 * (falling, landing, stacking, line clears, the two-row vertical write)
 * happens inside the 163-relay circuit; this page only flips the tick
 * slide, the column and shape slides, and the START button — exactly what
 * a human at 28 real Minivacs would do. After a lock the machine owes
 * itself bookkeeping ticks (the vertical phase-2 write, then the reset);
 * the page runs those automatically while the LOCKED slave is up, which
 * also keeps the keyboard from re-steering the piece between the bottom
 * and top writes.
 *
 * Per the UI performance invariants: no react, no per-frame state — plain
 * DOM, redrawn only after an interaction settles.
 */

import { MinivacSimulator, setSolverEngine } from './simulator/minivac-simulator';
import { tetrisCircuit, MACHINES, TETRIS_IO } from './circuits/multivac-mini-tetris';

// the 'fast' engine: typed-array rewrite of the sparse solver, validated
// against the dense oracle on 5000 random circuits (zero mismatches, max
// current diff 1.1e-10 mA) and the full suite. ~15x: a game tick dropped
// from ~1.2s to ~70-100ms. the suite's default engine remains 'sparse'.
setSolverEngine('fast');

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
    <div style="color:#7a828c;margin-bottom:18px">163 relays / ${MACHINES} minivacs — pure wiring</div>
    <div id="colrow" style="display:grid;grid-template-columns:repeat(${COLS},56px);gap:8px;justify-content:center;margin-bottom:6px"></div>
    <div id="grid" style="display:grid;grid-template-columns:repeat(${COLS},56px);gap:8px;justify-content:center"></div>
    <div id="status" style="margin-top:16px;color:#9aa3ad;min-height:1.5em">wiring the relays…</div>
    <div style="margin-top:10px;color:#5c646e">
      &larr;/&rarr; move &nbsp;&middot;&nbsp; &uarr; = piece shape &nbsp;&middot;&nbsp; &darr;/space = tick &nbsp;&middot;&nbsp; enter = start
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

let pos = 0; // left edge of the piece
let width = 1; // 1 or 2 columns (any mask works in the circuit)
let tall = false; // VMODE: the piece is 2 cells tall (the vertical rung)
let busy = true;
let ticks = 0;
let sim: MinivacSimulator;
const mask = () => (width === 2 ? 0b11 : 0b1) << pos;
const shapeLabel = () =>
  tall ? (width === 2 ? '2x2 square' : '2 tall') : width === 2 ? '2 wide' : '1x1';

function relay(loc: { machine: number; index: number }): boolean {
  return sim.getMachineState(loc.machine).relays[loc.index];
}

function tokenRow(): number {
  for (let i = 0; i < ROWS; i++) if (relay(TETRIS_IO.tokenRelay(i))) return i;
  return -1;
}

function render(note?: string) {
  const tok = tokenRow();
  const m = mask();
  for (let r = 0; r < ROWS; r++) {
    for (let j = 0; j < COLS; j++) {
      const on = relay(TETRIS_IO.cellRelay(r, j));
      const inPiece = r === tok || (tall && tok > 0 && r === tok - 1);
      const isPiece = inPiece && ((m >> j) & 1) === 1;
      pixels[r][j].style.background = isPiece ? '#7fd4ff' : on ? '#ffb000' : '#1b2027';
    }
  }
  for (let j = 0; j < COLS; j++) {
    colMarks[j].style.background = ((m >> j) & 1) === 1 ? '#7fd4ff' : 'transparent';
  }
  const alerts = sim.getState().alerts;
  status.textContent =
    note ??
    `tick ${ticks} — ${shapeLabel()}${tok >= 0 ? ` at row ${tok}` : ' (enter to spawn)'}` +
      (alerts.length ? ` — ${alerts.join('; ')}` : '');
}

// the solve is synchronous (~10ms per solve under 'fast'; a tick is ~70-100ms
// at 25 machines), so interactions paint a "settling" note first
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

function applyShape() {
  const m = mask();
  for (let k = 0; k < COLS; k++) {
    const s = TETRIS_IO.pieceSlide(k);
    sim.setSlide(s.slide, ((m >> k) & 1) === 1 ? 'right' : 'left', s.machine);
  }
  const v = TETRIS_IO.vmode;
  sim.setSlide(v.slide, tall ? 'right' : 'left', v.machine);
}

document.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const next = Math.min(COLS - width, Math.max(0, pos + (e.key === 'ArrowRight' ? 1 : -1)));
    if (next === pos) return;
    act(`column ${next}`, () => {
      pos = next;
      applyShape();
    });
  } else if (e.key === 'ArrowUp') {
    // cycle 1x1 -> 2 wide -> 2 tall -> 2x2 (tall = the VMODE slide: the
    // machine writes the row above the token on the phase-2 tick)
    act('shape', () => {
      if (!tall && width === 1) {
        width = 2;
      } else if (!tall) {
        tall = true;
        width = 1;
      } else if (width === 1) {
        width = 2;
      } else {
        tall = false;
        width = 1;
      }
      pos = Math.min(pos, COLS - width);
      applyShape();
    });
  } else if (e.key === 'ArrowDown' || e.key === ' ') {
    // one tick — plus however many the machine owes itself afterwards: a
    // lock leaves the LOCKED slave up until the (vertical) phase-2 write
    // and the reset have run. Auto-running them keeps the keyboard from
    // re-steering the piece between the bottom and top writes.
    if (busy) return;
    busy = true;
    status.textContent = 'tick — relays settling…';
    const step = (n: number) =>
      setTimeout(() => {
        const t = TETRIS_IO.tick;
        sim.setSlide(t.slide, 'right', t.machine);
        sim.setSlide(t.slide, 'left', t.machine);
        ticks++;
        if (relay(TETRIS_IO.lockedRelay) && n < 3) {
          render();
          status.textContent = 'locked — the machine runs its bookkeeping ticks…';
          step(n + 1);
        } else {
          busy = false;
          render();
        }
      }, 15);
    step(0);
  } else if (e.key === 'Enter') {
    // the machine has no interlock here: START arms the SPAWN latch
    // unconditionally, and pressing it mid-fall would make the next ring
    // tick inject a SECOND token (two pieces falling, both rows OR-written
    // on the lock). A 1961 operator wouldn't press it mid-game; we guard
    // the key instead of spending 8 relay contacts on an interlock.
    if (tokenRow() >= 0) {
      render('a piece is already falling');
      return;
    }
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
  applyShape();
  busy = false;
  render('ready — press enter to spawn a piece');
}, 30);
