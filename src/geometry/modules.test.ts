import { describe, expect, it } from 'vitest';
import { allParts, getPart } from '@/grammar/registry';
import type { ParamSchema, ParamValues } from '@/grammar/types';
import { buildBundle } from './build';
import {
  DOME_COLLAR_HEIGHT,
  DOME_RADII,
  LAUNCHER_ELEVATIONS,
  MAST_BASE_RADIUS,
  MAST_HEADS,
  MAST_HEIGHTS,
  REACTOR_FIN_REACH,
  REACTOR_HEIGHT_RATIO,
  REACTOR_PORT_Y,
  REACTOR_RADII,
  SLAB_THICK,
  TOWER_CAP_RATIO,
  TOWER_FLOOR_HEIGHT,
  TOWER_RADIUS,
} from './design-constants';
import { assertValidBundle } from './validate';

/** Every combination of choice/toggle values and the min / default / max of each range. */
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

const SLACK = 0.05;
/** Rib flanges may overhang a footprint margin a little; anything more is a bug. */
const PLAN_SLACK = 0.2;

describe.each(allParts().map((d) => [d.letter, d] as const))('module %s geometry', (_l, def) => {
  it('builds a valid bundle for every parameter set', () => {
    for (const raw of paramSets(def.schema)) {
      const bundle = buildBundle(def.geometry(def.resolve(raw), { seed: 't' }));
      expect(() => assertValidBundle(bundle)).not.toThrow();
      expect(Object.keys(bundle.byMaterial).length).toBeGreaterThan(0);
    }
  });

  it('keeps every port inside the bundle bounds', () => {
    for (const raw of paramSets(def.schema)) {
      const p = def.resolve(raw);
      const { bounds } = buildBundle(def.geometry(p, { seed: 't' }));
      for (const port of def.ports(p)) {
        for (let a = 0; a < 3; a++) {
          expect(port.position[a] ?? 0).toBeGreaterThanOrEqual((bounds.min[a] ?? 0) - SLACK);
          expect(port.position[a] ?? 0).toBeLessThanOrEqual((bounds.max[a] ?? 0) + SLACK);
        }
      }
    }
  });

  it('has a footprint that covers its geometry in plan', () => {
    for (const raw of paramSets(def.schema)) {
      const p = def.resolve(raw);
      const { bounds } = buildBundle(def.geometry(p, { seed: 't' }));
      const fp = def.footprint(p);
      const reach = (x: number, z: number): number =>
        fp.kind === 'rect'
          ? Math.max(Math.abs(x) - fp.hx, Math.abs(z) - fp.hz)
          : Math.hypot(x, z) - fp.r;
      for (const x of [bounds.min[0], bounds.max[0]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) {
          // Corners of the box may stick out of a disc; the box edges' midpoints may not.
          if (fp.kind === 'rect') expect(reach(x, z)).toBeLessThanOrEqual(PLAN_SLACK);
        }
      }
      if (fp.kind === 'disc') {
        const r = Math.max(
          Math.abs(bounds.min[0]),
          Math.abs(bounds.max[0]),
          Math.abs(bounds.min[2]),
          Math.abs(bounds.max[2]),
        );
        expect(r).toBeLessThanOrEqual(fp.r + PLAN_SLACK);
      }
    }
  });
});

describe('slab geometry', () => {
  const P = getPart('P');

  it('spans its plan size, from the underside to SLAB_THICK plus the hazard band', () => {
    expect(P).toBeDefined();
    if (!P) return;
    const p = P.resolve({ w: 8, d: 6 });
    const { bounds } = buildBundle(P.geometry(p, { seed: 't' }));
    expect(bounds.min[0]).toBeCloseTo(-4, 5);
    expect(bounds.max[0]).toBeCloseTo(4, 5);
    expect(bounds.max[2]).toBeCloseTo(3, 5);
    expect(bounds.min[1]).toBeCloseTo(0, 5);
    expect(bounds.max[1]).toBeGreaterThanOrEqual(SLAB_THICK);
    expect(bounds.max[1]).toBeLessThan(SLAB_THICK + 0.1);
  });

  it('puts every pylon on the underside, inside the deck', () => {
    if (!P) return;
    for (const raw of paramSets(P.schema)) {
      const p = P.resolve(raw);
      const feet = P.ports(p);
      expect(feet.length).toBeGreaterThanOrEqual(4);
      for (const f of feet) {
        expect(f.position[1]).toBe(0);
        expect(Math.abs(f.position[0])).toBeLessThan(Number(p.w) / 2);
        expect(Math.abs(f.position[2])).toBeLessThan(Number(p.d) / 2);
      }
    }
  });
});

describe('tower geometry', () => {
  const V = getPart('V');

  it('rises floors × floor height plus the cap, and rests on y = 0', () => {
    if (!V) throw new Error('V is not registered');
    for (const floors of [2, 3, 4, 5]) {
      const p = V.resolve({ floors });
      const { bounds } = buildBundle(V.geometry(p, { seed: 't' }));
      expect(bounds.min[1]).toBeCloseTo(0, 5);
      const top = floors * TOWER_FLOOR_HEIGHT;
      expect(bounds.max[1]).toBeGreaterThan(top);
      expect(bounds.max[1]).toBeLessThan(top + TOWER_RADIUS * TOWER_CAP_RATIO + 0.1);
    }
  });

  it('has 4 ground ports, 2 per upper floor, all on the hull cylinder', () => {
    if (!V) throw new Error('V is not registered');
    for (const floors of [2, 3, 4, 5]) {
      const ports = V.ports(V.resolve({ floors }));
      const press = ports.filter((q) => q.type === 'PRESS');
      expect(press).toHaveLength(4 + 2 * (floors - 1));
      for (const q of press) {
        expect(Math.hypot(q.position[0], q.position[2])).toBeCloseTo(TOWER_RADIUS, 9);
        expect(q.normal[1]).toBe(0);
        expect(q.position[1]).toBeLessThan(floors * TOWER_FLOOR_HEIGHT);
      }
      for (const q of ports.filter((s) => s.type === 'STRUCT')) expect(q.position[1]).toBe(0);
    }
  });
});

describe('mast geometry', () => {
  const M = getPart('M');

  it('is as tall as asked plus its head, whatever the head', () => {
    if (!M) throw new Error('M is not registered');
    for (const height of MAST_HEIGHTS) {
      const heights: number[] = [];
      for (const head of MAST_HEADS) {
        const { bounds } = buildBundle(M.geometry(M.resolve({ height, head }), { seed: 't' }));
        expect(bounds.min[1]).toBeCloseTo(0, 5);
        expect(bounds.max[1]).toBeGreaterThan(height);
        expect(bounds.max[1]).toBeLessThan(height + 4);
        heights.push(bounds.max[1]);
      }
      // The three heads differ, so the head param is visible.
      expect(new Set(heights.map((h) => h.toFixed(3))).size).toBe(3);
    }
  });

  it('puts the POWER port on the base plate rim and the feet under the plate', () => {
    if (!M) throw new Error('M is not registered');
    const ports = M.ports(M.resolve({}));
    const power = ports.find((q) => q.type === 'POWER');
    expect(power && Math.hypot(power.position[0], power.position[2])).toBeCloseTo(
      MAST_BASE_RADIUS,
      9,
    );
    const feet = ports.filter((q) => q.type === 'STRUCT');
    expect(feet).toHaveLength(3);
    for (const f of feet) {
      expect(f.position[1]).toBe(0);
      expect(Math.hypot(f.position[0], f.position[2])).toBeLessThan(MAST_BASE_RADIUS);
    }
  });
});

describe('power plant geometry', () => {
  const E = getPart('E');

  it('has three POWER ports on the drum, four feet under it, and fins inside the footprint', () => {
    if (!E) throw new Error('E is not registered');
    for (const radius of REACTOR_RADII) {
      const p = E.resolve({ radius });
      const ports = E.ports(p);
      const power = ports.filter((q) => q.type === 'POWER');
      expect(power).toHaveLength(3);
      for (const q of power) {
        expect(Math.hypot(q.position[0], q.position[2])).toBeCloseTo(radius, 9);
        expect(q.position[1]).toBe(REACTOR_PORT_Y);
      }
      expect(ports.filter((q) => q.type === 'STRUCT')).toHaveLength(4);

      const { bounds } = buildBundle(E.geometry(p, { seed: 't' }));
      expect(bounds.min[1]).toBeCloseTo(0, 5);
      // Fins reach out REACTOR_FIN_REACH of the radius beyond the hull.
      expect(bounds.max[0]).toBeGreaterThan(radius * (1 + REACTOR_FIN_REACH) - 0.2);
      expect(bounds.max[1]).toBeGreaterThan(radius * REACTOR_HEIGHT_RATIO);
    }
  });
});

describe('launcher geometry', () => {
  const C = getPart('C');

  it('lays its barrel out along +X and rises with the elevation, inside the footprint', () => {
    if (!C) throw new Error('C is not registered');
    const tops: number[] = [];
    for (const elevation of LAUNCHER_ELEVATIONS) {
      const p = C.resolve({ length: 16, elevation });
      const { bounds } = buildBundle(C.geometry(p, { seed: 't' }));
      expect(bounds.min[1]).toBeCloseTo(0, 5);
      expect(bounds.max[0]).toBeLessThanOrEqual(8 + 1e-6);
      expect(bounds.min[0]).toBeGreaterThanOrEqual(-8 - 1e-6);
      tops.push(bounds.max[1]);
    }
    // Steeper is higher.
    expect(tops[1]).toBeGreaterThan(tops[0] ?? Infinity);
    expect(tops[2]).toBeGreaterThan(tops[1] ?? Infinity);
  });

  it('has four feet under the sled and a POWER port on its rear face', () => {
    if (!C) throw new Error('C is not registered');
    for (const length of [8, 12, 16, 20]) {
      const ports = C.ports(C.resolve({ length }));
      const feet = ports.filter((q) => q.type === 'STRUCT');
      expect(feet).toHaveLength(4);
      for (const f of feet) expect(f.position[1]).toBe(0);
      const power = ports.find((q) => q.type === 'POWER');
      expect(power?.position[0]).toBe(-length / 2);
      expect(power?.normal).toEqual([-1, 0, 0]);
    }
  });
});

describe('dome geometry', () => {
  const D = getPart('D');

  it('is a collar plus a hemisphere, with PRESS ports on the collar', () => {
    if (!D) throw new Error('D is not registered');
    for (const radius of DOME_RADII) {
      const p = D.resolve({ radius });
      const { bounds } = buildBundle(D.geometry(p, { seed: 't' }));
      expect(bounds.min[1]).toBeCloseTo(0, 5);
      expect(bounds.max[1]).toBeCloseTo(DOME_COLLAR_HEIGHT + radius, 3);
      const press = D.ports(p).filter((q) => q.type === 'PRESS');
      expect(press).toHaveLength(4);
      for (const q of press) {
        expect(Math.hypot(q.position[0], q.position[2])).toBeCloseTo(radius, 9);
        expect(q.position[1]).toBeLessThanOrEqual(DOME_COLLAR_HEIGHT);
        expect(q.normal[1]).toBe(0);
      }
    }
  });
});
