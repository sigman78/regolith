/**
 * Drag handles, as data. A part says where its grips are and which param each
 * one turns; the editor draws a grip, measures how far it was dragged and asks
 * `applyHandleDelta` what that means. Nothing here knows about the camera or
 * the DOM, so every part's handles are testable headless.
 *
 * Every number is in the part's local frame, for the params it was asked about.
 */
import type { Vec3 } from '@/core/math';
import type { ParamValues, PartDefinition } from './types';

export interface HandleSpec {
  /** unique within the part, stable across param changes */
  id: string;
  /** the param this grip turns; a range or choice */
  param: string;
  /** where the grip sits on the part, local space */
  at: Vec3;
  /** unit direction the grip moves along when the param grows, local space */
  axis: Vec3;
  /** metres of grip travel per unit of the param */
  perUnit: number;
  /** a local point that must not move in the world when the param changes (the opposite end) */
  anchor: Vec3;
}

export interface HandleEdit {
  /** resolved: snapped to the schema, clamped */
  params: ParamValues;
  /** local offset to add to the part's position so the anchor stays where it was */
  shift: Vec3;
}

/** What dragging `spec` by `delta` metres along its axis does to a part with `params`. */
export function applyHandleDelta(
  def: PartDefinition,
  params: Readonly<ParamValues>,
  spec: HandleSpec,
  delta: number,
): HandleEdit {
  const current = Number(params[spec.param]);
  const next = def.resolve({ ...params, [spec.param]: current + delta / spec.perUnit });
  const after = def.handles?.(next).find((h) => h.id === spec.id);
  const shift: Vec3 = after
    ? [
        spec.anchor[0] - after.anchor[0],
        spec.anchor[1] - after.anchor[1],
        spec.anchor[2] - after.anchor[2],
      ]
    : [0, 0, 0];
  return { params: next, shift };
}

/** The param's next schema value up or down, or the current one at the end of its range. */
export function nextParamValue(
  def: PartDefinition,
  params: Readonly<ParamValues>,
  param: string,
  direction: 1 | -1,
): number {
  const spec = def.schema[param];
  const current = Number(params[param]);
  if (spec?.kind === 'range') {
    return Math.min(spec.max, Math.max(spec.min, current + direction * spec.step));
  }
  if (spec?.kind === 'choice') {
    const sorted = [...spec.options].sort((a, b) => a - b);
    const next =
      direction > 0
        ? sorted.find((o) => o > current)
        : [...sorted].reverse().find((o) => o < current);
    return next ?? current;
  }
  return current;
}
