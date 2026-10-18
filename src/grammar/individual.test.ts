import { describe, expect, it } from 'vitest';
import { HAB_STRIPE_VARIANTS, INDIVIDUAL_TINT_MAX } from '@/geometry/design-constants';
import { individualOf } from './individual';

describe('individualOf', () => {
  it('is a pure function of letter, serial and seed', () => {
    expect(individualOf('H', 7, 'olympus')).toEqual(individualOf('H', 7, 'olympus'));
    expect(individualOf('H', 7, 'olympus')).not.toEqual(individualOf('H', 7, 'other'));
  });

  it('keeps tint and variant in range and spreads them over serials', () => {
    const variants = new Set<number>();
    const tints = new Set<number>();
    for (let serial = 1; serial <= 200; serial++) {
      const i = individualOf('H', serial, 'olympus');
      expect(i.variant).toBeGreaterThanOrEqual(0);
      expect(i.variant).toBeLessThan(HAB_STRIPE_VARIANTS);
      expect(i.tint).toBeGreaterThanOrEqual(0);
      expect(i.tint).toBeLessThanOrEqual(INDIVIDUAL_TINT_MAX);
      variants.add(i.variant);
      tints.add(Math.round(i.tint * 1000));
    }
    expect(variants.size).toBe(HAB_STRIPE_VARIANTS);
    expect(tints.size).toBeGreaterThan(100);
  });

  it('leaves solver-made parts and untinted letters alone', () => {
    expect(individualOf('N', 0, 'olympus')).toEqual({ variant: 0, tint: 0 });
    expect(individualOf('E', 5, 'olympus').tint).toBe(0);
    expect(individualOf('M', 5, 'olympus').tint).toBe(0);
  });
});
