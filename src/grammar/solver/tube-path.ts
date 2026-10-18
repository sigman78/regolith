/**
 * Turning a centreline into a ResolvedTube: height profile over the terrain,
 * support legs every TUBE_LEG_SPACING, and the (hashable) geometry recipe.
 *
 * Invariants: the first and last points keep the port heights (plus PIPE_AXIS_LIFT) exactly; every
 * point in between is at least TUBE_RADIUS + TUBE_GROUND_GAP above the terrain;
 * each leg ends in the terrain (FOOT_SINK below it) and reaches the tube's
 * underside. Coordinates are rounded to 1 mm so hashes are stable.
 */
import {
  FOOT_SINK,
  TUBE_GROUND_GAP,
  TUBE_LEG_SPACING,
  TUBE_RADIUS,
  TUBE_SAMPLE,
} from '@/geometry/design-constants';
import { hashValue } from '@/core/hash';
import type { Vec3 } from '@/core/math';
import type { PortRef } from '@/world/document';
import type { Leg, ResolvedTube, SolverWorld } from './types';

const mm = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * Ports sit on the floor; a round pipe stands on it, so its axis is one radius up. The walking
 * path (graph.ts) is the axis lowered by the same amount. Retires with the pipe (M3.5 stage 1).
 */
export const PIPE_AXIS_LIFT = TUBE_RADIUS;

export interface TubeInput {
  id: string;
  kind: 'dock' | 'tube';
  a: PortRef;
  b: PortRef;
  /** 3D centreline, ends already embedded */
  path: Vec3[];
  world: SolverWorld;
  legs: boolean;
}

export function tubeFromPath(o: TubeInput): ResolvedTube {
  const path = o.path.map((p): Vec3 => [mm(p[0]), mm(p[1]), mm(p[2])]);
  const recipe = { ops: [{ kind: 'tube' as const, points: path.flatMap((p) => [...p]) }] };
  return {
    id: o.id,
    kind: o.kind,
    a: o.a,
    b: o.b,
    path,
    legs: o.legs ? tubeLegs(path, o.world) : [],
    recipe,
    recipeHash: hashValue(recipe),
  };
}

/**
 * Lift a flat (x,z) polyline into 3D: heights run from `ya` to `yb` along the
 * length, pushed up wherever the terrain would otherwise touch the tube, and
 * the polyline is subdivided so the profile follows the ground.
 */
export function profileXZ(
  xz: readonly [number, number][],
  ya: number,
  yb: number,
  world: SolverWorld,
): Vec3[] {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < xz.length; i++) {
    const a = xz[i] as [number, number];
    const b = xz[i + 1] as [number, number];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lens.push(l);
    total += l;
  }
  const floor = TUBE_RADIUS + TUBE_GROUND_GAP;
  const out: Vec3[] = [];
  let s = 0;
  for (let i = 0; i + 1 < xz.length; i++) {
    const a = xz[i] as [number, number];
    const b = xz[i + 1] as [number, number];
    const l = lens[i] ?? 0;
    const n = Math.max(1, Math.ceil(l / TUBE_SAMPLE));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const ss = s + l * t;
      const y =
        ss === 0
          ? ya
          : Math.max(ya + (yb - ya) * (total > 0 ? ss / total : 0), world.heightAt(x, z) + floor);
      out.push([x, y, z]);
    }
    s += l;
  }
  const last = xz[xz.length - 1];
  if (last) out.push([last[0], yb, last[1]]);
  return out;
}

function tubeLegs(path: Vec3[], world: SolverWorld): Leg[] {
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Vec3;
    const b = path[i] as Vec3;
    cum.push((cum[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = cum[cum.length - 1] ?? 0;
  const legs: Leg[] = [];
  let seg = 0;
  for (let s = TUBE_LEG_SPACING / 2; s < total - 1.5; s += TUBE_LEG_SPACING) {
    if (s < 1.5) continue;
    while (seg + 2 < cum.length && (cum[seg + 1] ?? Infinity) < s) seg++;
    const a = path[seg] as Vec3;
    const b = path[seg + 1] as Vec3;
    const span = (cum[seg + 1] ?? 0) - (cum[seg] ?? 0);
    const t = span > 0 ? (s - (cum[seg] ?? 0)) / span : 0;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    legs.push({
      portId: `tube-leg-${legs.length}`,
      top: [mm(x), mm(y - TUBE_RADIUS), mm(z)],
      bottom: [mm(x), mm(world.heightAt(x, z) - FOOT_SINK), mm(z)],
    });
  }
  return legs;
}
