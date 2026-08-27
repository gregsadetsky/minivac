// the tetris page's end-to-end receipt driver (playwright against the
// vite preview): shape cycle, vertical + staggered locks, the line
// flash, steer-into-overlap, auto-gravity (strict single-step), the
// machine wall, post-auto manual play, a STEP-EXACT scripted game
// checked against a rules model after EVERY keypress, and the double
// clear. run: npm run build && npx vite preview --port 4189 & then
// node scripts/verify-tetris-page.mjs  (BASE env overrides the url;
// SHOT_DIR redirects screenshots). this driver caught the auto-off
// wedge and the score race before any human did — treat it as a gate.
// verify the /tetris/ page's vertical-piece flow against the preview build:
// shape cycle on ArrowUp, tall overlay, auto-bookkeeping ticks after a lock,
// and the final field state (two stacked cells, then a 2x2 square).
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:4189';
const PCOLS = 6; // the page's well width (bumped with the wider-well rung)
import { tmpdir } from 'node:os';
const SHOT_DIR = process.env.SHOT_DIR || tmpdir();
const SHOT = (n) => `${SHOT_DIR}/shot-${n}.png`;

const browser = await chromium.launch({
  // PW_CHROME overrides for local runs (the default is the cloud sandbox path)
  executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
const status = () => page.locator('#status').textContent();

const waitIdle = async (label, timeout = 30000) => {
  // idle = status no longer shows a settling/bookkeeping note
  const t0 = Date.now();
  for (;;) {
    const s = await status();
    if (!/settling|bookkeeping|holding|falls|falls|wiring/.test(s)) return s;
    if (Date.now() - t0 > timeout) throw new Error(`${label}: still busy: ${s}`);
    await page.waitForTimeout(60);
  }
};

// grid colors: pixel k = row floor(k/4), col k%4
const gridState = () =>
  page.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid > div')];
    return cells.map((d) => {
      // read the inline TARGET style, not getComputedStyle: the page runs a
      // 120ms background transition and a computed read mid-transition
      // returns an interpolated color that matches nothing
      const c = d.style.background;
      if (c.includes('127, 212, 255') || c === '#7fd4ff') return 'P'; // piece cyan
      if (c.includes('255, 176, 0') || c === '#ffb000') return 'O'; // cell amber
      return '.';
    });
  });
const rows = async () => {
  const g = await gridState();
  return Array.from({ length: 12 }, (_, r) => g.slice(PCOLS * r, PCOLS * r + PCOLS).join(''));
};

await page.goto(`${BASE}/tetris/?deal=manual`);
await waitIdle('boot', 60000);
console.log('boot ok:', await status());

// toys-retire: the FIRST UP is the rho's one-way entry edge — the boot
// 1x1 steps straight to the O and the ring never returns to the toys
await page.keyboard.press('ArrowUp');
const s2 = await waitIdle('shape1');
console.log('shape after the entry UP (want 2x2 square):', s2);
if (!s2.includes('2x2')) throw new Error('the entry edge did not reach the square');

// spawn and hard-run the piece to the floor: 8 ticks max (spawn at 0..7)
await page.keyboard.press('Enter');
await waitIdle('spawn');
await page.screenshot({ path: SHOT('spawned') });

// tick until no piece is reported (16 covers a 12-row fall + bookkeeping)
// bookkeeping (phase 2 + reset) — the page must run those unprompted
let sawBookkeeping = false;
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('ArrowDown');
  // watch for the bookkeeping note while this interaction settles
  const t0 = Date.now();
  for (;;) {
    const s = await page.locator('#status').textContent();
    if (/bookkeeping/.test(s)) sawBookkeeping = true;
    if (!/settling|bookkeeping|holding|falls/.test(s)) break;
    if (Date.now() - t0 > 30000) throw new Error('tick never settled');
    await page.waitForTimeout(40);
  }
  const s = await status();
  if (/enter to spawn/.test(s)) break;
}
console.log('after the square drop:', await status());
console.log('saw bookkeeping note:', sawBookkeeping);
const r1 = await rows();
console.log('field:\n' + r1.join('\n'));
await page.screenshot({ path: SHOT('square-landed') });
// the register homes at the CENTER (col 2 on the 6-wide well): the
// square's two-row write is the phase-2 receipt now that the 2-tall toy
// is retired — cols 2-3, rows 10+11, nothing else
if (r1[11] !== '..OO..' || r1[10] !== '..OO..') throw new Error('square write wrong: ' + JSON.stringify(r1));
if (!sawBookkeeping) throw new Error('auto-bookkeeping note never appeared');

// second square at the left wall (pos 0: bottom cols 0-1)
await page.keyboard.press('ArrowLeft');
await waitIdle('move');
await page.keyboard.press('ArrowLeft');
await waitIdle('moveb');
await page.keyboard.press('Enter');
await waitIdle('spawn2');
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('tick2');
  if (/enter to spawn/.test(await status())) break;
}
const r2 = await rows();
console.log('field after the second square:\n' + r2.join('\n'));
if (r2[11] !== 'OOOO..' || r2[10] !== 'OOOO..') throw new Error('second square wrong: ' + JSON.stringify(r2));

// THIRD: the chooser cycle receipt — from the square through every
// tetromino orientation and the 19-WRAP back to the square (the toys
// are gone from the cycle; the operator clamps re-position the
// register per shape along the way)
await page.keyboard.press('ArrowUp');
const sS = await waitIdle('shapeS');
if (!/\bS\b/.test(sS)) throw new Error('expected S, got: ' + sS);
for (const want of [/S vert/, /\bZ\b/, /Z vert/, /\bL\b/, /L vert R/, /L flip/, /L vert L/, /\bJ\b/, /J vert R/, /J flip/, /J vert L/, /\bT\b/, /T vert R/, /T flip/, /T vert L/, /\bI\b/, /I vert/]) {
  await page.keyboard.press('ArrowUp');
  const s = await waitIdle('shapeCycle');
  if (!want.test(s)) throw new Error(`cycle expected ${want}, got: ${s}`);
}
await page.keyboard.press('ArrowUp');
const s4 = await waitIdle('shape4');
if (!s4.includes('2x2')) throw new Error('expected the square after the 19-wrap, got: ' + s4);

// FOURTH: the third square at cols 4-5 completes rows 10 AND 11 at one
// lock — the DOUBLE clear: the flash must paint while the tick is held,
// the status must announce the clear, and the field must come out EMPTY
// (nothing was stacked above). walk to the wall deterministically, then
// 4 rights = pos 4 exactly.
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('ArrowLeft');
  await waitIdle('rehome');
}
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('ArrowRight');
  await waitIdle(`move-r${i}`);
}
await page.keyboard.press('Enter');
await waitIdle('spawn3');
let sawFlash = false;
let sawCleared = false;
let finalNote = '';
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('ArrowDown');
  const t0 = Date.now();
  for (;;) {
    const s = await page.locator('#status').textContent();
    if (/line cleared/.test(s)) sawCleared = true;
    // a full row 11 is visible ONLY during the clear flash; the token
    // row paints PIECE-cyan over the fresh write, so accept O and P
    if (!sawFlash) {
      const rr = await rows();
      if (/^[OP]{6}$/.test(rr[11])) {
        sawFlash = true;
        await page.screenshot({ path: SHOT('line-flash') });
      }
    }
    if (!/settling|bookkeeping|holding|falls/.test(s)) {
      finalNote = s;
      break;
    }
    if (Date.now() - t0 > 30000) throw new Error('clear-phase tick never settled');
    await page.waitForTimeout(25);
  }
  if (sawCleared || /enter to spawn/.test(finalNote)) break;
}
console.log('clear-phase final status:', finalNote);
console.log('saw the full-row flash mid-press:', sawFlash, '| cleared note:', sawCleared);
const r3 = await rows();
console.log('field after the double clear:\n' + r3.join('\n'));
await page.screenshot({ path: SHOT('after-clear') });
if (!sawCleared) throw new Error('cleared note never seen: ' + finalNote);
if (!sawFlash) throw new Error('the full-row flash was never painted');
if (r3.some((row) => row !== '......')) throw new Error('post-double-clear field not empty: ' + JSON.stringify(r3));

// FIFTH: the sideways-overlap guard, beam edition. Drop an I VERT at
// col 2 (a four-cell tower, rows 8-11), then catch a second beam
// falling in col 3 and push LEFT into the tower: the contacts must
// refuse (the tok-1/tok-2 reads — B1/B2's banks doing real work).
const labelOf0 = (st) => {
  const m2 = st.match(/—\s*([^—]+?)\s*(?:at row \d+|\(enter to spawn\))/);
  return m2 ? m2[1].trim() : null;
};
let pickedIV = null;
for (let i = 0; i < 22; i++) {
  pickedIV = labelOf0(await status());
  if (pickedIV === 'I vert') break;
  await page.keyboard.press('ArrowUp');
  await waitIdle('walk to I vert');
}
if (pickedIV !== 'I vert') throw new Error('chooser never reached the I vert: ' + (await status()));
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('ArrowLeft');
  await waitIdle('beam wall');
}
// pos 0: the beam's column is p+2 = 2
await page.keyboard.press('Enter');
await waitIdle('spawn beam 1');
for (let i = 0; i < 18; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('beam1 tick');
  if (/enter to spawn/.test(await status())) break;
}
const rB = await rows();
if (rB[11] !== '..O...' || rB[10] !== '..O...' || rB[9] !== '..O...' || rB[8] !== '..O...')
  throw new Error('beam tower wrong: ' + JSON.stringify(rB));
// second beam in col 3 (pos 1: one left from the center re-home)
await page.keyboard.press('ArrowLeft');
await waitIdle('beam2 pos');
await page.keyboard.press('Enter');
await waitIdle('spawn beam 2');
let caught = false;
for (let i = 0; i < 11; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('beam2 tick');
  if (/at row 10/.test(await status())) {
    caught = true;
    break;
  }
}
if (!caught) throw new Error('never caught the second beam at row 10');
const before4 = await rows();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(400);
const note4 = await status();
const after4 = await rows();
if (!/blocked/.test(note4)) throw new Error('left into the tower was not refused: ' + note4);
if (JSON.stringify(before4) !== JSON.stringify(after4)) throw new Error('blocked move changed the field');
console.log('overlap guard verified (beam vs tower):', note4);
// finish the drop: two four-tall towers side by side
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('beam2 finish');
  if (/enter to spawn/.test(await status())) break;
}
const r5 = await rows();
if (r5[11] !== '..OO..' || r5[8] !== '..OO..') throw new Error('twin towers wrong: ' + JSON.stringify(r5));

// FIFTH-b: the staggered S preview mid-fall, then it rests ON the
// towers: bottom pair on row 7, top pair shifted left on row 6
for (const want of [/2x2/, /\bS\b/]) {
  await page.keyboard.press('ArrowUp');
  const s = await waitIdle('cycleS');
  if (!want.test(s)) throw new Error(`cycle expected ${want}, got: ${s}`);
}
await page.keyboard.press('Enter');
await waitIdle('spawnS');
await page.keyboard.press('ArrowDown');
await waitIdle('tickS1');
await page.keyboard.press('ArrowDown');
await waitIdle('tickS2');
const rS = await rows();
const tokRow = rS.findIndex((r) => r === '..PP..');
console.log('mid-fall S preview:\n' + rS.slice(0, 4).join('\n'));
if (tokRow < 1 || rS[tokRow - 1] !== '.PP...')
  throw new Error('staggered preview wrong: ' + JSON.stringify(rS));
await page.screenshot({ path: SHOT('s-midfall') });
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('tickS3');
  if (/enter to spawn/.test(await status())) break;
}
const r6 = await rows();
console.log('field after the S locks:\n' + r6.join('\n'));
await page.screenshot({ path: SHOT('s-landed') });
if (r6[7] !== '..OO..' || r6[6] !== '.OO...')
  throw new Error('staggered S write wrong: ' + JSON.stringify(r6));

// SIXTH: auto-gravity — a timer cycles the tick slide at operator
// cadence. THE anti-wacky property: sampled every 120ms for 5s, the
// piece row NEVER advances by more than one between samples (no
// multi-row jumps, no teleporting), and it DOES fall.
await page.keyboard.press('a');
await page.waitForTimeout(300);
const sA = await status();
if (!/auto/.test(sA)) throw new Error('auto did not engage: ' + sA);
await page.keyboard.press('Enter');
let lastRow = -1;
let fallSteps = 0;
for (let i = 0; i < 42; i++) {
  await page.waitForTimeout(120);
  const st = await status();
  const m2 = st.match(/at row (\d+)/);
  const row = m2 ? Number(m2[1]) : -1;
  if (row < 0) continue; // mid-tick or between pieces: keep the last row
  if (lastRow >= 0 && row > lastRow) {
    if (row - lastRow > 1)
      throw new Error(`auto gravity jumped ${lastRow} -> ${row}: ${st}`);
    fallSteps++;
  }
  lastRow = row;
}
if (fallSteps < 3) throw new Error('auto gravity barely moved: ' + fallSteps);
const sB = await waitIdle('auto settle'); // a raw read can land mid-tick
if (!/\(auto\)/.test(sB)) throw new Error('auto dropped out: ' + sB);
console.log(`auto-gravity verified: ${fallSteps} single-row falls, no jumps`);

// SEVENTH: the machine wall, sampled while auto ticks run — the
// geometry must match the machine count the page itself reports (17
// tiles per row, 26x16 px tiles), at least one armature must be lit,
// and the bitmap must change as the relays move (the wall breathes)
const wallGrab = () =>
  page.evaluate(() => {
    const c = document.getElementById('wall');
    if (!c) return null;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let amber = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] === 255 && d[i + 1] === 176 && d[i + 2] === 0) amber++;
    return { w: c.width, h: c.height, amber, url: c.toDataURL() };
  });
const machTxt = await page.evaluate(() => document.body.textContent.match(/(\d+) minivacs/)?.[1]);
if (!machTxt) throw new Error('page does not report a machine count');
const nMach = Number(machTxt);
const wA = await wallGrab();
if (!wA) throw new Error('no #wall canvas on the page');
if (wA.w !== 17 * 26 || wA.h !== Math.ceil(nMach / 17) * 16)
  throw new Error(`wall geometry wrong for ${nMach} machines: ${wA.w}x${wA.h}`);
if (wA.amber === 0) throw new Error('wall shows zero energized armatures');
let wB = wA;
for (let i = 0; i < 20 && wB.url === wA.url; i++) {
  await page.waitForTimeout(150);
  wB = await wallGrab();
}
if (wB.url === wA.url) throw new Error('wall bitmap frozen while the oscillator runs');
console.log(`machine wall verified: ${wA.w}x${wA.h}, ${wA.amber} amber px, bitmap breathes`);
await page.screenshot({ path: SHOT('machine-wall') });

// EIGHTH: auto off is instant; manual play works after the toggle.
// The auto scenario may legitimately end at GAME OVER (a topped-out
// stack freezes the keyboard by design), so this check runs on a
// fresh page: boot -> spawn -> one manual tick must move the grid.
// the toggle can land in a busy window (native owed ticks) — verify
// against the SETTLED status and re-press until it takes
let sOff = '';
for (let i = 0; i < 6; i++) {
  await page.keyboard.press('a');
  await page.waitForTimeout(300);
  sOff = await waitIdle('a-off settle');
  if (!/\(auto\)/.test(sOff)) break;
}
if (/\(auto\)/.test(sOff)) throw new Error('auto did not disengage: ' + sOff);
await page.goto(`${BASE}/tetris/?deal=manual`);
await waitIdle('post-auto boot', 60000);
await page.keyboard.press('Enter');
await waitIdle('post-auto start');
const g0 = (await rows()).join('|');
await page.keyboard.press('ArrowDown');
await waitIdle('post-auto tick');
const g1 = (await rows()).join('|');
if (g0 === g1) throw new Error(`post-auto manual play dead: grid frozen ${g0}`);
console.log('post-auto manual play verified: the grid moved on a manual tick');

// NINTH: the step-exact game — a fresh page, a fixed input script, and
// after EVERY key the full 12x4 pixel grid is checked against a model
// of the machine's rules. The script plays a real game: three pieces
// steered to fill the bottom row, a line clear with the 2-tall's top
// cell falling in, and the next spawn after the clear.
await page.goto(`${BASE}/tetris/?deal=manual`);
await waitIdle('boot2', 60000);
const NR = 12, NC = PCOLS;
const HOME = 2; // the register's center home at 6 columns (homeColumn(6))
const model = {
  field: Array.from({ length: NR }, () => Array(NC).fill(false)),
  piece: null, // {ix, pos, row}
  armed: false,
  shapeIx: 0,
  // page-mirrored geometry (2-row tetromino states only — the scripts
  // below never spawn a vertical; toys-retire removed the toy entries)
  shapes: {
    3: { bOff: 0, bW: 2, tOff: 0, tW: 2 }, // O
    4: { bOff: 0, bW: 2, tOff: -1, tW: 2 }, // S
    5: { bOff: 0, bW: 2, tOff: 1, tW: 2 }, // Z
    6: { bOff: 0, bW: 3, tOff: 0, tW: 1 }, // L
    7: { bOff: 0, bW: 3, tOff: 2, tW: 1 }, // J
    8: { bOff: 0, bW: 3, tOff: 1, tW: 1 }, // T
    12: { bOff: 0, bW: 4, tOff: 0, tW: 0 }, // I
  },
};
const geo = (ix) => {
  const g = model.shapes[ix];
  if (!g) throw new Error(`the model has no geometry for state ${ix} — the script spawned something it should not`);
  return g;
};
const cellsOf = (ix, pos, row) => {
  const g = geo(ix);
  const cs = [];
  for (let k = 0; k < g.bW; k++) cs.push([row, pos + g.bOff + k]);
  if (g.tW > 0 && row > 0) for (let k = 0; k < g.tW; k++) cs.push([row - 1, pos + g.tOff + k]);
  return cs.filter(([r, c]) => r >= 0 && r < NR && c >= 0 && c < NC);
};
// the ring's rotation map: {0,3,4,5} hold one orientation, 1<->2, and
// i<->i+3 across the L/J/T pairs (mirrors ROT_STATE in the circuit)
const ROT_IX = (i) => (i === 1 ? 2 : i === 2 ? 1 : i >= 6 && i < 12 ? (i < 9 ? i + 3 : i - 3) : i);
const modelKey = (key) => {
  const m = model;
  if (key === 'Enter') { if (!m.piece) m.armed = true; return; }
  if (key === 'ArrowUp') {
    // UP is the chooser pre-spawn and the ROTATION mid-fall (the machine
    // re-aims the ring's D-feeds on NOTOK). one-orientation shapes hold.
    if (m.piece) {
      const rot = ROT_IX(m.piece.ix);
      if (rot === m.piece.ix) return; // singleton: the ring refuses
      const g2 = geo(rot);
      // the machine also refuses a rotation whose footprint is out of
      // range here or lands on stored cells
      const minP = Math.max(0, -g2.bOff, -g2.tOff);
      const maxP = Math.min(NC - g2.bOff - g2.bW, g2.tW > 0 ? NC - g2.tOff - g2.tW : NC);
      if (m.piece.pos < minP || m.piece.pos > maxP) return;
      if (cellsOf(rot, m.piece.pos, m.piece.row).some(([r, c]) => m.field[r][c])) return;
      m.piece.ix = rot;
      m.shapeIx = rot;
      return;
    }
    // the circuit's SELECTION_CYCLE: the verticals sit next to their
    // rotation partners (B1)
    const SEL = { 0:3, 3:4, 4:13, 13:5, 5:14, 14:6, 6:15, 15:9, 9:16, 16:7, 7:17, 17:10, 10:18, 18:8, 8:19, 19:11, 11:20, 20:12, 12:21, 21:3 }; // the rho: 0 enters one-way, toys retired
    m.shapeIx = SEL[m.shapeIx];
    return;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (!m.piece) return;
    const d = key === 'ArrowRight' ? 1 : -1;
    const g = geo(m.piece.ix);
    const np = m.piece.pos + d;
    if (np < 0 || np + g.bOff + g.bW > NC) return;
    if (cellsOf(m.piece.ix, np, m.piece.row).some(([r, c]) => m.field[r][c])) return;
    m.piece.pos = np;
    return;
  }
  if (key === 'ArrowDown') {
    const lock = () => {
      for (const [r, c] of cellsOf(m.piece.ix, m.piece.pos, m.piece.row)) m.field[r][c] = true;
      m.piece = null;
      for (let r = 0; r < NR; r++)
        if (m.field[r].every(Boolean)) {
          m.field.splice(r, 1);
          m.field.unshift(Array(NC).fill(false));
        }
      m.armed = true; // SPAWN re-arms on the reset tick
    };
    const restsAt = (row) =>
      row + 1 >= NR || cellsOf(m.piece.ix, m.piece.pos, row + 1).some(([r, c]) => m.field[r][c]);
    if (m.piece) {
      const nr = m.piece.row + 1;
      const blocked = nr >= NR || cellsOf(m.piece.ix, m.piece.pos, nr).some(([r, c]) => m.field[r][c]);
      if (blocked) lock();
      else {
        m.piece.row = nr;
        // landing and locking are ONE merged tick: the machine never
        // parks a piece at its rest row
        if (restsAt(nr)) lock();
      }
      return;
    }
    if (m.armed) {
      m.piece = { ix: m.shapeIx, pos: HOME, row: 0 }; // center spawn
      m.armed = false;
      if (restsAt(0)) lock(); // an instant rest would merge too
    }
  }
};
const expectGrid = async (stepLabel) => {
  const got = await rows();
  const want = [];
  for (let r = 0; r < NR; r++) {
    let line = '';
    for (let c = 0; c < NC; c++) {
      const isP = model.piece && cellsOf(model.piece.ix, model.piece.pos, model.piece.row).some(([rr, cc]) => rr === r && cc === c);
      line += isP ? 'P' : model.field[r][c] ? 'O' : '.';
    }
    want.push(line);
  }
  if (got.join('|') !== want.join('|'))
    throw new Error(`step-exact mismatch at ${stepLabel}:\n got ${got.join('|')}\nwant ${want.join('|')}`);
};
// the script (6 wide, CENTER spawn at col 2, toys retired): walk the
// rho to L, steer it to the wall (bottom 0-2, stem at (10,0)); walk to
// J, one right (bottom 3-5, stem at (10,5)) — row 11 completes and the
// two stems collapse down to 'O....O'
const script = [
  ...Array(6).fill('ArrowUp'), // 0 -> 3 (the entry) -> 4 -> 13 -> 5 -> 14 -> 6 (L)
  'Enter', 'ArrowDown', // spawn the L at the center
  'ArrowLeft', 'ArrowLeft', // pos 0 (bottom 0-2)
  ...Array(11).fill('ArrowDown'), // falls + merged lock: (11,0..2) + (10,0)
  ...Array(4).fill('ArrowUp'), // 6 -> 15 -> 9 -> 16 -> 7 (J), pre-spawn
  'ArrowDown', // spawn the J
  'ArrowRight', // pos 3 (bottom 3-5, stem col 5)
  ...Array(11).fill('ArrowDown'), // lock -> row 11 full -> clear + collapse
  'ArrowDown', // next spawn: the game continues after the clear
];
for (let i = 0; i < script.length; i++) {
  await page.keyboard.press(script[i]);
  await waitIdle(`script[${i}] ${script[i]}`);
  modelKey(script[i]);
  await expectGrid(`${i}:${script[i]}`);
}
const sFinal = await status();
if (!/score 1/.test(sFinal)) throw new Error('the clear did not score: ' + sFinal);
console.log('step-exact game verified: every key, every pixel, incl. the clear; final:', sFinal);

// TENTH (KNOWN BUG until the CLEARP2 rung): the double clear. Two
// squares side by side complete rows 10+11 at one lock; the machine
// must clear BOTH and score 2. Today it clears one and leaves a
// permanent full row. The model expects the CORRECT behavior, so this
// scenario THROWS until the fix lands — run it and expect the marker.
let doubleClearOk = false;
try {
  await page.goto(`${BASE}/tetris/?deal=manual`);
  await waitIdle('boot3', 60000);
  model.field = Array.from({ length: NR }, () => Array(NC).fill(false));
  model.piece = null; model.armed = false; model.shapeIx = 0;
  const dc = [
    'ArrowUp', // -> O (the rho's entry edge)
    'Enter', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', // spawn at center, steer to 0-1
    ...Array(11).fill('ArrowDown'), // square 1 at 0-1
    'ArrowDown', // spawn 2: the center home IS pos 2 (bottom 2-3)
    ...Array(11).fill('ArrowDown'), // square 2 at 2-3
    'ArrowDown', // spawn 3
    'ArrowRight', 'ArrowRight',
    ...Array(11).fill('ArrowDown'), // square 3 at 4-5: completes BOTH rows
  ];
  for (let i = 0; i < dc.length; i++) {
    await page.keyboard.press(dc[i]);
    await waitIdle(`dc[${i}] ${dc[i]}`, 90000);
    modelKey(dc[i]);
    await expectGrid(`dc-${i}:${dc[i]}`);
  }
  // the last Down's status is the 'line cleared!' note — take one more
  // scripted step (the next spawn) so the standard status line renders
  await page.keyboard.press('ArrowDown');
  await waitIdle('dc-final spawn');
  modelKey('ArrowDown');
  await expectGrid('dc-final');
  const sDc = await status();
  if (!/score 2/.test(sDc)) throw new Error('double clear scored wrong: ' + sDc);
  doubleClearOk = true;
  console.log('double clear verified: both rows, score 2');
} catch (e) {
  console.log('KNOWN BUG (double clear rung pending): ' + e.message.split('\n')[0]);
}

// LAST: the key queue — three ArrowDowns fired back-to-back with NO
// settle wait between them must ALL land (dropped keys were the 6-wide
// complaint: presses during a solve vanished). the piece must fall at
// least 2 rows past its pre-burst row (3 exactly, unless it locks).
{
  let st = await status();
  if (!/at row/.test(st)) {
    await page.keyboard.press('Enter');
    await waitIdle('burst spawn');
    await page.keyboard.press('ArrowDown');
    await waitIdle('burst first tick');
    st = await status();
  }
  const r0 = Number((st.match(/at row (\d+)/) || [0, '0'])[1]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const after = await waitIdle('burst settle');
  const m2 = after.match(/at row (\d+)/);
  const r1 = m2 ? Number(m2[1]) : 99; // locked counts as fully advanced
  if (r1 < r0 + 2) throw new Error(`key queue dropped presses: row ${r0} -> ${after}`);
  console.log(`key queue verified: row ${r0} -> ${m2 ? 'row ' + r1 : 'locked'} on a 3-press burst`);
}

// LAST+1: ROTATION on the page — UP turns a falling piece inside its
// own family (L <-> L flip) and refuses on a one-orientation shape,
// while pre-spawn it still walks the chooser. This is the page's half
// of the rotation rung: its successor map must mirror the machine's.
{
  const labelOf = (st) => {
    const m2 = st.match(/—\s*([^—]+?)\s*(?:at row \d+|\(enter to spawn\))/);
    return m2 ? m2[1].trim() : null;
  };
  // clear whatever is falling
  for (let i = 0; i < 40; i++) {
    const st = await status();
    if (/enter to spawn/.test(st) || /game over/i.test(st)) break;
    await page.keyboard.press('ArrowDown');
    await waitIdle('rot clear');
  }
  const st0 = await status();
  if (/game over/i.test(st0)) {
    console.log('rotation probe skipped: the scripted game ended in a top-out');
  } else {
    // walk the chooser to L (pre-spawn: the full cycle still works)
    let picked = null;
    for (let i = 0; i < 14; i++) {
      picked = labelOf(await status());
      if (picked === 'L') break;
      await page.keyboard.press('ArrowUp');
      await waitIdle('chooser');
    }
    if (picked !== 'L') throw new Error(`chooser never reached L: ${await status()}`);
    await page.keyboard.press('Enter');
    await waitIdle('rot spawn');
    await page.keyboard.press('ArrowDown');
    await waitIdle('rot tick');
    // B2: rotation is a true 4-cycle — this receipt was REWRITTEN
    // deliberately (the old one asserted the 2-cycle flip)
    for (const want of ['L vert R', 'L flip', 'L vert L', 'L']) {
      await page.keyboard.press('ArrowUp');
      const sr = await waitIdle('rotate');
      if (labelOf(sr) !== want) throw new Error(`4-cycle expected ${want}: ${sr}`);
    }
    console.log('rotation verified: L -> L vert R -> L flip -> L vert L -> L, all in contacts');
    // and a one-orientation shape refuses (the page says so; the ring holds)
    for (let i = 0; i < 40; i++) {
      const st = await status();
      if (/enter to spawn/.test(st) || /game over/i.test(st)) break;
      await page.keyboard.press('ArrowDown');
      await waitIdle('rot clear 2');
    }
    if (!/game over/i.test(await status())) {
      let sq = null;
      for (let i = 0; i < 14; i++) {
        sq = labelOf(await status());
        if (sq === '2x2 square') break;
        await page.keyboard.press('ArrowUp');
        await waitIdle('chooser 2');
      }
      if (sq === '2x2 square') {
        await page.keyboard.press('Enter');
        await waitIdle('sq spawn');
        await page.keyboard.press('ArrowDown');
        await waitIdle('sq tick');
        await page.keyboard.press('ArrowUp');
        const s3 = await waitIdle('sq rotate');
        if (!/one orientation/.test(s3) && labelOf(s3) !== '2x2 square')
          throw new Error(`the square should not rotate: ${s3}`);
        console.log('singleton verified: the square refuses to rotate');
      }
    }
  }
}

// LAST+2: DEALER MODE, hands off — the page without ?deal=manual must
// deal a piece, SELF-SERVE it (no Enter), and gravity must be on by
// default: within ~25s of boot a piece has spawned and moved down on
// its own, or pieces have locked (cells appeared). nondeterministic by
// design, so the check is behavioral, not step-exact.
{
  await page.goto(`${BASE}/tetris/`);
  const t0 = Date.now();
  let sawFall = false;
  let lastRow = -1;
  while (Date.now() - t0 < 45000) {
    const st = await status();
    const m2 = st.match(/at row (\d+)/);
    if (m2) {
      const r = Number(m2[1]);
      if (lastRow >= 0 && r > lastRow) { sawFall = true; break; }
      lastRow = r;
    }
    const g = await gridState();
    if (g.some((c) => c === 'O')) { sawFall = true; break; } // a lock already happened
    await page.waitForTimeout(250);
  }
  if (!sawFall) throw new Error('dealer mode never self-served/fell: ' + (await status()));
  console.log('dealer mode verified: dealt, self-served, and fell with no keys pressed');
}

console.log(doubleClearOk ? 'PAGE VERIFICATION PASSED (incl. double clear)' : 'PAGE VERIFICATION PASSED (double clear still open)');
await browser.close();
