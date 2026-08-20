// the contact allocator (wider-well phase C, emitter 0 — see
// _notes/wider-well.md). A relay has exactly two contact sets; the
// hand-laid mirror banks (POSM3..6, SM/ZM, MMIR*, ...) spend them via
// per-block ledger comments that only the author could check. This
// object makes the ledger mechanical: a MirrorBank owns one layout
// bank of mirror relays for one source signal, mints contact sets in
// request order, emits the coil-chain wires itself, and throws the
// moment a consumer would overflow the bank or share a set (the
// tie-point law: a contact set serves ONE consumer — jacks are
// permanent ties, so a second consumer on the same set bridges nets
// through the shared jack whether the contact is open or not).
//
// v1 scope: plain mirrors only (coil parallels the source's coil net).
// Gated reads (coil = rail AND state, the LTS/LTZ class) stay
// hand-wired; the bank can still hand them sets via source: null.

export interface ContactSet {
  relay: number;
  set: 1 | 2;
  arm: string; // H (set 1) or L (set 2)
  no: string; // G or K
  nc: string; // J or N
}

export type SetKind = 'gate' | 'changeover';

export interface MirrorBankOpts {
  name: string; // for errors and the spend ledger
  // relay whose coil net the mirror chain parallels; null = the caller
  // wires the first mirror's coil feed itself (gated banks)
  source: number | null;
  base: number; // first mirror relay index (the layout's take())
  capacity: number; // mirror relays the layout granted
  w: string[]; // the circuit's wire list (coil wires are emitted here)
  R: (n: number, jack: string) => string;
  minusOf: (n: number) => string;
}

export class MirrorBank {
  private minted = 0; // mirrors whose coil wires exist
  private setsSpent = 0;
  private readonly kinds: SetKind[] = [];
  private readonly o: MirrorBankOpts;
  constructor(o: MirrorBankOpts) {
    this.o = o;
  }

  /** next unspent contact set, minting a new mirror when both sets of
   *  every minted mirror are gone. records the kind for the ledger. */
  request(kind: SetKind): ContactSet {
    const mirror = Math.floor(this.setsSpent / 2);
    if (mirror >= this.o.capacity)
      throw new Error(
        `${this.o.name}: bank exhausted (${this.o.capacity} mirrors / ${this.o.capacity * 2} sets; ` +
          `request #${this.setsSpent + 1})`
      );
    while (this.minted <= mirror) this.mint();
    const set = ((this.setsSpent % 2) + 1) as 1 | 2;
    this.setsSpent++;
    this.kinds.push(kind);
    const relay = this.o.base + mirror;
    return set === 1
      ? { relay, set, arm: 'H', no: 'G', nc: 'J' }
      : { relay, set, arm: 'L', no: 'K', nc: 'N' };
  }

  private mint(): void {
    const { source, base, w, R, minusOf } = this.o;
    const n = base + this.minted;
    const prev = this.minted === 0 ? source : base + this.minted - 1;
    if (prev !== null) w.push(`${R(prev, 'E')}/${R(n, 'E')}`);
    w.push(`${R(n, 'F')}/${minusOf(n)}`);
    this.minted++;
  }

  /** the spend ledger: relays minted, sets spent, kinds in order. */
  spent(): { relays: number; sets: number; kinds: readonly SetKind[] } {
    return { relays: this.minted, sets: this.setsSpent, kinds: this.kinds };
  }
}
