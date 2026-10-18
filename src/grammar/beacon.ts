/**
 * The base's one beacon (DESIGN_GUIDE rule 8): the tallest part that can carry one owns it. Height
 * is the world height of the ball's mount, so a tower on a slab outranks the same tower on the
 * ground. Ties go to the smaller part id, so the pick never depends on map order. Pure.
 */
import { localToWorld, type Pose, type Vec3 } from '@/core/math';
import type { PartId } from '@/world/document';
import { getPart } from './registry';
import type { Letter, ParamValues } from './types';

export interface BeaconPart {
  id: PartId;
  letter: Letter;
  params: Readonly<ParamValues>;
  pose: Pose;
}

export interface BeaconPick {
  part: PartId;
  /** the ball centre in the part's local frame */
  local: Vec3;
  /** the ball centre in the world */
  world: Vec3;
}

export function beaconOwner(parts: Iterable<BeaconPart>): BeaconPick | null {
  let best: BeaconPick | null = null;
  for (const part of parts) {
    const def = getPart(part.letter);
    if (!def?.beacon) continue;
    const local = def.beacon(def.resolve(part.params));
    const world = localToWorld(part.pose, local);
    if (
      !best ||
      world[1] > best.world[1] + 1e-9 ||
      (Math.abs(world[1] - best.world[1]) <= 1e-9 && part.id < best.part)
    ) {
      best = { part: part.id, local, world };
    }
  }
  return best;
}
