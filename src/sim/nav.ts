/**
 * Navigation over the press graph (grammar/solver/graph.ts). Every node contributes a centre
 * vertex and one vertex per PRESS port; the arcs are port <-> centre (inside a part) and port <->
 * port along a dock or tube. A route is a list of steps that name graph pieces, never coordinates,
 * so the same route keeps meaning when a part is dragged and the graph is rebuilt.
 */
import type { Vec3 } from '@/core/math';
import type { PartId } from '@/world/document';
import type { PressEdge, PressGraph } from '@/grammar/solver';
import { FLAT_ENV, loiterSpot, type NavEnv } from './loiter';

export const CENTRE = '@centre';

export type Step =
  /** inside a node, between its centre and one of its ports (either way) */
  | { k: 'node'; node: PartId; from: string; to: string }
  /** along a dock or tube; dir -1 walks it from b to a */
  | { k: 'edge'; edge: string; dir: 1 | -1 }
  /** outdoors, between an airlock's ramp foot and its loiter spot (dir -1 walks back) */
  | { k: 'out'; node: PartId; exit: string; slot: number; dir: 1 | -1 };

interface Arc {
  to: string;
  cost: number;
  step: Step;
}

export interface Nav {
  graph: PressGraph;
  /** the ground and keep-out mask outside the press graph (from the same solve as the graph) */
  env: NavEnv;
  /** loiter spots already worked out, by `node/exit/slot` */
  spots: Map<string, Vec3>;
  edgeById: Map<string, PressEdge>;
  /** each edge's walkway capped with its two port points, so steps join without a jump */
  edgePath: Map<string, Vec3[]>;
  arcs: Map<string, Arc[]>;
}

const vertex = (part: PartId, port: string): string => `${part.length}:${part}/${port}`;

const dist = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

const navCache = new WeakMap<PressGraph, Nav>();

/** The nav of a graph; `env` is read the first time (graph and env come from one solve). */
export function navOf(graph: PressGraph, env: NavEnv = FLAT_ENV): Nav {
  const hit = navCache.get(graph);
  if (hit) return hit;
  const arcs = new Map<string, Arc[]>();
  const add = (from: string, arc: Arc): void => {
    const list = arcs.get(from);
    if (list) list.push(arc);
    else arcs.set(from, [arc]);
  };
  for (const node of graph.nodes.values()) {
    const c = vertex(node.id, CENTRE);
    arcs.set(c, arcs.get(c) ?? []);
    for (const [port, p] of node.ports) {
      const v = vertex(node.id, port);
      const d = dist(p, node.centre);
      add(c, { to: v, cost: d, step: { k: 'node', node: node.id, from: CENTRE, to: port } });
      add(v, { to: c, cost: d, step: { k: 'node', node: node.id, from: port, to: CENTRE } });
    }
    // The way out: centre <-> ramp foot, through the door.
    for (const [exit, p] of node.exits) {
      const v = vertex(node.id, exit);
      const d = dist(p, node.centre);
      add(c, { to: v, cost: d, step: { k: 'node', node: node.id, from: CENTRE, to: exit } });
      add(v, { to: c, cost: d, step: { k: 'node', node: node.id, from: exit, to: CENTRE } });
    }
  }
  const edgeById = new Map<string, PressEdge>();
  const edgePath = new Map<string, Vec3[]>();
  for (const e of graph.edges) {
    edgeById.set(e.id, e);
    const pa = graph.nodes.get(e.a.part)?.ports.get(e.a.port);
    const pb = graph.nodes.get(e.b.part)?.ports.get(e.b.port);
    const path = [...(pa ? [pa] : []), ...e.path, ...(pb ? [pb] : [])];
    edgePath.set(e.id, path);
    const len = polylineLength(path);
    const a = vertex(e.a.part, e.a.port);
    const b = vertex(e.b.part, e.b.port);
    add(a, { to: b, cost: len, step: { k: 'edge', edge: e.id, dir: 1 } });
    add(b, { to: a, cost: len, step: { k: 'edge', edge: e.id, dir: -1 } });
  }
  const nav: Nav = { graph, env, spots: new Map(), edgeById, edgePath, arcs };
  navCache.set(graph, nav);
  return nav;
}

/** Shortest walk from the centre of one node to the centre of another, or null when unreachable. */
export function route(nav: Nav, from: PartId, to: PartId): Step[] | null {
  if (from === to) return [];
  return walk(nav, vertex(from, CENTRE), vertex(to, CENTRE));
}

/** Shortest walk from a node's centre to one of its airlock exits (ends on the step through the door). */
export function routeToExit(nav: Nav, from: PartId, lock: PartId, exit: string): Step[] | null {
  return walk(nav, vertex(from, CENTRE), vertex(lock, exit));
}

function walk(nav: Nav, start: string, goal: string): Step[] | null {
  if (start === goal) return [];
  if (!nav.arcs.has(start) || !nav.arcs.has(goal)) return null;

  const best = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, { from: string; step: Step }>();
  const done = new Set<string>();
  // Linear-scan Dijkstra: graphs are a few hundred vertices and routes are rare.
  for (;;) {
    let u: string | null = null;
    let ud = Infinity;
    for (const [k, d] of best) {
      if (done.has(k)) continue;
      if (d < ud || (d === ud && u !== null && k < u)) {
        u = k;
        ud = d;
      }
    }
    if (u === null) return null;
    if (u === goal) break;
    done.add(u);
    for (const arc of nav.arcs.get(u) ?? []) {
      const nd = ud + arc.cost;
      const cur = best.get(arc.to);
      if (cur === undefined || nd < cur - 1e-12) {
        best.set(arc.to, nd);
        prev.set(arc.to, { from: u, step: arc.step });
      }
    }
  }
  const steps: Step[] = [];
  for (let v = goal; v !== start;) {
    const p = prev.get(v);
    if (!p) return null;
    steps.push(p.step);
    v = p.from;
  }
  return steps.reverse();
}

/** The polyline a step walks, resolved against the current graph; null if a piece is gone. */
export function stepPolyline(nav: Nav, step: Step): Vec3[] | null {
  if (step.k === 'out') {
    const node = nav.graph.nodes.get(step.node);
    const foot = node?.exits.get(step.exit);
    if (!node || !foot) return null;
    const key = `${step.node}/${step.exit}/${step.slot}`;
    let spot = nav.spots.get(key);
    if (!spot) {
      spot = loiterSpot(nav.env, node.centre, foot, step.slot);
      nav.spots.set(key, spot);
    }
    return step.dir === 1 ? [foot, spot] : [spot, foot];
  }
  if (step.k === 'edge') {
    const path = nav.edgePath.get(step.edge);
    if (!path) return null;
    return step.dir === 1 ? path : [...path].reverse();
  }
  const node = nav.graph.nodes.get(step.node);
  if (!node) return null;
  const at = (id: string): Vec3 | undefined =>
    id === CENTRE ? node.centre : (node.ports.get(id) ?? node.exits.get(id));
  const a = at(step.from);
  const b = at(step.to);
  return a && b ? [a, b] : null;
}

export function polylineLength(poly: readonly Vec3[]): number {
  let sum = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    if (a && b) sum += dist(a, b);
  }
  return sum;
}

/** The point `s` metres along a polyline and the unit heading there (clamped to the ends). */
export function sampleAlong(
  poly: readonly Vec3[],
  s: number,
): { point: Vec3; heading: [number, number] } {
  let left = Math.max(0, s);
  let last: [number, number] = [1, 0];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    if (!a || !b) continue;
    const len = dist(a, b);
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const flat = Math.hypot(dx, dz);
    if (flat > 1e-9) last = [dx / flat, dz / flat];
    if (left <= len || i === poly.length - 1) {
      const t = len > 1e-9 ? Math.min(1, left / len) : 0;
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
        heading: last,
      };
    }
    left -= len;
  }
  const only = poly[0] ?? [0, 0, 0];
  return { point: [only[0], only[1], only[2]], heading: last };
}
