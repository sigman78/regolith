/**
 * Legs are two shared pieces: a unit-height strut (render scales it in Y to
 * the leg length, so only a plain cylinder is stretched) and a beveled
 * footpad that is never scaled.
 */
import { CylinderGeometry, Vector2 } from 'three';
import type { BundleBuilder } from './bundle';
import { lathe } from './profiles';
import { BEVEL, FOOT_HEIGHT, FOOT_RADIUS, LEG_RADIUS, LEG_SEGMENTS } from './design-constants';

export function buildLegStrut(out: BundleBuilder): void {
  const g = new CylinderGeometry(LEG_RADIUS, LEG_RADIUS, 1, LEG_SEGMENTS, 1, true);
  g.translate(0, 0.5, 0);
  out.add('graphite', g);
}

export function buildLegFoot(out: BundleBuilder): void {
  const b = Math.min(BEVEL, FOOT_HEIGHT / 2);
  const r = FOOT_RADIUS;
  const h = FOOT_HEIGHT;
  out.add(
    'graphite',
    lathe(
      [
        new Vector2(0, 0),
        new Vector2(r - b, 0),
        new Vector2(r, b),
        new Vector2(r, h - b),
        new Vector2(r - b, h),
        new Vector2(0, h),
      ],
      LEG_SEGMENTS,
    ),
  );
}
