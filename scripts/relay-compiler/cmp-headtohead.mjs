// HEAD TO HEAD: the two hand-wired roadmap rungs against the same two
// designs compiled mechanically from a gate netlist.
// decision rule fixed in _notes/compiled-relays.md BEFORE this ran.
import { RelayBackend, assertJackCapacity } from './relay-compile.mjs';
import { MinivacSimulator, setSolverEngine } from '/home/user/minivac/src/simulator/minivac-simulator.ts';
import { profStats } from '/home/user/minivac/src/simulator/fast-circuit.ts';

setSolverEngine('fast');

const sizeOf = (m, drive) => {
  profStats.on = true;
  profStats.reset();
  drive();
  profStats.on = false;
  const s = [...profStats.sizes];
  return s.length ? Math.max(...s) : 0;
};

// ------------------------------------------------------------------ hand
const CARRY = ['', 'm0.5', 'm0.6', 'm1.5'];
function handAdder() {
  const w = [];
  for (let i = 0; i < 4; i++) {
    const A = `m0.${i + 1}`, B = `m1.${i + 1}`, Bp = `m2.${i + 1}`;
    const C = CARRY[i];
    w.push(`${A}+/${A}S`, `${A}T/${A}E`, `${A}F/${A}-`);
    w.push(`${B}+/${B}S`, `${B}T/${B}com`, `${B}com/${B}E`, `${B}F/${B}-`);
    w.push(`${B}com/${Bp}E`, `${Bp}F/${Bp}-`);
    w.push(`${A}+/${A}H`);
    w.push(`${A}J/${B}H`, `${A}G/${B}L`);
    w.push(`${B}G/${Bp}com`, `${B}N/${Bp}com`);
    if (C) {
      w.push(`${B}J/${A}com`, `${B}K/${A}com`);
      w.push(`${A}com/${C}H`, `${Bp}com/${C}L`);
      w.push(`${C}G/${Bp}A`, `${C}N/${Bp}A`, `${Bp}B/${Bp}-`);
    } else {
      w.push(`${Bp}com/${Bp}A`, `${Bp}B/${Bp}-`);
    }
    w.push(`${A}K/${Bp}H`, `${A}N/${Bp}L`);
    w.push(`${Bp}+/${Bp}G`);
    if (C) {
      w.push(`${Bp}J/${C}com`, `${Bp}K/${C}com`);
      w.push(`${C}com/${C}E`, `${C}F/${C}-`);
      w.push(`m0.${i}L/${C}com`);
    }
  }
  w.push('m0.4L/m1.5A', 'm1.5B/m1.5-');
  return w;
}

function handShift(bits) {
  const w = ['m0.3+/m0.1S', 'm0.1T/m0.1com'];
  const machines = Math.ceil(bits / 2);
  for (let k = 1; k < machines; k++) w.push(`m${k - 1}.1com/m${k}.1com`);
  for (let i = 0; i < bits; i++) {
    const k = Math.floor(i / 2);
    const [c, a, s] = i % 2 === 0 ? [1, 2, 3] : [4, 5, 6];
    const j = (sec, jack) => `m${k}.${sec}${jack}`;
    w.push(`m${k}.1com/${j(c, 'E')}`, `${j(c, 'F')}/${j(c, '-')}`);
    w.push(`${j(a, 'com')}/${j(a, 'E')}`, `${j(a, 'F')}/${j(a, '-')}`);
    w.push(`${j(s, 'com')}/${j(s, 'E')}`, `${j(s, 'F')}/${j(s, '-')}`);
    w.push(`${j(c, '+')}/${j(c, 'H')}`, `${j(c, '+')}/${j(c, 'L')}`);
    if (i === 0) {
      w.push(`${j(c, 'J')}/m0.2S`, `m0.2T/${j(a, 'com')}`);
    } else {
      const pk = Math.floor((i - 1) / 2);
      const ps = (i - 1) % 2 === 0 ? 3 : 6;
      w.push(`${j(c, 'J')}/m${pk}.${ps}L`, `m${pk}.${ps}K/${j(a, 'com')}`);
    }
    w.push(`${j(c, 'G')}/${j(a, 'H')}`, `${j(a, 'G')}/${j(a, 'com')}`);
    w.push(`${j(c, 'K')}/${j(a, 'L')}`, `${j(a, 'K')}/${j(s, 'com')}`);
    w.push(`${j(c, 'N')}/${j(s, 'H')}`, `${j(s, 'G')}/${j(s, 'com')}`);
  }
  const lk = Math.floor((bits - 1) / 2);
  const ls = (bits - 1) % 2 === 0 ? 3 : 6;
  w.push(`m${lk}.${ls}+/m${lk}.${ls}L`, `m${lk}.${ls}K/m${lk}.${ls}A`, `m${lk}.${ls}B/m${lk}.${ls}-`);
  return w;
}

// -------------------------------------------------------------- compiled
function compiledAdder() {
  const B = new RelayBackend();
  const N = 4;
  const a = [], b = [];
  for (let i = 0; i < N; i++) a.push(B.input(`a${i}`));
  for (let i = 0; i < N; i++) b.push(B.input(`b${i}`));
  let cin = null;
  for (let i = 0; i < N; i++) {
    if (cin === null) {
      B.xor(`s${i}`, `a${i}`, `b${i}`);
      B.and(`c${i}`, `a${i}`, `b${i}`);
    } else {
      B.xor(`h${i}`, `a${i}`, `b${i}`);
      B.xor(`s${i}`, `h${i}`, cin);
      B.and(`g${i}`, `a${i}`, `b${i}`);
      B.and(`p${i}`, `h${i}`, cin);
      B.or(`c${i}`, `g${i}`, `p${i}`);
    }
    cin = `c${i}`;
  }
  return { B, a, b, N };
}

function compiledShift(bits) {
  const B = new RelayBackend();
  const din = B.input('din');
  // the clock rail: a slide on the input relay's own machine, chained to
  // every clock mirror's coil the way the hand design does it
  // give the clock its own input relay so the rail is a real driven net
  const clk = B.input('clk');
  let prev = 'din';
  for (let i = 0; i < bits; i++) {
    // one clock mirror per bit: both of its sets serve only its own bit,
    // because a clock contact shared by two bits would tie their D paths
    const cs = B.set('clk');
    const c = B.take();
    B.wire(`${B.com(c)}/${B.R(c, 'E')}`, `${B.R(c, 'F')}/${B.minus(c)}`);
    B.wire(`${B.plusHole(c)}/${B.R(cs.relay, cs.arm)}`, `${B.R(cs.relay, cs.no)}/${B.com(c)}`);
    B.wire(`${B.plusHole(c)}/${B.R(c, 'H')}`);
    B.wire(`${B.plusHole(c)}/${B.R(c, 'L')}`);
    B.dff(`q${i}`, c, B.set(prev));
    prev = `q${i}`;
  }
  return { B, din, clk, bits };
}

// ------------------------------------------------------------------ runs
function reportAdder(label, wires, machines, relays, probe) {
  const bad = assertJackCapacity(wires);
  const m = new MinivacSimulator(wires, false, machines);
  m.initialize();
  const N = sizeOf(m, () => { m.setSlide(1, 'right', 0); m.setSlide(1, 'left', 0); });
  let fails = 0;
  const t0 = Date.now();
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      probe.set(m, x, y);
      const got = probe.read(m);
      if (got !== x + y) fails++;
    }
  }
  const ms = Date.now() - t0;
  console.log(
    `${label.padEnd(16)} relays=${String(relays).padStart(3)} machines=${String(machines).padStart(2)} ` +
      `wires=${String(wires.length).padStart(3)} N=${String(N).padStart(4)} ` +
      `256 pairs=${String(ms).padStart(5)}ms ${fails === 0 ? 'ALL CORRECT' : `${fails} MISMATCH`}` +
      `${bad.length ? ` JACKS:${bad.length}` : ''}`
  );
  if (bad.length) console.log('   ' + bad.slice(0, 10).join(' | '));
  return { relays, machines, wires: wires.length, N, ms, fails, bad: bad.length };
}

console.log('=== 4-bit ripple-carry adder ===');
const hw = handAdder();
const hand = reportAdder('hand (rung 3)', hw, 3, 15, {
  set: (m, A, Bv) => {
    for (let i = 0; i < 4; i++) {
      m.setSlide(i + 1, (A >> i) & 1 ? 'right' : 'left', 0);
      m.setSlide(i + 1, (Bv >> i) & 1 ? 'right' : 'left', 1);
    }
  },
  read: (m) => {
    const s = m.getMachineState(2);
    return (
      (s.lights[0] ? 1 : 0) + (s.lights[1] ? 2 : 0) + (s.lights[2] ? 4 : 0) +
      (s.lights[3] ? 8 : 0) + (m.getMachineState(1).lights[4] ? 16 : 0)
    );
  },
});

const ca = compiledAdder();
const cRel = (m, i) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
const comp = reportAdder('compiled', ca.B.w, ca.B.machines(), ca.B.n, {
  set: (m, A, Bv) => {
    for (let i = 0; i < 4; i++) {
      const ra = ca.a[i], rb = ca.b[i];
      m.setSlide((ra % 6) + 1, (A >> i) & 1 ? 'right' : 'left', Math.floor(ra / 6));
      m.setSlide((rb % 6) + 1, (Bv >> i) & 1 ? 'right' : 'left', Math.floor(rb / 6));
    }
  },
  read: (m) => {
    let got = 0;
    for (let i = 0; i < 4; i++) if (cRel(m, ca.B.firstRelay.get(`s${i}`))) got |= 1 << i;
    if (cRel(m, ca.B.firstRelay.get('c3'))) got |= 16;
    return got;
  },
});
console.log(
  `  -> compiled/hand: relays ${(comp.relays / hand.relays).toFixed(2)}x, ` +
    `N ${(comp.N / hand.N).toFixed(2)}x, time ${(comp.ms / hand.ms).toFixed(2)}x, ` +
    `mirrors minted ${ca.B.mirrors || 0}`
);

console.log('\n=== 8-bit SIPO shift register ===');
function runShift(label, wires, machines, relays, io) {
  const bad = assertJackCapacity(wires);
  const m = new MinivacSimulator(wires, false, machines);
  m.initialize();
  const N = sizeOf(m, () => { io.setD(m, 1); io.setD(m, 0); });
  const t0 = Date.now();
  let fails = 0;
  const pattern = [1, 0, 1, 1, 0, 0, 1, 0];
  const seen = [];
  for (const bit of pattern) {
    io.setD(m, bit);
    io.clock(m);
    seen.push(io.reg(m));
  }
  const ms = Date.now() - t0;
  // the register must equal the pattern shifted in, newest at bit 0
  const want = [];
  let acc = [];
  for (const bit of pattern) {
    acc = [bit, ...acc].slice(0, 8);
    want.push([...acc, ...Array(8 - acc.length).fill(0)].join(''));
  }
  for (let i = 0; i < want.length; i++) if (seen[i] !== want[i]) fails++;
  console.log(
    `${label.padEnd(16)} relays=${String(relays).padStart(3)} machines=${String(machines).padStart(2)} ` +
      `wires=${String(wires.length).padStart(3)} N=${String(N).padStart(4)} ` +
      `8 clocks=${String(ms).padStart(5)}ms ${fails === 0 ? 'SHIFTS CORRECTLY' : `${fails} WRONG`}` +
      `${bad.length ? ` JACKS:${bad.length}` : ''}`
  );
  if (bad.length) console.log('   ' + bad.slice(0, 10).join(' | '));
  if (fails) console.log(`   got  ${seen.join(' ')}\n   want ${want.join(' ')}`);
  return { relays, machines, wires: wires.length, N, ms, fails };
}

const hsW = handShift(8);
const hs = runShift('hand (rung 2)', hsW, 4, 24, {
  setD: (m, v) => m.setSlide(2, v ? 'right' : 'left', 0),
  clock: (m) => {
    m.setSlide(1, 'right', 0);
    m.setSlide(1, 'left', 0);
  },
  reg: (m) =>
    Array.from({ length: 8 }, (_, i) =>
      m.getMachineState(Math.floor(i / 2)).relays[i % 2 === 0 ? 2 : 5] ? 1 : 0
    ).join(''),
});

const cs = compiledShift(8);
const csr = runShift('compiled', cs.B.w, cs.B.machines(), cs.B.n, {
  setD: (m, v) => m.setSlide((cs.din % 6) + 1, v ? 'right' : 'left', Math.floor(cs.din / 6)),
  clock: (m) => {
    m.setSlide((cs.clk % 6) + 1, 'right', Math.floor(cs.clk / 6));
    m.setSlide((cs.clk % 6) + 1, 'left', Math.floor(cs.clk / 6));
  },
  reg: (m) =>
    Array.from({ length: 8 }, (_, i) => cRel(m, cs.B.firstRelay.get(`q${i}`))).join(''),
});
console.log(
  `  -> compiled/hand: relays ${(csr.relays / hs.relays).toFixed(2)}x, ` +
    `N ${(csr.N / hs.N).toFixed(2)}x, time ${(csr.ms / hs.ms).toFixed(2)}x, ` +
    `mirrors minted ${cs.B.mirrors || 0}`
);
