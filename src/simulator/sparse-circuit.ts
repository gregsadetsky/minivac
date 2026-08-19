/**
 * Sparse MNA circuit engine — a drop-in alternative to cktsim's dense solver for
 * the subset of elements the Minivac simulator actually uses: resistors and
 * voltage sources (current probes are 0V sources).
 *
 * Builds the exact same MNA system as cktsim (verified conventions: ground node
 * is -1 and is skipped in stamps; a voltage source adds one branch-current
 * unknown with symmetric ±1 coupling and a v+ - v- = E constraint row; a column
 * with no usable pivot gets a 1e-12 diagonal, which is how floating islands —
 * e.g. unwired lights — resolve to 0V instead of blowing up).
 *
 * Solve: sparse Gaussian elimination with a min-row-nonzeros pivot heuristic
 * (Markowitz-lite) and a magnitude guard, O(nnz·fill) instead of dense O(N^3).
 */

const EPS_PIVOT = 1e-12;

export class SparseCircuit {
  private nodeCount = 0;
  private names: Record<string, number> = {};
  private resistors: Array<[number, number, number]> = [];
  private vsources: Array<[number, number, number, string]> = [];

  gnd_node(): number {
    return -1;
  }

  node(name: string, _ntype: number): number {
    const idx = this.nodeCount++;
    if (name) this.names[name] = idx;
    return idx;
  }

  r(n1: number, n2: number, value: string, _name: string): void {
    this.resistors.push([n1, n2, parseFloat(value)]);
  }

  v(n1: number, n2: number, value: string, name: string): void {
    this.vsources.push([n1, n2, parseFloat(value), name]);
  }

  finalize(): boolean {
    return true;
  }

  dc(): Record<string, number> | null {
    const N = this.nodeCount + this.vsources.length;
    const rows: Array<Map<number, number>> = Array.from({ length: N }, () => new Map());
    const colRows: Array<Set<number>> = Array.from({ length: N }, () => new Set());
    const b = new Float64Array(N);

    const add = (r: number, c: number, val: number) => {
      const row = rows[r];
      const next = (row.get(c) || 0) + val;
      row.set(c, next);
      colRows[c].add(r);
    };

    for (const [n1, n2, ohms] of this.resistors) {
      const g = 1 / ohms;
      if (n1 >= 0) {
        add(n1, n1, g);
        if (n2 >= 0) {
          add(n1, n2, -g);
          add(n2, n1, -g);
          add(n2, n2, g);
        }
      } else if (n2 >= 0) {
        add(n2, n2, g);
      }
    }

    for (let k = 0; k < this.vsources.length; k++) {
      const [npos, nneg, volts] = this.vsources[k];
      const branch = this.nodeCount + k;
      if (npos >= 0) {
        add(branch, npos, 1);
        add(npos, branch, 1);
      }
      if (nneg >= 0) {
        add(branch, nneg, -1);
        add(nneg, branch, -1);
      }
      b[branch] = volts;
    }

    // sparse gaussian elimination, min-row-nnz pivoting with magnitude guard
    const remainingRows = new Set<number>();
    const remainingCols = new Set<number>();
    for (let i = 0; i < N; i++) {
      remainingRows.add(i);
      remainingCols.add(i);
    }
    const order: Array<[number, number]> = [];  // pivot (row, col) sequence

    for (let step = 0; step < N; step++) {
      // pick the remaining row with fewest nonzeros; break ties by larger max |v|
      let pr = -1;
      let prNnz = Infinity;
      let prMax = 0;
      for (const r of remainingRows) {
        const nnz = rows[r].size;
        if (nnz < prNnz) {
          pr = r; prNnz = nnz; prMax = rowMaxAbs(rows[r]);
        } else if (nnz === prNnz) {
          const m = rowMaxAbs(rows[r]);
          if (m > prMax) { pr = r; prMax = m; }
        }
      }
      if (pr < 0) break;

      // pivot column: largest |v| in the chosen row
      let pc = -1;
      let pv = 0;
      for (const [c, val] of rows[pr]) {
        if (Math.abs(val) > Math.abs(pv)) { pc = c; pv = val; }
      }

      if (pc >= 0 && pv !== 0) {
        // threshold pivoting: if this entry is tiny compared to the best entry in its
        // column, pivot on that better row instead — prevents elimination growth
        let colMax = Math.abs(pv);
        let colMaxRow = pr;
        for (const r2 of colRows[pc]) {
          if (!remainingRows.has(r2)) continue;
          const a = Math.abs(rows[r2].get(pc) || 0);
          if (a > colMax) { colMax = a; colMaxRow = r2; }
        }
        if (Math.abs(pv) < 1e-3 * colMax) {
          pr = colMaxRow;
          pv = rows[pr].get(pc)!;
        }
      } else {
        // degenerate (dependent) row from a floating island. cktsim's eps trick is
        // only safe on a DEAD column (no remaining rows reference it) — otherwise
        // later eliminations divide by eps and explode. find one; prefer the row's
        // own index.
        pc = -1;
        const isDead = (c: number) => {
          for (const r2 of colRows[c]) {
            if (r2 !== pr && remainingRows.has(r2)) return false;
          }
          return true;
        };
        if (remainingCols.has(pr) && isDead(pr)) {
          pc = pr;
        } else {
          for (const c of remainingCols) {
            if (isDead(c)) { pc = c; break; }
          }
          if (pc < 0) pc = remainingCols.has(pr) ? pr : firstOf(remainingCols);
        }
        rows[pr].set(pc, EPS_PIVOT);
        colRows[pc].add(pr);
        pv = EPS_PIVOT;
      }

      // eliminate pivot column from all other remaining rows
      for (const r2 of Array.from(colRows[pc])) {
        if (r2 === pr || !remainingRows.has(r2)) continue;
        const factor = (rows[r2].get(pc) || 0) / pv;
        if (factor === 0) { rows[r2].delete(pc); continue; }
        for (const [c, val] of rows[pr]) {
          const next = (rows[r2].get(c) || 0) - factor * val;
          if (next === 0) {
            rows[r2].delete(c);
          } else {
            rows[r2].set(c, next);
            colRows[c].add(r2);
          }
        }
        rows[r2].delete(pc);
        b[r2] -= factor * b[pr];
      }

      remainingRows.delete(pr);
      remainingCols.delete(pc);
      order.push([pr, pc]);
    }

    // back-substitution in reverse pivot order
    const x = new Float64Array(N);
    for (let k = order.length - 1; k >= 0; k--) {
      const [r, c] = order[k];
      let sum = b[r];
      for (const [cc, val] of rows[r]) {
        if (cc !== c) sum -= val * x[cc];
      }
      const piv = rows[r].get(c) || EPS_PIVOT;
      x[c] = sum / piv;
      if (!Number.isFinite(x[c])) x[c] = 0;
    }

    // result dictionary shaped like cktsim's: node voltages by name + I(source)
    const result: Record<string, number> = {};
    for (const name in this.names) {
      result[name] = x[this.names[name]];
    }
    for (let k = 0; k < this.vsources.length; k++) {
      result[`I(${this.vsources[k][3]})`] = x[this.nodeCount + k];
    }
    return result;
  }
}

function rowMaxAbs(row: Map<number, number>): number {
  let m = 0;
  for (const v of row.values()) {
    const a = Math.abs(v);
    if (a > m) m = a;
  }
  return m;
}

function firstOf(s: Set<number>): number {
  for (const v of s) return v;
  return -1;
}
