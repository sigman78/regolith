/**
 * Letter A geometry: a short hab-shaped lock whose exit is a door on a corridor stub on the +z
 * flank, with a stair down to the ground and a hazard strip on every tread. (The lamp above the
 * door is an instance, see sim/lamps.ts; the PRESS end's stub comes from the solver like every
 * door's.)
 *
 * Frame matches grammar/parts/A.ts: axis along +X, origin at the centre of the axis.
 */
import { flankStub } from '@/grammar/stub-depth';
import type { BundleBuilder } from './bundle';
import {
  AIRLOCK_NOSE_W,
  AIRLOCK_RIB_THICK,
  AIRLOCK_STAIR_RISERS,
  AIRLOCK_STAIR_RUN,
  AIRLOCK_STAIR_W,
  DECK_HEIGHT,
  FLANGE_RATIO,
  FLOOR_ABOVE_BELLY,
  FOOT_HEIGHT,
  HAB_SEGMENTS,
  LEG_MIN_CLEARANCE,
} from './design-constants';
import { habHullProfile, layDown } from './hab';
import { bevelBox, lathe, ribProfile } from './profiles';
import { buildStub } from './stub';

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

  // The exit door: on the floor, on a stub through the +z flank, like every door in the base.
  const floor = FLOOR_ABOVE_BELLY - r;
  buildStub(out, { at: [0, floor, r], normal: [0, 0, 1], depth: flankStub(r, floor) });

  // The stair: DECK_HEIGHT down from the sill to the ground the legs stand on (where the EXT port
  // is), AIRLOCK_STAIR_RISERS risers over AIRLOCK_STAIR_RUN, as solid blocks a tread deep. The last
  // tread is a landing pad sunk into the ground like a footpad, with the EXT port at its far edge.
  const ground = -r - LEG_MIN_CLEARANCE;
  const riser = DECK_HEIGHT / AIRLOCK_STAIR_RISERS;
  const tread = AIRLOCK_STAIR_RUN / AIRLOCK_STAIR_RISERS;
  for (let i = 0; i < AIRLOCK_STAIR_RISERS; i++) {
    const top = floor - riser * (i + 1);
    const base = i + 1 < AIRLOCK_STAIR_RISERS ? ground : ground - FOOT_HEIGHT;
    const block = bevelBox(AIRLOCK_STAIR_W, top - base, tread);
    // The first block's back face would share the stub face's plane at z = r: nudged 4 mm out.
    block.translate(0, base, r + 0.004 + tread * (i + 0.5));
    out.add('graphite', block);
    const nose = bevelBox(AIRLOCK_STAIR_W * 0.9, 0.012, AIRLOCK_NOSE_W);
    nose.translate(0, top + 0.004, r + 0.004 + tread * (i + 1) - AIRLOCK_NOSE_W / 2);
    out.add('warning', nose);
  }
}
