import { describe, expect, it } from 'vitest';
import { hashValue } from '@/core/hash';
import {
  BOULDER_CAP,
  BOULDER_MAX_SLOPE_DEG,
  BOULDER_MIN_SIZE,
  ROCK_CAP,
  ROCK_MAX_SIZE,
  ROCK_MIN_SIZE,
  ROCK_VARIANTS,
} from '@/geometry/design-constants';
import { cullScatter, scatterCandidates, SCATTER_STRIDE } from './scatter';
import { generateTerrain, heightAt } from './terrain';

const hf = generateTerrain({ seed: 'olympus-07' });

function rows(set: ReturnType<typeof scatterCandidates>): number[][] {
  const out: number[][] = [];
  for (let n = 0; n < set.count; n++) {
    out.push([...set.data.subarray(n * SCATTER_STRIDE, (n + 1) * SCATTER_STRIDE)]);
  }
  return out;
}

describe('scatterCandidates', () => {
  it('is deterministic: same seed and terrain, same bytes', () => {
    const a = scatterCandidates(hf, 'olympus-07');
    const b = scatterCandidates(generateTerrain({ seed: 'olympus-07' }), 'olympus-07');
    expect(hashValue([...a.data])).toBe(hashValue([...b.data]));
    expect(hashValue([...a.data])).not.toBe(
      hashValue([...scatterCandidates(hf, 'another-seed').data]),
    );
  });

  it('keeps to the caps, the size range and the variants', () => {
    const set = scatterCandidates(hf, 'olympus-07');
    expect(set.count).toBeGreaterThan(300);
    expect(set.count).toBeLessThanOrEqual(ROCK_CAP);
    let boulders = 0;
    for (const r of rows(set)) {
      const size = r[3] ?? 0;
      expect(size).toBeGreaterThanOrEqual(ROCK_MIN_SIZE - 1e-6);
      expect(size).toBeLessThanOrEqual(ROCK_MAX_SIZE + 1e-6);
      expect(r[5]).toBeLessThan(ROCK_VARIANTS);
      if (size > BOULDER_MIN_SIZE) boulders++;
    }
    expect(boulders).toBeLessThanOrEqual(BOULDER_CAP);
  });

  it('is mostly small rocks (a power law, not a uniform spread)', () => {
    const sizes = rows(scatterCandidates(hf, 'olympus-07')).map((r) => r[3] ?? 0);
    const small = sizes.filter((s) => s < 0.5).length;
    expect(small / sizes.length).toBeGreaterThan(0.5);
  });

  it('sits every rock on the terrain, sunk into it, and keeps boulders off steep ground', () => {
    for (const r of rows(scatterCandidates(hf, 'olympus-07'))) {
      const [x = 0, y = 0, z = 0, size = 0] = r;
      const ground = heightAt(hf, x, z);
      // The origin is at or below the terrain under the rock's centre and not absurdly deep.
      expect(y).toBeLessThanOrEqual(ground + 1e-4);
      expect(ground - y).toBeLessThan(size + 1.5);
      if (size > BOULDER_MIN_SIZE) {
        const e = Math.max(0.3, size * 0.5);
        const slope =
          Math.atan(
            Math.hypot(
              heightAt(hf, x + e, z) - heightAt(hf, x - e, z),
              heightAt(hf, x, z + e) - heightAt(hf, x, z - e),
            ) /
              (2 * e),
          ) *
          (180 / Math.PI);
        expect(slope).toBeLessThanOrEqual(BOULDER_MAX_SLOPE_DEG + 1e-6);
      }
    }
  });

  it('a terrain edit changes only the rocks it touches', () => {
    const before = scatterCandidates(hf, 'olympus-07');
    const edited = { ...hf, heights: Float32Array.from(hf.heights) };
    const n = hf.size + 1;
    // Raise a 10 m patch around (-30, -30).
    const half = (hf.size * hf.cell) / 2;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = i * hf.cell - half;
        const z = j * hf.cell - half;
        if (Math.hypot(x + 30, z + 30) < 5)
          edited.heights[j * n + i] = (edited.heights[j * n + i] ?? 0) + 3;
      }
    }
    const after = scatterCandidates(edited, 'olympus-07');
    const byId = new Map(rows(after).map((r) => [r[7], r]));
    for (const r of rows(before)) {
      const [x = 0, , z = 0] = r;
      if (Math.hypot(x + 30, z + 30) < 9) continue; // inside or beside the patch
      expect(byId.get(r[7])).toEqual(r);
    }
  });
});

describe('scatter cost', () => {
  it('generates and culls well inside the frame budget (loose bound; numbers in docs/PERF.md)', () => {
    const t0 = performance.now();
    const set = scatterCandidates(hf, 'olympus-07');
    const t1 = performance.now();
    cullScatter(set, new Uint8Array(96 * 96), 96);
    const t2 = performance.now();
    expect(t1 - t0).toBeLessThan(250);
    expect(t2 - t1).toBeLessThan(50);
  });
});

describe('cullScatter', () => {
  it('drops rocks on blocked cells and keeps the rest untouched', () => {
    const set = scatterCandidates(hf, 'olympus-07');
    const size = 96;
    const mask = new Uint8Array(size * size);
    // Block the middle 20 m square.
    for (let j = 38; j < 58; j++) for (let i = 38; i < 58; i++) mask[j * size + i] = 1;
    const culled = cullScatter(set, mask, size);
    expect(culled.count).toBeLessThan(set.count);
    for (const r of rows(culled)) {
      const [x = 0, , z = 0] = r;
      expect(Math.abs(x) <= 10 && Math.abs(z) <= 10).toBe(false);
    }
    const kept = new Set(rows(culled).map((r) => r[7]));
    for (const r of rows(set)) {
      const inside = Math.abs(r[0] ?? 0) < 9 && Math.abs(r[2] ?? 0) < 9;
      if (!inside && Math.abs(r[0] ?? 0) > 12 && Math.abs(r[2] ?? 0) > 12) {
        expect(kept.has(r[7])).toBe(true);
      }
    }
  });
});
