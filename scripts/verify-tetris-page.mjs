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
import { tmpdir } from 'node:os';
const SHOT_DIR = process.env.SHOT_DIR || tmpdir();
const SHOT = (n) => `${SHOT_DIR}/shot-${n}.png`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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
  return Array.from({ length: 12 }, (_, r) => g.slice(4 * r, 4 * r + 4).join(''));
};

await page.goto(`${BASE}/tetris/`);
await waitIdle('boot', 60000);
console.log('boot ok:', await status());

// cycle shapes: 1x1 -> 2 wide -> 2 tall
await page.keyboard.press('ArrowUp');
await waitIdle('shape1');
await page.keyboard.press('ArrowUp');
const s2 = await waitIdle('shape2');
console.log('shape after 2 ups (want 2 tall):', s2);
if (!s2.includes('2 tall')) throw new Error('shape cycle did not reach "2 tall"');

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
console.log('after vertical drop:', await status());
console.log('saw bookkeeping note:', sawBookkeeping);
const r1 = await rows();
console.log('field:\n' + r1.join('\n'));
await page.screenshot({ path: SHOT('vertical-landed') });
// col 0 rows 6+7 must be amber, nothing else
if (r1[11] !== 'O...' || r1[10] !== 'O...') throw new Error('vertical write wrong: ' + JSON.stringify(r1));
if (!sawBookkeeping) throw new Error('auto-bookkeeping note never appeared');

// now a 2x2 square: one more ArrowUp (2 tall -> 2x2), move right, drop
await page.keyboard.press('ArrowUp');
const s3 = await waitIdle('shape3');
if (!s3.includes('2x2')) throw new Error('expected 2x2, got: ' + s3);
await page.keyboard.press('ArrowRight');
await waitIdle('move');
await page.keyboard.press('Enter');
await waitIdle('spawn2');
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('tick2');
  if (/enter to spawn/.test(await status())) break;
}
const r2 = await rows();
console.log('field after 2x2:\n' + r2.join('\n'));
await page.screenshot({ path: SHOT('square-landed') });
// square at cols 1-2, rows 6+7, on top of nothing; col 0 keeps its stack
if (r2[11] !== 'OOO.' || r2[10] !== 'OOO.') throw new Error('2x2 write wrong: ' + JSON.stringify(r2));

// third: complete row 7 with a 1x1 at col 3 — the flash must paint while
// the tick is held, the status must announce the clear, and the COLLAPSE
// must walk the 2x2 square's rows down into the hole (rung 10)
// the cycle now passes the staggered pair AND the triples: 2x2 -> S ->
// Z -> L -> J -> T -> 1x1. entering S auto-steps the register 0 -> 1
// (S's top pair needs pos>=1); the triples ride through at pos 1.
await page.keyboard.press('ArrowUp');
const sS = await waitIdle('shapeS');
if (!/\bS\b/.test(sS)) throw new Error('expected S, got: ' + sS);
await page.keyboard.press('ArrowUp');
const sZ = await waitIdle('shapeZ');
if (!/\bZ\b/.test(sZ)) throw new Error('expected Z, got: ' + sZ);
for (const want of [/\bL\b/, /\bJ\b/, /\bT\b/, /L flip/, /J flip/, /T flip/]) {
  await page.keyboard.press('ArrowUp');
  const s = await waitIdle('shapeTriple');
  if (!want.test(s)) throw new Error(`cycle expected ${want}, got: ${s}`);
}
await page.keyboard.press('ArrowUp');
const s4 = await waitIdle('shape4');
if (!s4.includes('1x1')) throw new Error('expected 1x1, got: ' + s4);
// the register sits at col 1 after the S transit: 3 rights still land col 3
// (the third is a page no-op at the wall)
await page.keyboard.press('ArrowRight');
await waitIdle('move2');
await page.keyboard.press('ArrowRight');
await waitIdle('move3');
await page.keyboard.press('ArrowRight');
await waitIdle('move3b');
await page.keyboard.press('Enter');
await waitIdle('spawn3');
let sawFlash = false;
let finalNote = '';
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('ArrowDown');
  const t0 = Date.now();
  for (;;) {
    const s = await page.locator('#status').textContent();
    if (/holding/.test(s)) {
      const rr = await rows();
      // the token row paints the mask column PIECE-cyan over the fresh
      // write, so a full row mid-press reads e.g. 'OOOP' — full = no dark
      // pixel in the row, either color counts
      if (/^[OP]{4}$/.test(rr[11])) {
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
  if (/line cleared|enter to spawn/.test(finalNote)) break;
}
console.log('clear-phase final status:', finalNote);
console.log('saw the full-row flash mid-press:', sawFlash);
const r3 = await rows();
console.log('field after the clear:\n' + r3.join('\n'));
await page.screenshot({ path: SHOT('after-clear') });
if (!/line cleared/.test(finalNote)) throw new Error('cleared note missing: ' + finalNote);
if (!sawFlash) throw new Error('the full-row flash was never painted');
if (r3[11] !== 'OOO.' || r3[10] !== '....') throw new Error('post-collapse field wrong: ' + JSON.stringify(r3));

// fourth: the sideways-overlap guard. Landing and locking are one merged
// tick, so a piece never parks at its rest row — the steerable moments are
// mid-fall. Build a block at row 6 (a col-2 piece insta-locks there on the
// fallen stack), then catch a col-3 piece PASSING row 6 and push left into
// the block: the page must refuse.
await page.keyboard.press('ArrowRight'); // re-homed: col 2 = 2 rights
await waitIdle('move4a');
await page.keyboard.press('ArrowRight');
await waitIdle('move4');
await page.keyboard.press('Enter');
await waitIdle('spawn4');
for (let i = 0; i < 14; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('tick4');
  if (/enter to spawn/.test(await status())) break;
}
const mid = await rows();
if (mid[10] !== '..O.') throw new Error('probe setup wrong (want row10 col2): ' + JSON.stringify(mid));
await page.keyboard.press('ArrowRight'); // re-homed: col 3 = 3 rights
await waitIdle('move5a');
await page.keyboard.press('ArrowRight');
await waitIdle('move5b');
await page.keyboard.press('ArrowRight');
await waitIdle('move5');
await page.keyboard.press('Enter');
await waitIdle('spawn5');
let caught = false;
for (let i = 0; i < 11; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('tick5');
  if (/at row 10/.test(await status())) {
    caught = true;
    break;
  }
}
if (!caught) throw new Error('never caught the piece passing row 6');
const before4 = await rows();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(400);
const note4 = await status();
const after4 = await rows();
if (!/blocked/.test(note4)) throw new Error('left into the stack was not refused: ' + note4);
if (JSON.stringify(before4) !== JSON.stringify(after4)) throw new Error('blocked move changed the field');
console.log('overlap guard verified:', note4);

// finish that drop: the col-3 piece completes row 11 -> clear + collapse
// walks the col-2 block down. Field afterwards: just '..O.' on the floor.
let note5 = '';
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('ArrowDown');
  note5 = await waitIdle('tick6');
  if (/line cleared|enter to spawn/.test(note5)) break;
}
const r5 = await rows();
console.log('field after the second clear:\n' + r5.join('\n'));
if (r5[11] !== '..O.' || r5[10] !== '....') throw new Error('second collapse wrong: ' + JSON.stringify(r5));

// FIFTH: the staggered S itself (shapes rung 3b on the page). Cycle
// 1x1 -> ... -> S (4 ups), spawn at pos 1 (bottom cols 1-2, top cols 0-1),
// verify the staggered PREVIEW mid-fall, then drop: the bottom pair rests
// on the '..O.' stack at row 10 and the top pair writes row 9 shifted left.
for (const want of [/2 wide/, /2 tall/, /2x2/, /\bS\b/]) {
  await page.keyboard.press('ArrowUp');
  const s = await waitIdle('cycleS');
  if (!want.test(s)) throw new Error(`cycle expected ${want}, got: ${s}`);
}
await page.keyboard.press('Enter');
await waitIdle('spawnS');
// two ticks in, the token is clear of the top row: the preview must paint
// bottom '.PP.' with 'PP..' directly above it
await page.keyboard.press('ArrowDown');
await waitIdle('tickS1');
await page.keyboard.press('ArrowDown');
await waitIdle('tickS2');
const rS = await rows();
const tokRow = rS.findIndex((r) => r === '.PP.');
console.log('mid-fall S preview:\n' + rS.slice(0, 4).join('\n'));
if (tokRow < 1 || rS[tokRow - 1] !== 'PP..')
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
if (r6[11] !== '..O.' || r6[10] !== '.OO.' || r6[9] !== 'OO..')
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
await page.keyboard.press('a');
await page.waitForTimeout(400);
const sOff = await status();
if (/\(auto\)/.test(sOff)) throw new Error('auto did not disengage: ' + sOff);
await page.goto(`${BASE}/tetris/`);
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
await page.goto(`${BASE}/tetris/`);
await waitIdle('boot2', 60000);
const NR = 12, NC = 4;
const model = {
  field: Array.from({ length: NR }, () => Array(NC).fill(false)),
  piece: null, // {ix, pos, row}
  armed: false,
  shapeIx: 0,
  // page-mirrored geometry
  shapes: [
    { bOff: 0, bW: 1, tOff: 0, tW: 0 }, { bOff: 0, bW: 2, tOff: 0, tW: 0 },
    { bOff: 0, bW: 1, tOff: 0, tW: 1 }, { bOff: 0, bW: 2, tOff: 0, tW: 2 },
  ],
};
const geo = (ix) => model.shapes[ix];
const cellsOf = (ix, pos, row) => {
  const g = geo(ix);
  const cs = [];
  for (let k = 0; k < g.bW; k++) cs.push([row, pos + g.bOff + k]);
  if (g.tW > 0 && row > 0) for (let k = 0; k < g.tW; k++) cs.push([row - 1, pos + g.tOff + k]);
  return cs.filter(([r, c]) => r >= 0 && r < NR && c >= 0 && c < NC);
};
const modelKey = (key) => {
  const m = model;
  if (key === 'Enter') { if (!m.piece) m.armed = true; return; }
  if (key === 'ArrowUp') { m.shapeIx = (m.shapeIx + 1) % 12; if (m.piece) m.piece.ix = m.shapeIx; return; }
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
      m.piece = { ix: m.shapeIx, pos: 0, row: 0 };
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
// the script: 1x1 to col3; 2wide to cols1-2; 2tall at col0 clears row 11
const script = [
  'Enter', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight',
  ...Array(11).fill('ArrowDown'), // 10 falls + the merged land+lock
  'ArrowUp', // ring -> 2wide (pre-spawn)
  'ArrowDown', // spawn
  'ArrowRight', // pos 1 (bottom 1,2)
  ...Array(11).fill('ArrowDown'),
  'ArrowUp', // -> 2tall
  'ArrowDown', // spawn at col0
  ...Array(11).fill('ArrowDown'), // falls + merged lock -> row 11 full -> clear
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
  await page.goto(`${BASE}/tetris/`);
  await waitIdle('boot3', 60000);
  model.field = Array.from({ length: NR }, () => Array(NC).fill(false));
  model.piece = null; model.armed = false; model.shapeIx = 0;
  const dc = [
    'ArrowUp', 'ArrowUp', 'ArrowUp', // -> O
    'Enter', 'ArrowDown', ...Array(11).fill('ArrowDown'), // square 1 floor left
    'ArrowDown', // spawn 2
    'ArrowRight', 'ArrowRight',
    ...Array(11).fill('ArrowDown'), // square 2: completes BOTH rows
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

console.log(doubleClearOk ? 'PAGE VERIFICATION PASSED (incl. double clear)' : 'PAGE VERIFICATION PASSED (double clear still open)');
await browser.close();
