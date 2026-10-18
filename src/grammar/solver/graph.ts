/**
 * Stage — graph. The walkable network of a base: every part with a PRESS port is a node, every
 * dock and tube is an edge between two of its ports. Crew move on this graph and never off it, so
 * the sim needs nothing else from the solver to know where people can go.
 *
 * A node keeps one floor-level point per door (horizontal PRESS port) plus a centre on its floor;
 * walking through a node is port → centre → port. An edge keeps the tube's centreline lowered to
 * the floor. All lengths are
 * walking distances in metres. Derived nodes (inserted on long tubes) are nodes like any other.
 */
import type { Vec3 } from '@/core/math';
import type { PartId } from '@/world/document';
import { getPart } from '../registry';
import { pressVolume } from '../volume';
import { isHorizontal } from './ports';
import { PIPE_AXIS_LIFT } from './tube-path';
import type { Letter } from '../types';
import type { PressEdge, PressGraph, PressNode, ResolvedPart, ResolvedTube } from './types';

export function emptyGraph(): PressGraph {
  return { nodes: new Map(), edges: [] };
}

/** A pipe's centreline, lowered to the floor it stands on (M3.5 stage 1 replaces the pipe). */
const onFloor = (p: Vec3): Vec3 => [p[0], p[1] - PIPE_AXIS_LIFT, p[2]];

const dist = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

function pathLength(path: readonly Vec3[]): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a && b) sum += dist(a, b);
  }
  return sum;
}

export function buildGraph(
  parts: ReadonlyMap<PartId, ResolvedPart>,
  tubes: ReadonlyMap<string, ResolvedTube>,
): PressGraph {
  const nodes = new Map<PartId, PressNode>();
  for (const part of parts.values()) {
    // Doors are the horizontal PRESS ports, already on the floor; a vertical hatch leaves the graph.
    const press = part.ports.filter((p) => p.type === 'PRESS' && isHorizontal(p.normal));
    if (press.length === 0) continue;
    const ports = new Map<string, Vec3>();
    for (const p of press) ports.set(p.id, p.position);
    const def = getPart(part.letter);
    const floor = def?.floor?.(def.resolve(part.params)) ?? 0;
    // An EXT port sits on the ground already (the foot of a ramp): no floor drop.
    const exits = new Map<string, Vec3>();
    for (const p of part.ports) if (p.type === 'EXT') exits.set(p.id, p.position);
    nodes.set(part.id, {
      id: part.id,
      letter: part.letter as Letter,
      derived: part.derived === true,
      centre: [part.pose.x, part.pose.y + floor, part.pose.z],
      ports,
      exits,
      volume: pressVolume(part.letter, part.params),
    });
  }

  const edges: PressEdge[] = [];
  for (const t of [...tubes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const a = nodes.get(t.a.part);
    const b = nodes.get(t.b.part);
    if (!a || !b || !a.ports.has(t.a.port) || !b.ports.has(t.b.port)) continue;
    const path = t.path.map(onFloor);
    edges.push({ id: t.id, kind: t.kind, a: t.a, b: t.b, path, length: pathLength(path) });
  }
  return { nodes, edges };
}

/** Walking distance through a node between two of its ports (port → centre → port). */
export function crossLength(node: PressNode, from: string, to: string): number {
  if (from === to) return 0;
  const a = node.ports.get(from);
  const b = node.ports.get(to);
  if (!a || !b) return Infinity;
  return dist(a, node.centre) + dist(node.centre, b);
}

/** Group id (the smallest part id in it) of every node, over the edges. */
export function graphComponents(graph: PressGraph): Map<PartId, PartId> {
  const parent = new Map<PartId, PartId>();
  for (const id of graph.nodes.keys()) parent.set(id, id);
  const find = (x: PartId): PartId => {
    let r = x;
    for (let p = parent.get(r); p !== undefined && p !== r; p = parent.get(r)) r = p;
    return r;
  };
  for (const e of graph.edges) {
    const ra = find(e.a.part);
    const rb = find(e.b.part);
    if (ra === rb) continue;
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  }
  const out = new Map<PartId, PartId>();
  for (const id of graph.nodes.keys()) out.set(id, find(id));
  return out;
}
