/**
 * Stage — dock. PRESS ports that face each other across a short gap become a
 * dock: a one-piece collar bridge between them (rule 1 of the grammar).
 *
 * A pair docks when the ports are within DOCK_RANGE, their normals oppose
 * within DOCK_ANGLE_DEG, and the lateral offset is under DOCK_LATERAL. Each
 * port docks at most once; closer pairs win, ties break by id for
 * determinism. A spatial hash keeps it near-linear in the number of ports.
 */
import {
  DOCK_ANGLE_DEG,
  DOCK_LATERAL,
  DOCK_RANGE,
  TUBE_PORT_EMBED,
} from '@/geometry/design-constants';
import type { Vec3 } from '@/core/math';
import type { PartId } from '@/world/document';
import type { Grounded } from './ground';
import { PIPE_AXIS_LIFT, tubeFromPath } from './tube-path';
import type { ResolvedTube, SolverWorld } from './types';

const BUCKET = DOCK_RANGE * 2;
const MIN_OPPOSE = -Math.cos((DOCK_ANGLE_DEG * Math.PI) / 180);

interface PortEntry {
  part: PartId;
  port: string;
  pos: Vec3;
  normal: Vec3;
  /** the hull is this far behind the port (ResolvedPort.gap) */
  gap: number;
}

export const portKey = (part: PartId, port: string): string => `${part}/${port}`;

export function dock(grounded: Grounded[], world: SolverWorld, used: Set<string>): ResolvedTube[] {
  const entries: PortEntry[] = [];
  const buckets = new Map<string, PortEntry[]>();
  const bucketOf = (p: Vec3): [number, number] => [
    Math.floor(p[0] / BUCKET),
    Math.floor(p[2] / BUCKET),
  ];

  for (const g of grounded) {
    for (const p of g.ports) {
      if (p.type !== 'PRESS') continue;
      const e: PortEntry = {
        part: g.draft.instance.id,
        port: p.id,
        pos: p.position,
        normal: p.normal,
        gap: p.gap,
      };
      entries.push(e);
      const [bx, bz] = bucketOf(p.position);
      const key = `${bx},${bz}`;
      const list = buckets.get(key);
      if (list) list.push(e);
      else buckets.set(key, [e]);
    }
  }

  const candidates: { a: PortEntry; b: PortEntry; d: number }[] = [];
  for (const a of entries) {
    const [bx, bz] = bucketOf(a.pos);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const b of buckets.get(`${bx + dx},${bz + dz}`) ?? []) {
          if (a.part >= b.part) continue; // each pair once, never within one part
          const d = dockDistance(a, b);
          if (d !== null) candidates.push({ a, b, d });
        }
      }
    }
  }
  candidates.sort(
    (x, y) =>
      x.d - y.d ||
      portKey(x.a.part, x.a.port).localeCompare(portKey(y.a.part, y.a.port)) ||
      portKey(x.b.part, x.b.port).localeCompare(portKey(y.b.part, y.b.port)),
  );

  const tubes: ResolvedTube[] = [];
  for (const { a, b } of candidates) {
    const ka = portKey(a.part, a.port);
    const kb = portKey(b.part, b.port);
    if (used.has(ka) || used.has(kb)) continue;
    used.add(ka);
    used.add(kb);
    const path: Vec3[] = [embed(a), embed(b)];
    tubes.push(
      tubeFromPath({
        id: `dock:${ka}~${kb}`,
        kind: 'dock',
        a: { part: a.part, port: a.port },
        b: { part: b.part, port: b.port },
        path,
        world,
        // A dock is a collar bridge between two hulls that already stand on legs.
        legs: false,
      }),
    );
  }
  return tubes;
}

/** Distance between two ports if they can dock, else null. */
function dockDistance(a: PortEntry, b: PortEntry): number | null {
  if (
    a.normal[0] * b.normal[0] + a.normal[1] * b.normal[1] + a.normal[2] * b.normal[2] >
    MIN_OPPOSE
  ) {
    return null;
  }
  const v: Vec3 = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]];
  const d = Math.hypot(...v);
  if (d > DOCK_RANGE) return null;
  const along = v[0] * a.normal[0] + v[1] * a.normal[1] + v[2] * a.normal[2];
  if (along < -0.3) return null; // b is behind a
  const lateral = Math.hypot(
    v[0] - along * a.normal[0],
    v[1] - along * a.normal[1],
    v[2] - along * a.normal[2],
  );
  return lateral <= DOCK_LATERAL ? d : null;
}

function embed(e: PortEntry): Vec3 {
  const depth = TUBE_PORT_EMBED + e.gap;
  return [
    e.pos[0] - e.normal[0] * depth,
    e.pos[1] + PIPE_AXIS_LIFT - e.normal[1] * depth,
    e.pos[2] - e.normal[2] * depth,
  ];
}
