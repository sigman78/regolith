/**
 * Where an airlock's lamp sits, in the part's own frame: on the hull above the door, a fixed angle
 * up from the +z flank, its light face turned outward. Shared by the sim (which places lamps in the
 * world) and nothing else; the shape is geometry/lamp.ts.
 */
import type { Vec3 } from '@/core/math';
import { AIRLOCK_LAMP_ANGLE_DEG } from '@/geometry/design-constants';

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
