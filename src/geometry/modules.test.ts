import { describe, expect, it } from 'vitest';
import { allParts, getPart } from '@/grammar/registry';
import type { ParamSchema, ParamValues } from '@/grammar/types';
import { buildBundle } from './build';
import { SLAB_THICK } from './design-constants';
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
