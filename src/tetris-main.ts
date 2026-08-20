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
 * that walks the stack down after a clear) happens inside the circuit —
 * now the 12-ROW WELL: the generator is rows-parameterized (rung 11), so
 * this page plays 396 relays across 68 minivacs; the page only works the
 * tick/shape slides, the LEFT/RIGHT buttons and START — exactly what a
 * human at 68 real Minivacs would do.
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
import { tetrisCircuit } from './circuits/multivac-mini-tetris';

// the 'fast' engine: typed-array rewrite of the sparse solver, validated
// against the dense oracle on 5000 random circuits (zero mismatches, max
// current diff 1.1e-10 mA) and the full suite. ~15x: a game tick dropped
// from ~1.2s to ~70-100ms. the suite's default engine remains 'sparse'.
setSolverEngine('fast');

const ROWS = 12; // the tall well (rung 11): the generator is rows-parameterized
const COLS = 4;

const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS);
const loc = (n: number) => ({ machine: Math.floor(n / 6), index: n % 6 });
const IO = {
  tick: { slide: 5, machine: 1 },
  start: { button: 6, machine: 1 },
  vmode: { slide: (L.VMODE % 6) + 1, machine: Math.floor(L.VMODE / 6) },
  wid: { slide: 5, machine: btnMachine },
  left: { button: 3, machine: btnMachine },
  right: { button: 4, machine: btnMachine },
  lockedRelay: loc(L.LKS),
  collapseRelay: loc(L.LANE),
  gameOverRelay: loc(L.GAMEOVER),
  scoreRelay: (i: number) => loc(L.SCR(i, 2)),
  posRelay: (j: number) => loc(L.POSS(j)),
  cellRelay: (r: number, j: number) => loc(L.CELL(r, j)),
  tokenRelay: (i: number) => loc(L.RING(i, 2)),
};

const root = document.getElementById('root')!;
document.body.style.cssText =
  'margin:0;min-height:100vh;background:#101216;color:#c8cdd4;display:flex;' +
  'align-items:center;justify-content:center;font:14px/1.5 ui-monospace,Menlo,monospace;';
root.innerHTML = `
  <div style="text-align:center;padding:24px">
    <h1 style="font-size:16px;font-weight:600;letter-spacing:.06em;color:#e8e2d0;margin:0 0 4px">
      multivac tetris</h1>
    <div style="color:#7a828c;margin-bottom:18px">${L.relays} relays / ${L.machines} minivacs — pure wiring</div>
    <div id="colrow" style="display:grid;grid-template-columns:repeat(${COLS},44px);gap:8px;justify-content:center;margin-bottom:6px"></div>
    <div id="grid" style="display:grid;grid-template-columns:repeat(${COLS},44px);gap:8px;justify-content:center"></div>
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
      'width:44px;height:44px;border-radius:9px;background:#1b2027;transition:background .12s';
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

document.getElementById('dump')!.textContent =
  `${wires.length} wires, ${L.machines} machines\n\n` + wires.join('\n');

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
// one-hot slaves (seeded at the home column from power-on)
function posAt(): number {
  for (let j = 0; j < COLS; j++) if (relay(IO.posRelay(j))) return j;
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

// the score ring's one-hot digit (0..9, wraps)
function scoreAt(): number {
  for (let i = 0; i < 10; i++) if (relay(IO.scoreRelay(i))) return i;
  return 0;
}

function tokenRow(): number {
  for (let i = 0; i < ROWS; i++) if (relay(IO.tokenRelay(i))) return i;
  return -1;
}

function rowCells(r: number): number {
  let n = 0;
  for (let j = 0; j < COLS; j++) if (relay(IO.cellRelay(r, j))) n++;
  return n;
}

// lateral legality lives IN THE CONTACTS: every D-tap runs through
// LEGINV/LEGINVT changeovers reading "target column occupied at the
// token row / one row above it", so the machine itself refuses sideways
// moves into stored cells — bottom AND top cell of a tall piece, wide
// edges included (the page just presses the button and reads back
// whether the register stepped). This JS check remains for exactly ONE
// seam: the ArrowUp RESHAPE — changing width/tallness is a slide, and a
// slide cannot be electrically refused.
function wouldOverlap(nPos: number, nWidth: number, nTall: boolean): boolean {
  const tok = tokenRow();
  if (tok < 0) return false;
  const m = (nWidth === 2 ? 0b11 : 0b1) << nPos;
  for (let j = 0; j < COLS; j++) {
    if (((m >> j) & 1) === 0) continue;
    if (relay(IO.cellRelay(tok, j))) return true;
    if (nTall && tok > 0 && relay(IO.cellRelay(tok - 1, j))) return true;
  }
  return false;
}

function render(note?: string) {
  if (relay(IO.gameOverRelay)) {
    // the latch is relay-held: only a power cycle clears it
    for (let r = 0; r < ROWS; r++)
      for (let j = 0; j < COLS; j++)
        if (relay(IO.cellRelay(r, j))) pixels[r][j].style.background = '#8a4a3a';
    status.textContent = `game over — score ${scoreAt()} — reload for a new game`;
    busy = true; // freeze the keyboard; the machine won\'t spawn anyway
    return;
  }
  const tok = tokenRow();
  const m = mask();
  for (let r = 0; r < ROWS; r++) {
    for (let j = 0; j < COLS; j++) {
      const on = relay(IO.cellRelay(r, j));
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
    `tick ${ticks} — score ${scoreAt()} — ${shapeLabel()}${tok >= 0 ? ` at row ${tok}` : ' (enter to spawn)'}` +
      (alerts.length ? ` — ${alerts.join('; ')}` : '');
}

// the solve is synchronous (~10ms per solve under 'fast'; a tick is ~70-100ms
// at 25 machines), so interactions paint a "settling" note first
function act(label: string, fn: () => string | void) {
  if (busy) return;
  busy = true;
  status.textContent = `${label} — relays settling…`;
  setTimeout(() => {
    const note = fn();
    busy = false;
    render(note ?? undefined);
  }, 15);
}

function applyShape() {
  const w = IO.wid;
  sim.setSlide(w.slide, width === 2 ? 'right' : 'left', w.machine);
  const v = IO.vmode;
  sim.setSlide(v.slide, tall ? 'right' : 'left', v.machine);
}

document.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (busy) return;
    const p = posAt();
    if (p < 0) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    // the machine decides everything here: stored cells (bottom and top
    // rows), the wide edges, and the wall all refuse in contacts. The
    // page skips only the obvious edge no-ops, then presses and reads
    // back whether the register stepped.
    const next = Math.min(COLS - width, Math.max(0, p + dir));
    if (next === p) return;
    act(`column ${next}`, () => {
      press(dir > 0 ? IO.right : IO.left);
      if (posAt() === p) return 'blocked — the contacts refused the step';
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
      if (nPos < p) {
        press(IO.left); // widening at the wall: step in first
        if (posAt() !== nPos) return 'blocked — no room for that shape here';
      }
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
        const t = IO.tick;
        sim.setSlide(t.slide, 'right', t.machine);
        render('holding the tick…');
        setTimeout(() => {
          sim.setSlide(t.slide, 'left', t.machine);
          ticks++;
          // the machine owes itself ticks while LOCKED (phase 2 / reset)
          // or while a collapse walks the stack down (up to 21 more)
          if ((relay(IO.lockedRelay) || relay(IO.collapseRelay)) && n < 3 * ROWS + 6) {
            render(
              relay(IO.collapseRelay)
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
      const b = IO.start;
      sim.pressButton(b.button, b.machine);
      sim.releaseButton(b.button, b.machine);
    });
  }
});

// boot: build + settle the machine off the main paint
setTimeout(() => {
  sim = new MinivacSimulator(wires, false, L.machines);
  sim.initialize();
  applyShape();
  busy = false;
  render('ready — press enter to spawn a piece');
}, 30);
