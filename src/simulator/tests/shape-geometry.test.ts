import { describe, expect, it } from 'vitest';
import { SHAPES, shapeRange, stepEntering } from '../../circuits/multivac-mini-tetris';

// the geometry the wider-well emitters build from. the step vectors are
// pinned to the check tables that were VERIFIED against three hand-laid
// trees (_notes/wider-well.md): offsets are from the TARGET position q.
const byLabel = (l: string) => {
  const s = SHAPES.find((x) => x.label === l);
  if (!s) throw new Error(l);
  return s;
};

describe('shape geometry (wider-well emitter input)', () => {
  it('step entering offsets match the verified check tables', () => {
    // S right: enters bottom q+1, top q (the b3 t2 at q=2 case)
    expect(stepEntering(byLabel('S'), 1)).toEqual({ b: 1, t: 0 });
    // Z right: bottom q+1, top q+2 (the NOT-Z-gated LTZ path)
    expect(stepEntering(byLabel('Z'), 1)).toEqual({ b: 1, t: 2 });
    // narrow flat: bottom q only
    expect(stepEntering(byLabel('1x1'), 1)).toEqual({ b: 0, t: null });
    expect(stepEntering(byLabel('1x1'), -1)).toEqual({ b: 0, t: null });
    // triples right: bottom q+2; stems at their tOff+tW-1
    expect(stepEntering(byLabel('L'), 1)).toEqual({ b: 2, t: 0 });
    expect(stepEntering(byLabel('J'), 1)).toEqual({ b: 2, t: 2 });
    expect(stepEntering(byLabel('T'), 1)).toEqual({ b: 2, t: 1 });
    // overhangs: offset single bottoms under 3-wide tops
    expect(stepEntering(byLabel('L flip'), 1)).toEqual({ b: 2, t: 2 });
    expect(stepEntering(byLabel('J flip'), 1)).toEqual({ b: 0, t: 2 });
    expect(stepEntering(byLabel('T flip'), 1)).toEqual({ b: 1, t: 2 });
    // left steps read the low edge
    expect(stepEntering(byLabel('S'), -1)).toEqual({ b: 0, t: -1 });
    expect(stepEntering(byLabel('L flip'), -1)).toEqual({ b: 2, t: 0 });
  });

  it('ranges at 4 and 6 match the tables', () => {
    const r4 = (l: string) => shapeRange(byLabel(l), 4);
    const r6 = (l: string) => shapeRange(byLabel(l), 6);
    expect(r4('S')).toEqual({ min: 1, max: 2 });
    expect(r4('Z')).toEqual({ min: 0, max: 1 });
    expect(r4('L flip')).toEqual({ min: 0, max: 1 });
    expect(r4('1x1')).toEqual({ min: 0, max: 3 });
    expect(r6('S')).toEqual({ min: 1, max: 4 });
    expect(r6('T')).toEqual({ min: 0, max: 3 });
    expect(r6('2x2 square')).toEqual({ min: 0, max: 4 });
  });
});
