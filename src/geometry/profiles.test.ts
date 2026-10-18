import { describe, expect, it } from 'vitest';
import { BundleBuilder } from './bundle';
import { bevelBox, bevelCylinder, rod } from './profiles';
import { assertValidBundle } from './validate';

describe('profile helpers', () => {
  it('bevelBox sits on y = 0, centred in X and Z, and is valid', () => {
    const out = new BundleBuilder();
    out.add('hull', bevelBox(4, 1, 2));
    const b = out.build('t');
    expect(() => assertValidBundle(b)).not.toThrow();
    expect(b.bounds.min[0]).toBeCloseTo(-2, 6);
    expect(b.bounds.max[0]).toBeCloseTo(2, 6);
    expect(b.bounds.min[1]).toBeCloseTo(0, 6);
    expect(b.bounds.max[1]).toBeCloseTo(1, 6);
    expect(b.bounds.max[2]).toBeCloseTo(1, 6);
  });

  it('bevelCylinder stands on y = 0 and is valid', () => {
    const out = new BundleBuilder();
    out.add('hull', bevelCylinder(1.5, 3, 24));
    const b = out.build('t');
    expect(() => assertValidBundle(b)).not.toThrow();
    expect(b.bounds.min[1]).toBeCloseTo(0, 6);
    expect(b.bounds.max[1]).toBeCloseTo(3, 6);
    expect(b.bounds.max[0]).toBeCloseTo(1.5, 2);
  });

  it('rod spans exactly its two end points along its axis', () => {
    const out = new BundleBuilder();
    out.add('aluminum', rod([0, 0, 0], [0, 4, 0], 0.05, 6));
    const b = out.build('t');
    expect(() => assertValidBundle(b)).not.toThrow();
    expect(b.bounds.min[1]).toBeCloseTo(0, 5);
    expect(b.bounds.max[1]).toBeCloseTo(4, 5);

    const slanted = new BundleBuilder();
    slanted.add('aluminum', rod([1, 0, 0], [4, 4, 0], 0.05, 6));
    const s = slanted.build('t');
    expect(() => assertValidBundle(s)).not.toThrow();
    expect(s.bounds.max[1]).toBeGreaterThanOrEqual(4 - 1e-6);
    expect(s.bounds.max[1]).toBeLessThan(4.1);
  });
});
