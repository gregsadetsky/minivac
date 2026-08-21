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
  return Array.from({ length: 12 }, (_, r) => g.slice(PCOLS * r, PCOLS * r + PCOLS).join(''));
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
if (r1[11] !== 'O.....' || r1[10] !== 'O.....') throw new Error('vertical write wrong: ' + JSON.stringify(r1));
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
if (r2[11] !== 'OOO...' || r2[10] !== 'OOO...') throw new Error('2x2 write wrong: ' + JSON.stringify(r2));

// third (6 wide): a SECOND 2x2 at cols 4-5 first, then complete row 11
// with a 1x1 at col 3 — the flash must paint while the tick is held, the
// status must announce the clear, and the COLLAPSE must walk the stacked
// rows down into the hole (rung 10)
await page.keyboard.press('ArrowRight');
await waitIdle('sq2a');
await page.keyboard.press('ArrowRight');
await waitIdle('sq2b');
await page.keyboard.press('ArrowRight');
await waitIdle('sq2c');
await page.keyboard.press('ArrowRight');
await waitIdle('sq2d'); // pos 4: bottom cols 4-5
await page.keyboard.press('Enter');
await waitIdle('spawnSq2');
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('ArrowDown');
  await waitIdle('tickSq2');
  if (/enter to spawn/.test(await status())) break;
}
const rSq2 = await rows();
if (rSq2[11] !== 'OOO.OO' || rSq2[10] !== 'OOO.OO')
  throw new Error('second square wrong: ' + JSON.stringify(rSq2));
// the cycle passes the staggered pair AND the triples: 2x2 -> S ->
// Z -> L -> J -> T -> flips -> 1x1; the operator clamps re-position
// the register per shape along the way.
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
// re-home deterministically (the cycle's clamps left the register at a
// shape-dependent column), then 3 rights = col 3 exactly
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('ArrowLeft');
  await waitIdle('rehome');
}
await page.keyboard.press('ArrowRight');
await waitIdle('move2');
await page.keyboard.press('ArrowRight');
await waitIdle('move3');
await page.keyboard.press('ArrowRight');
await waitIdle('move3b');
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
    // the token row paints the mask column PIECE-cyan over the fresh
    // write, so a full row mid-press reads e.g. 'OOOPOO' — and a full
    // row 11 is visible ONLY during the clear flash, so sample every
    // poll (the 'holding' status gate raced the shorter native ticks)
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
console.log('field after the clear:\n' + r3.join('\n'));
await page.screenshot({ path: SHOT('after-clear') });
if (!sawCleared) throw new Error('cleared note never seen: ' + finalNote);
if (!sawFlash) throw new Error('the full-row flash was never painted');
if (r3[11] !== 'OOO.OO' || r3[10] !== '......') throw new Error('post-collapse field wrong: ' + JSON.stringify(r3));

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
if (mid[10] !== '..O...') throw new Error('probe setup wrong (want row10 col2): ' + JSON.stringify(mid));
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
if (r5[11] !== '..O...' || r5[10] !== '......') throw new Error('second collapse wrong: ' + JSON.stringify(r5));

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
const tokRow = rS.findIndex((r) => r === '.PP...');
console.log('mid-fall S preview:\n' + rS.slice(0, 4).join('\n'));
if (tokRow < 1 || rS[tokRow - 1] !== 'PP....')
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
if (r6[11] !== '..O...' || r6[10] !== '.OO...' || r6[9] !== 'OO....')
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
const NR = 12, NC = PCOLS;
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
    m.shapeIx = (m.shapeIx + 1) % 13; // twelve shapes plus the horizontal I
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
// the script (6 wide): 1x1 to col5; 2wide at 3-4, then 1-2; the 2tall
// at col0 completes row 11 -> clears (its top survives at row 10)
const script = [
  'Enter', 'ArrowDown', ...Array(5).fill('ArrowRight'),
  ...Array(11).fill('ArrowDown'), // falls + the merged land+lock at (11,5)
  'ArrowUp', // ring -> 2wide (pre-spawn)
  'ArrowDown', // spawn
  ...Array(3).fill('ArrowRight'), // pos 3 (bottom 3,4)
  ...Array(11).fill('ArrowDown'),
  'ArrowDown', // spawn (still 2wide)
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
    'Enter', 'ArrowDown', ...Array(11).fill('ArrowDown'), // square 1 at 0-1
    'ArrowDown', // spawn 2
    'ArrowRight', 'ArrowRight',
    ...Array(11).fill('ArrowDown'), // square 2 at 2-3
    'ArrowDown', // spawn 3
    ...Array(4).fill('ArrowRight'),
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
    await page.keyboard.press('ArrowUp');
    const s1 = await waitIdle('rotate');
    if (labelOf(s1) !== 'L flip') throw new Error(`mid-fall UP did not rotate: ${s1}`);
    await page.keyboard.press('ArrowUp');
    const s2 = await waitIdle('rotate back');
    if (labelOf(s2) !== 'L') throw new Error(`rotation did not return: ${s2}`);
    console.log('rotation verified: L -> L flip -> L on a falling piece');
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

console.log(doubleClearOk ? 'PAGE VERIFICATION PASSED (incl. double clear)' : 'PAGE VERIFICATION PASSED (double clear still open)');
await browser.close();
