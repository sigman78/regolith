import { describe, expect, it } from 'vitest';
import { applyHandleDelta, nextParamValue } from './handles';
import { allParts } from './registry';
import type { ParamSchema, ParamValues } from './types';

/** Every combination of choice values and the min / default / max of each range; toggles are not handled. */
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

describe.each(allParts().map((d) => [d.letter, d] as const))('handles of %s', (_letter, def) => {
  const sets = paramSets(def.schema).map((raw) => def.resolve(raw));

  it('has at least one grip, with unique ids and sane specs', () => {
    for (const p of sets) {
      const specs = def.handles?.(p) ?? [];
      expect(specs.length).toBeGreaterThan(0);
      expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
      for (const s of specs) {
        const schema = def.schema[s.param];
        expect(schema && schema.kind !== 'toggle').toBe(true);
        expect(Math.hypot(...s.axis)).toBeCloseTo(1, 9);
        expect(s.perUnit).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the same grips as the params change, so a drag can follow one', () => {
    const ids = (p: ParamValues) => (def.handles?.(p) ?? []).map((s) => s.id).sort();
    for (const p of sets) expect(ids(p)).toEqual(ids(sets[0] ?? {}));
  });

  it('puts every grip over the footprint', () => {
    for (const p of sets) {
      const fp = def.footprint(p);
      for (const s of def.handles?.(p) ?? []) {
        const [x, , z] = s.at;
        if (fp.kind === 'rect') {
          expect(Math.abs(x)).toBeLessThanOrEqual(fp.hx);
          expect(Math.abs(z)).toBeLessThanOrEqual(fp.hz);
        } else expect(Math.hypot(x, z)).toBeLessThanOrEqual(fp.r);
      }
    }
  });

  it('one step up or down lands on the next schema value, the anchor stays put and the grip travels as promised', () => {
    for (const p of sets) {
      for (const spec of def.handles?.(p) ?? []) {
        for (const dir of [1, -1] as const) {
          const target = nextParamValue(def, p, spec.param, dir);
          const current = Number(p[spec.param]);
          const delta = (target - current) * spec.perUnit;
          const edit = applyHandleDelta(def, p, spec, delta);
          expect(edit.params[spec.param]).toBe(target);
          const after = def.handles?.(edit.params).find((h) => h.id === spec.id);
          if (!after) throw new Error(`grip ${spec.id} vanished`);
          // The anchor does not move once the part is shifted.
          for (let i = 0; i < 3; i++) {
            expect((after.anchor[i] ?? 0) + (edit.shift[i] ?? 0)).toBeCloseTo(
              spec.anchor[i] ?? 0,
              9,
            );
          }
          // The grip moved by `delta` along its axis, and nowhere else.
          for (let i = 0; i < 3; i++) {
            const moved = (edit.shift[i] ?? 0) + (after.at[i] ?? 0) - (spec.at[i] ?? 0);
            expect(moved).toBeCloseTo((spec.axis[i] ?? 0) * delta, 9);
          }
        }
      }
    }
  });

  it('clamps a huge drag to the schema instead of throwing', () => {
    for (const p of sets.slice(0, 4)) {
      for (const spec of def.handles?.(p) ?? []) {
        for (const delta of [1e6, -1e6, Number.NaN]) {
          const edit = applyHandleDelta(def, p, spec, delta);
          expect(def.resolve(edit.params)).toEqual(edit.params);
        }
      }
    }
  });

  it('leaves a part alone when the drag is zero', () => {
    for (const p of sets) {
      for (const spec of def.handles?.(p) ?? []) {
        const edit = applyHandleDelta(def, p, spec, 0);
        expect(edit.params).toEqual(p);
        expect(edit.shift.map(Math.abs)).toEqual([0, 0, 0]);
      }
    }
  });
});
