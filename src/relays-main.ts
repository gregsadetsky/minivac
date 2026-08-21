/**
 * THE RELAY VIEWER — /relays/
 *
 * The tetris page shows the GAME. This shows the MACHINE: every one of
 * the ~1080 relay sections across 180 ganged Minivacs, drawn as an actual
 * relay (coil block + two armatures), with the ~4800 patch wires between
 * their real jacks.
 *
 * Built in the four stages it was asked for, each independently toggleable
 * so the look can be judged one layer at a time:
 *   1. all the relays, static
 *   2. the relays CHANGING — armatures sit on NO or NC, no animation
 *   3. the wires, non-droopy (manhattan) or droopy (a one-time sag curve)
 *   4. the wires coloured by CURRENT
 *
 * Stage 4 is exact, not a proxy: a wire is a 0.1-ohm resistor in the
 * solver rather than an ideal short, so its current is (V(a)-V(b))/R.
 *
 * PERFORMANCE SHAPE (measured, shown live in the HUD):
 *   - the circuit SOLVE is ~200ms and dominates everything
 *   - reading all 4782 wire currents is ~0.3ms, i.e. ~750x cheaper than
 *     the solve that produced them, so there is nothing here worth
 *     moving to a worker
 *   - the static picture (relay bodies, dead wires) is rendered ONCE to
 *     an offscreen canvas per zoom level and blitted; only the armatures
 *     and the ~120 live wires are redrawn per frame
 */

import { MinivacSimulator, setSolverEngine } from './simulator/minivac-simulator';
import { tetrisCircuit, TETRIS_IO } from './circuits/multivac-mini-tetris';
import { panelLayout, sectionOrigin, SEC_JACKS, CONTACT_SETS, SEC_W, SEC_H, COIL_BOX } from './relays/panel-layout';
import { buildWirePaths, type WireStyle, type WirePaths } from './relays/wire-paths';
import { circuitBlocks, ownerMap } from './relays/blocks';

const ROWS = 12;
const COLS = 6;

// the palette lives inline at each draw call: this view is one screen of
// canvas code and a colour indirection layer would only hide it.

// ------------------------------------------------------------------ setup
const root = document.getElementById('root')!;
// styled inline, like the tetris page: this view is one file and a
// stylesheet import would be the only one in the build
const css = document.createElement('style');
css.textContent = `
  html, body { margin:0; height:100%; background:#0b0e13; color:#9aa7bd;
    font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow:hidden }
  #rv-wrap { position:fixed; inset:0; display:flex; flex-direction:column }
  #rv-bar { display:flex; align-items:center; gap:10px; padding:7px 12px; flex-wrap:wrap;
    background:#111621; border-bottom:1px solid #1e2632; color:#9aa7bd }
  #rv-bar strong { color:#ffb000; font-weight:600; letter-spacing:.02em }
  #rv-bar label { display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:#9aa7bd }
  #rv-bar select, #rv-bar button { background:#1b2230; color:#c3cddd; border:1px solid #2b3648;
    border-radius:4px; padding:3px 9px; font:inherit; cursor:pointer }
  #rv-bar button:hover { background:#243047; border-color:#3b4a63 }
  .rv-sep { width:1px; align-self:stretch; background:#1e2632 }
  #rv-hud { color:#5f6d86; margin-left:auto; white-space:nowrap }
  #rv-canvas { flex:1; width:100%; display:block; cursor:grab; touch-action:none }
  #rv-canvas:active { cursor:grabbing }
  #rv-help { padding:5px 12px; background:#111621; border-top:1px solid #1e2632; color:#4d5972 }
`;
document.head.appendChild(css);
root.innerHTML = `
  <div id="rv-wrap">
    <div id="rv-bar">
      <strong>minivac relay wall</strong>
      <span class="rv-sep"></span>
      <label><input type="checkbox" id="rv-relays" checked> relays</label>
      <label><input type="checkbox" id="rv-arms" checked> armatures live</label>
      <span class="rv-sep"></span>
      wires:
      <select id="rv-wires">
        <option value="none">none</option>
        <option value="manhattan" selected>manhattan</option>
        <option value="droopy">droopy</option>
      </select>
      <label><input type="checkbox" id="rv-current" checked> colour by current</label>
      harness: <input type="range" id="rv-dim" min="1" max="10" value="6" style="width:70px">
      <select id="rv-pal">
        <option value="amber" selected>amber on slate</option>
        <option value="gr">green off / red live</option>
      </select>
      <label><input type="checkbox" id="rv-rails" checked> supply stubs</label>
      <span class="rv-sep"></span>
      part: <select id="rv-block"></select>
      <label><input type="checkbox" id="rv-io"> only its i/o</label>
      <label><input type="checkbox" id="rv-well" checked> well</label>
      <span class="rv-sep"></span>
      <button id="rv-tick">tick</button>
      <button id="rv-run">run</button>
      <button id="rv-fit">fit</button>
      <span class="rv-sep"></span>
      <span id="rv-hud"></span>
    </div>
    <canvas id="rv-canvas"></canvas>
    <div id="rv-help">drag to pan &middot; wheel to zoom &middot; enter spawns &middot; arrows steer/rotate &middot; space ticks</div>
  </div>`;

const canvas = document.getElementById('rv-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const hud = document.getElementById('rv-hud')!;
const cbRelays = document.getElementById('rv-relays') as HTMLInputElement;
const cbArms = document.getElementById('rv-arms') as HTMLInputElement;
const cbCurrent = document.getElementById('rv-current') as HTMLInputElement;
const selWires = document.getElementById('rv-wires') as HTMLSelectElement;
const cbRails = document.getElementById('rv-rails') as HTMLInputElement;
const selBlock = document.getElementById('rv-block') as HTMLSelectElement;
const cbIO = document.getElementById('rv-io') as HTMLInputElement;
const rngDim = document.getElementById('rv-dim') as HTMLInputElement;
const cbWell = document.getElementById('rv-well') as HTMLInputElement;
const selPal = document.getElementById('rv-pal') as HTMLSelectElement;
/** the dead harness was drawn at #232c3a on #0b0e13 and read as invisible:
 *  all 4782 wires were there, only ~117 amber ones showed. brightness is a
 *  control now, and the HUD reports how many were actually stroked. */
const harnessColour = () => {
  const t = +rngDim.value / 10;
  const c = Math.round(30 + t * 110);
  return selPal.value === 'gr'
    ? `rgb(${Math.round(c * 0.3)},${c},${Math.round(c * 0.45)})`
    : `rgb(${Math.round(c * 0.72)},${Math.round(c * 0.85)},${c})`;
};
const liveColour = () => (selPal.value === 'gr' ? '#ff4d4d' : '#ffb000');

// ------------------------------------------------------------- the machine
setSolverEngine('fast');
const built = tetrisCircuit(ROWS, COLS);
const sim = new MinivacSimulator(built.wires, false, built.layout.machines);
sim.initialize();

const L = panelLayout(built.layout.machines);
const terms = sim.getWireTerminals();
const resolved = terms.map((t) => L.ends(t[0], t[1]));
const wireEnds = resolved.map((e) => (e ? ([e.ax, e.ay, e.bx, e.by] as const) : null));
/** rail stubs are drawn as a symbol, not routed: 0 none, 1 plus, -1 minus */
const railKind = new Int8Array(resolved.length);
resolved.forEach((e, i) => (railKind[i] = e?.rail === '+' ? 1 : e?.rail === '-' ? -1 : 0));
const railStubs = resolved.filter((e) => e?.rail).length;
const unplaced = wireEnds.filter((e) => !e).length;
const paths: Record<WireStyle, WirePaths> = {
  // a rail stub is the same short straight segment in both styles: it is
  // a symbol, not a run of wire, so neither routing nor sag applies
  manhattan: buildWirePaths(wireEnds, 'manhattan', railKind),
  droopy: buildWirePaths(wireEnds, 'droopy', railKind),
};
const current = new Float32Array(terms.length);

// ---- the parts of the circuit, read off the layout's own accessors ----
const BLOCKS = circuitBlocks(built.layout, ROWS, COLS);
selBlock.innerHTML =
  '<option value="-2">off</option><option value="-1">all parts</option>' +
  BLOCKS.map((b, i) => `<option value="${i}" title="${b.note}">${b.name}</option>`).join('');
selBlock.value = '-2';
/** -2 no tint, -1 every part tinted, >=0 focus one part */
const blockMode = () => parseInt(selBlock.value, 10);

/** relay state, read once per frame into a flat array */
const nSections = built.layout.machines * 6;
const energized = new Uint8Array(nSections);
function readRelays(): void {
  for (let m = 0; m < built.layout.machines; m++) {
    const st = sim.getMachineState(m).relays;
    for (let s = 0; s < 6; s++) energized[m * 6 + s] = st[s] ? 1 : 0;
  }
}

const owner = ownerMap(BLOCKS, nSections);
/** which section a jack name belongs to, so a wire can be attributed */
const sectionOfNode = (name: string): number => {
  const g = /^(?:m(\d+)\.)?(?:Relay(\d)|Common_(\d)|Capacitor_(\d)|Slide(\d)|Button(\d))/.exec(name);
  if (!g) return -1;
  const mach = g[1] === undefined ? 0 : +g[1];
  const sec = +(g[2] ?? g[3] ?? g[4] ?? g[5] ?? g[6]);
  return Number.isFinite(sec) && sec >= 1 ? mach * 6 + (sec - 1) : -1;
};
/** per wire: the block at each end, -1 for rails and unowned relays */
const wireBlockA = new Int8Array(terms.length).fill(-1);
const wireBlockB = new Int8Array(terms.length).fill(-1);
for (let i = 0; i < terms.length; i++) {
  const sa = sectionOfNode(terms[i][0]);
  const sb = sectionOfNode(terms[i][1]);
  wireBlockA[i] = sa >= 0 && sa < nSections ? owner[sa] : -1;
  wireBlockB[i] = sb >= 0 && sb < nSections ? owner[sb] : -1;
}

/**
 * With a part focused and "only its i/o" on, the picture drops to that
 * part's CROSSINGS — wires with exactly one end inside it. That is the
 * visual6502 reading of a block's interface: what it listens to and what
 * it drives, with its internal wiring taken out of the way.
 */
function wireShown(i: number): boolean {
  const mode = blockMode();
  if (mode < 0 || !cbIO.checked) return true;
  const a = wireBlockA[i] === mode, b = wireBlockB[i] === mode;
  return a !== b;
}

// -------------------------------------------------------------- the camera
let zoom = 0.2;
let panX = 0;
let panY = 0;
function fit(): void {
  const z = Math.min(canvas.clientWidth / L.width, canvas.clientHeight / L.height) * 0.98;
  zoom = z;
  panX = (canvas.clientWidth - L.width * z) / 2;
  panY = (canvas.clientHeight - L.height * z) / 2;
  staticDirty = true;
}

// ------------------------------------------------- the static picture cache
// relay bodies and dead wires never move, so they are rendered once per
// (zoom, options) into an offscreen canvas the size of the viewport and
// blitted; only armatures and live wires are per-frame work.
let staticLayer: HTMLCanvasElement | null = null;
let staticDirty = true;
let staticKey = '';

function drawSectionBody(g: CanvasRenderingContext2D, x: number, y: number, tint: string | null, focus = false): void {
  // the part tint is a WASH, not a fill: the relay has to stay readable
  g.fillStyle = tint ?? '#1b2230';
  if (tint) g.globalAlpha = focus ? 0.42 : 0.2;
  g.fillRect(x, y, SEC_W, SEC_H);
  g.globalAlpha = 1;
  if (!tint) g.fillStyle = '#1b2230';
  g.strokeStyle = tint ?? '#2b3648';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, SEC_W - 1, SEC_H - 1);

  // the coil: a bobbin with windings, so it reads as a coil and not a box
  const cb = COIL_BOX;
  g.fillStyle = '#2b3446';
  g.fillRect(x + cb.x, y + cb.y, cb.w, cb.h);
  g.strokeStyle = '#3f4b63';
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < 8; i++) {
    const wx = x + cb.x + (i * cb.w) / 8;
    g.moveTo(wx, y + cb.y + 3);
    g.lineTo(wx, y + cb.y + cb.h - 3);
  }
  // the bobbin's end cheeks
  g.moveTo(x + cb.x + 1.5, y + cb.y);
  g.lineTo(x + cb.x + 1.5, y + cb.y + cb.h);
  g.moveTo(x + cb.x + cb.w - 1.5, y + cb.y);
  g.lineTo(x + cb.x + cb.w - 1.5, y + cb.y + cb.h);
  g.stroke();
  // the coil's own leads down to E and F
  g.strokeStyle = '#46536b';
  g.beginPath();
  g.moveTo(x + cb.x + 8, y + cb.y + cb.h);
  g.lineTo(x + SEC_JACKS.E[0], y + SEC_JACKS.E[1]);
  g.moveTo(x + cb.x + cb.w - 8, y + cb.y + cb.h);
  g.lineTo(x + SEC_JACKS.F[0], y + SEC_JACKS.F[1]);
  g.stroke();

  // each contact set: the hinge post, and the two fixed contacts it can
  // land on drawn as little anvils so the arm has somewhere to go
  for (const cs of CONTACT_SETS) {
    const p = SEC_JACKS[cs.pivot], nc = SEC_JACKS[cs.nc], no = SEC_JACKS[cs.no];
    g.strokeStyle = '#3f4b63';
    g.lineWidth = 1.4;
    g.beginPath();
    // the hinge post rising from the frame to the pivot
    g.moveTo(x + p[0], y + p[1] + 12);
    g.lineTo(x + p[0], y + p[1]);
    // the fixed contacts, as short vertical anvils
    for (const c of [nc, no]) {
      g.moveTo(x + c[0] - 5, y + c[1]);
      g.lineTo(x + c[0] + 5, y + c[1]);
    }
    g.stroke();
  }

  // every jack as a dot
  g.fillStyle = '#46536b';
  for (const k in SEC_JACKS) {
    const p = SEC_JACKS[k];
    g.beginPath();
    g.arc(x + p[0], y + p[1], 2.2, 0, 6.2832);
    g.fill();
  }
}

function renderStatic(): void {
  if (!staticLayer) staticLayer = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  staticLayer.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  staticLayer.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  const g = staticLayer.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0b0e13';
  g.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  g.save();
  g.translate(panX, panY);
  g.scale(zoom, zoom);

  if (cbRelays.checked) {
    for (let m = 0; m < built.layout.machines; m++) {
      const [mx, my] = L.machineOrigin(m);
      g.fillStyle = '#141922';
      g.strokeStyle = '#1e2632';
      g.lineWidth = 1;
      const mw = 2 * SEC_W + 10 + 24;
      const mh = 3 * SEC_H + 16 + 34 + 28;
      g.fillRect(mx, my, mw, mh);
      g.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
      if (zoom > 0.42) {
        g.fillStyle = '#55627a';
        g.font = '11px ui-monospace, monospace';
        g.fillText(`m${m}`, mx + 8, my + 14);
      }
      for (let s = 1; s <= 6; s++) {
        const [sx, sy] = sectionOrigin(s);
        const b = owner[m * 6 + (s - 1)];
        const mode = blockMode();
        const tint =
          mode === -2 || b < 0 ? null : mode === -1 || mode === b ? BLOCKS[b].colour : '#2a3242';
        drawSectionBody(g, mx + sx, my + sy, tint, mode >= 0 && b === mode);
      }
    }
  }
  // THE HARNESS GOES ON TOP. drawing it first and then filling the relay
  // bodies painted over nearly every wire — machines tile the whole wall,
  // so only the fragments crossing the gaps survived and the picture read
  // as a tiny subset of the wiring. patch cords lie on top of the panel in
  // the real thing too.
  const style = selWires.value as WireStyle | 'none';
  if (style !== 'none') {
    const p = paths[style];
    g.strokeStyle = harnessColour();
    g.lineWidth = Math.max(0.6, 1.1 / zoom);
    g.beginPath();
    const showRails = cbRails.checked;
    drawnWires = 0;
    for (let i = 0; i < p.count; i++) {
      if (railKind[i] !== 0 && !showRails) continue;
      if (!wireShown(i)) continue;
      drawnWires++;
      const s = p.start[i], e = p.start[i + 1];
      if (e <= s) continue;
      g.moveTo(p.pts[s], p.pts[s + 1]);
      for (let k = s + 2; k < e; k += 2) g.lineTo(p.pts[k], p.pts[k + 1]);
    }
    g.stroke();
    // the supply symbols at the far end of each stub: a bar for minus, a
    // cross for plus, which is what the wire is actually going to
    if (showRails && zoom > 0.22) {
      g.strokeStyle = '#33405a';
      g.lineWidth = Math.max(0.8, 1.4 / zoom);
      g.beginPath();
      for (let i = 0; i < p.count; i++) {
        const k = railKind[i];
        if (k === 0) continue;
        const e = p.start[i + 1];
        if (e < 4) continue;
        const bx = p.pts[e - 2], by = p.pts[e - 1];
        g.moveTo(bx - 4, by);
        g.lineTo(bx + 4, by);
        if (k > 0) {
          g.moveTo(bx, by - 4);
          g.lineTo(bx, by + 4);
        }
      }
      g.stroke();
    }
  }

  g.restore();
  staticDirty = false;
}

// ------------------------------------------------------------- the frame
let lastSolveMs = 0;
let lastWireMs = 0;
let lastDrawMs = 0;
let liveWires = 0;
let drawnWires = 0;

function draw(): void {
  const t0 = performance.now();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    staticDirty = true;
  }
  const key = `${zoom}|${panX}|${panY}|${selWires.value}|${cbRelays.checked}|${cbRails.checked}|${selBlock.value}|${cbIO.checked}|${rngDim.value}|${selPal.value}|${cw}x${ch}`;
  if (staticDirty || key !== staticKey) {
    renderStatic();
    staticKey = key;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(staticLayer!, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // ---- live wires, over the dead harness ----
  const style = selWires.value as WireStyle | 'none';
  if (style !== 'none' && cbCurrent.checked) {
    const tw = performance.now();
    sim.getWireCurrents(current);
    lastWireMs = performance.now() - tw;
    const p = paths[style];
    ctx.strokeStyle = liveColour();
    ctx.lineWidth = Math.max(1, 2.2 / zoom);
    ctx.beginPath();
    let live = 0;
    const showRails = cbRails.checked;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(current[i]) < 0.05) continue;
      if (railKind[i] !== 0 && !showRails) continue;
      if (!wireShown(i)) continue;
      const s = p.start[i], e = p.start[i + 1];
      if (e <= s) continue;
      live++;
      ctx.moveTo(p.pts[s], p.pts[s + 1]);
      for (let k = s + 2; k < e; k += 2) ctx.lineTo(p.pts[k], p.pts[k + 1]);
    }
    ctx.stroke();
    liveWires = live;
  } else {
    lastWireMs = 0;
    liveWires = 0;
  }
  if (selWires.value === 'none') drawnWires = 0;

  // ---- the armatures: the whole point of the view ----
  if (cbRelays.checked && cbArms.checked) {
    readRelays();
    // two passes so the whole released set and the whole pulled set are
    // each one path: colour is the second cue, the ANGLE is the first
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? '#ffc44d' : '#7f8da8';
      ctx.lineWidth = Math.max(1, (pass ? 3 : 2.2) / zoom);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let m = 0; m < built.layout.machines; m++) {
        const [mx, my] = L.machineOrigin(m);
        for (let s = 1; s <= 6; s++) {
          const on = energized[m * 6 + (s - 1)] === 1;
          if ((pass === 1) !== on) continue;
          const [sx, sy] = sectionOrigin(s);
          const bx = mx + sx, by = my + sy;
          for (const cs of CONTACT_SETS) {
            const p = SEC_JACKS[cs.pivot];
            const t = SEC_JACKS[on ? cs.no : cs.nc];
            ctx.moveTo(bx + p[0], by + p[1]);
            ctx.lineTo(bx + t[0], by + t[1]);
          }
        }
      }
      ctx.stroke();
    }
    // a pulled coil glows, so an energized section is readable even when
    // the armatures are too small to resolve
    if (zoom > 0.1) {
      ctx.fillStyle = '#6b4f10';
      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = Math.max(0.7, 1.2 / zoom);
      for (let m = 0; m < built.layout.machines; m++) {
        const [mx, my] = L.machineOrigin(m);
        for (let s = 1; s <= 6; s++) {
          if (!energized[m * 6 + (s - 1)]) continue;
          const [sx, sy] = sectionOrigin(s);
          ctx.fillRect(mx + sx + COIL_BOX.x, my + sy + COIL_BOX.y, COIL_BOX.w, COIL_BOX.h);
          if (zoom > 0.35)
            ctx.strokeRect(mx + sx + COIL_BOX.x, my + sy + COIL_BOX.y, COIL_BOX.w, COIL_BOX.h);
        }
      }
    }
  }
  ctx.restore();

  // ---- the well, in SCREEN space, so you can see what you are playing ----
  // read from the machine's own relays: stored cells from CELL, and the
  // falling piece from the mask fans at the token row (PIECE) and the row
  // above it (PIECET). nothing here is a model of the game — it is the
  // same relays the wall is drawing, just arranged as a playfield.
  if (cbWell.checked) {
    const cell = 11, pad = 8;
    const w = COLS * cell + pad * 2, h = ROWS * cell + pad * 2 + 14;
    const ox = cw - w - 14, oy = ch - h - 14;
    ctx.fillStyle = 'rgba(10,13,19,0.92)';
    ctx.strokeStyle = '#2b3648';
    ctx.lineWidth = 1;
    ctx.fillRect(ox, oy, w, h);
    ctx.strokeRect(ox + 0.5, oy + 0.5, w - 1, h - 1);
    const relayOn = (n: number) => sim.getMachineState(Math.floor(n / 6)).relays[n % 6];
    let tokenRow = -1;
    for (let i = 0; i < ROWS; i++) if (relayOn(built.layout.RING(i, 2))) { tokenRow = i; break; }
    for (let r = 0; r < ROWS; r++) {
      for (let j = 0; j < COLS; j++) {
        const stored = relayOn(built.layout.CELL(r, j));
        let live = false;
        if (tokenRow >= 0) {
          if (r === tokenRow) live = relayOn(built.layout.PIECE(j));
          else if (r === tokenRow - 1) live = relayOn(built.layout.PIECET(j));
        }
        if (!stored && !live) continue;
        ctx.fillStyle = live ? '#ffd166' : '#5f7fb0';
        ctx.fillRect(ox + pad + j * cell + 1, oy + pad + r * cell + 1, cell - 2, cell - 2);
      }
    }
    ctx.fillStyle = '#55627a';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(tokenRow >= 0 ? `piece at row ${tokenRow}` : 'no piece — enter to spawn', ox + pad, oy + h - 8);
  }

  lastDrawMs = performance.now() - t0;

  let up = 0;
  for (let i = 0; i < nSections; i++) up += energized[i];
  hud.textContent =
    `${built.layout.machines} machines / ${nSections} relays (${up} pulled) · ` +
    `${terms.length} wires (${drawnWires} drawn, ${railStubs} to rails)${unplaced ? `, ${unplaced} UNPLACED` : ''}` +
    `${liveWires ? `, ${liveWires} live` : ''} · ` +
    `draw ${lastDrawMs.toFixed(1)}ms · wire currents ${lastWireMs.toFixed(2)}ms · solve ${lastSolveMs.toFixed(0)}ms`;
}

let raf = 0;
function schedule(): void {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    draw();
  });
}

// ------------------------------------------------------------- driving it
function timedSolve(fn: () => void): void {
  const t = performance.now();
  fn();
  lastSolveMs = performance.now() - t;
  schedule();
}
const tick = () =>
  timedSolve(() => {
    sim.setSlide(TETRIS_IO.tick.slide, 'right', TETRIS_IO.tick.machine);
    sim.setSlide(TETRIS_IO.tick.slide, 'left', TETRIS_IO.tick.machine);
  });
const pressBtn = (b: { button: number; machine: number }) =>
  timedSolve(() => {
    sim.pressButton(b.button, b.machine);
    sim.releaseButton(b.button, b.machine);
  });

document.getElementById('rv-tick')!.addEventListener('click', tick);
document.getElementById('rv-fit')!.addEventListener('click', () => {
  fit();
  schedule();
});
let runTimer: number | null = null;
const runBtn = document.getElementById('rv-run') as HTMLButtonElement;
runBtn.addEventListener('click', () => {
  if (runTimer !== null) {
    clearInterval(runTimer);
    runTimer = null;
    runBtn.textContent = 'run';
    return;
  }
  runBtn.textContent = 'stop';
  runTimer = window.setInterval(() => {
    tick();
  }, 120);
});
for (const el of [cbRelays, cbArms, cbCurrent, cbRails, selWires, selBlock, cbIO, rngDim, cbWell, selPal]) {
  el.addEventListener('change', () => {
    staticDirty = true;
    schedule();
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') pressBtn(TETRIS_IO.start);
  else if (e.key === 'ArrowLeft') pressBtn(TETRIS_IO.left);
  else if (e.key === 'ArrowRight') pressBtn(TETRIS_IO.right);
  else if (e.key === 'ArrowUp') pressBtn(TETRIS_IO.up);
  else if (e.key === ' ' || e.key === 'ArrowDown') tick();
  else return;
  e.preventDefault();
});

let dragging = false;
let lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  panX += e.clientX - lastX;
  panY += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  staticDirty = true;
  schedule();
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0016);
    const nz = Math.min(3, Math.max(0.03, zoom * f));
    // keep the point under the cursor put
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    panX = cx - ((cx - panX) * nz) / zoom;
    panY = cy - ((cy - panY) * nz) / zoom;
    zoom = nz;
    staticDirty = true;
    schedule();
  },
  { passive: false }
);
window.addEventListener('resize', () => {
  staticDirty = true;
  schedule();
});

fit();
readRelays();
schedule();
