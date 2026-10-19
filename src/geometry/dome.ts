/**
 * Letter D geometry (opaque dome): a collar drum on a FLOOR_ABOVE_BELLY plinth with a hemispherical
 * shell above it, latitude ribs, a rib at the collar rim and an accent stripe on the collar. The
 * rim rib and the stripe cross the doors' height, so they skip an arc around each door, where the
 * door's stub would otherwise cut through them.
 *
 * Frame matches grammar/parts/D.ts: axis along +Y, flat base at y = 0.
 */
import { Vector2 } from 'three';
import { D } from '@/grammar/parts/D';
import { STUB_HALF_WIDTH } from '@/grammar/stub-depth';
import type { BundleBuilder } from './bundle';
import {
  BAND_END_GAP,
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
  FLOOR_ABOVE_BELLY,
  HAB_RIB_INSET,
} from './design-constants';
import { lathe, latheArcs, ribProfile, ringArcs } from './profiles';

export interface DomeOp {
  radius: number;
}

/** Height of the collar rim: the plinth plus the collar. */
export function domeRimY(): number {
  return FLOOR_ABOVE_BELLY + DOME_COLLAR_HEIGHT;
}

export function buildDome(out: BundleBuilder, op: DomeOp): void {
  const r = op.radius;
  const rim = domeRimY();

  const hull = [
    new Vector2(0, 0),
    new Vector2(r - BEVEL, 0),
    new Vector2(r, BEVEL),
    new Vector2(r, rim),
  ];
  for (let i = 1; i <= DOME_ARC_STEPS; i++) {
    const a = (i / DOME_ARC_STEPS) * (Math.PI / 2);
    hull.push(new Vector2(Math.cos(a) * r, rim + Math.sin(a) * r));
  }
  out.add('hull', lathe(hull, DOME_SEGMENTS));

  const doors = D.ports(D.resolve({ radius: r }))
    .filter((q) => q.type === 'PRESS')
    .map((q) => q.normal);
  // Rings stop a gap beside each stub's wall, measured where the ring is nearest the hull.
  const skip = STUB_HALF_WIDTH + BAND_END_GAP;

  // Rib at the collar rim (around the doors), then one per latitude: a ring at the shell radius there.
  for (const g of latheArcs(
    ribProfile(r, rim, DOME_RIB_THICK, r * FLANGE_RATIO),
    DOME_SEGMENTS,
    ringArcs(doors, r - HAB_RIB_INSET, skip),
  )) {
    out.add('graphite', g);
  }
  for (const deg of DOME_RIB_ELEVATIONS) {
    const a = (deg * Math.PI) / 180;
    out.add(
      'graphite',
      lathe(
        ribProfile(Math.cos(a) * r, rim + Math.sin(a) * r, DOME_RIB_THICK, r * FLANGE_RATIO * 0.8),
        DOME_SEGMENTS,
      ),
    );
  }

  const sr = r + DOME_STRIPE_PROUD;
  const sy = FLOOR_ABOVE_BELLY + DOME_STRIPE_Y;
  const stripe = [new Vector2(sr, sy - DOME_STRIPE_HALF), new Vector2(sr, sy + DOME_STRIPE_HALF)];
  for (const g of latheArcs(stripe, DOME_SEGMENTS, ringArcs(doors, sr, skip))) out.add('accent', g);
}
