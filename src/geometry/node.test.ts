import { describe, expect, it } from 'vitest';
import { N } from '@/grammar/parts/N';
import { buildBundle } from './build';
import { NODE_RADII } from './design-constants';
import { assertValidBundle } from './validate';

describe('node geometry', () => {
  it('is valid and spans exactly the sphere, for every size', () => {
    for (const size of NODE_RADII) {
      const p = N.resolve({ size });
      const bundle = buildBundle(N.geometry(p, { seed: 't' }));
      expect(() => assertValidBundle(bundle)).not.toThrow();
      const hull = bundle.byMaterial.hull;
      expect(hull).toBeTruthy();
      let maxR = 0;
      for (let i = 0; i < (hull?.positions.length ?? 0); i += 3) {
        const q = hull?.positions;
        maxR = Math.max(maxR, Math.hypot(q?.[i] ?? 0, q?.[i + 1] ?? 0, q?.[i + 2] ?? 0));
      }
      expect(maxR).toBeCloseTo(size, 4);
    }
  });

  it('puts every port on the shell', () => {
    for (const size of NODE_RADII) {
      for (const port of N.ports(N.resolve({ size }))) {
        expect(Math.hypot(...port.position)).toBeCloseTo(size, 9);
      }
    }
  });

  it('wears a collar at each PRESS port: graphite reaches past the shell on every axis', () => {
    const size = 2;
    const g = buildBundle(N.geometry(N.resolve({ size }), { seed: 't' })).byMaterial.graphite;
    const reach = [0, 0, 0, 0, 0, 0]; // +x -x +z -z +y -y
    for (let i = 0; i < (g?.positions.length ?? 0); i += 3) {
      const [x = 0, y = 0, z = 0] = [g?.positions[i], g?.positions[i + 1], g?.positions[i + 2]];
      reach[0] = Math.max(reach[0] ?? 0, x);
      reach[1] = Math.max(reach[1] ?? 0, -x);
      reach[2] = Math.max(reach[2] ?? 0, z);
      reach[3] = Math.max(reach[3] ?? 0, -z);
      reach[4] = Math.max(reach[4] ?? 0, y);
      reach[5] = Math.max(reach[5] ?? 0, -y);
    }
    for (const r of reach.slice(0, 5)) expect(r).toBeGreaterThan(size);
    expect(reach[5]).toBeLessThanOrEqual(size); // no collar under the sphere
  });
});
