/**
 * Letter D geometry (opaque dome): a short collar drum with a hemispherical
 * shell above it, latitude ribs, a rib at the collar rim and an accent stripe.
 *
 * Frame matches grammar/parts/D.ts: axis along +Y, flat base at y = 0.
 */
import { Vector2 } from 'three';
import type { BundleBuilder } from './bundle';
import {
  BEVEL,
  DOME_ARC_STEPS,
  DOME_COLLAR_HEIGHT,
  DOME_RIB_ELEVATIONS,
  DOME_RIB_THICK,
  DOME_SEGMENTS,
  DOME_STRIPE_HALF,
  DOME_STRIPE_PROUD,
  DOME_STRIPE_Y,
  FLANGE_RATIO,
} from './design-constants';
import { lathe, ribProfile } from './profiles';

export interface DomeOp {
  radius: number;
}

export function buildDome(out: BundleBuilder, op: DomeOp): void {
  const r = op.radius;
  const hc = DOME_COLLAR_HEIGHT;

  const hull = [
    new Vector2(0, 0),
    new Vector2(r - BEVEL, 0),
    new Vector2(r, BEVEL),
    new Vector2(r, hc),
  ];
  for (let i = 1; i <= DOME_ARC_STEPS; i++) {
    const a = (i / DOME_ARC_STEPS) * (Math.PI / 2);
    hull.push(new Vector2(Math.cos(a) * r, hc + Math.sin(a) * r));
  }
  out.add('hull', lathe(hull, DOME_SEGMENTS));

  // Rib at the collar rim, then one per latitude: a ring at the shell radius for that height.
  out.add('graphite', lathe(ribProfile(r, hc, DOME_RIB_THICK, r * FLANGE_RATIO), DOME_SEGMENTS));
  for (const deg of DOME_RIB_ELEVATIONS) {
    const a = (deg * Math.PI) / 180;
    out.add(
      'graphite',
      lathe(
        ribProfile(Math.cos(a) * r, hc + Math.sin(a) * r, DOME_RIB_THICK, r * FLANGE_RATIO * 0.8),
        DOME_SEGMENTS,
      ),
    );
  }

  const sr = r + DOME_STRIPE_PROUD;
  out.add(
    'accent',
    lathe(
      [
        new Vector2(sr, DOME_STRIPE_Y - DOME_STRIPE_HALF),
        new Vector2(sr, DOME_STRIPE_Y + DOME_STRIPE_HALF),
      ],
      DOME_SEGMENTS,
    ),
  );
}
