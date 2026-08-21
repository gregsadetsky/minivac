// THE CONTROL-LOGIC CASE. the adder and the shift register are datapath,
// where hand and compiled converge. rung 4's 1-of-8 decoder is the other
// kind: the hand version is a 3-LEVEL TRANSFER-CONTACT TREE costing FOUR
// relays total (A2 one set, A1 both, A0 four sets so it gets one mirror),
// with the eight leaves being plain jacks. that is the density a gate
// netlist cannot express, so this is where a compiler should hurt.
//
// two compiled variants, to separate "compilers are bad" from "this
// compiler is naive":
//   (a) NAIVE: one relay per 2-input gate, the textbook mapping
//   (b) CONE: multi-input ANDs collapse into a series CONTACT CHAIN with
//       one relay at the cone's root — what a relay-aware backend does
import { RelayBackend, assertJackCapacity } from './relay-compile.mjs';
import { MinivacSimulator, setSolverEngine } from '/home/user/minivac/src/simulator/minivac-simulator.ts';

setSolverEngine('fast');

/** series chain of literals (net, polarity) into one output relay */
function andChain(B, net, lits) {
  const out = B.mkRelay(net);
  let head = null;
  for (const { n, inv } of lits) {
    const s = B.set(n);
    if (head === null) B.wire(`${B.plusHole(out)}/${B.R(s.relay, s.arm)}`);
    else B.wire(`${head}/${B.R(s.relay, s.arm)}`);
    head = B.R(s.relay, inv ? s.nc : s.no);
  }
  B.wire(`${head}/${B.com(out)}`);
  return out;
}

function build(mode) {
  const B = new RelayBackend();
  const addr = [];
  for (let i = 0; i < 3; i++) addr.push(B.input(`a${i}`));
  if (mode === 'naive') {
    // inverters are real gates; AND3 decomposes into two AND2s
    for (let i = 0; i < 3; i++) B.not(`n${i}`, `a${i}`);
    for (let leaf = 0; leaf < 8; leaf++) {
      const lit = (i) => ((leaf >> i) & 1 ? `a${i}` : `n${i}`);
      B.and(`t${leaf}`, lit(0), lit(1));
      B.and(`d${leaf}`, `t${leaf}`, lit(2));
    }
  } else {
    // one relay per leaf, its coil fed through a 3-contact series chain
    // that reads the address relays' NO or NC sides directly
    for (let leaf = 0; leaf < 8; leaf++) {
      andChain(B, `d${leaf}`, [0, 1, 2].map((i) => ({ n: `a${i}`, inv: !((leaf >> i) & 1) })));
    }
  }
  return { B, addr };
}

for (const mode of ['naive', 'cone']) {
  const { B, addr } = build(mode);
  const wires = B.w;
  const bad = assertJackCapacity(wires);
  const machines = B.machines();
  const m = new MinivacSimulator(wires, false, machines);
  m.initialize();
  const rel = (i) => (m.getMachineState(Math.floor(i / 6)).relays[i % 6] ? 1 : 0);
  let fails = 0;
  for (let a = 0; a < 8; a++) {
    for (let i = 0; i < 3; i++) {
      const r = addr[i];
      m.setSlide((r % 6) + 1, (a >> i) & 1 ? 'right' : 'left', Math.floor(r / 6));
    }
    const hot = [];
    for (let leaf = 0; leaf < 8; leaf++) if (rel(B.firstRelay.get(`d${leaf}`))) hot.push(leaf);
    if (hot.length !== 1 || hot[0] !== a) {
      fails++;
      if (fails <= 3) console.log(`  addr ${a}: hot = [${hot}]`);
    }
  }
  console.log(
    `compiled 1-of-8 decoder [${mode.padEnd(5)}] relays=${String(B.n).padStart(3)} ` +
      `machines=${String(machines).padStart(2)} wires=${String(wires.length).padStart(3)} ` +
      `mirrors=${B.mirrors || 0} ${fails === 0 ? 'ONE-HOT CORRECT' : `${fails} WRONG`}` +
      `${bad.length ? ` JACKS:${bad.length} ${bad.slice(0, 4).join(' | ')}` : ''}`
  );
  console.log(`  -> vs the hand tree's 4 relays: ${(B.n / 4).toFixed(2)}x`);
}
