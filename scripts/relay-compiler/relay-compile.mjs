// A MINIMAL GATE-NETLIST -> RELAY BACKEND.
//
// the point is NOT to be a good compiler. it is to answer one question
// with a number: how many relays does a MECHANICALLY compiled design
// cost against the hand-wired equivalents already in this repo (rung 2's
// 8-bit shift register at 24 relays, rung 3's 4-bit adder at 15)?
//
// so this deliberately does what a real backend would have to do and
// nothing clever:
//   - one relay per primary input, per gate output, per DFF (x2 + clock)
//   - a gate's function is a CONTACT NETWORK on its inputs feeding the
//     output relay's coil
//   - fan-out beyond a relay's two changeover sets mints parallel-coil
//     MIRROR relays (the tie-point law: one consumer per contact set)
//   - jack capacity is respected (2/jack, 4 on com)
// no contact reuse tricks, no one-hot reasoning, no borrowed sets —
// exactly the density a synthesis tool would leave on the table.

const SETS = [
  { arm: 'H', no: 'G', nc: 'J' },
  { arm: 'L', no: 'K', nc: 'N' },
];

export class RelayBackend {
  constructor() {
    this.n = 0; // next relay index
    this.w = [];
    this.holes = new Map(); // jack -> wires landed on it
    this.free = new Map(); // net -> [{relay, set}] unspent contact sets
    this.driver = new Map(); // net -> relay the NEXT mirror chains off
    this.firstRelay = new Map(); // net -> the relay that IS the net (probe here)
  }
  // --- jack helpers (m{K}.{SEC}{JACK}, sections 1..6 per machine) ---
  R(i, jack) {
    return `m${Math.floor(i / 6)}.${(i % 6) + 1}${jack}`;
  }
  plus(i) { return this.R(i, '+'); }
  /** a + jack on the SAME MACHINE as relay i with a free hole. supplies
   *  are per-machine and the six section + jacks are the same node, so
   *  this is a hole-routing choice, not an electrical one — the hand
   *  designs do it too (rung 2 feeds m0.1's slide from m0.3+). a real
   *  backend has to do this or it emits unbuildable netlists. */
  plusHole(i) {
    const mach = Math.floor(i / 6);
    for (let sec = 1; sec <= 6; sec++) {
      const j = `m${mach}.${sec}+`;
      if ((this.holes.get(j) || 0) < 2) return j;
    }
    throw new Error(`machine ${mach}: every + jack is full`);
  }
  /** every emitted wire passes through here so hole counts stay honest */
  wire(...ws) {
    for (const s of ws) {
      this.w.push(s);
      for (const t of s.split('/')) this.holes.set(t, (this.holes.get(t) || 0) + 1);
    }
  }
  minus(i) { return this.R(i, '-'); }
  com(i) { return this.R(i, 'com'); }
  take() { return this.n++; }

  /** a relay whose coil hangs off `com`, with both sets available */
  mkRelay(net) {
    const i = this.take();
    this.wire(`${this.com(i)}/${this.R(i, 'E')}`, `${this.R(i, 'F')}/${this.minus(i)}`);
    if (net !== undefined) {
      this.driver.set(net, i);
      this.firstRelay.set(net, i);
      this.free.set(net, [
        { relay: i, ...SETS[0] },
        { relay: i, ...SETS[1] },
      ]);
    }
    return i;
  }

  /** next unspent contact set of `net`, minting a parallel-coil mirror
   *  when both sets of every relay carrying the net are gone. this is
   *  the cost a compiler pays that a hand design dodges by borrowing
   *  spare sets off unrelated relays. */
  set(net) {
    const pool = this.free.get(net);
    if (!pool) throw new Error(`unknown net ${net}`);
    if (pool.length === 0) {
      const src = this.driver.get(net);
      const mir = this.take();
      this.wire(`${this.R(src, 'E')}/${this.R(mir, 'E')}`, `${this.R(mir, 'F')}/${this.minus(mir)}`);
      this.mirrors = (this.mirrors || 0) + 1;
      // the mirror's coil now parallels the source's; the source jack it
      // entered counts against E's capacity, tracked by the audit below
      this.driver.set(net, mir); // chain further mirrors off this one
      pool.push({ relay: mir, ...SETS[0] }, { relay: mir, ...SETS[1] });
    }
    return pool.shift();
  }

  /** declare a primary input: a relay driven by its OWN section's slide
   *  (every section has one, so inputs cost no extra routing) */
  input(net) {
    const i = this.mkRelay(net);
    this.wire(`${this.plusHole(i)}/${this.R(i, 'S')}`, `${this.R(i, 'T')}/${this.com(i)}`);
    return i;
  }

  /** a series pair: + -> a(NO) -> b(NO) -> out.coil */
  and(net, a, b) {
    const out = this.mkRelay(net);
    const sa = this.set(a), sb = this.set(b);
    this.wire(`${this.plusHole(out)}/${this.R(sa.relay, sa.arm)}`);
    this.wire(`${this.R(sa.relay, sa.no)}/${this.R(sb.relay, sb.arm)}`);
    this.wire(`${this.R(sb.relay, sb.no)}/${this.com(out)}`);
    return out;
  }
  /** two parallel branches into the coil node */
  or(net, a, b) {
    const out = this.mkRelay(net);
    for (const x of [a, b]) {
      const s = this.set(x);
      this.wire(`${this.plusHole(out)}/${this.R(s.relay, s.arm)}`);
      this.wire(`${this.R(s.relay, s.no)}/${this.com(out)}`);
    }
    return out;
  }
  not(net, a) {
    const out = this.mkRelay(net);
    const s = this.set(a);
    this.wire(`${this.plusHole(out)}/${this.R(s.relay, s.arm)}`);
    this.wire(`${this.R(s.relay, s.nc)}/${this.com(out)}`);
    return out;
  }
  /** the parity ladder: a splits + into even/odd, b swaps them. costs
   *  ONE set of a and TWO of b. */
  xor(net, a, b) {
    const out = this.mkRelay(net);
    const sa = this.set(a), sb1 = this.set(b), sb2 = this.set(b);
    this.wire(`${this.plusHole(out)}/${this.R(sa.relay, sa.arm)}`);
    // even rail (a = 0) -> b set 1 ; odd rail (a = 1) -> b set 2
    this.wire(`${this.R(sa.relay, sa.nc)}/${this.R(sb1.relay, sb1.arm)}`);
    this.wire(`${this.R(sa.relay, sa.no)}/${this.R(sb2.relay, sb2.arm)}`);
    this.wire(`${this.R(sb1.relay, sb1.no)}/${this.com(out)}`); // a=0,b=1
    this.wire(`${this.R(sb2.relay, sb2.nc)}/${this.com(out)}`); // a=1,b=0
    return out;
  }

  /** a clock-mirror relay: one per DFF (both its sets serve only its own
   *  bit — a shared clock contact would bridge two bits' D paths) */
  clockMirror(railJack) {
    const c = this.take();
    this.wire(`${railJack}/${this.R(c, 'E')}`, `${this.R(c, 'F')}/${this.minus(c)}`);
    this.wire(`${this.plusHole(c)}/${this.R(c, 'H')}`);
    this.wire(`${this.plusHole(c)}/${this.R(c, 'L')}`);
    return c;
  }

  /** master/slave D flip-flop; `dSet` is a contact set carrying D */
  dff(net, c, dSet) {
    const a = this.take(); // master
    const s = this.take(); // slave
    for (const r of [a, s]) this.wire(`${this.com(r)}/${this.R(r, 'E')}`, `${this.R(r, 'F')}/${this.minus(r)}`);
    // D while the clock is LOW, through the caller's D contact set
    this.wire(`${this.R(c, 'J')}/${this.R(dSet.relay, dSet.arm)}`);
    this.wire(`${this.R(dSet.relay, dSet.no)}/${this.com(a)}`);
    this.wire(`${this.R(c, 'G')}/${this.R(a, 'H')}`, `${this.R(a, 'G')}/${this.com(a)}`); // master holds, clock high
    this.wire(`${this.R(c, 'K')}/${this.R(a, 'L')}`, `${this.R(a, 'K')}/${this.com(s)}`); // slave := master
    this.wire(`${this.R(c, 'N')}/${this.R(s, 'H')}`, `${this.R(s, 'G')}/${this.com(s)}`); // slave holds, clock low
    this.driver.set(net, s);
    this.firstRelay.set(net, s);
    this.free.set(net, [{ relay: s, ...SETS[1] }]); // set 1 is the hold
    return { master: a, slave: s };
  }

  /** drive a light off `net` (an output pin) */
  light(net) {
    const s = this.set(net);
    this.wire(`${this.plusHole(s.relay)}/${this.R(s.relay, s.arm)}`);
    this.wire(`${this.R(s.relay, s.no)}/${this.R(s.relay, 'A')}`, `${this.R(s.relay, 'B')}/${this.minus(s.relay)}`);
  }

  machines() { return Math.ceil(this.n / 6); }
}

export function assertJackCapacity(wires) {
  const uses = new Map();
  for (const w of wires) for (const t of w.split('/')) uses.set(t, (uses.get(t) || 0) + 1);
  const bad = [];
  for (const [jack, n] of uses) {
    const cap = jack.endsWith('com') ? 4 : /M1[01]$/.test(jack) ? 6 : 2;
    if (n > cap) bad.push(`${jack} used ${n}x (cap ${cap})`);
  }
  return bad;
}
