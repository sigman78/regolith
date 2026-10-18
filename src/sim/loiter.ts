/**
 * Where a crew member stands about outside an airlock: a spot 4-8 m from the ramp foot, in the
 * direction the door faces, on open ground. Pure. The caller supplies the ground height and the
 * keep-out mask (the same one rocks respect), so a spot never lands in a hull or a tube corridor.
 *
 * The slot picks where in a fixed candidate ring the scan starts; the scan then walks the ring in
 * order and takes the first free cell. If every candidate is blocked the spot falls back to one
 * metre past the foot (an invalid placement is resolved, never rejected).
 */
import type { Vec3 } from '@/core/math';
import { GRID, LOITER_ANGLES_DEG, LOITER_DISTANCES } from '@/geometry/design-constants';

/** What the sim needs of the world outside the press graph. */
export interface NavEnv {
  /** keep-out mask of the 1 m grid (index j * size + i), or null when there is none */
  keepOut: Uint8Array | null;
  heightAt: (x: number, z: number) => number;
}

export const FLAT_ENV: NavEnv = { keepOut: null, heightAt: () => 0 };

/** Is the world point inside the keep-out mask (or off the map)? */
export function blocked(env: NavEnv, x: number, z: number): boolean {
  const mask = env.keepOut;
  if (!mask) return false;
  const size = Math.round(Math.sqrt(mask.length));
  if (size === 0) return false;
  const i = Math.floor(x / GRID) + size / 2;
  const j = Math.floor(z / GRID) + size / 2;
  if (i < 0 || j < 0 || i >= size || j >= size) return true;
  return mask[j * size + i] === 1;
}

/** Number of candidate spots in the ring. */
export const LOITER_CANDIDATES = LOITER_DISTANCES.length * LOITER_ANGLES_DEG.length;

/** The unit direction (x, z) from a node's centre out through its ramp foot. */
export function facingOf(centre: Vec3, foot: Vec3): [number, number] {
  const dx = foot[0] - centre[0];
  const dz = foot[2] - centre[2];
  const len = Math.hypot(dx, dz);
  return len > 1e-9 ? [dx / len, dz / len] : [0, 1];
}

export function loiterSpot(env: NavEnv, centre: Vec3, foot: Vec3, slot: number): Vec3 {
  const [fx, fz] = facingOf(centre, foot);
  for (let k = 0; k < LOITER_CANDIDATES; k++) {
    const i = (slot + k) % LOITER_CANDIDATES;
    const d = LOITER_DISTANCES[Math.floor(i / LOITER_ANGLES_DEG.length)] ?? 4;
    const a = ((LOITER_ANGLES_DEG[i % LOITER_ANGLES_DEG.length] ?? 0) * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = foot[0] + (fx * c - fz * s) * d;
    const z = foot[2] + (fx * s + fz * c) * d;
    if (!blocked(env, x, z)) return [x, env.heightAt(x, z), z];
  }
  const x = foot[0] + fx;
  const z = foot[2] + fz;
  return [x, env.heightAt(x, z), z];
}
