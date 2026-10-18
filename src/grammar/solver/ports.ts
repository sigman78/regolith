/** Which ports a tube may leave from (one rule, shared by the solver, the halos and diagnose). */
import type { Vec3 } from '@/core/math';
import type { PortType } from '../types';

export function isHorizontal(normal: Vec3): boolean {
  return Math.abs(normal[1]) < 1e-6;
}

/** Tubes leave PRESS ports sideways; nothing else gets a halo. */
export function canTakeTube(port: { type: PortType; normal: Vec3 }): boolean {
  return port.type === 'PRESS' && isHorizontal(port.normal);
}
