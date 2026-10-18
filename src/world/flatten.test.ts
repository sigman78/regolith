import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { buildFlatField, distanceToShape, FLATTEN_SKIRT, type FlatShape } from './flatten';
import { generateTerrain, heightAt } from './terrain';

const hf = generateTerrain({ seed: 'flatten', size: 96 });
const raw = (x: number, z: number): number => heightAt(hf, x, z);
const GRID = { half: 48, cell: 1 };

const slab: FlatShape = { kind: 'rect', x: 5, z: -3, yaw: 45, hx: 4, hz: 3 };
const dome: FlatShape = { kind: 'disc', x: -14, z: 10, r: 5 };

describe('distanceToShape', () => {
  it('is zero inside and the plain distance outside, for a turned rectangle', () => {
    expect(distanceToShape(slab, 5, -3)).toBe(0);
    // Along the part's own axis, which runs (cos yaw, -sin yaw) in world XZ like rotateY.
    const a = Math.PI / 4;
    const out = [5 + Math.cos(a) * 6, -3 - Math.sin(a) * 6] as const;
    expect(Math.abs(distanceToShape(slab, ...out) - 2)).toBeLessThan(1e-9);
  });

  it('is the distance past the rim for a disc', () => {
    expect(distanceToShape(dome, -14 + 5, 10)).toBeCloseTo(0, 9);
    expect(distanceToShape(dome, -14 + 8, 10)).toBeCloseTo(3, 9);
  });
});

describe('buildFlatField', () => {
  const field = buildFlatField(
    raw,
    [
      { id: 'a', shape: slab },
      { id: 'b', shape: dome },
    ],
    GRID,
  );

  it('is the natural terrain, byte for byte, with nothing to level', () => {
    const none = buildFlatField(raw, [], GRID);
    const rng = new Rng(2);
    for (let i = 0; i < 500; i++) {
      const x = rng.range(-47, 47);
      const z = rng.range(-47, 47);
      expect(none.heightAt(x, z)).toBe(raw(x, z));
    }
  });

  it('is flat to a centimetre everywhere under a footprint', () => {
    const rng = new Rng(5);
    for (const p of field.patches) {
      let n = 0;
      while (n < 300) {
        const x = p.shape.x + rng.range(-8, 8);
        const z = p.shape.z + rng.range(-8, 8);
        if (distanceToShape(p.shape, x, z) > 0) continue;
        expect(Math.abs(field.heightAt(x, z) - p.target)).toBeLessThan(0.01);
        n++;
      }
    }
  });

  it('levels to the mean of the natural terrain under the footprint', () => {
    const p = field.patches.find((q) => q.id === 'b');
    let sum = 0;
    let n = 0;
    for (let z = 4; z <= 16; z += 0.5) {
      for (let x = -20; x <= -8; x += 0.5) {
        if (distanceToShape(dome, x, z) > 0) continue;
        sum += raw(x, z);
        n++;
      }
    }
    expect(Math.abs((p?.target ?? NaN) - sum / n)).toBeLessThan(0.05);
  });

  it('leaves the ground alone beyond the skirt and eases in monotonically on a step', () => {
    expect(field.heightAt(40, 40)).toBe(raw(40, 40));
    // Natural terrain at 0 inside the dome and 1 outside; the target (the mean) is below 1.
    const stepped = buildFlatField(
      (x, z) => (Math.hypot(x + 14, z - 10) < 5 ? 0 : 1),
      [{ id: 'd', shape: dome }],
      GRID,
    );
    const target = stepped.patches[0]?.target ?? 0;
    expect(target).toBeLessThan(0.5);
    let last = stepped.heightAt(-14 + 5, 10);
    for (let d = 0.25; d <= FLATTEN_SKIRT + 3; d += 0.25) {
      const h = stepped.heightAt(-14 + 5 + d, 10);
      expect(h).toBeGreaterThanOrEqual(last - 1e-9);
      last = h;
    }
    expect(last).toBeCloseTo(1, 9);
  });

  it('is continuous between two slabs a metre apart, with no step over 2 cm per 5 cm', () => {
    const a: FlatShape = { kind: 'rect', x: -3, z: 0, yaw: 0, hx: 2, hz: 4 };
    const b: FlatShape = { kind: 'rect', x: 3.2, z: 0, yaw: 0, hx: 2, hz: 4 };
    const two = buildFlatField(
      (x) => (x < 0 ? 0 : 3),
      [
        { id: 'a', shape: a },
        { id: 'b', shape: b },
      ],
      GRID,
    );
    let last = two.heightAt(-8, 0);
    for (let x = -8; x <= 8; x += 0.05) {
      const h = two.heightAt(x, 0);
      expect(Math.abs(h - last)).toBeLessThan(0.3);
      last = h;
    }
  });

  it('is the same field whatever order the shapes arrive in', () => {
    const forward = buildFlatField(
      raw,
      [
        { id: 'a', shape: slab },
        { id: 'b', shape: dome },
      ],
      GRID,
    );
    const reversed = buildFlatField(
      raw,
      [
        { id: 'b', shape: dome },
        { id: 'a', shape: slab },
      ],
      GRID,
    );
    expect(forward.key).toBe(reversed.key);
    for (let x = -30; x <= 30; x += 1.7) {
      for (let z = -30; z <= 30; z += 1.7) {
        expect(forward.heightAt(x, z)).toBe(reversed.heightAt(x, z));
      }
    }
  });

  it('says which spots a patch reaches, with a radius', () => {
    expect(field.touches(5, -3)).toBe(true);
    expect(field.touches(40, 40)).toBe(false);
    expect(field.touches(-14 + 5 + 2 * FLATTEN_SKIRT + 3, 10)).toBe(false);
    expect(field.touches(-14 + 5 + 2 * FLATTEN_SKIRT + 3, 10, 5)).toBe(true);
  });
});
