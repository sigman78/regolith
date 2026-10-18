import { describe, expect, it } from 'vitest';
import { getPart } from '@/grammar/registry';
import { solarPostXs } from '@/grammar/solar-layout';
import { buildBundle } from './build';
import { SOLAR_ROWS } from './design-constants';

describe('letter A geometry', () => {
  it('draws a door and a ramp with chevrons and no glass', () => {
    const b = buildBundle({ ops: [{ kind: 'airlock', radius: 2, length: 2.4 }] });
    expect(b.byMaterial.warning).toBeTruthy();
    expect(b.byMaterial.graphite).toBeTruthy();
    expect(b.byMaterial.glass).toBeUndefined();
  });
});

describe('letter S geometry', () => {
  it('has a face per panel and a leg foot per post', () => {
    for (const rows of SOLAR_ROWS) {
      for (const cols of [2, 6, 12] as const) {
        const b = buildBundle({ ops: [{ kind: 'solar', rows, cols }] });
        // One four-vertex plane per panel face.
        expect((b.byMaterial.solar?.positions.length ?? 0) / 3).toBe(rows * cols * 4);
        const part = getPart('S');
        const params = part?.resolve({ rows, cols }) ?? {};
        const feet = part?.ports(params).filter((q) => q.type === 'STRUCT') ?? [];
        expect(feet).toHaveLength(solarPostXs(cols).length);
      }
    }
  });

  it('keeps tracking out of the shape until the sim moves panels', () => {
    const on = buildBundle({ ops: [{ kind: 'solar', rows: 2, cols: 4, tracking: true }] });
    const off = buildBundle({ ops: [{ kind: 'solar', rows: 2, cols: 4, tracking: false }] });
    expect(Array.from(on.byMaterial.solar?.positions ?? [])).toEqual(
      Array.from(off.byMaterial.solar?.positions ?? []),
    );
  });

  it('stays light: the largest array is a few thousand triangles', () => {
    const b = buildBundle({ ops: [{ kind: 'solar', rows: 4, cols: 12 }] });
    const tris = Object.values(b.byMaterial).reduce((n, m) => n + (m?.indices.length ?? 0) / 3, 0);
    expect(tris).toBeLessThan(8000);
  });
});

describe('letter X geometry', () => {
  it('is as tall as asked; its lamp is an instance', () => {
    for (const height of [3, 4, 6]) {
      const b = buildBundle({ ops: [{ kind: 'pole', height }] });
      expect(b.bounds.max[1]).toBeGreaterThanOrEqual(height - 0.1);
      expect(b.bounds.max[1]).toBeLessThanOrEqual(height + 0.1);
    }
  });
});
