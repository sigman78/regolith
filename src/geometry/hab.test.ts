import { describe, expect, it } from 'vitest';
import { H } from '@/grammar/parts/H';
import { buildBundle, clearBundleCache } from './build';
import { HAB_LENGTH, HAB_RADII, HAB_STRIPE_FROM_END, HAB_STRIPE_HALF } from './design-constants';
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
        expect(Object.keys(bundle.byMaterial).sort()).toEqual([
          'accent',
          'glass',
          'graphite',
          'hull',
        ]);
      }
    }
  });

  it('puts window panes proud of the hull, on both flanks, never under the stripe', () => {
    for (const length of lengths) {
      for (const radius of HAB_RADII) {
        const { bundle } = hullBundle(length, radius);
        const glass = bundle.byMaterial.glass;
        expect(glass).toBeTruthy();
        if (!glass) return;
        let minR = Infinity;
        let seenPlus = false;
        let seenMinus = false;
        const stripeX = length / 2 - HAB_STRIPE_FROM_END;
        for (let i = 0; i < glass.positions.length; i += 3) {
          const x = glass.positions[i] ?? 0;
          const y = glass.positions[i + 1] ?? 0;
          const z = glass.positions[i + 2] ?? 0;
          minR = Math.min(minR, Math.hypot(y, z));
          if (z > 0) seenPlus = true;
          if (z < 0) seenMinus = true;
          expect(Math.abs(x - stripeX)).toBeGreaterThan(HAB_STRIPE_HALF);
        }
        // No pane face lies on the hull: every vertex is at least the pane's inset off it
        // or clearly proud (the back face is buried, the front face stands 2 cm off).
        expect(minR).toBeGreaterThan(radius - 0.1);
        expect(seenPlus && seenMinus).toBe(true);
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
            // a door on the floor, in the plan position of the flank; the hull is a little behind
            // it (stage 2's stub closes the gap)
            expect(port.position[1]).toBeCloseTo(H.floor?.(p) ?? NaN, 9);
            expect(Math.abs(port.position[2])).toBeCloseTo(radius, 9);
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

describe('hab stripe variants', () => {
  const p = H.resolve({ length: 10, radius: 2 });
  const variant = (v: number) => buildBundle(H.geometry(p, { seed: 't', variant: v }));
  const meanX = (b: ReturnType<typeof variant>, material: 'accent' | 'graphite'): number => {
    // The hab lies along local +x after layDown; compare along its axis.
    const pos = b.byMaterial[material]?.positions ?? new Float32Array(0);
    let sum = 0;
    for (let i = 0; i < pos.length; i += 3) sum += pos[i] ?? 0;
    return sum / Math.max(1, pos.length / 3);
  };

  it('keeps variant 0 as the plain recipe and gives each variant its own bundle', () => {
    expect(H.geometry(p, { seed: 't' })).toEqual(H.geometry(p, { seed: 't', variant: 0 }));
    expect(new Set([0, 1, 2].map((v) => variant(v).hash)).size).toBe(3);
    for (const v of [0, 1, 2]) expect(() => assertValidBundle(variant(v))).not.toThrow();
  });

  it('puts the stripe at the other end for 1 and in graphite instead of accent for 2', () => {
    expect(meanX(variant(0), 'accent')).toBeGreaterThan(1);
    expect(meanX(variant(1), 'accent')).toBeLessThan(-1);
    expect(variant(2).byMaterial.accent).toBeUndefined();
    expect(variant(0).byMaterial.accent).toBeDefined();
  });
});
