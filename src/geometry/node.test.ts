import { describe, expect, it } from 'vitest';
import { N } from '@/grammar/parts/N';
import { stubOps } from '@/grammar/stubs';
import { STUB_HALF_WIDTH, STUB_TOP } from '@/grammar/stub-depth';
import { buildBundle } from './build';
import { DOOR_FRAME_PROUD, NODE_RADII } from './design-constants';
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

  it('puts the hatch and feet on the shell, and the doors on the floor under the equator', () => {
    for (const size of NODE_RADII) {
      const p = N.resolve({ size });
      const floor = N.floor?.(p) ?? NaN;
      for (const port of N.ports(p)) {
        if (port.type === 'PRESS' && port.normal[1] === 0) {
          expect(port.position[1]).toBeCloseTo(floor, 9);
          expect(Math.hypot(port.position[0], port.position[2])).toBeCloseTo(size, 9);
        } else {
          expect(Math.hypot(...port.position)).toBeCloseTo(size, 9);
        }
      }
    }
  });

  it('with its stubs on, wears a door frame at each side port and a hatch ring on top', () => {
    const size = 2;
    const p = N.resolve({ size });
    const recipe = { ops: [...N.geometry(p, { seed: 't' }).ops, ...stubOps(N, p)] };
    const b = buildBundle(recipe);
    expect(() => assertValidBundle(b)).not.toThrow();
    const g = b.byMaterial.graphite;
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
    for (const r of reach.slice(0, 4)) expect(r).toBeCloseTo(size + DOOR_FRAME_PROUD, 4);
    expect(reach[4]).toBeGreaterThan(size); // the hatch ring
    expect(reach[5]).toBeLessThanOrEqual(size); // nothing under the sphere
    // The stub faces are flat plates tangent at the equator: the hull reaches their corners and no further.
    const hull = b.byMaterial.hull?.positions ?? new Float32Array();
    const floor = N.floor?.(p) ?? NaN;
    const cornerR = Math.hypot(size, STUB_HALF_WIDTH, floor + STUB_TOP);
    let maxR = 0;
    for (let i = 0; i < hull.length; i += 3) {
      maxR = Math.max(maxR, Math.hypot(hull[i] ?? 0, hull[i + 1] ?? 0, hull[i + 2] ?? 0));
    }
    expect(maxR).toBeLessThanOrEqual(cornerR + 1e-6);
    expect(maxR).toBeGreaterThan(size);
  });
});
