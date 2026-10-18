import { describe, expect, it } from 'vitest';
import type { GeometryBundle } from './bundle';
import { validateBundle } from './validate';

function tri(indices: number[], normalZ = 1, x = 0): GeometryBundle {
  return {
    hash: 'test',
    bounds: { min: [0, 0, 0], max: [1, 1, 0] },
    byMaterial: {
      hull: {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, x, 1, 0]),
        normals: new Float32Array([0, 0, normalZ, 0, 0, normalZ, 0, 0, normalZ]),
        uvs: new Float32Array(6),
        indices: new Uint32Array(indices),
      },
    },
  };
}

describe('validateBundle', () => {
  it('accepts a counter-clockwise triangle facing +Z', () => {
    expect(validateBundle(tri([0, 1, 2]))).toEqual([]);
  });

  it('flags winding against the normals', () => {
    expect(validateBundle(tri([0, 2, 1])).join()).toMatch(/wound against/);
  });

  it('flags NaN positions', () => {
    const b = tri([0, 1, 2]);
    const hull = b.byMaterial.hull;
    if (hull) hull.positions[0] = NaN;
    expect(validateBundle(b).join()).toMatch(/non-finite/);
  });

  it('flags out-of-range indices and non-unit normals', () => {
    expect(validateBundle(tri([0, 1, 9])).join()).toMatch(/out of range/);
    expect(validateBundle(tri([0, 1, 2], 2)).join()).toMatch(/normal length/);
  });
});
