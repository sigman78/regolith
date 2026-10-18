/**
 * Where an airlock's lamp sits, in the part's own frame: on the hull above the door, a fixed angle
 * up from the +z flank, its light face turned outward. Shared by the sim (which places lamps in the
 * world) and nothing else; the shape is geometry/lamp.ts.
 */
import type { Vec3 } from '@/core/math';
import {
  AIRLOCK_LAMP_ANGLE_DEG,
  BEACON_LIFT,
  BEACON_RADIUS,
  MAST_BEACON_RADIUS,
  MAST_DISH_LIFT,
  MAST_DISH_TILT_DEG,
  MAST_FEED_LENGTH,
  MAST_HEAD_DISH,
  MAST_HEAD_WHIP,
  MAST_RELAY_BOX,
  MAST_RELAY_LIFT,
  MAST_WHIP_LENGTH,
  POLE_ARM,
  POLE_ARM_DROP,
  POLE_HOOD,
} from '@/geometry/design-constants';

export interface LampFrame {
  at: Vec3;
  /** unit, pointing away from the hull */
  normal: Vec3;
}

export function airlockLampFrame(radius: number): LampFrame {
  const a = (AIRLOCK_LAMP_ANGLE_DEG * Math.PI) / 180;
  const normal: Vec3 = [0, Math.sin(a), Math.cos(a)];
  // Sunk 2 cm so the base sits in the hull.
  const r = radius - 0.02;
  return { at: [0, r * normal[1], r * normal[2]], normal };
}

/** The lamp plate under a light pole's hood, its light face turned down. */
export function poleLampFrame(height: number): LampFrame {
  return { at: [POLE_ARM, height - POLE_ARM_DROP - POLE_HOOD[1] / 2, 0], normal: [0, -1, 0] };
}

/** A beacon ball resting on a surface at height `top` (the ball is sunk by `BEACON_LIFT`). */
export function beaconOn(top: number, x = 0): Vec3 {
  return [x, top + BEACON_LIFT * BEACON_RADIUS, 0];
}

/**
 * The ball at the tip of a mast head. geometry/mast.ts draws the graphite ball of the same centre
 * on every mast; the base's beacon, when a mast owns it, is a slightly larger glowing one there.
 */
export function mastBeacon(height: number, head: number): Vec3 {
  if (head === MAST_HEAD_WHIP) return [0, height + MAST_WHIP_LENGTH, 0];
  if (head === MAST_HEAD_DISH) {
    const tilt = (MAST_DISH_TILT_DEG * Math.PI) / 180;
    return [
      Math.sin(tilt) * MAST_FEED_LENGTH,
      height + MAST_DISH_LIFT + Math.cos(tilt) * MAST_FEED_LENGTH,
      0,
    ];
  }
  return [0, height + MAST_RELAY_LIFT + MAST_RELAY_BOX.h + MAST_BEACON_RADIUS * 0.5, 0];
}
