/**
 * Letter X geometry: a slim graphite pole on a round base, with an arm and a hood. The lamp plate under the hood is
 * an instance (render/lamps.ts, placed by grammar/lamps.ts). Frame matches grammar/parts/X.ts: axis +Y, base underside at y = 0.
 */
import { Vector2 } from 'three';
import type { BundleBuilder } from './bundle';
import {
  POLE_ARM,
  POLE_ARM_DROP,
  POLE_BASE_RADIUS,
  POLE_BASE_THICK,
  POLE_HOOD,
  POLE_RADIUS_BOTTOM,
  POLE_RADIUS_TOP,
  POLE_SEGMENTS,
} from './design-constants';
import { bevelBox, bevelCylinder, lathe } from './profiles';

export interface PoleOp {
  height: number;
}

export function buildPole(out: BundleBuilder, op: PoleOp): void {
  const h = op.height;
  out.add('graphite', bevelCylinder(POLE_BASE_RADIUS, POLE_BASE_THICK, POLE_SEGMENTS));
  out.add(
    'graphite',
    lathe(
      [
        new Vector2(0, POLE_BASE_THICK),
        new Vector2(POLE_RADIUS_BOTTOM, POLE_BASE_THICK),
        new Vector2(POLE_RADIUS_TOP, h),
        new Vector2(0, h),
      ],
      POLE_SEGMENTS,
    ),
  );

  const armY = h - POLE_ARM_DROP;
  const arm = bevelBox(POLE_ARM, 0.06, 0.06);
  arm.translate(POLE_ARM / 2, armY, 0);
  out.add('graphite', arm);

  const hood = bevelBox(POLE_HOOD[0], POLE_HOOD[1], POLE_HOOD[2]);
  hood.translate(POLE_ARM, armY - POLE_HOOD[1] / 2, 0);
  out.add('graphite', hood);
}
