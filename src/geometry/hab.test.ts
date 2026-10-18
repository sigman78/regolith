import { describe, expect, it } from 'vitest';
import { H } from '@/grammar/parts/H';
import { buildBundle, clearBundleCache } from './build';
import { HAB_LENGTH, HAB_RADII } from './design-constants';
import { assertValidBundle } from './validate';

const lengths: number[] = [];
for (let l: number = HAB_LENGTH.min; l <= HAB_LENGTH.max; l += HAB_LENGTH.step) lengths.push(l);

function hullBundle(length: number, radius: number) {
  const p = H.resolve({ length, radius });
  return { p, bundle: buildBundle(H.geometry(p, { seed: 't' })) };
}

describe('hab geometry', () => {
  it('produces valid bundles for every length and radius', () => {
    for (const length of lengths) {
      for (const radius of HAB_RADII) {
        const { bundle } = hullBundle(length, radius);
        expect(() => assertValidBundle(bundle)).not.toThrow();
        expect(Object.keys(bundle.byMaterial).sort()).toEqual(['accent', 'graphite', 'hull']);
      }
    }
  });

  it('is deterministic: same params, same bytes', () => {
    const a = hullBundle(8, 2).bundle;
    clearBundleCache();
    const b = hullBundle(8, 2).bundle;
    expect(a).not.toBe(b);
    expect(a.hash).toBe(b.hash);
    expect(Array.from(a.byMaterial.hull?.positions ?? [])).toEqual(
      Array.from(b.byMaterial.hull?.positions ?? []),
    );
  });

  it('bounds match the ports: the hull spans exactly the end-cap apexes', () => {
    for (const length of lengths) {
      for (const radius of HAB_RADII) {
        const { p, bundle } = hullBundle(length, radius);
        const ports = H.ports(p);
        const endPlus = ports.find((q) => q.id === 'end+');
        const endMinus = ports.find((q) => q.id === 'end-');
        const hull = bundle.byMaterial.hull;
        expect(endPlus && endMinus && hull).toBeTruthy();
        if (!endPlus || !endMinus || !hull) return;
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < hull.positions.length; i += 3) {
          minX = Math.min(minX, hull.positions[i] ?? 0);
          maxX = Math.max(maxX, hull.positions[i] ?? 0);
        }
        expect(maxX).toBeCloseTo(endPlus.position[0], 4);
        expect(minX).toBeCloseTo(endMinus.position[0], 4);
      }
    }
  });

  it('puts side and foot ports on the hull surface', () => {
    for (const length of lengths) {
      for (const radius of HAB_RADII) {
        const { p } = hullBundle(length, radius);
        for (const port of H.ports(p)) {
          if (port.type === 'PRESS' && port.id.startsWith('side')) {
            // on the cylinder section, at the radius
            expect(Math.hypot(port.position[1], port.position[2])).toBeCloseTo(radius, 6);
            expect(Math.abs(port.position[0])).toBeLessThan(length / 2);
          }
          if (port.type === 'STRUCT') {
            expect(Math.hypot(port.position[1], port.position[2])).toBeCloseTo(radius, 6);
            expect(port.position[1]).toBeCloseTo(-radius, 6);
          }
        }
      }
    }
  });
});
