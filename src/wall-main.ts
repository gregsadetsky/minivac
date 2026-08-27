/**
 * THE MULTIVAC WALL (/wall/, v1 prototype — 2026-08-27, user call:
 * "a zoomable field of minivacs that look WAY more like the actual
 * react minivacs, but full canvas, animating, zoom in-outable, with
 * all the wires... then to see that + the tetris on the right").
 *
 * Every machine drawn as a stylized Minivac 601 panel (the react
 * panel's look: near-black face, teal frame and stripes, silver relay
 * covers with MOVING armatures, amber lights) on one pannable,
 * zoomable canvas — with the REAL netlist's wires drawn jack-to-jack
 * and colored by their LIVE current. React-less per the UI perf
 * invariants: one canvas, repaints only when state arrived / a
 * gesture is active / an armature is mid-flip.
 *
 * THE SIM LIVES IN A WORKER (wall-worker.ts). The user's trace
 * receipt: the sparse solver owned 24.5s of a 26s main-thread trace
 * (dc + rowMaxAbs; draw() was 0.04s) — the spin dealer solves the
 * 176-machine circuit continuously and navigation starved behind
 * 3-second timer bursts. This thread now only draws and forwards
 * keys; the netlist is rebuilt here (pure generation, no sim) for the
 * wire/panel geometry.
 *
 * LOD by zoom: far = panel tiles + relay dots; mid = full panel
 * chrome, armatures animating; near = jack field + the wires, current
 * lighting them up. The v1 exists to be LOOKED AT and redirected —
 * layout/mobile decisions are deliberately the user's.
 */
import { tetrisCircuit, SHAPES } from './circuits/multivac-mini-tetris';

const ROWS = 8;
const COLS = 4;
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
  gameOver: boolean;
  status?: string;
  wireCur: Float32Array;
}
let snap: Snapshot | null = null;
const worker = new Worker(new URL('./wall-worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = (e: MessageEvent) => {
  const d = e.data as { type: string } & Snapshot;
  if (d.type !== 'state') return;
  snap = d;
  for (let m = 0; m < N_MACHINES; m++) {
    const r = d.relays[m];
    for (let i = 0; i < 6; i++) armTarget[m * 6 + i] = (r >> i) & 1;
  }
  paintWell();
  needsPaint = true;
};

// ---- DOM scaffold ----------------------------------------------------
const root = document.getElementById('root')!;
root.innerHTML = `
  <canvas id="wall" style="position:fixed;inset:0;width:100vw;height:100vh;display:block;cursor:grab;touch-action:none"></canvas>
  <div id="card" style="position:fixed;top:12px;right:12px;background:rgba(10,12,15,.88);border:1px solid #2a2f38;border-radius:8px;padding:10px;font:12px ui-monospace,monospace;color:#c9d4e3;user-select:none">
    <div id="grid" style="display:grid;grid-template-columns:repeat(${COLS},16px);gap:2px;margin-bottom:8px"></div>
    <div id="status" style="max-width:${COLS * 18 + 60}px;line-height:1.35">wiring ${N_MACHINES} machines…</div>
    <div style="margin-top:6px;color:#5f6b7a">arrows steer/rotate · ↓ tick/take · enter serve<br>a gravity · drag pan · wheel zoom · f fit</div>
  </div>
  <div id="hud" style="position:fixed;left:12px;bottom:10px;font:11px ui-monospace,monospace;color:#5f6b7a;user-select:none"></div>
`;
const canvas = document.getElementById('wall') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const statusEl = document.getElementById('status')!;
const hud = document.getElementById('hud')!;
const gridEl = document.getElementById('grid')!;
const pixels: HTMLDivElement[][] = [];
for (let r = 0; r < ROWS; r++) {
  pixels.push([]);
  for (let j = 0; j < COLS; j++) {
    const d = document.createElement('div');
    d.style.cssText = 'width:16px;height:16px;border-radius:2px;background:#1b2027';
    gridEl.appendChild(d);
    pixels[r].push(d);
  }
}

// ---- panel geometry (world units) -------------------------------------
const PW = 560;
const PH = 340;
const GAP = 46;
const GRID_COLS = Math.ceil(Math.sqrt(N_MACHINES * ((PH + GAP) / (PW + GAP)) * 2.6)); // wide wall
const GRID_ROWS = Math.ceil(N_MACHINES / GRID_COLS);
const panelXY = (m: number) => ({
  x: (m % GRID_COLS) * (PW + GAP),
  y: Math.floor(m / GRID_COLS) * (PH + GAP),
});
const secCX = (sec: number) => 40 + (sec - 1) * 92 + 30; // section center x, 1-based
function jackLocal(sec: number, jack: string): [number, number] | null {
  const cx = secCX(sec);
  switch (jack) {
    case '+': return [cx - 14, 70];
    case '-': return [cx + 14, 70];
    case 'E': return [cx - 10, 172];
    case 'F': return [cx + 10, 172];
    case 'H': return [cx - 16, 192];
    case 'G': return [cx, 192];
    case 'J': return [cx + 16, 192];
    case 'L': return [cx - 16, 210];
    case 'K': return [cx, 210];
    case 'N': return [cx + 16, 210];
    case 'com': return [cx, 228];
    case 'X': return [cx - 8, 248];
    case 'Y': return [cx + 8, 248];
    case 'S': return [cx - 8, 270];
    case 'T': return [cx + 8, 270];
    case 'cap': return [cx, 288];
    default: return null;
  }
}
const matrixLocal = (which: 'M10' | 'M11', slot: number): [number, number] => [
  (which === 'M10' ? PW * 0.28 : PW * 0.72) + ((slot % 6) - 2.5) * 16,
  308,
];

// ---- wires: parse the netlist once ------------------------------------
interface Seg { x1: number; y1: number; x2: number; y2: number; }
const segs: Seg[] = [];
const wireIndex: number[] = [];
const matrixSlots = new Map<string, number>();
function endpointPos(tok: string): [number, number] | null {
  let m = 0;
  let rest = tok;
  const mm = tok.match(/^m(\d+)\.(.*)$/);
  if (mm) { m = +mm[1]; rest = mm[2]; }
  const { x, y } = panelXY(m);
  if (rest === 'M10' || rest === 'M11') {
    const key = `${m}.${rest}`;
    const slot = matrixSlots.get(key) ?? 0;
    matrixSlots.set(key, slot + 1);
    const [lx, ly] = matrixLocal(rest, slot % 12);
    return [x + lx, y + ly];
  }
  const sm = rest.match(/^([1-6])(\+|-|com|cap|[EFGHJKLNSTXY])$/);
  if (!sm) return null;
  const loc = jackLocal(+sm[1], sm[2]);
  return loc ? [x + loc[0], y + loc[1]] : null;
}
let unparsed = 0;
for (let i = 0; i < wires.length; i++) {
  const [a, b] = wires[i].split('/');
  const pa = endpointPos(a);
  const pb = endpointPos(b);
  if (!pa || !pb) { unparsed++; continue; }
  segs.push({ x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1] });
  wireIndex.push(i);
}

// ---- camera ------------------------------------------------------------
const WORLD_W = GRID_COLS * (PW + GAP);
const WORLD_H = GRID_ROWS * (PH + GAP);
const cam = { x: 0, y: 0, s: 0.1 };
let needsPaint = true;
function fitAll() {
  const sw = canvas.clientWidth, sh = canvas.clientHeight;
  cam.s = Math.min(sw / WORLD_W, sh / WORLD_H) * 0.96;
  cam.x = (WORLD_W - sw / cam.s) / 2;
  cam.y = (WORLD_H - sh / cam.s) / 2;
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
  const s2 = Math.min(3, Math.max(0.01, cam.s * factor));
  cam.x += sx / cam.s - sx / s2;
  cam.y += sy / cam.s - sy / s2;
  cam.s = s2;
  needsPaint = true;
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
// dev/driver hook: the verify script steps the camera deterministically
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
const TEAL = '#84B6C7';
const FACE = '#16181c';
function draw() {
  const sw = canvas.clientWidth, sh = canvas.clientHeight;
  ctx.fillStyle = '#0a0c0f';
  ctx.fillRect(0, 0, sw, sh);
  const s = cam.s;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - 50, vy0 = cam.y - 50;
  const vx1 = cam.x + sw / s + 50, vy1 = cam.y + sh / s + 50;
  const showChrome = s > 0.16;
  const showJacks = s > 0.5;
  for (let m = 0; m < N_MACHINES; m++) {
    const { x, y } = panelXY(m);
    if (x + PW < vx0 || x > vx1 || y + PH < vy0 || y > vy1) continue;
    const rbits = snap ? snap.relays[m] : 0;
    if (!showChrome) {
      ctx.fillStyle = FACE;
      ctx.fillRect(x, y, PW, PH);
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 8;
      ctx.strokeRect(x + 4, y + 4, PW - 8, PH - 8);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = (rbits >> i) & 1 ? '#ffb000' : '#2a2f38';
        ctx.fillRect(x + secCX(i + 1) - 16, y + PH / 2 - 22, 32, 44);
      }
      continue;
    }
    ctx.fillStyle = FACE;
    ctx.fillRect(x, y, PW, PH);
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 3, y + 3, PW - 6, PH - 6);
    ctx.fillStyle = TEAL;
    ctx.fillRect(x + 6, y + 62, PW - 12, 16);
    ctx.fillStyle = '#e8edf4';
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillText(`MINIVAC 601 · m${m}`, x + 14, y + 20);
    for (let sec = 1; sec <= 6; sec++) {
      const cx = x + secCX(sec);
      const lit = snap ? (snap.lights[m] >> (sec - 1)) & 1 : 0;
      ctx.beginPath();
      ctx.arc(cx, y + 42, 8, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#ffcf9a' : '#1a1414';
      ctx.fill();
      if (lit) {
        ctx.beginPath();
        ctx.arc(cx, y + 42, 13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,176,136,0.25)';
        ctx.fill();
      }
      ctx.strokeStyle = '#3a3f48';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, y + 42, 8, 0, Math.PI * 2);
      ctx.stroke();
      const a = armDisp[m * 6 + (sec - 1)];
      const rx = cx - 22, ry = y + 90;
      const grad = ctx.createLinearGradient(rx, 0, rx + 44, 0);
      grad.addColorStop(0, '#4a4d55');
      grad.addColorStop(0.5, '#eef0ee');
      grad.addColorStop(1, '#4a4d55');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(rx, ry, 44, 62, 5);
      ctx.fill();
      ctx.fillStyle = '#0d0f13';
      ctx.fillRect(rx + 6, ry + 40, 32, 16);
      ctx.strokeStyle = a > 0.5 ? '#ffb000' : '#8a8d95';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx + 8, ry + 54);
      ctx.lineTo(rx + 36, ry + 54 - 10 * (1 - a) - 1);
      ctx.stroke();
      const btn = snap ? (snap.buttons[m] >> (sec - 1)) & 1 : 0;
      ctx.beginPath();
      ctx.arc(cx, y + 248, 7, 0, Math.PI * 2);
      ctx.fillStyle = btn ? '#c33' : '#801f1f';
      ctx.fill();
      if (showJacks) {
        ctx.fillStyle = '#0d0f13';
        for (const j of ['+', '-', 'E', 'F', 'H', 'G', 'J', 'L', 'K', 'N', 'com', 'X', 'Y', 'S', 'T', 'cap']) {
          const p = jackLocal(sec, j)!;
          ctx.beginPath();
          ctx.arc(x + p[0], y + p[1], 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#3a3f48';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (s > 1.1) {
          ctx.fillStyle = '#93a1b3';
          ctx.font = '7px ui-monospace, monospace';
          for (const j of ['E', 'F', 'H', 'G', 'J', 'L', 'K', 'N']) {
            const p = jackLocal(sec, j)!;
            ctx.fillText(j, x + p[0] - 2, y + p[1] - 5);
          }
        }
      }
    }
    if (showJacks) {
      ctx.fillStyle = '#10141a';
      ctx.fillRect(x + PW * 0.28 - 52, y + 300, 104, 16);
      ctx.fillRect(x + PW * 0.72 - 52, y + 300, 104, 16);
      ctx.fillStyle = '#0d0f13';
      for (let k = 0; k < 6; k++) {
        for (const which of ['M10', 'M11'] as const) {
          const p = matrixLocal(which, k);
          ctx.beginPath();
          ctx.arc(x + p[0], y + p[1], 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // cables ON TOP of the panels — they plug into the jacks
  if (showJacks && snap) {
    ctx.lineWidth = 1.4;
    for (let si = 0; si < segs.length; si++) {
      const g = segs[si];
      const lo = Math.min(g.x1, g.x2), hi = Math.max(g.x1, g.x2);
      if (hi < vx0 || lo > vx1) continue;
      const ly = Math.min(g.y1, g.y2), hy = Math.max(g.y1, g.y2);
      if (hy < vy0 || ly > vy1) continue;
      const cur = Math.abs(snap.wireCur[wireIndex[si]]);
      const t = Math.min(1, cur / 220);
      ctx.strokeStyle = t < 0.005
        ? 'rgba(150,165,190,0.10)'
        : `rgba(${Math.round(190 + 65 * t)},${Math.round(160 + 16 * t)},40,${0.18 + 0.72 * t})`;
      ctx.beginPath();
      const mx = (g.x1 + g.x2) / 2;
      const my = (g.y1 + g.y2) / 2 + Math.min(120, Math.hypot(g.x2 - g.x1, g.y2 - g.y1) * 0.12);
      ctx.moveTo(g.x1, g.y1);
      ctx.quadraticCurveTo(mx, my, g.x2, g.y2);
      ctx.stroke();
    }
  }
  ctx.restore();
  hud.textContent = `${N_MACHINES} machines · ${segs.length} wires (${unparsed} off-template) · zoom ${cam.s.toFixed(2)} · sim in a worker`;
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
  const label = SHAPES[shapeIx]?.label ?? '…';
  statusEl.textContent =
    snap.status ?? `${label}${tok >= 0 ? ` at row ${tok}` : snap.dealing ? ' — the ring spins' : ''}`;
}

// keys go to the engine room
document.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (e.key === 'f' || e.key === 'F') { fitAll(); return; }
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
draw();
requestAnimationFrame(frame);
