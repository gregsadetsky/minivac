/**
 * THE MULTIVAC WALL (/wall/ — 2026-08-27). v2 after the user's first
 * look: panels now follow the REACT PANEL'S REAL ANATOMY (the 19 rows
 * of MinivacPanel.tsx: numbers, lights, BINARY OUTPUT, the power
 * stripe, C/E/F, the relay covers, indicators, STORAGE, G/H/J, K/L/N,
 * the COMMON stripe, SECONDARY STORAGE, R/S/T, U/V/W, slides, BINARY
 * INPUT, X/Y/Z, buttons — plus the right-hand matrix/power block and
 * the motor dial), prebaked ONCE into a 2x template bitmap and
 * blitted per machine; only the living parts (lights, armatures,
 * indicators, buttons) draw per frame. Wires are DROOPY with a
 * shadow, and they stay visible at EVERY zoom via a cached world-size
 * wire layer re-rendered per state snapshot (vector-crisp up close).
 *
 * The sim lives in wall-worker.ts (trace receipt #1: main-thread
 * solver starved navigation) on the FAST engine at 12x6 (trace
 * receipt #2: the wall ran the Map-based default 'sparse' — rowMaxAbs
 * 10.7s — while /tetris/ runs 'fast'; and it was a smaller machine
 * than /tetris/'s. it is the SAME machine now). Keys queue in the
 * worker instead of dropping.
 */
import { tetrisCircuit, SHAPES } from './circuits/multivac-mini-tetris';

const ROWS = 12;
const COLS = 6;
const built = tetrisCircuit(ROWS, COLS);
const L = built.layout;
const wires = built.wires;
const N_MACHINES = L.machines;

// ---- the worker (the engine room) --------------------------------------
interface Snapshot {
  relays: Uint8Array;
  lights: Uint8Array;
  buttons: Uint8Array;
  cells: Uint8Array;
  tok: number;
  shapeIx: number;
  pos: number;
  dealing: boolean;
  autoOn: boolean;
  gameOver: boolean;
  motorAngle: number;
  status?: string;
  wireCur: Float32Array;
}
let motorAngle = 0; // machine 0's dial — THE WHEEL that deals
let snap: Snapshot | null = null;
// the clatter (/tetris/'s real relay samples): each snapshot diffs the
// armature bits and plays a staggered, capped burst. 'm' mutes.
const clickOn = new Audio('/relay-on.mp3');
const clickOff = new Audio('/relay-off.mp3');
let soundOn = true;
let prevRelays: Uint8Array | null = null;
function clatter(relays: Uint8Array) {
  let on = 0, off = 0;
  if (prevRelays) {
    for (let m = 0; m < N_MACHINES; m++) {
      const flips = prevRelays[m] ^ relays[m];
      for (let i = 0; i < 6; i++)
        if ((flips >> i) & 1) {
          if ((relays[m] >> i) & 1) on++;
          else off++;
        }
    }
  }
  prevRelays = relays.slice();
  if (!soundOn) return;
  const bursts = Math.min(7, on + off);
  for (let k = 0; k < bursts; k++) {
    const a = (k < Math.min(4, on) ? clickOn : clickOff).cloneNode() as HTMLAudioElement;
    a.volume = 0.18 + Math.random() * 0.22;
    setTimeout(() => { a.play().catch(() => {}); }, Math.random() * 110);
  }
}
const worker = new Worker(new URL('./wall-worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = (e: MessageEvent) => {
  const d = e.data as { type: string; angle?: number } & Snapshot;
  if (d.type === 'motor') {
    motorAngle = d.angle as number;
    needsPaint = true;
    return;
  }
  if (d.type !== 'state') return;
  snap = d;
  motorAngle = d.motorAngle;
  for (let m = 0; m < N_MACHINES; m++) {
    const r = d.relays[m];
    for (let i = 0; i < 6; i++) armTarget[m * 6 + i] = (r >> i) & 1;
  }
  clatter(d.relays);
  paintWell();
  scheduleWireLayer();
  needsPaint = true;
};

// ---- DOM scaffold ----------------------------------------------------
const root = document.getElementById('root')!;
// USER COPY: modal + footer text are lorem placeholders, to be written.
root.innerHTML = `
  <canvas id="wall" style="position:fixed;inset:0;width:100vw;height:100vh;display:block;cursor:grab;touch-action:none"></canvas>
  <div id="card" style="position:fixed;top:14px;right:14px;background:rgba(10,12,15,.92);border:1px solid #2a2f38;border-radius:10px;padding:14px;user-select:none">
    <div style="position:relative">
      <div id="grid" style="display:grid;grid-template-columns:repeat(${COLS},30px);gap:3px"></div>
      <div id="pressenter" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;text-align:center;font:800 24px/1.3 ui-monospace,monospace;color:#7fd4ff;text-shadow:0 0 8px rgba(127,212,255,.35),0 2px 4px #000;animation:pe 1.2s ease-in-out infinite">PRESS<br>ENTER<br>FOR NEW<br>PIECE</div>
    </div>
  </div>
  <style>@keyframes pe{0%,100%{opacity:1}50%{opacity:.4}}
    #footer a{color:#9fc0dd;text-decoration:none} #footer a:hover{text-decoration:underline}
  </style>
  <div id="footer" style="position:fixed;left:0;right:0;bottom:0;background:rgba(10,12,15,.9);border-top:1px solid #2a2f38;padding:8px 16px;font:12px ui-monospace,monospace;color:#8fa0b5;text-align:center;user-select:none">
    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
    · <a id="circuitlink" href="#">Read the Relay Circuit</a>
    · <a href="https://minivac.greg.technology/">Main Minivac Simulator Site</a>
    · <a href="https://github.com/gregsadetsky/minivac/" target="_blank" rel="noopener">GitHub</a>
    · <a href="mailto:hi@greg.technology">Contact</a>
  </div>
  <div id="circuitmodal" style="display:none;position:fixed;inset:0;background:rgba(4,6,9,.78);z-index:20;align-items:center;justify-content:center">
    <div style="position:relative;width:min(760px,92vw);height:min(80vh,900px);background:#101318;border:1px solid #2a2f38;border-radius:14px;padding:22px;color:#c9d4e3;font:13px ui-monospace,monospace;display:flex;flex-direction:column">
      <div id="circuitclose" style="position:absolute;top:10px;right:16px;font-size:22px;color:#8fa0b5;cursor:pointer">×</div>
      <div style="font-weight:800;color:#e8edf4;margin-bottom:10px">The relay circuit</div>
      <div id="circuittext" style="flex:1;overflow:auto;white-space:pre;background:#0a0c0f;border-radius:8px;padding:12px;line-height:1.4"></div>
    </div>
  </div>
  <div id="modal" style="position:fixed;inset:0;background:rgba(4,6,9,.72);display:flex;align-items:center;justify-content:center;z-index:10">
    <div style="max-width:560px;margin:20px;background:#101318;border:1px solid #2a2f38;border-radius:14px;padding:28px 30px;color:#c9d4e3;font:15px/1.55 ui-monospace,monospace">
      <div style="font-size:26px;font-weight:800;color:#e8edf4;margin-bottom:10px">Relay Tetris</div>
      <p style="margin:0 0 16px">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      <div id="modalgo" style="display:inline-block;background:#1c4a7a;color:#e8edf4;border-radius:8px;padding:10px 22px;font-weight:700;cursor:pointer">Play</div>
    </div>
  </div>
`;
const modal = document.getElementById('modal')!;
const pressEnterEl = document.getElementById('pressenter')!;
let modalOpen = true;
function closeModal() {
  modalOpen = false;
  modal.style.display = 'none';
}
// the circuit popup: the entire netlist, scrollable
const circuitModal = document.getElementById('circuitmodal')!;
document.getElementById('circuitlink')!.addEventListener('click', (e) => {
  e.preventDefault();
  const t = document.getElementById('circuittext')!;
  if (!t.textContent) {
    // one light comment per wiring block (the generator's own section
    // banners, exported as notes) over the raw jack-to-jack wire list
    const parts: string[] = [`${wires.length} wires across ${N_MACHINES} machines\n`];
    let ni = 0;
    for (let i = 0; i < wires.length; i++) {
      while (ni < built.notes.length && built.notes[ni].at === i) {
        parts.push(`\n// ${built.notes[ni].label}`);
        ni++;
      }
      parts.push(wires[i]);
    }
    t.textContent = parts.join('\n');
  }
  circuitModal.style.display = 'flex';
});
document.getElementById('circuitclose')!.addEventListener('pointerdown', () => {
  circuitModal.style.display = 'none';
});
document.getElementById('modalgo')!.addEventListener('pointerdown', closeModal); // ONLY the Play button dismisses (user call)
const canvas = document.getElementById('wall') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const gridEl = document.getElementById('grid')!;
const pixels: HTMLDivElement[][] = [];
for (let r = 0; r < ROWS; r++) {
  pixels.push([]);
  for (let j = 0; j < COLS; j++) {
    const d = document.createElement('div');
    d.style.cssText = 'width:30px;height:30px;border-radius:3px;background:#1b2027';
    gridEl.appendChild(d);
    pixels[r].push(d);
  }
}

// ---- panel geometry (world units), the react panel's row order --------
const PW = 1270;
const PH = 780;
const GAP = 70;
const cx6 = (sec: number) => 88 + (sec - 1) * 150; // section centers, left block
const RY = {
  numbers: 34,
  lights: 74,
  outLabel: 104,
  stripe1: [118, 146] as const,
  power: 132,
  cef: 176,
  relayTop: 200,
  relayH: 96,
  indicators: 314,
  storage: 336,
  ghj: 362,
  kln: 392,
  stripe2: [410, 438] as const,
  com: 424,
  secStorage: 458,
  rst: 484,
  uvw: 514,
  slides: 548,
  stripe3: [578, 592] as const,
  inLabel: 610,
  xyz: 636,
  buttons: 690,
};
const SEP_X = 940;
const RX = 948; // right block start
function jackLocal(sec: number, jack: string): [number, number] | null {
  const cx = cx6(sec);
  switch (jack) {
    case '+': return [cx - 16, RY.power];
    case '-': return [cx + 16, RY.power];
    case 'cap': return [cx - 40, RY.cef];
    case 'E': return [cx, RY.cef];
    case 'F': return [cx + 40, RY.cef];
    case 'G': return [cx - 40, RY.ghj];
    case 'H': return [cx, RY.ghj];
    case 'J': return [cx + 40, RY.ghj];
    case 'K': return [cx - 40, RY.kln];
    case 'L': return [cx, RY.kln];
    case 'N': return [cx + 40, RY.kln];
    case 'com': return [cx - 10, RY.com];
    case 'S': return [cx, RY.rst];
    case 'T': return [cx + 40, RY.rst];
    case 'X': return [cx - 40, RY.xyz];
    case 'Y': return [cx, RY.xyz];
    default: return null;
  }
}
const matrixLocal = (which: 'M10' | 'M11', slot: number): [number, number] => [
  (which === 'M10' ? 972 : 1172) + (slot % 2) * 20,
  160 + Math.floor((slot % 6) / 2) * 30,
];
const GRID_COLS = Math.ceil(Math.sqrt(N_MACHINES * ((PH + GAP) / (PW + GAP)) * 2.6));
const GRID_ROWS = Math.ceil(N_MACHINES / GRID_COLS);
const panelXY = (m: number) => ({
  x: (m % GRID_COLS) * (PW + GAP),
  y: Math.floor(m / GRID_COLS) * (PH + GAP),
});

// ---- the panel TEMPLATE, prebaked once at 2x ---------------------------
const TEAL = '#84B6C7';
const FACE = '#1a1a1a';
const TSCALE = 2;
const template = document.createElement('canvas');
template.width = PW * TSCALE;
template.height = PH * TSCALE;
{
  const t = template.getContext('2d')!;
  t.scale(TSCALE, TSCALE);
  const hole = (x: number, y: number, r = 5) => {
    t.beginPath();
    t.arc(x, y, r, 0, Math.PI * 2);
    t.fillStyle = '#0b0d10';
    t.fill();
    t.strokeStyle = '#4a4f58';
    t.lineWidth = 1.2;
    t.stroke();
  };
  const label = (s: string, x: number, y: number, size = 13, color = '#fff', align: CanvasTextAlign = 'center') => {
    t.fillStyle = color;
    t.font = `bold ${size}px ui-monospace, monospace`;
    t.textAlign = align;
    t.fillText(s, x, y);
    t.textAlign = 'start';
  };
  // face + frame
  t.fillStyle = FACE;
  t.fillRect(0, 0, PW, PH);
  t.strokeStyle = TEAL;
  t.lineWidth = 10;
  t.strokeRect(5, 5, PW - 10, PH - 10);
  // stripes bleed to the frame like the real machine
  t.fillStyle = TEAL;
  for (const [a, b] of [RY.stripe1, RY.stripe2, RY.stripe3]) t.fillRect(10, a, SEP_X - 10, b - a);
  t.fillRect(SEP_X, 10, 4, PH - 20); // separator
  t.fillRect(RX, 90, PW - RX - 10, 16); // matrix power stripe
  t.fillRect(RX - 8, 402, PW - RX - 2, 12); // motor band
  // per-section rows
  for (let sec = 1; sec <= 6; sec++) {
    const cx = cx6(sec);
    label(String(sec), cx, RY.numbers, 22);
    // light bezel
    t.beginPath();
    t.arc(cx, RY.lights, 13, 0, Math.PI * 2);
    t.fillStyle = '#101216';
    t.fill();
    t.strokeStyle = '#5a5f68';
    t.lineWidth = 2;
    t.stroke();
    label('+', cx - 16, RY.power - 12, 11);
    label('−', cx + 16, RY.power - 12, 11);
    hole(cx - 16, RY.power);
    hole(cx + 16, RY.power);
    for (const [ch, dx] of [['C', -40], ['E', 0], ['F', 40]] as const) {
      label(ch, cx + dx, RY.cef - 12, 10, '#c9d4e3');
      hole(cx + dx, RY.cef);
    }
    // relay, open frame like Relay.tsx: a vertical silver COIL CYLINDER
    // and a dark armature bar beside it (the bar is dynamic — draw())
    const ry = RY.relayTop;
    t.fillStyle = '#101216';
    t.beginPath();
    t.roundRect(cx - 34, ry, 68, RY.relayH, 5);
    t.fill();
    const coilX = cx - 28;
    const grad = t.createLinearGradient(coilX, 0, coilX + 28, 0);
    for (const [st, col] of [[0, '#1a1d24'], [0.05, '#4a4d55'], [0.12, '#8a8d95'], [0.2, '#e8e4dc'], [0.35, '#f8f5ed'], [0.5, '#ffffff'], [0.65, '#f8f5ed'], [0.8, '#e8e4dc'], [0.88, '#8a8d95'], [0.95, '#4a4d55'], [1, '#1a1d24']] as const) grad.addColorStop(st as number, col as string);
    t.fillStyle = grad;
    t.beginPath();
    t.roundRect(coilX, ry + 10, 28, RY.relayH - 22, 4);
    t.fill();
    // the white tape highlight
    t.fillStyle = 'rgba(255,255,255,0.35)';
    t.fillRect(coilX + 11, ry + 26, 5, RY.relayH - 52)
    // indicator bezel
    t.beginPath();
    t.arc(cx + 38, RY.indicators, 6, 0, Math.PI * 2);
    t.fillStyle = '#241a1a';
    t.fill();
    for (const [ch, dx] of [['G', -40], ['H', 0], ['J', 40]] as const) {
      label(ch, cx + dx, RY.ghj - 12, 10, '#c9d4e3');
      hole(cx + dx, RY.ghj);
    }
    for (const [ch, dx] of [['K', -40], ['L', 0], ['N', 40]] as const) {
      label(ch, cx + dx, RY.kln - 12, 10, '#c9d4e3');
      hole(cx + dx, RY.kln);
    }
    hole(cx - 10, RY.com);
    hole(cx + 10, RY.com);
    for (const [ch, dx] of [['R', -40], ['S', 0], ['T', 40]] as const) {
      label(ch, cx + dx, RY.rst - 12, 10, '#c9d4e3');
      hole(cx + dx, RY.rst);
    }
    for (const [ch, dx] of [['U', -40], ['V', 0], ['W', 40]] as const) {
      label(ch, cx + dx, RY.uvw - 12, 10, '#c9d4e3');
      hole(cx + dx, RY.uvw);
    }
    // slide switch body
    t.fillStyle = '#0d0f13';
    t.beginPath();
    t.roundRect(cx - 34, RY.slides - 9, 68, 18, 4);
    t.fill();
    t.fillStyle = '#b8bbc3';
    t.fillRect(cx - 28, RY.slides - 6, 24, 12); // knob parked left
    for (const [ch, dx] of [['X', -40], ['Y', 0], ['Z', 40]] as const) {
      label(ch, cx + dx, RY.xyz - 12, 10, '#c9d4e3');
      hole(cx + dx, RY.xyz);
    }
    // button well (cap painted live)
    t.beginPath();
    t.arc(cx, RY.buttons, 21, 0, Math.PI * 2);
    t.fillStyle = '#0d0f13';
    t.fill();
  }
  label('BINARY OUTPUT', 470, RY.outLabel, 13);
  label('STORAGE', 470, RY.storage, 13);
  label('COMMON', 60, RY.com + 4, 11, '#fff', 'left');
  label('SECONDARY STORAGE', 470, RY.secStorage, 13);
  label('BINARY INPUT', 470, RY.inLabel, 13);
  // right block: title, matrix, power, motor dial
  label('MINIVAC 601', (RX + PW) / 2 - 5, 52, 26);
  label('DIGITAL COMPUTER KIT', (RX + PW) / 2 - 5, 74, 10, '#c9d4e3');
  // the MATRIX, per MatrixConnector: a tic-tac-toe 3x3 of four-hole
  // connectors numbered clockwise (1,2,3 / 8,9,4 / 7,6,5), flanked by
  // the two vertical six-hole strips '10' (M10) and '11' (M11)
  t.strokeStyle = '#737373';
  t.lineWidth = 2;
  for (const gx of [1057, 1112]) { t.beginPath(); t.moveTo(gx, 128); t.lineTo(gx, 292); t.stroke(); }
  for (const gy of [182, 237]) { t.beginPath(); t.moveTo(1004, gy); t.lineTo(1166, gy); t.stroke(); }
  const MTX_NUMS = [1, 2, 3, 8, 9, 4, 7, 6, 5];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const gx = 1030 + c * 55, gy = 155 + r * 55;
      for (const [dx, dy] of [[-11, -12], [11, -12], [-11, 12], [11, 12]] as const) hole(gx + dx, gy + dy, 4.5);
      t.strokeStyle = '#737373';
      t.lineWidth = 1.5;
      for (const dy of [-12, 12]) { t.beginPath(); t.moveTo(gx - 7, gy + dy); t.lineTo(gx + 7, gy + dy); t.stroke(); }
      label(String(MTX_NUMS[r * 3 + c]), gx, gy + 4, 10, '#c9d4e3');
    }
  }
  for (const [lbl, bx] of [['10', 972], ['11', 1172]] as const) {
    for (let k = 0; k < 6; k++) hole(bx + (k % 2) * 20, 160 + Math.floor(k / 2) * 30, 4.5);
    label(lbl, bx + 10, 258, 10, '#c9d4e3');
  }
  label('MATRIX', 968, 340, 12, '#fff', 'left');
  // power section
  t.beginPath();
  t.arc(1205, 160, 12, 0, Math.PI * 2);
  t.fillStyle = '#101216';
  t.fill();
  t.strokeStyle = '#5a5f68';
  t.stroke();
  label('ON', 1205, 200, 9, '#c9d4e3');
  t.fillStyle = '#0d0f13';
  t.beginPath();
  t.roundRect(1196, 208, 18, 48, 4);
  t.fill();
  t.fillStyle = '#b8bbc3';
  t.fillRect(1199, 212, 12, 18);
  label('OFF', 1205, 272, 9, '#c9d4e3');
  // motor square: jacks column + the decimal wheel
  for (let k = 0; k < 6; k++) hole(970, 450 + k * 40, 5);
  const dcx = 1120, dcy = 590, dr = 118;
  t.beginPath();
  t.arc(dcx, dcy, dr + 24, 0, Math.PI * 2);
  t.fillStyle = '#111318';
  t.fill();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 - Math.PI / 2;
    hole(dcx + Math.cos(a) * dr, dcy + Math.sin(a) * dr, 5);
    label(String(k), dcx + Math.cos(a) * (dr - 26), dcy + Math.sin(a) * (dr - 26) + 4, 10, '#c9d4e3');
  }
  t.beginPath();
  t.arc(dcx, dcy, 42, 0, Math.PI * 2);
  t.fillStyle = '#26292f';
  t.fill();
  t.strokeStyle = '#4a4f58';
  t.lineWidth = 2;
  t.stroke();
  t.strokeStyle = '#c9d4e3';
  t.lineWidth = 4;
  t.beginPath();
  t.moveTo(dcx, dcy - 8);
  t.lineTo(dcx, dcy - 38);
  t.stroke();
}

// ---- wires: parse the netlist once ------------------------------------
interface Seg { x1: number; y1: number; x2: number; y2: number; mA: number; mB: number; }
const segs: Seg[] = [];
const wireIndex: number[] = [];
const matrixSlots = new Map<string, number>();
function endpointPos(tok: string): [number, number, number] | null {
  let m = 0;
  let rest = tok;
  const mm = tok.match(/^m(\d+)\.(.*)$/);
  if (mm) { m = +mm[1]; rest = mm[2]; }
  const { x, y } = panelXY(m);
  if (rest === 'M10' || rest === 'M11') {
    const key = `${m}.${rest}`;
    const slot = matrixSlots.get(key) ?? 0;
    matrixSlots.set(key, slot + 1);
    const [lx, ly] = matrixLocal(rest, slot % 6);
    return [x + lx, y + ly, m];
  }
  const sm = rest.match(/^([1-6])(\+|-|com|cap|[EFGHJKLNSTXY])$/);
  if (!sm) return null;
  const loc = jackLocal(+sm[1], sm[2]);
  return loc ? [x + loc[0], y + loc[1], m] : null;
}
for (let i = 0; i < wires.length; i++) {
  const [a, b] = wires[i].split('/');
  const pa = endpointPos(a);
  const pb = endpointPos(b);
  if (!pa || !pb) continue; // the motor-drive wires live off-panel by design
  segs.push({ x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1], mA: pa[2], mB: pb[2] });
  wireIndex.push(i);
}

// ---- cable ROUTING (v2 feedback: 9.6k direct spans buried the panels).
// same-panel wires droop directly; cross-machine wires drop into the
// alley below their panel, run the corridors like a cable tray, and
// rise to the target jack. per-wire jitter spreads the bundles.
// direct point-to-point cables (v3, user call — the v2 trays that ran
// 'around' the minivacs are gone), a real droop, per-wire jitter so
// parallel runs read as separate cables
const jit = (si: number, k: number) => ((((si + 1) * 2654435761 + k * 40503) >>> 0) % 1000) / 1000;
function strokeWire(c: CanvasRenderingContext2D, si: number, g: Seg, yoff: number) {
  const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
  const sag = Math.min(240, 22 + len * (0.1 + 0.08 * jit(si, 1)));
  c.beginPath();
  c.moveTo(g.x1, g.y1 + yoff);
  c.quadraticCurveTo((g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2 + sag + yoff, g.x2, g.y2 + yoff);
  c.stroke();
}

// ---- the cached wire layer (visible at EVERY zoom) ----------------------
const WORLD_W = GRID_COLS * (PW + GAP);
const WORLD_H = GRID_ROWS * (PH + GAP);
const wireLayer = document.createElement('canvas');
const WLS = Math.min(1, 5000 / WORLD_W); // layer scale: ~5k px wide
const VEC_MIN = Math.max(0.2, WLS * 1.3); // past this, cables draw as vectors
wireLayer.width = Math.ceil(WORLD_W * WLS);
wireLayer.height = Math.ceil(WORLD_H * WLS);
const wctx = wireLayer.getContext('2d')!;
let wireLayerAt = 0;
let wireLayerQueued = false;
function renderWireLayer() {
  wireLayerAt = performance.now();
  wctx.setTransform(WLS, 0, 0, WLS, 0, 0);
  wctx.clearRect(0, 0, WORLD_W, WORLD_H);
  const cur = snap?.wireCur;
  const wc = wctx as unknown as CanvasRenderingContext2D;
  for (let si = 0; si < segs.length; si++) {
    const g = segs[si];
    const c = cur ? Math.abs(cur[wireIndex[si]]) : 0;
    const t = Math.min(1, c / 220);
    if (t < 0.005) {
      // idle cable: one faint stroke, no shadow — the wall must stay legible
      wctx.strokeStyle = 'rgba(158,170,192,0.24)';
      wctx.lineWidth = 2.6;
      strokeWire(wc, si, g, 0);
    } else {
      wctx.strokeStyle = 'rgba(0,0,0,0.30)'; // the hint of shadow
      wctx.lineWidth = 5;
      strokeWire(wc, si, g, 4);
      wctx.strokeStyle = `rgba(${Math.round(190 + 65 * t)},${Math.round(150 + 30 * t)},40,${0.55 + 0.45 * t})`;
      wctx.lineWidth = 3.4;
      strokeWire(wc, si, g, 0);
    }
  }
  needsPaint = true;
}
function scheduleWireLayer() {
  if (wireLayerQueued) return;
  const due = Math.max(0, 150 - (performance.now() - wireLayerAt));
  wireLayerQueued = true;
  setTimeout(() => {
    wireLayerQueued = false;
    renderWireLayer();
  }, due);
}

// ---- camera ------------------------------------------------------------
const cam = { x: 0, y: 0, s: 0.1 };
let needsPaint = true;
const TITLE_H = 2000; // world-space band above the wall for the giant title
function fitAll() {
  const sw = canvas.clientWidth, sh = canvas.clientHeight;
  cam.s = Math.min(sw / WORLD_W, sh / (WORLD_H + TITLE_H)) * 0.96;
  cam.x = (WORLD_W - sw / cam.s) / 2;
  cam.y = (WORLD_H + TITLE_H - sh / cam.s) / 2 - TITLE_H;
  needsPaint = true;
}
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  needsPaint = true;
}
window.addEventListener('resize', () => { resize(); });

const pointers = new Map<number, { x: number; y: number }>();
let pinchD = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    pinchD = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const cur = { x: e.clientX, y: e.clientY };
  if (pointers.size === 1) {
    cam.x -= (cur.x - prev.x) / cam.s;
    cam.y -= (cur.y - prev.y) / cam.s;
  } else if (pointers.size === 2) {
    pointers.set(e.pointerId, cur);
    const [p1, p2] = [...pointers.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (pinchD > 0) zoomAt(mid.x, mid.y, d / pinchD);
    pinchD = d;
  }
  pointers.set(e.pointerId, cur);
  needsPaint = true;
});
const endPointer = (e: PointerEvent) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchD = 0;
  if (pointers.size === 0) canvas.style.cursor = 'grab';
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
function zoomAt(sx: number, sy: number, factor: number) {
  const s2 = Math.min(3, Math.max(0.008, cam.s * factor));
  cam.x += sx / cam.s - sx / s2;
  cam.y += sy / cam.s - sy / s2;
  cam.s = s2;
  needsPaint = true;
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
(window as unknown as { __wallCam: unknown }).__wallCam = {
  set(x: number, y: number, s: number) {
    cam.x = x; cam.y = y; cam.s = s;
    needsPaint = true;
  },
  get: () => ({ ...cam, worldW: WORLD_W, worldH: WORLD_H }),
};

// ---- armature animation state ------------------------------------------
const armDisp = new Float32Array(N_MACHINES * 6);
const armTarget = new Uint8Array(N_MACHINES * 6);

// ---- drawing -----------------------------------------------------------
function draw() {
  const sw = canvas.clientWidth, sh = canvas.clientHeight;
  ctx.fillStyle = '#0a0c0f';
  ctx.fillRect(0, 0, sw, sh);
  const s = cam.s;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - 80, vy0 = cam.y - 80;
  const vx1 = cam.x + sw / s + 80, vy1 = cam.y + sh / s + 80;
  const showDetail = s > 0.12;
  // the giant line above all the minivacs (user copy), real counts
  ctx.fillStyle = '#dfe7f2';
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(TITLE_H / 2.4)}px ui-monospace, monospace`;
  ctx.fillText('Relay Tetris', WORLD_W / 2, -TITLE_H * 0.42);
  ctx.font = `700 ${Math.round(TITLE_H / 10)}px ui-monospace, monospace`;
  ctx.fillStyle = '#9fb2c8';
  ctx.fillText(`implemented using ${L.relays} relays on ${N_MACHINES} simulated Minivac 601s,`, WORLD_W / 2, -TITLE_H * 0.22);
  ctx.fillText('a relay computer kit from 1961', WORLD_W / 2, -TITLE_H * 0.09);
  ctx.textAlign = 'start';
  for (let m = 0; m < N_MACHINES; m++) {
    const { x, y } = panelXY(m);
    if (x + PW < vx0 || x > vx1 || y + PH < vy0 || y > vy1) continue;
    ctx.drawImage(template, x, y, PW, PH);
    if (s > 0.06) {
      ctx.fillStyle = '#9fb2c8';
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.fillText(`m${m}`, x + 20, y + 30);
    }
    if (!snap) continue;
    const li = snap.lights[m], bt = snap.buttons[m];
    for (let sec = 1; sec <= 6; sec++) {
      const cx = x + cx6(sec);
      // light
      if ((li >> (sec - 1)) & 1) {
        ctx.beginPath();
        ctx.arc(cx, y + RY.lights, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd9a8';
        ctx.fill();
        if (showDetail) {
          ctx.beginPath();
          ctx.arc(cx, y + RY.lights, 19, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,176,120,0.28)';
          ctx.fill();
        }
      }
      // the armature bar slides TOWARD the coil when energized
      // (Relay.tsx: left 55px -> 48px), eased by armDisp
      const a = armDisp[m * 6 + (sec - 1)];
      if (showDetail) {
        const ry2 = y + RY.relayTop;
        if (a > 0.3) {
          ctx.fillStyle = `rgba(255,176,0,${0.16 * a})`;
          ctx.fillRect(cx - 34, ry2, 68, RY.relayH);
        }
        const bx = cx + 6 + 12 * (1 - a);
        const bg = ctx.createLinearGradient(bx, 0, bx + 9, 0);
        bg.addColorStop(0, '#4a4d55');
        bg.addColorStop(0.5, '#2a2d35');
        bg.addColorStop(1, '#1a1d24');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(bx, ry2 + 10, 9, RY.relayH - 22, 2);
        ctx.fill();
        // indicator lamp follows the coil
        if (a > 0.5) {
          ctx.beginPath();
          ctx.arc(cx + 38, y + RY.indicators, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ff6a4a';
          ctx.fill();
        }
      } else if (a > 0.5) {
        // far away, an energized relay still reads as an amber block
        ctx.fillStyle = '#ffb000';
        ctx.fillRect(cx - 34, y + RY.relayTop, 68, RY.relayH);
      }
      // button cap
      ctx.beginPath();
      ctx.arc(cx, y + RY.buttons, 16, 0, Math.PI * 2);
      ctx.fillStyle = (bt >> (sec - 1)) & 1 ? '#e04432' : '#8f2620';
      ctx.fill();
    }
    // the power lamp is on: the wall is running
    ctx.beginPath();
    ctx.arc(x + 1205, y + 160, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd9a8';
    ctx.fill();
    // machine 0 carries THE WHEEL — the live dial that deals the pieces
    if (m === 0 && showDetail) {
      const a0 = ((motorAngle - 90) * Math.PI) / 180;
      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x + 1120, y + 590);
      ctx.lineTo(x + 1120 + Math.cos(a0) * 34, y + 590 + Math.sin(a0) * 34);
      ctx.stroke();
    }
  }
  // the cables: the cached bitmap serves only zooms at-or-below its own
  // native resolution (the user found the blurry band between the old
  // 0.8 threshold and the layer's ~0.19 render scale); everything
  // closer is vector-crisp
  if (s <= VEC_MIN) {
    ctx.drawImage(wireLayer, 0, 0, wireLayer.width, wireLayer.height, 0, 0, WORLD_W, WORLD_H);
  } else if (snap) {
    for (let si = 0; si < segs.length; si++) {
      const g = segs[si];
      const lo = Math.min(g.x1, g.x2), hi = Math.max(g.x1, g.x2);
      if (hi < vx0 - GAP || lo > vx1 + GAP) continue;
      const ly = Math.min(g.y1, g.y2), hy = Math.max(g.y1, g.y2) + GAP;
      if (hy < vy0 - GAP || ly > vy1 + GAP) continue;
      const c = Math.abs(snap.wireCur[wireIndex[si]]);
      const t = Math.min(1, c / 220);
      if (t < 0.005) {
        ctx.strokeStyle = 'rgba(158,170,192,0.26)';
        ctx.lineWidth = 2.2;
        strokeWire(ctx, si, g, 0);
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.30)';
        ctx.lineWidth = 4;
        strokeWire(ctx, si, g, 3);
        ctx.strokeStyle = `rgba(${Math.round(190 + 65 * t)},${Math.round(150 + 30 * t)},40,${0.55 + 0.45 * t})`;
        ctx.lineWidth = 2.6;
        strokeWire(ctx, si, g, 0);
      }
    }
  }
  ctx.restore();
}

// ---- the well card -------------------------------------------------------
function paintWell() {
  if (!snap) return;
  const { tok, shapeIx, pos, cells } = snap;
  const srows = SHAPES[shapeIx]?.rows;
  const masks = [0, 1, 2, 3].map((k) => {
    const row = srows?.[k];
    if (pos < 0 || !row) return 0;
    const sh = pos + row.off;
    if (sh < 0 || sh + row.w > COLS) return 0;
    return ((1 << row.w) - 1) << sh;
  });
  for (let r = 0; r < ROWS; r++) {
    for (let j = 0; j < COLS; j++) {
      const on = cells[r * COLS + j] === 1;
      let piece = false;
      for (let k = 0; k < 4; k++) if (tok - k === r && ((masks[k] >> j) & 1) === 1 && tok >= k) piece = true;
      pixels[r][j].style.background = piece ? '#7fd4ff' : on ? '#ffb000' : '#1b2027';
    }
  }
  // huge letters when the machine is genuinely waiting on the player:
  // no piece, not mid-crank, gravity off (with gravity on, the wheel
  // deals and the piece serves itself in about a second)
  pressEnterEl.style.display =
    !snap.gameOver && snap.tok < 0 && !snap.dealing && !snap.autoOn ? 'flex' : 'none';
}

// keys go to the engine room
document.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (modalOpen) return; // the modal dismisses only via its Play button
  if (e.key === 'f' || e.key === 'F') { fitAll(); return; }
  if (e.key === 'm' || e.key === 'M') { soundOn = !soundOn; return; }
  const k = e.key === 'A' ? 'a' : e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'a'].includes(k))
    worker.postMessage({ type: 'key', key: k });
});

// ---- animation loop ------------------------------------------------------
let lastT = performance.now();
function frame(t: number) {
  const dt = Math.min(50, t - lastT);
  lastT = t;
  let animating = false;
  for (let i = 0; i < armDisp.length; i++) {
    const target = armTarget[i];
    const d = target - armDisp[i];
    if (Math.abs(d) > 0.01) {
      armDisp[i] += d * Math.min(1, dt / 70);
      animating = true;
    } else armDisp[i] = target;
  }
  if (needsPaint || animating) {
    needsPaint = false;
    draw();
  }
  requestAnimationFrame(frame);
}

resize();
fitAll();
renderWireLayer();
draw();
requestAnimationFrame(frame);
