import { describe, expect, it } from 'vitest';
import { getPart } from '@/grammar/registry';
import { buildBundle, clearBundleCache } from './build';
import { DUST_HEIGHT } from './design-constants';
import { bakeTints, tintDust, tintUnderside } from './tint';

describe('tintUnderside', () => {
  it('is neutral on a high up-facing surface and darkest straight down', () => {
    expect(tintUnderside(1, 5)).toEqual([1, 1, 1]);
    const down = tintUnderside(-1, 5);
    const side = tintUnderside(0, 5);
    for (let c = 0; c < 3; c++) {
      expect(down[c]).toBeLessThan(side[c] ?? 0);
      expect(side[c]).toBeLessThanOrEqual(1);
    }
  });

  it('darkens the lowest part of a module a little', () => {
    const grounded = tintUnderside(1, 0);
    expect(grounded[0]).toBeLessThan(1);
    expect(grounded[0]).toBeGreaterThan(0.7);
  });
});

describe('tintDust', () => {
  it('only reaches the lowest part of a module', () => {
    expect(tintDust(1, 0, 0, DUST_HEIGHT + 0.1)).toEqual([1, 1, 1]);
    expect(tintDust(1, 0, 0, 0)[2]).toBeLessThan(1);
  });

  it('is thicker on the windward side than on the lee side', () => {
    const wind = [Math.cos((215 * Math.PI) / 180), Math.sin((215 * Math.PI) / 180)];
    const toward = tintDust(wind[0] ?? 0, 0, wind[1] ?? 0, 0);
    const away = tintDust(-(wind[0] ?? 0), 0, -(wind[1] ?? 0), 0);
    expect(toward[2]).toBeLessThan(away[2] ?? 1);
  });
});

describe('bakeTints', () => {
  it('leaves glass untouched and stays in 0..1 for everything else', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0.2, 0, 0, 3, 1]);
    const normals = new Float32Array([0, -1, 0, 1, 0, 0, 0, 1, 0]);
    expect([...bakeTints('glass', positions, normals)].every((v) => v === 1)).toBe(true);
    for (const v of bakeTints('hull', positions, normals)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('gives a built hab a colour per vertex, identical on every build', () => {
    const H = getPart('H');
    if (!H) throw new Error('H is not registered');
    const recipe = H.geometry(H.resolve({}), { seed: 't' });
    const a = buildBundle(recipe);
    clearBundleCache();
    const b = buildBundle(recipe);
    expect(a).not.toBe(b);
    for (const [name, buf] of Object.entries(a.byMaterial)) {
      expect(buf.colors.length).toBe(buf.positions.length);
      const other = b.byMaterial[name as keyof typeof b.byMaterial];
      expect(other?.colors).toEqual(buf.colors);
    }
    expect(a.hash).toBe(b.hash);
  });
});
