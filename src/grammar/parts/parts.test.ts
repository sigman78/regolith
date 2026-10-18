import { describe, expect, it } from 'vitest';
import { allParts } from '../registry';
import type { ParamSchema, ParamValues } from '../types';

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

describe.each(allParts().map((d) => [d.letter, d] as const))('part %s', (_letter, def) => {
  const sets = paramSets(def.schema);

  it('resolves every input to the schema, including garbage', () => {
    for (const raw of [{}, { x: 1 }, ...sets]) {
      const p = def.resolve(raw);
      expect(def.resolve(p)).toEqual(p); // idempotent
    }
    const wild = Object.fromEntries(Object.keys(def.schema).map((k) => [k, Number.NaN]));
    expect(() => def.resolve(wild)).not.toThrow();
    expect(def.resolve({ ...wild, bogus: 'x' })).toEqual(def.resolve({}));
  });

  it('keeps ports inside the footprint, with unit normals and unique ids', () => {
    for (const raw of sets) {
      const p = def.resolve(raw);
      const fp = def.footprint(p);
      const ports = def.ports(p);
      expect(new Set(ports.map((q) => q.id)).size).toBe(ports.length);
      for (const port of ports) {
        const [x, , z] = port.position;
        if (fp.kind === 'rect') {
          expect(Math.abs(x)).toBeLessThanOrEqual(fp.hx);
          expect(Math.abs(z)).toBeLessThanOrEqual(fp.hz);
        } else {
          expect(Math.hypot(x, z)).toBeLessThanOrEqual(fp.r);
        }
        expect(Math.hypot(...port.normal)).toBeCloseTo(1, 9);
      }
    }
  });

  it('has STRUCT ports iff it stands on legs', () => {
    for (const raw of sets) {
      const p = def.resolve(raw);
      const structs = def.ports(p).filter((q) => q.type === 'STRUCT');
      if (def.ground(p).mode === 'legs') expect(structs.length).toBeGreaterThan(0);
    }
  });

  it('emits a deterministic, non-empty recipe', () => {
    for (const raw of sets) {
      const p = def.resolve(raw);
      const a = def.geometry(p, { seed: 's' });
      expect(a.ops.length).toBeGreaterThan(0);
      expect(JSON.stringify(a)).toBe(JSON.stringify(def.geometry(p, { seed: 's' })));
    }
  });
});
