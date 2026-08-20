/**
 * multivac mini-tetris — the minimal viewer. No minivac drawings: just the
 * playfield as big pixels and a keyboard wired to the machine's inputs.
 * The pixels ARE relay armatures: each cell reads a field-cell relay, the
 * falling piece reads the token ring's slaves, and the piece's COLUMN
 * reads the position register's slaves — steering is machine state now:
 * the arrow keys press momentary LEFT/RIGHT buttons and a one-hot relay
 * ring steps (edge presses self-loop); this page no longer knows where
 * the piece is, it asks. Everything the game decides (falling, landing,
 * stacking, line clears, the two-row vertical write, the row collapse
 * that walks the stack down after a clear) happens inside the 245-relay
 * circuit; the page only works the tick/shape slides, the LEFT/RIGHT
 * buttons and START — exactly what a human at 42 real Minivacs would do.
 * After a lock the machine owes itself bookkeeping ticks (the vertical
 * phase-2 write, then the reset, which also re-homes the register); the
 * page runs those automatically while the LOCKED slave is up, which also
 * keeps the keyboard from re-steering the piece between the bottom and
 * top writes.
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
    <div style="color:#7a828c;margin-bottom:18px">245 relays / ${MACHINES} minivacs — pure wiring</div>
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

let width = 1; // 1 or 2 columns (the WID slide)
let tall = false; // VMODE: the piece is 2 cells tall (the vertical rung)
let busy = true;
let ticks = 0;
let sim: MinivacSimulator;
const shapeLabel = () =>
  tall ? (width === 2 ? '2x2 square' : '2 tall') : width === 2 ? '2 wide' : '1x1';

function relay(loc: { machine: number; index: number }): boolean {
  return sim.getMachineState(loc.machine).relays[loc.index];
}

// the piece's column lives in the machine: the position register's
// one-hot slaves (dark until the first START seeds them)
function posAt(): number {
  for (let j = 0; j < COLS; j++) if (relay(TETRIS_IO.posRelay(j))) return j;
  return -1;
}

function mask(): number {
  const p = posAt();
  return p < 0 ? 0 : (width === 2 ? 0b11 : 0b1) << p;
}

function press(b: { button: number; machine: number }) {
  sim.pressButton(b.button, b.machine);
  sim.releaseButton(b.button, b.machine);
}

function tokenRow(): number {
  for (let i = 0; i < ROWS; i++) if (relay(TETRIS_IO.tokenRelay(i))) return i;
  return -1;
}

function rowCells(r: number): number {
  let n = 0;
  for (let j = 0; j < COLS; j++) if (relay(TETRIS_IO.cellRelay(r, j))) n++;
  return n;
}

// the register steps on any button press — lateral LEGALITY isn't in the
// contacts yet (that's the next increment: the step's D-path gated by
// "target column free at the token row"), so moving or reshaping into
// stored cells would overlap them (benign for the data: the lock is an
// OR-write; wrong as tetris). Until then, like the Enter guard below,
// the page plays the disciplined 1961 operator and refuses the keypress.
function wouldOverlap(nPos: number, nWidth: number, nTall: boolean): boolean {
  const tok = tokenRow();
  if (tok < 0) return false;
  const m = (nWidth === 2 ? 0b11 : 0b1) << nPos;
  for (let j = 0; j < COLS; j++) {
    if (((m >> j) & 1) === 0) continue;
    if (relay(TETRIS_IO.cellRelay(tok, j))) return true;
    if (nTall && tok > 0 && relay(TETRIS_IO.cellRelay(tok - 1, j))) return true;
  }
  return false;
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
  const w = TETRIS_IO.wid;
  sim.setSlide(w.slide, width === 2 ? 'right' : 'left', w.machine);
  const v = TETRIS_IO.vmode;
  sim.setSlide(v.slide, tall ? 'right' : 'left', v.machine);
}

document.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (busy) return;
    const p = posAt();
    if (p < 0) return; // the register is dark until the first START
    // the ring self-loops at columns 0 and 3; the wide piece's right edge
    // is a page clamp for now (the register doesn't know the width — the
    // legality increment folds it in via WIDM)
    const next = Math.min(COLS - width, Math.max(0, p + (e.key === 'ArrowRight' ? 1 : -1)));
    if (next === p) return;
    if (wouldOverlap(next, width, tall)) {
      render('blocked — the stack is in the way');
      return;
    }
    act(`column ${next}`, () => {
      press(e.key === 'ArrowRight' ? TETRIS_IO.right : TETRIS_IO.left);
    });
  } else if (e.key === 'ArrowUp') {
    // cycle 1x1 -> 2 wide -> 2 tall -> 2x2 (tall = the VMODE slide: the
    // machine writes the row above the token on the phase-2 tick)
    if (busy) return;
    const p = posAt();
    if (p < 0) return;
    let nWidth = width;
    let nTall = tall;
    if (!tall && width === 1) nWidth = 2;
    else if (!tall) {
      nTall = true;
      nWidth = 1;
    } else if (width === 1) nWidth = 2;
    else {
      nTall = false;
      nWidth = 1;
    }
    const nPos = Math.min(p, COLS - nWidth);
    if (wouldOverlap(nPos, nWidth, nTall)) {
      render('blocked — no room for that shape here');
      return;
    }
    act('shape', () => {
      if (nPos < p) press(TETRIS_IO.left); // widening at the wall: step in first
      width = nWidth;
      tall = nTall;
      applyShape();
    });
  } else if (e.key === 'ArrowDown' || e.key === ' ') {
    // one tick — plus however many the machine owes itself afterwards: a
    // lock leaves the LOCKED slave up until the (vertical) phase-2 write
    // and the reset have run. Auto-running them keeps the keyboard from
    // re-steering the piece between the bottom and top writes. The tick is
    // painted MID-PRESS too: a completed line is lit only while the tick
    // slide is held (the flash — CLEARP drops the row on the release), and
    // slamming press+release into one paint made every clear look like a
    // row silently vanishing.
    if (busy) return;
    busy = true;
    status.textContent = 'tick — relays settling…';
    const cellsBefore = Array.from({ length: ROWS }, (_, r) => rowCells(r));
    const step = (n: number) =>
      setTimeout(() => {
        const t = TETRIS_IO.tick;
        sim.setSlide(t.slide, 'right', t.machine);
        render('holding the tick…');
        setTimeout(() => {
          sim.setSlide(t.slide, 'left', t.machine);
          ticks++;
          // the machine owes itself ticks while LOCKED (phase 2 / reset)
          // or while a collapse walks the stack down (up to 21 more)
          if ((relay(TETRIS_IO.lockedRelay) || relay(TETRIS_IO.collapseRelay)) && n < 26) {
            render(
              relay(TETRIS_IO.collapseRelay)
                ? 'line cleared — the stack falls…'
                : 'locked — the machine runs its bookkeeping ticks…'
            );
            step(n + 1);
          } else {
            busy = false;
            const cleared = cellsBefore.some((c, r) => c > 0 && rowCells(r) === 0);
            render(cleared ? `tick ${ticks} — line cleared! the stack fell in` : undefined);
          }
        }, 120);
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
