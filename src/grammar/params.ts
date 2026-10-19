/**
 * Typed readers for ParamSchema entries. They clamp, snap to step and fall
 * back to the default, so a part's `resolve()` can never see a bad value
 * (pillar P1: bad input is resolved, not rejected).
 */
import { clamp } from '@/core/math';
import type { ParamSchema, ParamSpec, ParamValue, ParamValues } from './types';

export function readRange(
  spec: Extract<ParamSpec, { kind: 'range' }>,
  raw: ParamValue | undefined,
): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : spec.default;
  const snapped = spec.min + Math.round((n - spec.min) / spec.step) * spec.step;
  return clamp(snapped, spec.min, spec.max);
}

/** Pick the option nearest to the raw number. */
export function readChoice(
  spec: Extract<ParamSpec, { kind: 'choice' }>,
  raw: ParamValue | undefined,
): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : spec.default;
  let best = spec.default;
  let bestD = Infinity;
  for (const o of spec.options) {
    const d = Math.abs(o - n);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

export function readToggle(
  spec: Extract<ParamSpec, { kind: 'toggle' }>,
  raw: ParamValue | undefined,
): boolean {
  return typeof raw === 'boolean' ? raw : spec.default;
}

/** Every combination of a schema's extremes and defaults: what the tests sweep for "every size". */
export function paramSets(schema: ParamSchema): ParamValues[] {
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
