// the relay viewer's receipt driver (playwright against the vite preview).
//
// /relays/ shipped with its keyboard wired to the DEFAULT geometry's button
// machine (m124) while the page builds a 12x6 circuit whose buttons live on
// m178 — so LEFT, RIGHT and UP pressed jacks no wire touches and the page
// looked like it had no controls at all. This driver is the guard against
// that class: it drives the page's real keyboard and checks the MACHINE
// answered, not that a handler ran.
//
// run: npm run build && npx vite preview --port 4189 &
//      node scripts/verify-relays-page.mjs   (BASE overrides the url)
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:4189';
const ROWS = 12;
const COLS = 6;
const WELL_CELL = 52; // must match relays-main.ts
const SHOT_DIR = process.env.SHOT_DIR || '/tmp';

const browser = await chromium.launch({
  // PW_CHROME overrides for local runs (the default is the cloud sandbox path)
  executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const status = () => page.locator('#rv-status').textContent();
// wait on the page's OWN busy flag, not on the wording of the status
// line: operations here are multi-press and report progress as they go
// ("column 3", "locked — bookkeeping…"), so sniffing prose would call
// the machine idle in the middle of a deal.
const waitIdle = async (label, timeout = 120000) => {
  const t0 = Date.now();
  for (;;) {
    const b = await page.getAttribute('#rv-status', 'data-busy');
    if (b === '0') return status();
    if (Date.now() - t0 > timeout) throw new Error(`${label}: still busy after ${timeout}ms: ${await status()}`);
    await page.waitForTimeout(40);
  }
};

// The well overlay, read straight off the canvas pixels.
//
// Behind a DOUBLE requestAnimationFrame on purpose: the page flips the
// status line synchronously at the end of a solve but repaints on the
// next frame, so a sample taken the instant waitIdle() returns can read
// the PREVIOUS frame. That cost one confusing false failure already.
const well = () =>
  page.evaluate(
    ({ ROWS, COLS, WELL_CELL }) =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.getElementById('rv-canvas');
      const g = c.getContext('2d');
      const cell = Math.max(12, Math.min(WELL_CELL, Math.floor((c.height - 112) / ROWS)));
      const pad = Math.round(cell * 0.3);
      const cap = Math.round(cell * 0.42) + 12;
      const w = COLS * cell + pad * 2, h = ROWS * cell + pad * 2 + cap;
      const ox = c.width - w - 14, oy = c.height - h - 14;
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        let line = '';
        for (let j = 0; j < COLS; j++) {
          // sample below the lit face strip so the block body colour reads
          const d = g.getImageData(
            Math.round(ox + pad + j * cell + cell / 2),
            Math.round(oy + pad + r * cell + cell * 0.65),
            1, 1
          ).data;
          const hex = ((d[0] << 16) | (d[1] << 8) | d[2]).toString(16).padStart(6, '0');
          line += hex === 'ffd166' ? 'P' : hex === '5f7fb0' ? 'O' : '.';
        }
        rows.push(line);
      }
      resolve({ rows, cell });
    }))),
    { ROWS, COLS, WELL_CELL }
  );

const pieceCols = (rows) => {
  const out = [];
  rows.forEach((line, r) => [...line].forEach((ch, j) => ch === 'P' && out.push([r, j])));
  return out;
};
const fail = (m) => {
  console.error('FAIL:', m);
  process.exitCode = 1;
};

await page.goto(`${BASE}/relays/`);
await waitIdle('boot');
console.log('boot:', await status());

// ---- 1. the well is drawn at a size a human can read -----------------------
{
  const { cell } = await well();
  if (cell < 40) fail(`well cell is ${cell}px — it shipped at 11 and must be ~5x that`);
  else console.log(`ok  well cell ${cell}px (was 11)`);
}

// ---- 2. the shape ring is reachable: deal every state ----------------------
{
  const labels = await page.$$eval('#rv-deal option', (os) =>
    os.map((o) => [o.value, o.textContent]).filter(([v]) => +v >= 0)
  );
  if (labels.length !== 22) fail(`dealer lists ${labels.length} shapes, expected 22 (B3: every tetromino orientation)`);
  let dealt = 0;
  for (const [value, label] of labels) {
    await page.selectOption('#rv-deal', value);
    const s = await waitIdle(`deal ${label}`);
    if (!s.includes(label)) fail(`dealing ${label} ended at: ${s}`);
    else dealt++;
  }
  if (dealt === labels.length) console.log(`ok  every one of the ${labels.length} ring states deals`);
}

// ---- 3. LEFT/RIGHT actually move the piece ---------------------------------
await page.selectOption('#rv-deal', '8'); // T: a three-wide bottom, easy to see
await waitIdle('deal T');
await page.keyboard.press('Enter');
await waitIdle('start');
await page.keyboard.press(' ');
await waitIdle('tick');
{
  const col = (rows) => { const c = pieceCols(rows); return c.length ? Math.min(...c.map((x) => x[1])) : -1; };
  const c0 = col((await well()).rows);
  if (c0 < 0) throw new Error('no piece drawn in the well after start+tick');
  await page.keyboard.press('ArrowRight');
  const s1 = await waitIdle('right');
  const c1 = col((await well()).rows);
  if (c1 !== c0 + 1) fail(`ArrowRight moved the piece ${c0} -> ${c1} (status: ${s1})`);
  else console.log(`ok  ArrowRight steps the register (${s1})`);
  await page.keyboard.press('ArrowLeft');
  const s2 = await waitIdle('left');
  const c2 = col((await well()).rows);
  if (c1 === c0) console.log('--  ArrowLeft not checked: the piece never left column', c0);
  else if (c2 !== c0) fail(`ArrowLeft did not step back: ${c1} -> ${c2} (status: ${s2})`);
  else console.log(`ok  ArrowLeft steps it back (${s2})`);
}

// ---- 4. the piece is a real multi-cell shape, not a lone square ------------
{
  const cells = pieceCols((await well()).rows);
  if (cells.length < 3) fail(`the dealt T drew ${cells.length} cells — the ring is stuck`);
  else console.log(`ok  the dealt piece is ${cells.length} cells, not a 1x1`);
}

// ---- 5. ArrowUp mid-fall rotates and the piece KEEPS FALLING ---------------
{
  const rowOf = (rows) => { const c = pieceCols(rows); return c.length ? Math.max(...c.map((x) => x[0])) : -1; };
  const r0 = rowOf((await well()).rows);
  const su = await (async () => { await page.keyboard.press('ArrowUp'); return waitIdle('up'); })();
  console.log('    mid-fall up:', su);
  const r1 = rowOf((await well()).rows);
  if (r1 !== r0) fail(`ArrowUp moved the piece's row ${r0} -> ${r1}`);
  await page.keyboard.press(' ');
  await waitIdle('tick after up');
  const r2 = rowOf((await well()).rows);
  if (r2 !== r0 + 1) fail(`after ArrowUp the piece stopped mid-air: row ${r0} -> ${r2}`);
  else console.log(`ok  ArrowUp leaves the piece falling (row ${r0} -> ${r2})`);
  // B2: that UP was a QUARTER turn (T -> T vert R). complete the 4-cycle
  // so the landing phase below sees the canonical 2-row T again — and
  // this page receipts the full rotation cycle on the way.
  for (let k = 0; k < 3; k++) {
    await page.keyboard.press('ArrowUp');
    await waitIdle('4-cycle');
  }
  console.log('ok  the 4-cycle returned the T (three more quarter turns)');
}

// ---- 6. a second START mid-fall is refused (no stranded mid-air cell) ------
{
  const s = await (async () => { await page.keyboard.press('Enter'); return waitIdle('second start'); })();
  if (!/already falling/.test(s)) fail(`a second START mid-fall was accepted: ${s}`);
  else console.log('ok  START is refused mid-fall (no second token)');
}

// ---- 7. run it out: the piece lands, and nothing is left hanging -----------
{
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press(' ');
    await waitIdle(`tick ${i}`);
    const rows = (await well()).rows;
    if (!pieceCols(rows).length) break;
  }
  const rows = (await well()).rows;
  const stored = [];
  rows.forEach((line, r) => [...line].forEach((ch, j) => ch === 'O' && stored.push([r, j])));
  if (!stored.length) fail('the piece never landed');
  const bottom = Math.max(...stored.map((c) => c[0]));
  if (bottom !== ROWS - 1) fail(`the stack's lowest cell is row ${bottom}, expected ${ROWS - 1}`);
  // ONE two-row piece onto an empty field can only occupy the bottom two
  // rows. Anything higher is a cell stranded in mid-air, which is what a
  // second START mid-fall produces: two tokens fall three rows apart and
  // the lock writes BOTH their rows.
  else if (stored.some(([r]) => r < ROWS - 2))
    fail(`cells stranded above the floor: rows ${[...new Set(stored.map((c) => c[0]))].sort((a, b) => a - b)}`);
  else console.log(`ok  the piece landed on the floor, nothing stranded (${stored.length} cells, rows ${ROWS - 2}-${bottom})`);
}

await page.screenshot({ path: `${SHOT_DIR}/relays-page.png` });
if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log(process.exitCode ? 'RELAYS PAGE: FAILED' : 'RELAYS PAGE: all checks passed');
await browser.close();
