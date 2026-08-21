/**
 * Fast sparse MNA circuit engine — a typed-array rewrite of sparse-circuit.ts,
 * same element subset (resistors + voltage sources; current probes are 0V
 * sources), same algorithm class, engineered for large multivac circuits.
 *
 * Builds the exact same MNA system as cktsim/SparseCircuit (verified
 * conventions all three engines MUST keep):
 * - ground node is -1 and is skipped in stamps
 * - a voltage source adds one branch-current unknown with symmetric ±1
 *   coupling and a v+ - v- = E constraint row; I(name) is that unknown
 * - a step with no usable pivot (a dependent row from a floating island, e.g.
 *   an unwired light) regularizes with a 1e-12 diagonal, ONLY on a DEAD
 *   column — one no remaining row references. Regularizing a live column
 *   makes later eliminations divide by 1e-12 and currents explode to 1e24
 *   (see the 'previously-diverging comparator' regression test). Deadness
 *   here is exact — a per-column count of entries in still-remaining rows —
 *   where sparse-circuit.ts consults column sets that can contain stale rows;
 *   the exact rule finds a superset of sparse's dead columns, every one truly
 *   unreferenced, so the choice is at least as safe.
 * - threshold pivoting: reject pivots < 1e-3 of their column max
 *
 * Same solve as sparse-circuit.ts — sparse Gaussian elimination with
 * min-row-nonzeros pivoting (Markowitz-lite) and a magnitude guard — but the
 * Map/Set structures become flat typed arrays:
 * - row entries live in one growable index+value arena, compacted in place;
 *   a row that outgrows its slot moves to the arena top
 * - the per-step scan of ALL remaining rows becomes a bucket lookup: rows sit
 *   in doubly-linked lists keyed by their nonzero count, with a cached
 *   per-row max |value| for the tie-break, so each step scans one bucket
 * - eliminations run through a sparse accumulator (scatter the pivot row,
 *   walk the target row once in place, append fill-in) — no Map churn
 * - column→row membership is a linked list over a flat pool; entries that
 *   went stale (row eliminated, or entry cancelled away) are filtered and
 *   unlinked lazily when a column is next scanned
 *
 * Pivot POLICY is identical to sparse-circuit.ts (min nnz, then larger max
 * |value|, then lower row index; pivot column = largest |value| in the row,
 * first on ties; the same threshold repivot and dead-column rules), so the
 * two engines almost always take the same elimination path. Order can differ
 * only in rare tie cases where sparse's Set iteration order decided (exact
 * |value| ties during a threshold repivot; stale-set vs exact dead checks) —
 * equivalence is judged against the dense cktsim oracle, not bit-vs-sparse.
 *
 * Every dc() is a from-scratch solve. The workspace is module-level and
 * grow-only, reused across dc() calls (dc is synchronous and re-initializes
 * every cell it reads), so steady-state solves allocate almost nothing.
 */

const EPS_PIVOT = 1e-12;

// ---------------------------------------------------------------------------
// module-level grow-only workspace, shared by every FastCircuit.dc() call
// ---------------------------------------------------------------------------

interface Workspace {
  n: number; // unknown-count capacity of the per-row/per-column arrays
  // per row
  rowStart: Int32Array;
  rowLen: Int32Array;
  rowCap: Int32Array;
  rowMax: Float64Array; // cached max |value| (the pivot tie-break)
  rowAlive: Uint8Array;
  rowSeen: Int32Array; // stamp: dedupe when collecting a column's rows
  bucketNext: Int32Array;
  bucketPrev: Int32Array;
  bucketHead: Int32Array; // length n+1 (a row can hold up to N entries)
  // per column
  colAlive: Uint8Array;
  colCount: Int32Array; // exact count of entries in still-alive rows
  colHead: Int32Array; // linked-list heads/tails into the lnk pool
  colTail: Int32Array;
  // sparse accumulator + assembly coalescing markers
  spaVal: Float64Array;
  spaMark: Int32Array;
  markCol: Int32Array;
  markPos: Int32Array;
  // rhs, solution, recorded pivot order, column-collect scratch
  b: Float64Array;
  x: Float64Array;
  orderRow: Int32Array;
  orderCol: Int32Array;
  collectRow: Int32Array;
  collectIdx: Int32Array;
  // row-entry arena (all rows' index+value pairs)
  arenaCols: Int32Array;
  arenaVals: Float64Array;
  arenaCap: number;
  // column→rows linked-list pool
  lnkRow: Int32Array;
  lnkNext: Int32Array;
  lnkCap: number;
}

let ws: Workspace | null = null;

function ensureWorkspace(n: number): Workspace {
  if (ws && ws.n >= n) return ws;
  const cap = Math.max(n, 256, ws ? Math.floor(ws.n * 1.5) : 0);
  ws = {
    n: cap,
    rowStart: new Int32Array(cap),
    rowLen: new Int32Array(cap),
    rowCap: new Int32Array(cap),
    rowMax: new Float64Array(cap),
    rowAlive: new Uint8Array(cap),
    rowSeen: new Int32Array(cap),
    bucketNext: new Int32Array(cap),
    bucketPrev: new Int32Array(cap),
    bucketHead: new Int32Array(cap + 1),
    colAlive: new Uint8Array(cap),
    colCount: new Int32Array(cap),
    colHead: new Int32Array(cap),
    colTail: new Int32Array(cap),
    spaVal: new Float64Array(cap),
    spaMark: new Int32Array(cap),
    markCol: new Int32Array(cap),
    markPos: new Int32Array(cap),
    b: new Float64Array(cap),
    x: new Float64Array(cap),
    orderRow: new Int32Array(cap),
    orderCol: new Int32Array(cap),
    collectRow: new Int32Array(cap),
    collectIdx: new Int32Array(cap),
    arenaCols: ws ? ws.arenaCols : new Int32Array(1 << 14),
    arenaVals: ws ? ws.arenaVals : new Float64Array(1 << 14),
    arenaCap: ws ? ws.arenaCap : 1 << 14,
    lnkRow: ws ? ws.lnkRow : new Int32Array(1 << 14),
    lnkNext: ws ? ws.lnkNext : new Int32Array(1 << 14),
    lnkCap: ws ? ws.lnkCap : 1 << 14,
  };
  return ws;
}

function growArena(w: Workspace, minCap: number): void {
  let cap = w.arenaCap;
  while (cap < minCap) cap *= 2;
  const nc = new Int32Array(cap);
  nc.set(w.arenaCols);
  const nv = new Float64Array(cap);
  nv.set(w.arenaVals);
  w.arenaCols = nc;
  w.arenaVals = nv;
  w.arenaCap = cap;
}

function growLnk(w: Workspace): void {
  const cap = w.lnkCap * 2;
  const nr = new Int32Array(cap);
  nr.set(w.lnkRow);
  const nn = new Int32Array(cap);
  nn.set(w.lnkNext);
  w.lnkRow = nr;
  w.lnkNext = nn;
  w.lnkCap = cap;
}

// ---------------------------------------------------------------------------

// MEASUREMENT ONLY (see _notes/pivot-reuse.md): the pivot-order and
// symbolic-reuse levers both rest on sparsity patterns REPEATING across
// solves, and in this simulator every relay flip restamps the matrix.
// so before building either, count the repeats. off unless enabled.
export const profStats = {
  on: false,
  solves: 0,
  repeats: 0,
  sigs: new Map<number, number>(),
  tSearch: 0,
  tElim: 0,
  sizes: [] as number[],
  deadRows: [] as number[],
  reset() {
    this.sizes = [];
    this.deadRows = [];
    this.solves = 0;
    this.repeats = 0;
    this.sigs = new Map<number, number>();
    this.tSearch = 0;
    this.tElim = 0;
  },
};

export class FastCircuit {
  private nodeCount = 0;
  private names: Record<string, number> = {};
  // resistors as parallel arrays (n1, n2, ohms)
  private rN1: number[] = [];
  private rN2: number[] = [];
  private rOhms: number[] = [];
  // voltage sources as parallel arrays (n+, n-, volts, name)
  private vN1: number[] = [];
  private vN2: number[] = [];
  private vVolts: number[] = [];
  private vNames: string[] = [];

  gnd_node(): number {
    return -1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  node(name: string, _ntype: number): number {
    const idx = this.nodeCount++;
    if (name) this.names[name] = idx;
    return idx;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  r(n1: number, n2: number, value: string, _name: string): void {
    this.rN1.push(n1);
    this.rN2.push(n2);
    this.rOhms.push(parseFloat(value));
  }

  v(n1: number, n2: number, value: string, name: string): void {
    this.vN1.push(n1);
    this.vN2.push(n2);
    this.vVolts.push(parseFloat(value));
    this.vNames.push(name);
  }

  finalize(): boolean {
    return true;
  }

  dc(): Record<string, number> | null {
    const nNodes = this.nodeCount;
    const nSrc = this.vN1.length;
    const nRes = this.rN1.length;
    const N = nNodes + nSrc;
    const w = ensureWorkspace(N);

    const rowStart = w.rowStart;
    const rowLen = w.rowLen;
    const rowCap = w.rowCap;
    const rowMax = w.rowMax;
    const rowAlive = w.rowAlive;
    const rowSeen = w.rowSeen;
    const bucketNext = w.bucketNext;
    const bucketPrev = w.bucketPrev;
    const bucketHead = w.bucketHead;
    const colAlive = w.colAlive;
    const colCount = w.colCount;
    const colHead = w.colHead;
    const colTail = w.colTail;
    const spaVal = w.spaVal;
    const spaMark = w.spaMark;
    const markCol = w.markCol;
    const markPos = w.markPos;
    const b = w.b;
    const x = w.x;
    const orderRow = w.orderRow;
    const orderCol = w.orderCol;
    const collectRow = w.collectRow;
    const collectIdx = w.collectIdx;
    // arena/pool aliases are `let`: they are refreshed after any growth
    let aCols = w.arenaCols;
    let aVals = w.arenaVals;
    let lRow = w.lnkRow;
    let lNext = w.lnkNext;
    let lnkTop = 0;
    let arenaTop = 0;
    let spaStamp = 0;
    let seenStamp = 0;
    let minNnz = 0;

    const rN1 = this.rN1;
    const rN2 = this.rN2;
    const rOhms = this.rOhms;
    const vN1 = this.vN1;
    const vN2 = this.vN2;

    // ---- workspace init for this solve (only the cells this N uses) ----
    b.fill(0, 0, N);
    x.fill(0, 0, N);
    spaMark.fill(0, 0, N);
    rowSeen.fill(0, 0, N);
    markCol.fill(-1, 0, N);
    colCount.fill(0, 0, N);
    colAlive.fill(1, 0, N);
    colHead.fill(-1, 0, N);
    colTail.fill(-1, 0, N);
    rowAlive.fill(1, 0, N);
    bucketHead.fill(-1, 0, N + 1);

    // ---- stamp pass 1: raw entry count per row (duplicates included) ----
    rowCap.fill(0, 0, N);
    for (let i = 0; i < nRes; i++) {
      const n1 = rN1[i];
      const n2 = rN2[i];
      if (n1 >= 0) {
        if (n2 >= 0) {
          rowCap[n1] += 2;
          rowCap[n2] += 2;
        } else {
          rowCap[n1] += 1;
        }
      } else if (n2 >= 0) {
        rowCap[n2] += 1;
      }
    }
    for (let k = 0; k < nSrc; k++) {
      const branch = nNodes + k;
      if (vN1[k] >= 0) {
        rowCap[branch] += 1;
        rowCap[vN1[k]] += 1;
      }
      if (vN2[k] >= 0) {
        rowCap[branch] += 1;
        rowCap[vN2[k]] += 1;
      }
    }

    // ---- carve per-row arena slots (raw count + fill headroom) ----
    let top = 0;
    for (let r = 0; r < N; r++) {
      rowStart[r] = top;
      const cap = rowCap[r] + 4;
      rowCap[r] = cap;
      rowLen[r] = 0;
      top += cap;
    }
    if (top > w.arenaCap) {
      growArena(w, top);
      aCols = w.arenaCols;
      aVals = w.arenaVals;
    }
    arenaTop = top;

    // ---- stamp pass 2: scatter raw stamps in the exact order SparseCircuit
    // issues them (within-row entry order must match Map insertion order) ----
    const stamp = (r: number, c: number, val: number) => {
      const p = rowStart[r] + rowLen[r]++;
      aCols[p] = c;
      aVals[p] = val;
    };
    for (let i = 0; i < nRes; i++) {
      const n1 = rN1[i];
      const n2 = rN2[i];
      const g = 1 / rOhms[i];
      if (n1 >= 0) {
        stamp(n1, n1, g);
        if (n2 >= 0) {
          stamp(n1, n2, -g);
          stamp(n2, n1, -g);
          stamp(n2, n2, g);
        }
      } else if (n2 >= 0) {
        stamp(n2, n2, g);
      }
    }
    for (let k = 0; k < nSrc; k++) {
      const branch = nNodes + k;
      const npos = vN1[k];
      const nneg = vN2[k];
      if (npos >= 0) {
        stamp(branch, npos, 1);
        stamp(npos, branch, 1);
      }
      if (nneg >= 0) {
        stamp(branch, nneg, -1);
        stamp(nneg, branch, -1);
      }
      b[branch] = this.vVolts[k];
    }

    // ---- push a row into the column's linked list ----
    const lnkPush = (c: number, r: number) => {
      if (lnkTop === w.lnkCap) {
        growLnk(w);
        lRow = w.lnkRow;
        lNext = w.lnkNext;
      }
      const i = lnkTop++;
      lRow[i] = r;
      lNext[i] = -1;
      const t = colTail[c];
      if (t === -1) colHead[c] = i;
      else lNext[t] = i;
      colTail[c] = i;
    };

    const bucketInsert = (r: number, nnz: number) => {
      const h = bucketHead[nnz];
      bucketPrev[r] = -1;
      bucketNext[r] = h;
      if (h !== -1) bucketPrev[h] = r;
      bucketHead[nnz] = r;
      if (nnz < minNnz) minNnz = nnz;
    };
    const bucketRemove = (r: number, nnz: number) => {
      const p = bucketPrev[r];
      const nx = bucketNext[r];
      if (p === -1) bucketHead[nnz] = nx;
      else bucketNext[p] = nx;
      if (nx !== -1) bucketPrev[nx] = p;
    };

    // ---- coalesce duplicates per row (keeping first-occurrence order, like
    // Map insertion), then register entries in columns and buckets ----
    for (let r = 0; r < N; r++) {
      const base = rowStart[r];
      const end = base + rowLen[r];
      let write = base;
      for (let i = base; i < end; i++) {
        const c = aCols[i];
        if (markCol[c] === r) {
          aVals[markPos[c]] += aVals[i];
        } else {
          markCol[c] = r;
          markPos[c] = write;
          aCols[write] = c;
          aVals[write] = aVals[i];
          write++;
        }
      }
      const len = write - base;
      rowLen[r] = len;
      let max = 0;
      for (let i = base; i < write; i++) {
        const a = Math.abs(aVals[i]);
        if (a > max) max = a;
        colCount[aCols[i]]++;
        lnkPush(aCols[i], r);
      }
      rowMax[r] = max;
      bucketInsert(r, len);
    }

    // ---- move a row's compacted entries to the arena top with a bigger cap
    // (rowLen must already hold the compacted length) ----
    const moveRow = (r: number, needCap: number) => {
      if (arenaTop + needCap > w.arenaCap) {
        growArena(w, arenaTop + needCap);
        aCols = w.arenaCols;
        aVals = w.arenaVals;
      }
      const from = rowStart[r];
      const len = rowLen[r];
      aCols.copyWithin(arenaTop, from, from + len);
      aVals.copyWithin(arenaTop, from, from + len);
      rowStart[r] = arenaTop;
      rowCap[r] = needCap;
      arenaTop += needCap;
    };

    // ---- collect the still-alive rows that really hold an entry in column
    // pcol (dedupes re-pushed rows, unlinks stale nodes); returns the count.
    // collectRow[j] = row, collectIdx[j] = arena index of its pcol entry ----
    const collect = (pcol: number): number => {
      let cnt = 0;
      const seen = ++seenStamp;
      let cur = colHead[pcol];
      let prev = -1;
      while (cur !== -1) {
        const nxt = lNext[cur];
        const r2 = lRow[cur];
        let keep = false;
        if (rowAlive[r2] === 1 && rowSeen[r2] !== seen) {
          const b2 = rowStart[r2];
          const l2 = rowLen[r2];
          let at = -1;
          for (let i = 0; i < l2; i++) {
            if (aCols[b2 + i] === pcol) {
              at = b2 + i;
              break;
            }
          }
          if (at >= 0) {
            rowSeen[r2] = seen;
            collectRow[cnt] = r2;
            collectIdx[cnt] = at;
            cnt++;
            keep = true;
          }
        }
        if (keep) {
          prev = cur;
        } else {
          if (prev === -1) colHead[pcol] = nxt;
          else lNext[prev] = nxt;
          if (nxt === -1) colTail[pcol] = prev;
        }
        cur = nxt;
      }
      return cnt;
    };

    // ---- sparse gaussian elimination: same pivot policy as SparseCircuit ----
    if (profStats.on) {
      profStats.sizes.push(N);
      // how many rows are isolated (empty) or dangling (a single entry)?
      // those are unwired/one-legged jacks carried through the whole
      // elimination for nothing
      let dead = 0;
      for (let r = 0; r < N; r++) if (rowLen[r] <= 1) dead++;
      profStats.deadRows.push(dead);
      // FNV-1a over the row structure — O(nnz), only when profiling
      let h = 0x811c9dc5;
      for (let r = 0; r < N; r++) {
        h = Math.imul(h ^ rowLen[r], 0x01000193);
        const base = rowStart[r];
        for (let i = 0; i < rowLen[r]; i++) h = Math.imul(h ^ aCols[base + i], 0x01000193);
      }
      profStats.solves++;
      const seen = profStats.sigs.get(h);
      profStats.sigs.set(h, (seen ?? 0) + 1);
      if (seen !== undefined) profStats.repeats++;
    }
    let orderN = 0;
    for (let step = 0; step < N; step++) {
      while (minNnz <= N && bucketHead[minNnz] === -1) minNnz++;
      if (minNnz > N) break; // no rows left

      // pivot row: fewest nonzeros, then larger cached max |v|, then lower index
      let pr = -1;
      let prMax = -1;
      for (let r = bucketHead[minNnz]; r !== -1; r = bucketNext[r]) {
        const m = rowMax[r];
        if (m > prMax || (m === prMax && r < pr)) {
          pr = r;
          prMax = m;
        }
      }

      // pivot column: largest |v| in the chosen row (first wins ties)
      let pc = -1;
      let pv = 0;
      {
        const base = rowStart[pr];
        const len = rowLen[pr];
        let best = 0;
        for (let i = 0; i < len; i++) {
          const a = Math.abs(aVals[base + i]);
          if (a > best) {
            best = a;
            pc = aCols[base + i];
            pv = aVals[base + i];
          }
        }
      }

      let collectN: number;
      if (pc >= 0 && pv !== 0) {
        collectN = collect(pc);
        // threshold pivoting: if this entry is tiny compared to the best entry
        // in its column, pivot on that better row instead
        let colMax = Math.abs(pv);
        let cmRow = pr;
        let cmIdx = -1;
        for (let j = 0; j < collectN; j++) {
          const a = Math.abs(aVals[collectIdx[j]]);
          if (a > colMax) {
            colMax = a;
            cmRow = collectRow[j];
            cmIdx = collectIdx[j];
          }
        }
        if (Math.abs(pv) < 1e-3 * colMax) {
          pr = cmRow;
          pv = aVals[cmIdx];
        }
        bucketRemove(pr, rowLen[pr]);
      } else {
        // degenerate (dependent) row from a floating island. The eps trick is
        // only safe on a DEAD column — no remaining row (besides pr itself)
        // holds an entry there — otherwise later eliminations divide by eps.
        // Prefer the row's own index; else the lowest dead column; else (a
        // truly singular tangle) fall back like SparseCircuit does.
        const dstamp = ++spaStamp; // mark pr's own columns for O(1) checks
        {
          const base = rowStart[pr];
          const len = rowLen[pr];
          for (let i = 0; i < len; i++) spaMark[aCols[base + i]] = dstamp;
        }
        pc = -1;
        if (colAlive[pr] === 1 && colCount[pr] === (spaMark[pr] === dstamp ? 1 : 0)) {
          pc = pr;
        } else {
          for (let c = 0; c < N; c++) {
            if (colAlive[c] === 1 && colCount[c] === (spaMark[c] === dstamp ? 1 : 0)) {
              pc = c;
              break;
            }
          }
          if (pc < 0) {
            if (colAlive[pr] === 1) pc = pr;
            else {
              for (let c = 0; c < N; c++) {
                if (colAlive[c] === 1) {
                  pc = c;
                  break;
                }
              }
            }
          }
        }
        // place the epsilon pivot on (pr, pc). Take pr out of the buckets
        // BEFORE the row may grow, so the removal uses its indexed length.
        bucketRemove(pr, rowLen[pr]);
        {
          const base = rowStart[pr];
          const len = rowLen[pr];
          let at = -1;
          for (let i = 0; i < len; i++) {
            if (aCols[base + i] === pc) {
              at = base + i;
              break;
            }
          }
          if (at >= 0) {
            aVals[at] = EPS_PIVOT;
          } else {
            if (len === rowCap[pr]) moveRow(pr, len + 4);
            const p = rowStart[pr] + len;
            aCols[p] = pc;
            aVals[p] = EPS_PIVOT;
            rowLen[pr] = len + 1;
            colCount[pc]++;
            lnkPush(pc, pr);
          }
        }
        pv = EPS_PIVOT;
        collectN = collect(pc);
      }

      // eliminate the pivot column from all other collected rows
      const pb = rowStart[pr];
      const pl = rowLen[pr];
      for (let j = 0; j < collectN; j++) {
        const r2 = collectRow[j];
        if (r2 === pr) continue;
        const eAt = collectIdx[j];
        const factor = aVals[eAt] / pv;
        const b2 = rowStart[r2];
        const l2 = rowLen[r2];
        if (factor === 0) {
          // explicit-zero entry: drop it (mirrors rows[r2].delete(pc))
          const last = b2 + l2 - 1;
          for (let i = eAt; i < last; i++) {
            aCols[i] = aCols[i + 1];
            aVals[i] = aVals[i + 1];
          }
          rowLen[r2] = l2 - 1;
          colCount[pc]--;
          bucketRemove(r2, l2);
          bucketInsert(r2, l2 - 1);
          continue; // a zero can't have been the row max
        }
        // scatter the pivot row into the accumulator
        const sc = spaStamp + 1;
        const con = spaStamp + 2;
        spaStamp += 2;
        for (let i = 0; i < pl; i++) {
          const c = aCols[pb + i];
          spaVal[c] = aVals[pb + i];
          spaMark[c] = sc;
        }
        // walk r2 in place: update touched entries, drop pc and exact zeros
        let write = 0;
        let newMax = 0;
        for (let i = 0; i < l2; i++) {
          const c = aCols[b2 + i];
          let val = aVals[b2 + i];
          if (spaMark[c] === sc) {
            spaMark[c] = con;
            if (c === pc) {
              colCount[pc]--;
              continue;
            }
            val = val - factor * spaVal[c];
            if (val === 0) {
              colCount[c]--;
              continue;
            }
          }
          aCols[b2 + write] = c;
          aVals[b2 + write] = val;
          write++;
          const a = Math.abs(val);
          if (a > newMax) newMax = a;
        }
        // fill-in: pivot-row columns the walk did not consume. Worst case
        // adds pl entries; relocate the compacted row once if it can't fit.
        if (write + pl > rowCap[r2]) {
          rowLen[r2] = write;
          moveRow(r2, write + pl + 4);
        }
        const nb = rowStart[r2];
        for (let i = 0; i < pl; i++) {
          const c = aCols[pb + i];
          if (spaMark[c] !== sc) continue; // consumed by the walk above
          const nv = -factor * spaVal[c];
          if (nv === 0) continue; // underflow — mirrors the next===0 delete
          aCols[nb + write] = c;
          aVals[nb + write] = nv;
          write++;
          const a = Math.abs(nv);
          if (a > newMax) newMax = a;
          colCount[c]++;
          lnkPush(c, r2);
        }
        rowLen[r2] = write;
        rowMax[r2] = newMax;
        if (write !== l2) {
          bucketRemove(r2, l2);
          bucketInsert(r2, write);
        }
        b[r2] -= factor * b[pr];
      }

      // retire the pivot row and column
      rowAlive[pr] = 0;
      {
        const base = rowStart[pr];
        const len = rowLen[pr];
        for (let i = 0; i < len; i++) colCount[aCols[base + i]]--;
      }
      colAlive[pc] = 0;
      orderRow[orderN] = pr;
      orderCol[orderN] = pc;
      orderN++;
    }

    // ---- back-substitution in reverse pivot order ----
    for (let k = orderN - 1; k >= 0; k--) {
      const r = orderRow[k];
      const c = orderCol[k];
      const base = rowStart[r];
      const len = rowLen[r];
      let sum = b[r];
      let piv = 0;
      for (let i = 0; i < len; i++) {
        const cc = aCols[base + i];
        if (cc === c) piv = aVals[base + i];
        else sum -= aVals[base + i] * x[cc];
      }
      if (piv === 0) piv = EPS_PIVOT;
      const xv = sum / piv;
      x[c] = Number.isFinite(xv) ? xv : 0;
    }

    // result dictionary shaped like cktsim's: node voltages by name + I(source)
    const result: Record<string, number> = {};
    for (const name in this.names) {
      result[name] = x[this.names[name]];
    }
    for (let k = 0; k < nSrc; k++) {
      result[`I(${this.vNames[k]})`] = x[nNodes + k];
    }
    return result;
  }
}
