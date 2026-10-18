import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { snapYaw } from '@/core/math';
import { FOOT_SINK, LEG_MIN_CLEARANCE } from '@/geometry/design-constants';
import { addPart, createDocument, type BaseDocument } from '@/world/document';
import { generateTerrain, heightAt } from '@/world/terrain';
import { habHalfExtent, type HabParams } from '../parts/H';
import { polygonGap, rectCorners } from '../footprint';
import { solve, type SolverWorld } from './index';

function worldFor(seed: string, size = 96): SolverWorld {
  const hf = generateTerrain({ seed, size });
  return { halfSize: size / 2, heightAt: (x, z) => heightAt(hf, x, z) };
}

function randomBase(seed: number, count: number, extent: number): BaseDocument {
  const rng = new Rng(seed);
  let doc = createDocument({ seed: `s${seed}` });
  for (let i = 0; i < count; i++) {
    doc = addPart(doc, {
      id: `p${i}`,
      letter: 'H',
      params: { length: rng.int(2, 8) * 2, radius: rng.pick([2, 3]) },
      pose: {
        x: rng.range(-extent, extent),
        z: rng.range(-extent, extent),
        yaw: snapYaw(rng.int(0, 7) * 45),
      },
    });
  }
  return doc;
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('solver: nothing floats', () => {
  it('gives every STRUCT port a leg that ends in the terrain', () => {
    for (const seed of SEEDS) {
      const world = worldFor(`t${seed}`);
      const base = solve(randomBase(seed, 12, 30), world);
      for (const part of base.parts.values()) {
        const structs = part.ports.filter((p) => p.type === 'STRUCT');
        expect(part.legs).toHaveLength(structs.length);
        expect(structs.length).toBeGreaterThan(0);
        for (const leg of part.legs) {
          const port = structs.find((p) => p.id === leg.portId);
          expect(port?.position).toEqual(leg.top);
          expect(leg.bottom[1]).toBeCloseTo(
            (base.terrain?.heightAt ?? world.heightAt)(leg.bottom[0], leg.bottom[2]) - FOOT_SINK,
            9,
          );
          expect(leg.top[1] - leg.bottom[1]).toBeGreaterThanOrEqual(
            LEG_MIN_CLEARANCE + FOOT_SINK - 1e-9,
          );
        }
      }
    }
  });

  it('keeps the hull belly above the terrain along the whole axis', () => {
    for (const seed of SEEDS) {
      const world = worldFor(`t${seed}`);
      const base = solve(randomBase(seed, 12, 30), world);
      for (const part of base.parts.values()) {
        const p = part.params as HabParams;
        const ext = habHalfExtent(p);
        const yaw = (part.pose.yaw * Math.PI) / 180;
        for (let s = -ext; s <= ext; s += 0.25) {
          const x = part.pose.x + s * Math.cos(yaw);
          const z = part.pose.z - s * Math.sin(yaw);
          expect(part.pose.y - p.radius).toBeGreaterThan(
            (base.terrain?.heightAt ?? world.heightAt)(x, z),
          );
        }
      }
    }
  });
});

describe('solver: hulls never intersect', () => {
  it('keeps every pair of hulls at least 10 cm apart, even from a pile-up', () => {
    for (const seed of SEEDS) {
      const world = worldFor(`t${seed}`);
      // Everything requested inside a 12 m square: heavy overlap on purpose.
      const base = solve(randomBase(seed, 10, 6), world);
      const parts = [...base.parts.values()];
      expect(base.diagnostics.filter((d) => d.kind === 'unplaceable')).toEqual([]);
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i];
          const b = parts[j];
          if (!a || !b) continue;
          const pa = a.params as HabParams;
          const pb = b.params as HabParams;
          const gap = polygonGap(
            rectCorners(habHalfExtent(pa), pa.radius, a.pose),
            rectCorners(habHalfExtent(pb), pb.radius, b.pose),
          );
          expect(gap).toBeGreaterThanOrEqual(0.1);
        }
      }
    }
  });

  it('lets the moving part yield, older parts keep their spots', () => {
    const world = worldFor('move');
    let doc = createDocument({ seed: 'move' });
    doc = addPart(doc, { id: 'old', letter: 'H', pose: { x: 0, z: 0, yaw: 0 } });
    doc = addPart(doc, { id: 'new', letter: 'H', pose: { x: 0, z: 0, yaw: 0 } });

    const a = solve(doc, world);
    expect(a.parts.get('old')?.pose.x).toBe(0);
    expect(a.parts.get('new')?.pose).not.toMatchObject({ x: 0, z: 0 });

    // Dragging the old part: it is placed last and yields instead.
    const b = solve(doc, world, { movingId: 'old' });
    expect(b.parts.get('new')?.pose).toMatchObject({ x: 0, z: 0 });
    expect(b.parts.get('old')?.pose).not.toMatchObject({ x: 0, z: 0 });
    expect(b.diagnostics.some((d) => d.kind === 'moved' && d.part === 'old')).toBe(true);
  });
});

describe('solver: resolves instead of rejecting (P1)', () => {
  it('snaps, clamps and survives garbage input', () => {
    const world = worldFor('garbage');
    let doc = createDocument({ seed: 'garbage' });
    doc = addPart(doc, {
      id: 'wild',
      letter: 'H',
      params: { length: 999, radius: -4 },
      pose: { x: 1e6, z: -1e6, yaw: 33 as never },
    });
    doc = addPart(doc, {
      id: 'nan',
      letter: 'H',
      params: { length: Number.NaN },
      pose: { x: Number.NaN, z: 0, yaw: 0 },
    });
    const base = solve(doc, world);
    for (const part of base.parts.values()) {
      expect(Number.isFinite(part.pose.x + part.pose.y + part.pose.z)).toBe(true);
      expect(Math.abs(part.pose.x)).toBeLessThanOrEqual(world.halfSize);
      expect(Math.abs(part.pose.z)).toBeLessThanOrEqual(world.halfSize);
      expect(part.pose.yaw % 45).toBe(0);
    }
    expect((base.parts.get('wild')?.params as HabParams).length).toBe(16);
    expect((base.parts.get('wild')?.params as HabParams).radius).toBe(2);
  });

  it('reports unknown letters instead of throwing', () => {
    const world = worldFor('unknown');
    let doc = createDocument({ seed: 'unknown' });
    doc = addPart(doc, { id: 'x', letter: 'B', pose: { x: 0, z: 0, yaw: 0 } });
    const base = solve(doc, world);
    expect(base.parts.size).toBe(0);
    expect(base.diagnostics).toEqual([{ kind: 'unknown-letter', part: 'x', letter: 'B' }]);
  });
});

describe('solver: determinism and budget', () => {
  it('is a pure function of its input', () => {
    const world = worldFor('pure');
    const doc = randomBase(42, 15, 30);
    const a = solve(doc, world);
    const b = solve(doc, world);
    expect(JSON.stringify([...a.parts.values()])).toBe(JSON.stringify([...b.parts.values()]));
  });

  it('solves 200 parts within a loose budget (target is < 2 ms; see docs/PERF.md)', () => {
    const world = worldFor('perf', 320);
    const doc = randomBase(7, 200, 140);
    solve(doc, world); // warm up
    const t0 = performance.now();
    solve(doc, world);
    const ms = performance.now() - t0;
    console.info(`solver: 200 parts in ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(250);
  });
});
