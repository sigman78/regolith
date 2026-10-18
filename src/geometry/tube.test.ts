import { describe, expect, it } from 'vitest';
import { buildBundle } from './build';
import { TUBE_RADIUS } from './design-constants';
import { assertValidBundle } from './validate';

const build = (points: number[]) => buildBundle({ ops: [{ kind: 'tube', points }] });

describe('tube geometry', () => {
  it('builds a valid straight tube with hull, flanges and nothing else', () => {
    const b = build([0, 3, 0, 10, 3, 0]);
    expect(() => assertValidBundle(b)).not.toThrow();
    expect(Object.keys(b.byMaterial).sort()).toEqual(['graphite', 'hull']);
    expect(b.bounds.min[0]).toBeCloseTo(0, 5);
    expect(b.bounds.max[0]).toBeCloseTo(10, 5);
    expect(b.bounds.max[1]).toBeCloseTo(3 + TUBE_RADIUS + 0.08, 2);
  });

  it('builds valid bends, slopes and diagonal runs', () => {
    for (const pts of [
      [0, 3, 0, 6, 3, 0, 10, 3, 4], // 45° kink
      [0, 3, 0, 5, 3.5, 0, 10, 4, 0], // gentle slope, collinear-ish
      [0, 3, 0, 0, 3, 8, -6, 3, 8, -6, 3, 0], // two 90° bends
      [0, 3, 0, 4, 3, 4], // diagonal
    ]) {
      expect(() => assertValidBundle(build(pts))).not.toThrow();
    }
  });

  it('ignores repeated points and survives degenerate input', () => {
    expect(() => assertValidBundle(build([0, 3, 0, 0, 3, 0, 5, 3, 0]))).not.toThrow();
    expect(build([1, 1, 1]).byMaterial).toEqual({});
  });

  it('is deterministic', () => {
    const a = build([0, 3, 0, 6, 3, 0, 10, 3, 4]);
    const again = buildBundle({ ops: [{ kind: 'tube', points: [0, 3, 0, 6, 3, 0, 10, 3, 4] }] });
    expect(again).toBe(a);
  });
});
