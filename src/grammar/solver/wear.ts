/**
 * Wear sources of a resolved base: every part footprint and every
 * footpad, in world XZ. Feeds `world/wear.ts`; kept here because it reads the solver's output.
 */
import type { FlatShape } from '@/world/flatten';
import { buildWear, type WearField } from '@/world/wear';
import { FOOT_RADIUS } from '@/geometry/design-constants';
import type { ResolvedBase } from './types';

export function wearOf(base: ResolvedBase, half: number): WearField {
  const footprints: FlatShape[] = [];
  const footpads: { x: number; z: number; r: number }[] = [];
  for (const part of base.parts.values()) {
    const { footprint: fp, pose } = part;
    footprints.push(
      fp.kind === 'rect'
        ? { kind: 'rect', x: pose.x, z: pose.z, yaw: pose.yaw, hx: fp.hx, hz: fp.hz }
        : { kind: 'disc', x: pose.x, z: pose.z, r: fp.r },
    );
    for (const leg of part.legs)
      footpads.push({ x: leg.bottom[0], z: leg.bottom[2], r: FOOT_RADIUS });
  }
  for (const tube of base.tubes.values()) {
    for (const leg of tube.legs)
      footpads.push({ x: leg.bottom[0], z: leg.bottom[2], r: FOOT_RADIUS });
  }
  return buildWear(half, footprints, footpads);
}
