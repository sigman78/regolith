/**
 * Ray queries against the world. Pure, so tools can be tested without a GPU.
 */
import type { Vec3 } from '@/core/math';

export interface Ray {
  origin: Vec3;
  /** unit length */
  dir: Vec3;
}

/**
 * First intersection of a ray with the terrain surface, or null. Marches in
 * half-metre steps (terrain features are wider than that), then bisects.
 */
export function raycastTerrain(
  ray: Ray,
  heightAt: (x: number, z: number) => number,
  maxDistance = 600,
): Vec3 | null {
  const step = 0.5;
  const at = (t: number): Vec3 => [
    ray.origin[0] + ray.dir[0] * t,
    ray.origin[1] + ray.dir[1] * t,
    ray.origin[2] + ray.dir[2] * t,
  ];
  const above = (t: number): boolean => {
    const p = at(t);
    return p[1] >= heightAt(p[0], p[2]);
  };

  if (!above(0)) return null;
  let prev = 0;
  for (let t = step; t <= maxDistance; t += step) {
    if (above(t)) {
      prev = t;
      continue;
    }
    let lo = prev;
    let hi = t;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (above(mid)) lo = mid;
      else hi = mid;
    }
    const p = at((lo + hi) / 2);
    return [p[0], heightAt(p[0], p[2]), p[2]];
  }
  return null;
}

/**
 * Where along the line `p0 + s·u` (u unit) the ray passes closest, as `s`. Null when the ray runs
 * parallel to the line, where the answer would be meaningless. Handle drags use it to turn a
 * pointer position into a distance along the grip's axis, whatever that axis is.
 */
export function rayClosestOnLine(ray: Ray, p0: Vec3, u: Vec3): number | null {
  const { origin: o, dir: v } = ray;
  const w: Vec3 = [p0[0] - o[0], p0[1] - o[1], p0[2] - o[2]];
  const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const denom = a * c - b * b;
  if (denom < 1e-6 * a * c) return null;
  return (b * dot(v, w) - c * dot(u, w)) / denom;
}
