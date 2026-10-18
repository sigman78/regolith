import { describe, expect, it } from 'vitest';
import { allParts, getPart } from '@/grammar/registry';
import { poleLampFrame } from '@/grammar/lamps';
import type { ParamSchema, ParamValues } from '@/grammar/types';
import { buildBundle } from './build';
import {
  BEACON_LIFT,
  BEACON_RADIUS,
  HAB_RIB_THICK_END,
  POLE_ARM,
  POLE_HEIGHTS,
  RIB_SPACING,
} from './design-constants';

function paramSets(schema: ParamSchema): ParamValues[] {
  let sets: ParamValues[] = [{}];
  for (const [key, spec] of Object.entries(schema)) {
    const values: (number | boolean)[] =
      spec.kind === 'range'
        ? [spec.min, spec.default, spec.max]
        : spec.kind === 'choice'
          ? [...spec.options]
          : [false, true];
    sets = sets.flatMap((s) => values.map((v) => ({ ...s, [key]: v })));
  }
  return sets;
}

/** Highest vertex within `reach` metres (in plan) of the point. */
function topNear(positions: Float32Array[], x: number, z: number, reach: number): number {
  let top = -Infinity;
  for (const p of positions) {
    for (let i = 0; i < p.length; i += 3) {
      if (Math.hypot((p[i] ?? 0) - x, (p[i + 2] ?? 0) - z) < reach) {
        top = Math.max(top, p[i + 1] ?? -Infinity);
      }
    }
  }
  return top;
}

describe('beacon mounts', () => {
  it('rest on the hull: the surface under the ball is where the ball sinks to', () => {
    for (const letter of ['N', 'D', 'V', 'E'] as const) {
      const def = getPart(letter);
      if (!def?.beacon) throw new Error(`${letter} offers no beacon`);
      for (const raw of paramSets(def.schema)) {
        const p = def.resolve(raw);
        const [x, y, z] = def.beacon(p);
        const b = buildBundle(def.geometry(p, { seed: 's' }));
        const positions = Object.values(b.byMaterial).map(
          (m) => m?.positions ?? new Float32Array(),
        );
        const surface = topNear(positions, x, z, 0.3);
        expect(surface, `${letter} ${JSON.stringify(p)} at ${x},${z}`).toBeGreaterThan(-Infinity);
        expect(y - BEACON_LIFT * BEACON_RADIUS).toBeCloseTo(surface, 1);
      }
    }
  });

  it('sit at the tip of every mast head, inside its bounds', () => {
    const def = getPart('M');
    if (!def?.beacon) throw new Error('M offers no beacon');
    for (const raw of paramSets(def.schema)) {
      const p = def.resolve(raw);
      const b = buildBundle(def.geometry(p, { seed: 's' }));
      const [x, y, z] = def.beacon(p);
      expect(y + BEACON_RADIUS).toBeLessThanOrEqual(b.bounds.max[1] + 0.02);
      expect(y).toBeGreaterThan(Number(p['height']));
      const positions = Object.values(b.byMaterial).map((m) => m?.positions ?? new Float32Array());
      // The graphite ball of the same centre is drawn there: geometry reaches the ball's top.
      expect(topNear(positions, x, z, 0.05)).toBeGreaterThanOrEqual(y);
    }
  });

  it('are offered by the tall letters and no others', () => {
    const offering = allParts()
      .filter((d) => d.beacon)
      .map((d) => d.letter)
      .sort();
    expect(offering).toEqual(['D', 'E', 'H', 'M', 'N', 'V']);
  });
});

describe('hab beacon', () => {
  it('sits on the bare hull, in the middle of a gap between ribs', () => {
    const def = getPart('H');
    if (!def?.beacon) throw new Error('H offers no beacon');
    for (const raw of paramSets(def.schema)) {
      const p = def.resolve(raw);
      const length = Number(p['length']);
      const radius = Number(p['radius']);
      const [x, y, z] = def.beacon(p);
      expect(y).toBeCloseTo(radius + BEACON_LIFT * BEACON_RADIUS, 9);
      expect(z).toBe(0);
      const count = Math.max(1, Math.round(length / RIB_SPACING));
      for (let i = 0; i <= count; i++) {
        const rib = -length / 2 + (length * i) / count;
        expect(Math.abs(x - rib)).toBeGreaterThan(HAB_RIB_THICK_END / 2 + BEACON_RADIUS);
      }
    }
  });
});

describe('pole lamp', () => {
  it('hangs just under the hood', () => {
    for (const height of POLE_HEIGHTS) {
      const frame = poleLampFrame(height);
      const b = buildBundle({ ops: [{ kind: 'pole', height }] });
      const g = b.byMaterial.graphite;
      if (!g) throw new Error('pole has no graphite');
      expect(frame.normal).toEqual([0, -1, 0]);
      expect(frame.at[0]).toBeCloseTo(POLE_ARM, 9);
      // The lowest graphite over the lamp is the hood's underside.
      let lowest = Infinity;
      for (let i = 0; i < g.positions.length; i += 3) {
        const near =
          Math.abs((g.positions[i] ?? 0) - POLE_ARM) < 0.2 &&
          Math.abs(g.positions[i + 2] ?? 0) < 0.12;
        if (near && (g.positions[i + 1] ?? 0) > height - 1)
          lowest = Math.min(lowest, g.positions[i + 1] ?? Infinity);
      }
      expect(lowest).toBeCloseTo(frame.at[1], 2);
    }
  });
});
