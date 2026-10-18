import { describe, expect, it } from 'vitest';
import { buildBundle } from './build';
import { ROCK_FLATTEN, ROCK_VARIANTS } from './design-constants';
import { assertValidBundle } from './validate';

describe('rock geometry', () => {
  it('is an 80-triangle lump resting on y = 0, valid and different per variant', () => {
    const hashes = new Set<string>();
    for (let variant = 0; variant < ROCK_VARIANTS; variant++) {
      const bundle = buildBundle({ ops: [{ kind: 'rock', variant }] });
      expect(() => assertValidBundle(bundle)).not.toThrow();
      const rock = bundle.byMaterial.rock;
      expect(rock?.indices.length).toBe(80 * 3);
      expect(bundle.bounds.min[1]).toBeCloseTo(0, 6);
      expect(bundle.bounds.max[1]).toBeGreaterThan(0.3);
      expect(bundle.bounds.max[1]).toBeLessThan(ROCK_FLATTEN * 1.4);
      expect(bundle.bounds.max[0] - bundle.bounds.min[0]).toBeLessThan(1.5);
      hashes.add(bundle.hash);
    }
    expect(hashes.size).toBe(ROCK_VARIANTS);
  });
});
