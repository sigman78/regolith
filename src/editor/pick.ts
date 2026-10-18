/**
 * Part picking by ray against oriented boxes (the geometry bundle's local
 * bounds, posed). Footprint proxies, not render meshes (ARCHITECTURE §8), so
 * picking is pure and stays cheap with hundreds of parts.
 */
import { worldDirToLocal, worldToLocal, type Vec3 } from '@/core/math';
import { buildBundle } from '@/geometry/build';
import { TUBE_RADIUS } from '@/geometry/design-constants';
import type { ResolvedBase, ResolvedPart } from '@/grammar/solver';
import type { Ray } from '@/world/raycast';

export interface PartHit {
  id: string;
  /** distance along the ray */
  t: number;
}

/** Ray vs the part's posed local AABB; returns distance or null. */
export function rayHitsPart(ray: Ray, part: ResolvedPart): number | null {
  const bounds = buildBundle(part.recipe).bounds;
  const o = worldToLocal(part.pose, ray.origin);
  const d = worldDirToLocal(part.pose, ray.dir);
  return slab(o, d, bounds.min, bounds.max);
}

export function pickPart(ray: Ray, base: ResolvedBase): PartHit | null {
  let best: PartHit | null = null;
  for (const part of base.parts.values()) {
    const t = rayHitsPart(ray, part);
    if (t !== null && (best === null || t < best.t)) best = { id: part.id, t };
  }
  return best;
}

function slab(o: Vec3, d: Vec3, min: Vec3, max: Vec3): number | null {
  let tMin = 0;
  let tMax = Infinity;
  for (let a = 0; a < 3; a++) {
    const oa = o[a] ?? 0;
    const da = d[a] ?? 0;
    const lo = min[a] ?? 0;
    const hi = max[a] ?? 0;
    if (Math.abs(da) < 1e-9) {
      if (oa < lo || oa > hi) return null;
      continue;
    }
    let t1 = (lo - oa) / da;
    let t2 = (hi - oa) / da;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

export interface TubeHit {
  id: string;
  t: number;
}

/** Only player tubes are pickable; docks come and go with the parts they join. */
export function pickTube(ray: Ray, base: ResolvedBase, radius = TUBE_RADIUS + 0.3): TubeHit | null {
  let best: TubeHit | null = null;
  for (const tube of base.tubes.values()) {
    if (tube.kind !== 'tube') continue;
    for (let i = 0; i + 1 < tube.path.length; i++) {
      const hit = rayToSegment(ray, tube.path[i] as Vec3, tube.path[i + 1] as Vec3);
      if (hit.dist <= radius && hit.t > 0 && (best === null || hit.t < best.t)) {
        best = { id: tube.id, t: hit.t };
      }
    }
  }
  return best;
}

/**
 * Closest approach between a ray (parameter s >= 0, unit direction) and a
 * segment (parameter u in [0, 1]): the distance, and s at that point.
 */
function rayToSegment(ray: Ray, a: Vec3, b: Vec3): { dist: number; t: number } {
  const d: Vec3 = ray.dir;
  const e: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const r: Vec3 = [ray.origin[0] - a[0], ray.origin[1] - a[1], ray.origin[2] - a[2]];
  const dot = (u: Vec3, v: Vec3): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const aa = dot(d, d);
  const ee = dot(e, e);
  const bb = dot(d, e);
  const cc = dot(d, r);
  const ff = dot(e, r);
  const denom = aa * ee - bb * bb;

  let s = denom > 1e-12 ? Math.max(0, (bb * ff - cc * ee) / denom) : 0;
  let u = ee > 1e-12 ? (bb * s + ff) / ee : 0;
  if (u < 0) {
    u = 0;
    s = Math.max(0, -cc / aa);
  } else if (u > 1) {
    u = 1;
    s = Math.max(0, (bb - cc) / aa);
  }
  const px = ray.origin[0] + d[0] * s - (a[0] + e[0] * u);
  const py = ray.origin[1] + d[1] * s - (a[1] + e[1] * u);
  const pz = ray.origin[2] + d[2] * s - (a[2] + e[2] * u);
  return { dist: Math.hypot(px, py, pz), t: s };
}
