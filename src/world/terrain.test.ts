import { describe, expect, it } from 'vitest';
import { generateTerrain, heightAt } from './terrain';

describe('terrain', () => {
  it('is deterministic for a given seed', () => {
    const a = generateTerrain({ seed: 'test', size: 16 });
    const b = generateTerrain({ seed: 'test', size: 16 });
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
  });

  it('differs between seeds', () => {
    const a = generateTerrain({ seed: 'one', size: 16 });
    const b = generateTerrain({ seed: 'two', size: 16 });
    expect(Array.from(a.heights)).not.toEqual(Array.from(b.heights));
  });

  it('samples heights bilinearly within the grid', () => {
    const hf = generateTerrain({ seed: 'test', size: 16 });
    const h = heightAt(hf, 0.5, 0.5);
    expect(Number.isFinite(h)).toBe(true);
    // Corner sample matches the raw grid value exactly.
    const half = (hf.size * hf.cell) / 2;
    expect(heightAt(hf, -half, -half)).toBeCloseTo(hf.heights[0] ?? NaN, 5);
  });
});
