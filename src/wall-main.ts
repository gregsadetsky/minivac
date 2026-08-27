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
 * and colored by their LIVE current (sim.getWireCurrents). Fully
 * react-less per the UI perf invariants: one canvas, no per-frame
 * state, repaints only when the sim changed / a camera gesture is
 * active / an armature is mid-flip. The game itself is the tetris
 * machine on autoplay (the free-run dealer + gravity), with the same
 * keyboard controls as /tetris/; the well renders in a corner card.
 *
 * LOD by zoom: far = panel tiles + relay dots; mid = full panel
 * chrome, armatures animating; near = jack field + the wires, current
 * lighting them up. The v1 exists to be LOOKED AT and redirected —
 * layout/mobile decisions are deliberately unfinished (the user's
 * call to make with the thing on screen).
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
const wires = built.wires;
const N_MACHINES = L.machines;

// ---- DOM scaffold ----------------------------------------------------
const root = document.getElementById('root')!;
root.innerHTML = `
  <canvas id="wall" style="position:fixed;inset:0;width:100vw;height:100vh;display:block;cursor:grab;touch-action:none"></canvas>
  <div id="card" style="position:fixed;top:12px;right:12px;background:rgba(10,12,15,.88);border:1px solid #2a2f38;border-radius:8px;padding:10px;font:12px ui-monospace,monospace;color:#c9d4e3;user-select:none">
    <div id="grid" style="display:grid;grid-template-columns:repeat(${COLS},16px);gap:2px;margin-bottom:8px"></div>
    <div id="status" style="max-width:${COLS * 18 + 60}px;line-height:1.35">building…</div>
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
// per-section jack template (local coords)
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
  308 + Math.floor(slot / 6) * 0, // one row strip
];

// ---- wires: parse the netlist once ------------------------------------
interface Seg { x1: number; y1: number; x2: number; y2: number; }
const segs: Seg[] = [];
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
for (const wire of wires) {
  const [a, b] = wire.split('/');
  const pa = endpointPos(a);
  const pb = endpointPos(b);
  if (!pa || !pb) { unparsed++; continue; }
  segs.push({ x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1] });
}

// ---- camera ------------------------------------------------------------
const WORLD_W = GRID_COLS * (PW + GAP);
const WORLD_H = GRID_ROWS * (PH + GAP);
const cam = { x: 0, y: 0, s: 0.1 }; // world -> screen: (wx - x) * s
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

// pan/zoom: pointer drag + wheel (pinch = 2 pointers)
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

// ---- live state --------------------------------------------------------
let sim!: MinivacSimulator;
const armDisp = new Float32Array(N_MACHINES * 6); // eased armature 0..1
const armTarget = new Uint8Array(N_MACHINES * 6);
let wireCur: Float32Array | null = null;
let solvedOnce = false;
function pullState() {
  for (let m = 0; m < N_MACHINES; m++) {
    const st = sim.getMachineState(m);
    for (let i = 0; i < 6; i++) armTarget[m * 6 + i] = st.relays[i] ? 1 : 0;
  }
  wireCur = sim.getWireCurrents(wireCur ?? undefined);
  solvedOnce = true;
  needsPaint = true;
}

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
  // wires under the panels' faces but over the void
  if (showJacks && solvedOnce) {
    ctx.lineWidth = 1.4;
    for (let si = 0; si < segs.length; si++) {
      const g = segs[si];
      const lo = Math.min(g.x1, g.x2), hi = Math.max(g.x1, g.x2);
      if (hi < vx0 || lo > vx1) continue;
      const ly = Math.min(g.y1, g.y2), hy = Math.max(g.y1, g.y2);
      if (hy < vy0 || ly > vy1) continue;
      const cur = wireCur ? Math.abs(wireCur[wireIndex[si]]) : 0;
      const t = Math.min(1, cur / 220);
      ctx.strokeStyle = t < 0.005
        ? 'rgba(150,165,190,0.10)'
        : `rgba(${Math.round(190 + 65 * t)},${Math.round(160 + 16 * t)},${Math.round(40)},${0.18 + 0.72 * t})`;
      ctx.beginPath();
      const mx = (g.x1 + g.x2) / 2;
      const my = (g.y1 + g.y2) / 2 + Math.min(120, Math.hypot(g.x2 - g.x1, g.y2 - g.y1) * 0.12);
      ctx.moveTo(g.x1, g.y1);
      ctx.quadraticCurveTo(mx, my, g.x2, g.y2);
      ctx.stroke();
    }
  }
  for (let m = 0; m < N_MACHINES; m++) {
    const { x, y } = panelXY(m);
    if (x + PW < vx0 || x > vx1 || y + PH < vy0 || y > vy1) continue;
    const st = solvedOnce ? sim.getMachineState(m) : null;
    if (!showChrome) {
      // far: tile + relay dots
      ctx.fillStyle = FACE;
      ctx.fillRect(x, y, PW, PH);
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 8;
      ctx.strokeRect(x + 4, y + 4, PW - 8, PH - 8);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = st && st.relays[i] ? '#ffb000' : '#2a2f38';
        ctx.fillRect(x + secCX(i + 1) - 16, y + PH / 2 - 22, 32, 44);
      }
      continue;
    }
    // panel chrome
    ctx.fillStyle = FACE;
    ctx.fillRect(x, y, PW, PH);
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 3, y + 3, PW - 6, PH - 6);
    ctx.fillStyle = TEAL;
    ctx.fillRect(x + 6, y + 62, PW - 12, 16); // power stripe
    ctx.fillStyle = '#e8edf4';
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillText(`MINIVAC 601 · m${m}`, x + 14, y + 20);
    for (let sec = 1; sec <= 6; sec++) {
      const cx = x + secCX(sec);
      // light
      const lit = st?.lights[sec - 1];
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
      // relay: silver cover + armature
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
      ctx.fillRect(rx + 6, ry + 40, 32, 16); // the window
      // armature: a lever seated (energized) or sprung
      ctx.strokeStyle = a > 0.5 ? '#ffb000' : '#8a8d95';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx + 8, ry + 54);
      ctx.lineTo(rx + 36, ry + 54 - 10 * (1 - a) - 1);
      ctx.stroke();
      // indicator lamp
      const ind = st?.relayIndicatorLights[sec - 1];
      ctx.beginPath();
      ctx.arc(cx + 30, ry + 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = ind ? '#ff6a4a' : '#241a1a';
      ctx.fill();
      // button cap
      const btn = st?.buttons[sec - 1];
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
      // matrix strips
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
  ctx.restore();
  hud.textContent = `${N_MACHINES} machines · ${segs.length} wires drawn (${unparsed} endpoints off-template) · zoom ${cam.s.toFixed(2)}`;
}
// wire index lookup (segs order == parse order over the wire list minus skips)
const wireIndex: number[] = [];
{
  let k = 0;
  matrixSlots.clear();
  for (let i = 0; i < wires.length; i++) {
    const [a, b] = wires[i].split('/');
    if (endpointPos(a) && endpointPos(b)) wireIndex[k++] = i;
  }
}

// ---- the game (the /tetris/ machine on autoplay) -----------------------
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
const rowMask = (k: number) => {
  const srows = SHAPES[shapeAt()]?.rows;
  const p = posAt();
  const row = srows?.[k];
  if (p < 0 || !row) return 0;
  const sh = p + row.off;
  if (sh < 0 || sh + row.w > COLS) return 0;
  return ((1 << row.w) - 1) << sh;
};
function paintWell(note?: string) {
  const tok = tokenRow();
  const masks = [0, 1, 2, 3].map((k) => rowMask(k));
  for (let r = 0; r < ROWS; r++) {
    for (let j = 0; j < COLS; j++) {
      const on = rel(L.CELL(r, j));
      let piece = false;
      for (let k = 0; k < 4; k++) if (tok - k === r && ((masks[k] >> j) & 1) === 1 && tok >= k) piece = true;
      pixels[r][j].style.background = piece ? '#7fd4ff' : on ? '#ffb000' : '#1b2027';
    }
  }
  const label = SHAPES[shapeAt()]?.label ?? '…';
  statusEl.textContent = note ?? `${label}${tok >= 0 ? ` at row ${tok}` : dealing ? ' — the ring spins' : ''}`;
  pullState();
}
let busy = true;
function press(b: { button: number; machine: number }) {
  sim.pressButton(b.button, b.machine);
  sim.releaseButton(b.button, b.machine);
}
function runTick() {
  if (busy) return;
  busy = true;
  const step = (n: number) => {
    sim.setSlide(IO.tick.slide, 'right', IO.tick.machine);
    paintWell();
    setTimeout(() => {
      sim.setSlide(IO.tick.slide, 'left', IO.tick.machine);
      paintWell();
      if ((rel(L.LKS) || rel(L.LANE)) && n < 3 * ROWS + 6) setTimeout(() => step(n + 1), 16);
      else {
        busy = false;
        deal();
      }
    }, 60);
  };
  step(0);
}
// the free-run dealer (the /tetris/ design: JS cranks, YOUR press samples)
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
      if (rel(L.GAMEOVER)) { dealing = false; busy = false; paintWell('game over — reload'); return; }
      if (serveReq || (autoServeReq && steps >= SHAPES.length)) {
        dealing = false;
        if (tokenRow() < 0) press(IO.start);
        busy = false;
        paintWell(`dealt: ${SHAPES[shapeAt()]?.label}`);
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
      paintWell();
      step();
    }, 16);
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
document.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  if (e.key === 'f' || e.key === 'F') { fitAll(); return; }
  if (e.key === 'a' || e.key === 'A') { setAuto(!autoOn); return; }
  if (dealing && (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter')) { serveReq = true; return; }
  if (busy) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const p = posAt();
    if (p < 0) return;
    press(e.key === 'ArrowRight' ? IO.right : IO.left);
    paintWell();
  } else if (e.key === 'ArrowUp') {
    press(IO.up);
    paintWell();
  } else if (e.key === 'ArrowDown' || e.key === ' ') {
    runTick();
  } else if (e.key === 'Enter') {
    if (tokenRow() < 0 && !rel(L.GAMEOVER)) { press(IO.start); paintWell(); }
  }
});

// ---- animation loop ----------------------------------------------------
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

// ---- boot ---------------------------------------------------------------
resize();
fitAll();
draw();
statusEl.textContent = `wiring ${N_MACHINES} machines…`;
setTimeout(() => {
  sim = new MinivacSimulator(wires, false, N_MACHINES);
  sim.initialize();
  busy = false;
  pullState();
  paintWell('ready — the ring spins');
  deal();
  setAuto(true);
  requestAnimationFrame(frame);
}, 30);
