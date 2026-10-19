import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/core/math';
import { allParts } from '@/grammar/registry';
import { paramSets } from '@/grammar/params';
import { stubOps } from '@/grammar/stubs';
import { buildBundle } from './build';
import {
  AIRLOCK_STAIR_RISERS,
  AIRLOCK_STAIR_RUN,
  CORRIDOR_HALF_WIDTH,
  DECK_HEIGHT,
  DOOR_FRAME_PROUD,
  DOOR_H,
  DOOR_SILL,
  DOOR_W,
  FLOOR_ABOVE_BELLY,
  LEG_MIN_CLEARANCE,
  STUB_PROUD,
} from './design-constants';
import { assertValidBundle } from './validate';

const extent = (p: Float32Array | undefined, axis: number): [number, number] => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = axis; i < (p?.length ?? 0); i += 3) {
    lo = Math.min(lo, p?.[i] ?? 0);
    hi = Math.max(hi, p?.[i] ?? 0);
  }
  return [lo, hi];
};

describe('stub geometry', () => {
  const at: Vec3 = [4, 1.5, 0];
  const b = buildBundle({ ops: [{ kind: 'stub', at, normal: [1, 0, 0], depth: 0.8 }] });

  it('is valid, runs from the depth to the port, and is STUB_PROUD wider than a corridor', () => {
    expect(() => assertValidBundle(b)).not.toThrow();
    const [x0, x1] = extent(b.byMaterial.hull?.positions, 0);
    expect(x0).toBeCloseTo(4 - 0.8, 5);
    expect(x1).toBeCloseTo(4, 5);
    const [z0, z1] = extent(b.byMaterial.hull?.positions, 2);
    expect(z1).toBeCloseTo(CORRIDOR_HALF_WIDTH + STUB_PROUD, 5);
    expect(z0).toBeCloseTo(-CORRIDOR_HALF_WIDTH - STUB_PROUD, 5);
  });

  it('carries a door on its face: frame proud of the port plane, leaf DOOR_W by DOOR_H from the sill', () => {
    const [, gx] = extent(b.byMaterial.graphite?.positions, 0);
    expect(gx).toBeCloseTo(4 + DOOR_FRAME_PROUD, 5);
    const [y0, y1] = extent(b.byMaterial.accent?.positions, 1);
    expect(y0).toBeCloseTo(1.5 + DOOR_SILL, 5);
    expect(y1).toBeCloseTo(1.5 + DOOR_SILL + DOOR_H, 5);
    const [z0, z1] = extent(b.byMaterial.accent?.positions, 2);
    expect(z1 - z0).toBeCloseTo(DOOR_W, 5);
  });

  it('faces any horizontal way', () => {
    for (const normal of [
      [0, 0, 1],
      [-1, 0, 0],
      [Math.SQRT1_2, 0, Math.SQRT1_2],
    ] as Vec3[]) {
      const g = buildBundle({ ops: [{ kind: 'stub', at: [0, 0, 0], normal, depth: 0.6 }] });
      expect(() => assertValidBundle(g)).not.toThrow();
      // The frame's farthest point along the normal is the proud face.
      const p = g.byMaterial.graphite?.positions ?? new Float32Array();
      let far = -Infinity;
      for (let i = 0; i < p.length; i += 3) {
        far = Math.max(far, (p[i] ?? 0) * normal[0] + (p[i + 2] ?? 0) * normal[2]);
      }
      expect(far).toBeCloseTo(DOOR_FRAME_PROUD, 5);
    }
  });

  it('builds a valid bundle for every letter with its stubs on', () => {
    for (const def of allParts()) {
      for (const raw of paramSets(def.schema)) {
        const p = def.resolve(raw);
        const stubs = stubOps(def, p);
        if (stubs.length === 0) continue;
        const recipe = { ops: [...def.geometry(p, { seed: 't' }).ops, ...stubs] };
        expect(() => assertValidBundle(buildBundle(recipe))).not.toThrow();
      }
    }
  });
});

describe('airlock stair', () => {
  const r = 2;
  const b = buildBundle({ ops: [{ kind: 'airlock', radius: r, length: 2.4 }] });
  const floor = FLOOR_ABOVE_BELLY - r;
  const ground = -r - LEG_MIN_CLEARANCE;

  it('steps DECK_HEIGHT down from the sill to the ground over the run, a hazard nose on every tread', () => {
    expect(() => assertValidBundle(b)).not.toThrow();
    expect(floor - ground).toBeCloseTo(DECK_HEIGHT, 9);
    const [z0, z1] = extent(b.byMaterial.warning?.positions, 2);
    expect(z0).toBeGreaterThan(r);
    expect(z1).toBeLessThanOrEqual(r + AIRLOCK_STAIR_RUN + 1e-6);
    // One nose strip per tread, the last on the landing pad at the ground: each a riser down from
    // the one before, so the strips span RISERS - 1 risers.
    const tops = new Set<number>();
    const w = b.byMaterial.warning?.positions ?? new Float32Array();
    for (let i = 1; i < w.length; i += 3) tops.add(Math.round((w[i] ?? 0) * 1000) / 1000);
    const riser = DECK_HEIGHT / AIRLOCK_STAIR_RISERS;
    const distinct = [...tops].sort((a, c) => c - a);
    expect(distinct.length).toBeGreaterThanOrEqual(AIRLOCK_STAIR_RISERS);
    expect(Math.max(...distinct)).toBeLessThan(floor);
    expect(Math.min(...distinct)).toBeGreaterThan(ground);
    expect(Math.max(...distinct) - Math.min(...distinct)).toBeCloseTo(
      riser * (AIRLOCK_STAIR_RISERS - 1),
      1,
    );
  });

  it('has its door on the flank at the floor, with no glass', () => {
    const [y0] = extent(b.byMaterial.accent?.positions, 1);
    expect(y0).toBeCloseTo(floor + DOOR_SILL, 5);
    expect(b.byMaterial.glass).toBeUndefined();
  });
});
