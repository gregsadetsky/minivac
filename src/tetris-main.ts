/**
 * multivac mini-tetris — the minimal viewer. No minivac drawings: just the
 * playfield as big pixels and a keyboard wired to the machine's inputs.
 * The pixels ARE relay armatures: each cell reads a field-cell relay, the
 * falling piece reads the token ring's slaves, the piece's COLUMN reads
 * the position register's slaves, and since the shape ring (3b-3a) the
 * piece's SHAPE reads a 12-state one-hot ring stepped by the UP button —
 * steering AND reshaping are machine state: this page no longer knows
 * where the piece is or what shape it has, it asks. Everything the game
 * decides (falling, landing,
 * stacking, line clears, the two-row vertical write, the row collapse
 * that walks the stack down after a clear) happens inside the circuit —
 * now the 12-ROW WELL: the generator is rows-parameterized (rung 11); the
 * relay/machine counts on screen are computed from the layout. the page
 * only works the tick/shape slides, the LEFT/RIGHT buttons and START —
 * exactly what a human at that many real Minivacs would do.
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
import { tetrisCircuit, SHAPES, shapeRange } from './circuits/multivac-mini-tetris';

// the 'fast' engine: typed-array rewrite of the sparse solver, validated
// against the dense oracle on 5000 random circuits (zero mismatches, max
// current diff 1.1e-10 mA) and the full suite. ~15x: a game tick dropped
// from ~1.2s to ~70-100ms. the suite's default engine remains 'sparse'.
setSolverEngine('fast');

const ROWS = 12; // the tall well (rung 11): the generator is rows-parameterized
const COLS = 6; // the wider well (was 4; the generator + emitters are cols-general)

const { wires, layout: L, btnMachine } = tetrisCircuit(ROWS, COLS);
const loc = (n: number) => ({ machine: Math.floor(n / 6), index: n % 6 });
const IO = {
  tick: { slide: 5, machine: 1 },
  start: { button: 6, machine: 1 },
  left: { button: 3, machine: btnMachine },
  right: { button: 4, machine: btnMachine },
  up: { button: 2, machine: btnMachine },
  auto: { slide: (L.TOSC % 6) + 1, machine: Math.floor(L.TOSC / 6) },
  oscRelay: loc(L.TDRV), // up = the oscillator is holding the tick line high
  shapeRelay: (i: number) => loc(i < 6 ? L.SHR(i, 2) : i < 9 ? L.SHR2(i, 2) : L.SHR3(i, 2)),
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
    <div style="margin-top:14px;color:#5c646e;font-size:11px">the machine wall — every armature, live</div>
    <canvas id="wall" style="margin-top:4px;image-rendering:pixelated"></canvas>
    <div style="margin-top:10px;color:#5c646e">
      &larr;/&rarr; move &nbsp;&middot;&nbsp; &uarr; = shape &nbsp;&middot;&nbsp; &darr;/space = tick &nbsp;&middot;&nbsp; a = auto-gravity &nbsp;&middot;&nbsp; enter = start &nbsp;&middot;&nbsp; m = sound
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

// the shape set lives in the circuit file now (single source of truth
// with the ring order and the wider-well emitter); the page only renders
// its labels and geometry.
// the selected shape lives IN THE RELAYS (like the position): read it back
function shapeAt(): number {
  for (let i = 0; i < SHAPES.length; i++) if (relay(IO.shapeRelay(i))) return i;
  return 0;
}
const shape = () => SHAPES[shapeAt()];
let busy = true;
let ticks = 0;
let sim: MinivacSimulator;
const shapeLabel = () => shape().label;
// position bounds per shape: BOTH rows must fit the well
const minPos = () => shapeRange(shape(), COLS).min;
const maxPos = () => shapeRange(shape(), COLS).max;

function relay(loc: { machine: number; index: number }): boolean {
  return sim.getMachineState(loc.machine).relays[loc.index];
}

// the clatter: the real machine is 400+ relays and every armature clicks.
// Each paint diffs the relay states and plays a staggered burst of the
// app's real relay samples, capped so a collapse doesn't fire hundreds.
const clickOn = new Audio('/relay-on.mp3');
const clickOff = new Audio('/relay-off.mp3');
let soundOn = true;
const prevStates: boolean[][] = [];
function clatter() {
  let on = 0;
  let off = 0;
  for (let m = 0; m < L.machines; m++) {
    const rel = sim.getMachineState(m).relays;
    const prev = prevStates[m];
    for (let i = 0; i < 6; i++) {
      const now = !!rel[i];
      if (prev && prev[i] !== now) {
        if (now) on++;
        else off++;
      }
    }
    prevStates[m] = rel.slice();
  }
  if (!soundOn) return;
  const bursts = Math.min(7, on + off);
  for (let k = 0; k < bursts; k++) {
    const a = (k < Math.min(4, on) ? clickOn : clickOff).cloneNode() as HTMLAudioElement;
    a.volume = 0.18 + Math.random() * 0.22;
    setTimeout(() => {
      a.play().catch(() => {});
    }, Math.random() * 110);
  }
}

// the piece's column lives in the machine: the position register's
// one-hot slaves (seeded at the home column from power-on)
function posAt(): number {
  for (let j = 0; j < COLS; j++) if (relay(IO.posRelay(j))) return j;
  return -1;
}

function mask(): number {
  const s = shape();
  const p = posAt();
  if (p < 0) return 0;
  const sh = p + s.bOff;
  if (sh < 0 || sh + s.bW > COLS) return 0; // mirrors the fan's omitted terms
  return (((1 << s.bW) - 1) << sh) & ((1 << COLS) - 1);
}

function topMask(): number {
  const s = shape();
  const p = posAt();
  if (p < 0 || s.tW === 0) return 0;
  // out-of-bounds = EMPTY top, mirroring the machine's T fan exactly (its
  // invalid-pos branches are omitted); happens transiently after a reset
  // re-homes the register, before the operator steps back in bounds
  const sh = p + s.tOff;
  if (sh < 0 || sh + s.tW > COLS) return 0;
  return (((1 << s.tW) - 1) << sh) & ((1 << COLS) - 1);
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

// every gameplay rule lives IN THE CONTACTS now: lateral legality (the
// D-tap changeover trees, TRUE staggered top columns included), the fit
// bounds, the collision, AND — since 3b-3c — the RESHAPE: the shape
// ring's clock only conducts when the target shape's new cells are free
// at the current spot. The page presses buttons and reads back what the
// machine did; it holds no game model at all. The one guard left is the
// Enter key's double-spawn interlock (a 1961 operator's discipline,
// documented at the handler).

// THE MACHINE WALL: all the minivacs as tiles on one canvas, six
// armature dots each, redrawn directly per paint (no per-frame state —
// the UI invariant). This is the whole multivac at a glance: the game
// above is what those armatures are doing.
const wall = document.getElementById('wall') as HTMLCanvasElement;
const WALL_COLS = 17;
const WALL_TILE_W = 26;
const WALL_TILE_H = 16;
const wallRows = Math.ceil(L.machines / WALL_COLS);
wall.width = WALL_COLS * WALL_TILE_W;
wall.height = wallRows * WALL_TILE_H;
wall.style.width = `${wall.width}px`;
const wctx = wall.getContext('2d')!;
function drawWall() {
  wctx.fillStyle = '#0a0c0f';
  wctx.fillRect(0, 0, wall.width, wall.height);
  for (let m = 0; m < L.machines; m++) {
    const x = (m % WALL_COLS) * WALL_TILE_W;
    const y = Math.floor(m / WALL_COLS) * WALL_TILE_H;
    wctx.fillStyle = '#161a20';
    wctx.fillRect(x + 1, y + 1, WALL_TILE_W - 2, WALL_TILE_H - 2);
    const rel = sim.getMachineState(m).relays;
    for (let i = 0; i < 6; i++) {
      const rx = x + 3 + (i % 3) * 7;
      const ry = y + 3 + Math.floor(i / 3) * 6;
      wctx.fillStyle = rel[i] ? '#ffb000' : '#2a2f38';
      wctx.fillRect(rx, ry, 5, 4);
    }
  }
}

function render(note?: string) {
  clatter();
  drawWall();
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
  const bm = mask();
  const tm = topMask(); // = bm for symmetric tall shapes, shifted for S/Z
  for (let r = 0; r < ROWS; r++) {
    for (let j = 0; j < COLS; j++) {
      const on = relay(IO.cellRelay(r, j));
      const isPiece =
        (r === tok && ((bm >> j) & 1) === 1) ||
        (tok > 0 && r === tok - 1 && ((tm >> j) & 1) === 1);
      pixels[r][j].style.background = isPiece ? '#7fd4ff' : on ? '#ffb000' : '#1b2027';
    }
  }
  const um = bm | tm;
  for (let j = 0; j < COLS; j++) {
    colMarks[j].style.background = ((um >> j) & 1) === 1 ? '#7fd4ff' : 'transparent';
  }
  // under AUTO the oscillator's transition solve BUZZES by design (a
  // real relay oscillator buzzes; chatter pins de-energized) — that one
  // alert is expected physics, not a fault, so it stays off the status
  const alerts = sim.getState().alerts;
  status.textContent =
    note ??
    `tick ${ticks}${autoOn ? ' (auto)' : ''} — score ${scoreAt()} — ${shapeLabel()}${tok >= 0 ? ` at row ${tok}` : ' (enter to spawn)'}` +
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
    drainKeys();
  }, 15);
}

// after a lock the reset tick re-homes the register to column 0 — out of
// bounds for a staggered shape (S needs pos>=1). The operator steps the
// fresh position back in bounds BEFORE the next spawn (pre-spawn steps
// are legal: no token, the legality rails read empty). Nothing else to
// sync: the machine's T fan follows the register by itself.
function resyncPiece() {
  let cur = posAt();
  let guard = 0;
  while (cur >= 0 && cur < minPos() && guard++ < COLS) {
    press(IO.right);
    cur = posAt();
  }
  while (cur > maxPos() && guard++ < COLS) {
    press(IO.left);
    cur = posAt();
  }
}

// one tick — plus however many the machine owes itself afterwards: a
// lock leaves the LOCKED slave up until the (vertical) phase-2 write
// and the reset have run. Auto-running them keeps the keyboard from
// re-steering the piece between the bottom and top writes. The tick is
// painted MID-PRESS too: a completed line is lit only while the tick
// slide is held (the flash — CLEARP drops the row on the release), and
// slamming press+release into one paint made every clear look like a
// row silently vanishing.
function runTick() {
  busy = true;
  status.textContent = 'tick — relays settling…';
  const cellsBefore = Array.from({ length: ROWS }, (_, r) => rowCells(r));
  const step = (n: number) =>
    // the PLAYER'S tick (n=0) keeps the theatrical rhythm — the line
    // flash is only visible while the slide is held. The OWED ticks
    // (bookkeeping + the collapse walk) run at native speed: the relays
    // themselves are quasi-static, so the only real cost is the solve;
    // one frame of hold keeps each walk stage visible without the old
    // 120ms-per-tick wait (a 12-row cascade was ~5s of pure theater).
    setTimeout(() => {
      const t = IO.tick;
      sim.setSlide(t.slide, 'right', t.machine);
      render(
        n === 0
          ? 'holding the tick…'
          : relay(IO.collapseRelay)
            ? 'line cleared — the stack falls…'
            : 'locked — the machine runs its bookkeeping ticks…'
      );
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
          // n>0 means a lock's bookkeeping ran, i.e. the register was
          // re-homed — shapes whose range excludes the home column need
          // their bounds back (resync no-ops when already in range)
          if (n > 0 && !relay(IO.gameOverRelay)) resyncPiece();
          busy = false;
          const cleared = cellsBefore.some((c, r) => c > 0 && rowCells(r) === 0);
          render(cleared ? `tick ${ticks} — line cleared! the stack fell in` : undefined);
          drainKeys();
        }
      }, n === 0 ? 120 : 16);
    }, n === 0 ? 15 : 0);
  step(0);
}

// auto-gravity: a timer cycles the TICK SLIDE at operator cadence — the
// same single-step path as ArrowDown, proven one row per tick. (The
// in-machine capacitor oscillator from 3b-5 still exists and oscillates
// — engine-parity-exact — but under the quasi-static solver its
// transition relaxations FLUTTER and each flutter cycle reaches the
// ring as a full tick edge: 3-4 rows per solve, reproduced identically
// with a follower relay and a two-cap astable. The compressed-transient
// artifact is fundamental to the relaxation semantics, so the page
// clocks the game like a 1961 operator would: rhythmically, by hand.)
let autoOn = false;
let autoTimer: ReturnType<typeof setInterval> | undefined;
function setAuto(on: boolean) {
  autoOn = on;
  if (on && autoTimer === undefined) {
    autoTimer = setInterval(() => {
      if (busy || relay(IO.gameOverRelay)) return;
      runTick();
    }, 700);
  } else if (!on && autoTimer !== undefined) {
    clearInterval(autoTimer);
    autoTimer = undefined;
  }
}

// keys pressed while a solve is in flight used to be DROPPED (every
// branch guards on busy) — at 6 columns the solves are longer and the
// travel is wider, so real inputs vanished mid-play. now game keys
// queue (small FIFO) and drain in order whenever the machine settles.
const keyQueue: string[] = [];
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'];
function drainKeys() {
  if (busy || keyQueue.length === 0) return;
  if (relay(IO.gameOverRelay)) {
    keyQueue.length = 0;
    return;
  }
  handleKey(keyQueue.shift() as string);
}
document.addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.key)) e.preventDefault();
  handleKey(e.key);
});
function handleKey(key: string) {
  const e = { key };
  if (busy && GAME_KEYS.includes(key) && !relay(IO.gameOverRelay)) {
    if (keyQueue.length < 4) keyQueue.push(key);
    return;
  }
  if (e.key === 'm' || e.key === 'M') {
    soundOn = !soundOn;
    if (!busy) render(soundOn ? 'relay clatter on' : 'relay clatter off');
    return;
  }
  if (e.key === 'a' || e.key === 'A') {
    // game over pins busy to freeze the game keys — but the tick slide
    // must stay reachable, or gravity could never be stopped again
    if (busy && !relay(IO.gameOverRelay)) return;
    setAuto(!autoOn);
    render(autoOn ? 'auto-gravity on — the tick slide runs at operator cadence' : 'auto-gravity off');
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (busy) return;
    const p = posAt();
    if (p < 0) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    // the machine decides ALL of it since 3b-3b: stored cells under the
    // TRUE target footprint (an S/Z top pair enters a shifted column —
    // the trees read exactly those now), the wide edges, the wall, and
    // the staggered fit bounds all refuse in contacts. The page skips
    // only the obvious edge no-ops, then presses and reads back whether
    // the register stepped.
    const next = Math.min(maxPos(), Math.max(minPos(), p + dir));
    if (next === p) return;
    act(`column ${next}`, () => {
      press(dir > 0 ? IO.right : IO.left);
      if (posAt() === p) return 'blocked — the contacts refused the step';
      // nothing to re-sync: the machine's T fan follows the register
    });
  } else if (e.key === 'ArrowUp') {
    // step the SHAPE RING — a machine button, exactly like LEFT/RIGHT.
    // Since 3b-3c the transition legality lives in the contacts too: the
    // ring's clock only conducts when the target shape's new cells are
    // free here and its fit range allows this column, so the page just
    // presses and reads back. The clamp steps first are operator
    // kindness — walking into the target's range (S needs pos>=1, Z
    // pos<=1, wide shapes pos<=2) instead of letting the bound refuse.
    if (busy) return;
    const p = posAt();
    if (p < 0) return;
    const nIx = (shapeAt() + 1) % SHAPES.length;
    const ns = SHAPES[nIx];
    const { min: nMin, max: nMax } = shapeRange(ns, COLS);
    const nPos = Math.min(nMax, Math.max(nMin, p));
    act(ns.label, () => {
      // the clamp = operator steps, machine-checked per the CURRENT shape
      let cur = p;
      let guard = 0;
      while (cur !== nPos && guard++ < COLS) {
        press(cur < nPos ? IO.right : IO.left);
        const stepped = posAt();
        if (stepped === cur) break; // the contacts refused
        cur = stepped;
      }
      press(IO.up);
      if (shapeAt() !== nIx) return 'blocked — the contacts refused the reshape';
    });
  } else if (e.key === 'ArrowDown' || e.key === ' ') {
    if (busy) return;
    runTick();
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
    if (busy) return;
    act('start', () => {
      const b = IO.start;
      sim.pressButton(b.button, b.machine);
      sim.releaseButton(b.button, b.machine);
    });
  }
}

// boot: build + settle the machine off the main paint
setTimeout(() => {
  sim = new MinivacSimulator(wires, false, L.machines);
  sim.initialize();
  // nothing to apply: the shape ring seeds at 1x1, the slides stay parked
  busy = false;
  render('ready — press enter to spawn a piece');
}, 30);
