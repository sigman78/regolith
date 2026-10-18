/**
 * Letter A geometry: a short hab-shaped lock with a door and a ramp on its +z flank, hazard
 * chevrons on the ramp, and a lamp above the door.
 *
 * Frame matches grammar/parts/A.ts: axis along +X, origin at the centre of the axis.
 */
import { CylinderGeometry } from 'three';
import type { BundleBuilder } from './bundle';
import {
  AIRLOCK_CHEVRONS,
  AIRLOCK_CHEVRON_W,
  AIRLOCK_DOOR_H,
  AIRLOCK_DOOR_PROUD,
  AIRLOCK_DOOR_W,
  AIRLOCK_LAMP_ANGLE_DEG,
  AIRLOCK_LAMP_SIZE,
  AIRLOCK_RAMP_RUN,
  AIRLOCK_RAMP_THICK,
  AIRLOCK_RAMP_W,
  AIRLOCK_RIB_THICK,
  FLANGE_RATIO,
  HAB_SEGMENTS,
  LEG_MIN_CLEARANCE,
} from './design-constants';
import { habHullProfile, layDown } from './hab';
import { bevelBox, lathe, ribProfile } from './profiles';

export interface AirlockOp {
  radius: number;
  /** cylinder section between the caps, metres */
  length: number;
}

export function buildAirlock(out: BundleBuilder, op: AirlockOp): void {
  const { radius: r, length } = op;
  out.add('hull', layDown(lathe(habHullProfile(length, r), HAB_SEGMENTS)));
  for (const y of [-length / 2, length / 2]) {
    out.add(
      'graphite',
      layDown(lathe(ribProfile(r, y, AIRLOCK_RIB_THICK, r * FLANGE_RATIO), HAB_SEGMENTS)),
    );
  }

  // Door: a patch of shell on the +z flank at axis height, standing a little off the hull so it
  // follows the curve instead of cutting through it.
  const span = AIRLOCK_DOOR_H / r;
  const door = new CylinderGeometry(
    r + AIRLOCK_DOOR_PROUD,
    r + AIRLOCK_DOOR_PROUD,
    AIRLOCK_DOOR_W,
    10,
    1,
    true,
    -span / 2,
    span,
  );
  door.rotateZ(-Math.PI / 2);
  out.add('graphite', door);

  // Ramp: its top runs from the door sill down to the ground a hab's legs would stand on.
  const sillY = -AIRLOCK_DOOR_H / 2;
  const footY = -r - LEG_MIN_CLEARANCE;
  const drop = sillY - footY;
  // The ramp foot is AIRLOCK_RAMP_RUN beyond the hull's own radius (that is where the EXT port is).
  const z0 = Math.sqrt(r * r - sillY * sillY);
  const run = r + AIRLOCK_RAMP_RUN - z0;
  const slope = Math.atan2(drop, run);
  const length3 = Math.hypot(run, drop);
  const ramp = bevelBox(AIRLOCK_RAMP_W, AIRLOCK_RAMP_THICK, length3);
  ramp.translate(0, -AIRLOCK_RAMP_THICK, length3 / 2);
  ramp.rotateX(slope);
  ramp.translate(0, sillY, z0);
  out.add('graphite', ramp);

  // Chevrons across the ramp, evenly spaced, in warning yellow.
  for (let i = 0; i < AIRLOCK_CHEVRONS; i++) {
    const t = (i + 1) / (AIRLOCK_CHEVRONS + 1);
    const strip = bevelBox(AIRLOCK_RAMP_W * 0.9, 0.012, AIRLOCK_CHEVRON_W);
    strip.rotateX(slope);
    strip.translate(0, sillY - drop * t + 0.004, z0 + run * t);
    out.add('warning', strip);
  }

  // Lamp above the door, up the hull at a fixed angle, turned to face outward.
  const turn = Math.PI / 2 - (AIRLOCK_LAMP_ANGLE_DEG * Math.PI) / 180;
  const lamp = bevelBox(AIRLOCK_LAMP_SIZE, 0.05, AIRLOCK_LAMP_SIZE);
  lamp.translate(0, r - 0.02, 0);
  lamp.rotateX(turn);
  out.add('light', lamp);
}
