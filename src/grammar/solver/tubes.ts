/**
 * Stage — tubes. Every player link of kind 'tube' becomes a routed tube
 * between two PRESS ports (grammar rule 2).
 *
 * Route: leave each port straight for at least TUBE_LEAD, then A* across the
 * 1 m lattice (45° headings, turn penalty) around hull footprints and earlier
 * tubes. A tube over TUBE_MAX_SPAN or with more than TUBE_MAX_KINKS bends is
 * split by inserting a derived node on a straight run near the middle, and
 * each half is checked again. Nothing is ever rejected (P1): a link whose
 * route fails still gets a straight tube, flagged in the diagnostics.
 *
 * Invariants: lattice route points keep >= 1 m clear of every hull footprint
 * cell (tube radius is 0.8 m), so tubes never cross hulls; derived nodes sit on
 * lattice points whose footprint cells were free; no two tubes share a lattice
 * point unless no other route existed.
 */
import {
  CORRIDOR_HALF_WIDTH,
  CORRIDOR_MAX_SLOPE,
  CORRIDOR_SLOPE_MIN_RUN,
  NODE_RADII,
  TUBE_LEAD,
  TUBE_MAX_KINKS,
  TUBE_MAX_SPAN,
  TUBE_PORT_EMBED,
} from '@/geometry/design-constants';
import { snapYaw, type Pose, type Vec3, type Yaw } from '@/core/math';
import type { BaseDocument, Link, PartInstance } from '@/world/document';
import { cellKey, cellOf, footprintCells } from '../footprint';
import { getPart } from '../registry';
import { portKey } from './dock';
import { ground, type Grounded } from './ground';
import { isHorizontal } from './ports';
import { corners, DIRS, route, type Lattice } from './route';
import { profileXZ, tubeFromPath } from './tube-path';
import type { Diagnostic, Draft, ResolvedPort, ResolvedTube, SolverWorld } from './types';

type XZ = [number, number];

export interface TubesResult {
  tubes: ResolvedTube[];
  /** Nodes inserted along long tubes, already grounded. */
  nodes: Grounded[];
}

export function linkKey(link: Link): string {
  const a = portKey(link.a.part, link.a.port);
  const b = portKey(link.b.part, link.b.port);
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

export function tubesStage(
  doc: BaseDocument,
  grounded: Grounded[],
  world: SolverWorld,
  taken: Set<number>,
  used: Set<string>,
  diagnostics: Diagnostic[],
): TubesResult {
  const ports = new Map<string, ResolvedPort>();
  for (const g of grounded) {
    for (const p of g.ports) ports.set(portKey(g.draft.instance.id, p.id), p);
  }

  const cellsOf = new Map<string, number[]>();
  for (const g of grounded) cellsOf.set(g.draft.instance.id, g.draft.cells);
  const result: TubesResult = { tubes: [], nodes: [] };
  const tubePoints = new Set<number>();

  for (const link of doc.links) {
    if (link.kind !== 'tube') continue;
    const ka = portKey(link.a.part, link.a.port);
    const kb = portKey(link.b.part, link.b.port);
    const pa = ports.get(ka);
    const pb = ports.get(kb);
    const skip = (reason: string): void => {
      diagnostics.push({ kind: 'link-skipped', link, reason });
    };
    if (!pa || !pb) {
      skip('missing port');
      continue;
    }
    if (ka === kb || link.a.part === link.b.part) {
      skip('same part');
      continue;
    }
    if (pa.type !== 'PRESS' || pb.type !== 'PRESS') {
      skip('not a PRESS port');
      continue;
    }
    if (!horizontal(pa) || !horizontal(pb)) {
      skip('tubes leave ports sideways');
      continue;
    }
    if (used.has(ka) || used.has(kb)) {
      skip('port already connected');
      continue;
    }
    used.add(ka);
    used.add(kb);

    const key = linkKey(link);
    const ctx: Ctx = {
      key,
      world,
      taken,
      tubePoints,
      diagnostics,
      result,
      used,
      nodeCount: 0,
      pieceCount: 0,
      journal: { taken: [], used: [], points: [] },
    };
    const ends = { a: { ref: link.a, port: pa }, b: { ref: link.b, port: pb } };
    const own = {
      a: new Set(cellsOf.get(link.a.part)),
      b: new Set(cellsOf.get(link.b.part)),
    };

    // Prefer a route with room for a node wherever one might be needed: first
    // hugging the obstacles, then with a wide berth. If neither works, build
    // the tight route anyway and flag it.
    let done = false;
    for (const clearance of [0, NODE_CLEARANCE]) {
      const route = routeLink(pa, pb, taken, tubePoints, clearance, own);
      if (!route.routed) continue;
      const m = checkpoint(ctx);
      if (build(ctx, { dense: route.dense, ...ends }, 0, true)) {
        done = true;
        break;
      }
      rollback(ctx, m);
    }
    if (!done) {
      const route = routeLink(pa, pb, taken, tubePoints, 0, own);
      if (!route.routed) diagnostics.push({ kind: 'tube-unroutable', tube: `tube:${key}` });
      build(ctx, { dense: route.dense, ...ends }, 0, false);
    }
  }
  return result;
}

// ---- Pieces ----------------------------------------------------------------------

interface End {
  ref: { part: string; port: string };
  port: ResolvedPort;
}

/** A stretch of tube between two ports; `dense` has a point per lattice step plus the exact end points. */
interface Piece {
  dense: XZ[];
  a: End;
  b: End;
}

interface Ctx {
  key: string;
  world: SolverWorld;
  taken: Set<number>;
  tubePoints: Set<number>;
  diagnostics: Diagnostic[];
  result: TubesResult;
  used: Set<string>;
  nodeCount: number;
  pieceCount: number;
  /** What this link added to the shared sets, so a failed attempt can be undone. */
  journal: { taken: number[]; used: string[]; points: number[] };
}

function claim(ctx: Ctx, cell: number): void {
  if (!ctx.taken.has(cell)) {
    ctx.taken.add(cell);
    ctx.journal.taken.push(cell);
  }
}

function useKey(ctx: Ctx, key: string): void {
  if (!ctx.used.has(key)) {
    ctx.used.add(key);
    ctx.journal.used.push(key);
  }
}

function markPoint(ctx: Ctx, key: number): void {
  if (!ctx.tubePoints.has(key)) {
    ctx.tubePoints.add(key);
    ctx.journal.points.push(key);
  }
}

function checkpoint(ctx: Ctx) {
  return {
    taken: ctx.journal.taken.length,
    used: ctx.journal.used.length,
    points: ctx.journal.points.length,
    tubes: ctx.result.tubes.length,
    nodes: ctx.result.nodes.length,
    diagnostics: ctx.diagnostics.length,
    nodeCount: ctx.nodeCount,
    pieceCount: ctx.pieceCount,
  };
}

function rollback(ctx: Ctx, m: ReturnType<typeof checkpoint>): void {
  for (const c of ctx.journal.taken.splice(m.taken)) ctx.taken.delete(c);
  for (const k of ctx.journal.used.splice(m.used)) ctx.used.delete(k);
  for (const p of ctx.journal.points.splice(m.points)) ctx.tubePoints.delete(p);
  ctx.result.tubes.length = m.tubes;
  ctx.result.nodes.length = m.nodes;
  ctx.diagnostics.length = m.diagnostics;
  ctx.nodeCount = m.nodeCount;
  ctx.pieceCount = m.pieceCount;
}

const NODE_R = NODE_RADII[0];
const MAX_DEPTH = 4;
/** Extra cells of clearance around a route that must leave room for a node (radius + margin). */
const NODE_CLEARANCE = 2;
/** Gap kept between a node's flange and the nearest earlier tube, on top of the tube radius. */
const NODE_TUBE_MARGIN = 0.75;
/** Spacing of the samples used to check that a port's straight lead is clear. */
const LEAD_STEP = 0.25;

/**
 * Turn a piece into tubes, splitting with nodes as needed. In strict mode a
 * piece that needs a node and has no room fails (returns false) so the caller
 * can try another route; otherwise it is flagged and built as is.
 */
function build(ctx: Ctx, piece: Piece, depth: number, strict: boolean): boolean {
  if (needsNode(piece.dense) && depth < MAX_DEPTH) {
    const split = insertNode(ctx, piece);
    if (split) {
      return build(ctx, split[0], depth + 1, strict) && build(ctx, split[1], depth + 1, strict);
    }
    if (strict) return false;
    ctx.diagnostics.push({ kind: 'tube-too-long', tube: `tube:${ctx.key}` });
  }
  finish(ctx, piece);
  return true;
}

function finish(ctx: Ctx, piece: Piece): void {
  const verts = corners(piece.dense.map((p): Lattice => [p[0], p[1]])).map((p): XZ => [p[0], p[1]]);
  // Start and end sit slightly inside the hulls (embedded along the port normals).
  const a = piece.a.port;
  const b = piece.b.port;
  const first = verts[0];
  const last = verts[verts.length - 1];
  if (first)
    verts[0] = [
      first[0] - a.normal[0] * (TUBE_PORT_EMBED + a.gap),
      first[1] - a.normal[2] * (TUBE_PORT_EMBED + a.gap),
    ];
  if (last)
    verts[verts.length - 1] = [
      last[0] - b.normal[0] * (TUBE_PORT_EMBED + b.gap),
      last[1] - b.normal[2] * (TUBE_PORT_EMBED + b.gap),
    ];

  const id = `tube:${ctx.key}:${ctx.pieceCount++}`;
  const tube = tubeFromPath({
    id,
    kind: 'tube',
    a: piece.a.ref,
    b: piece.b.ref,
    path: profileXZ(verts, a.position[1], b.position[1], ctx.world),
    world: ctx.world,
    legs: true,
  });
  ctx.result.tubes.push(tube);
  if (maxSlope(tube.path) > CORRIDOR_MAX_SLOPE) {
    ctx.diagnostics.push({ kind: 'corridor-steep', tube: tube.id });
  }
  for (const p of piece.dense) {
    if (Number.isInteger(p[0]) && Number.isInteger(p[1])) markPoint(ctx, cellKey(p[0], p[1]));
  }
}

/** Steepest rise over run along a centreline (segments shorter than CORRIDOR_SLOPE_MIN_RUN are skipped). */
export function maxSlope(path: readonly Vec3[]): number {
  let worst = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const run = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (run >= CORRIDOR_SLOPE_MIN_RUN) worst = Math.max(worst, Math.abs(b[1] - a[1]) / run);
  }
  return worst;
}

// ---- Node insertion --------------------------------------------------------------

function needsNode(dense: XZ[]): boolean {
  return length(dense) > TUBE_MAX_SPAN || kinks(dense) > TUBE_MAX_KINKS;
}

function length(dense: XZ[]): number {
  let l = 0;
  for (let i = 1; i < dense.length; i++) l += seg(dense, i - 1).len;
  return l;
}

function seg(dense: XZ[], i: number): { len: number; dx: number; dz: number } {
  const a = dense[i] as XZ;
  const b = dense[i + 1] as XZ;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { len, dx: len > 0 ? (b[0] - a[0]) / len : 0, dz: len > 0 ? (b[1] - a[1]) / len : 0 };
}

/** Number of direction changes (over ~1°) along the polyline. */
function kinks(dense: XZ[]): number {
  let n = 0;
  let prev: { dx: number; dz: number } | null = null;
  for (let i = 0; i + 1 < dense.length; i++) {
    const s = seg(dense, i);
    if (s.len < 1e-9) continue;
    if (prev && prev.dx * s.dx + prev.dz * s.dz < Math.cos(Math.PI / 180)) n++;
    prev = s;
  }
  return n;
}

/**
 * Put a node on a straight run near the middle of the piece and return the two
 * halves, or null when there is no room.
 */
function insertNode(ctx: Ctx, piece: Piece): [Piece, Piece] | null {
  const d = piece.dense;
  const total = length(d);
  const margin = NODE_R + TUBE_LEAD + 0.5;

  // Arc position of every dense point.
  const arc: number[] = [0];
  for (let i = 1; i < d.length; i++) arc.push((arc[i - 1] ?? 0) + seg(d, i - 1).len);

  const def = getPart('N');
  if (!def) return null;
  const params = def.resolve({ size: NODE_R });
  const footprint = def.footprint(params);
  const nodeReach =
    (footprint.kind === 'rect' ? Math.hypot(footprint.hx, footprint.hz) : footprint.r) +
    CORRIDOR_HALF_WIDTH +
    NODE_TUBE_MARGIN;

  let best: { i: number; score: number; yaw: Yaw } | null = null;
  for (let i = 1; i + 1 < d.length; i++) {
    const p = d[i] as XZ;
    if (!Number.isInteger(p[0]) || !Number.isInteger(p[1])) continue;
    const s = arc[i] ?? 0;
    if (s < margin || total - s < margin) continue;
    if (!straightAround(d, arc, i, NODE_R + 0.5)) continue;
    const dir = seg(d, i);
    // Heading as a 45° stop; the node's local +X runs along the tube.
    const k = Math.round(Math.atan2(dir.dz, dir.dx) / (Math.PI / 4));
    const yaw = snapYaw(-45 * k);
    const cells = footprintCells(footprint, { x: p[0], y: 0, z: p[1], yaw });
    if (cells.some((c) => ctx.taken.has(c))) continue;
    if (nearTube(ctx.tubePoints, p, nodeReach)) continue;
    const score = Math.abs(s - total / 2);
    if (!best || score < best.score) best = { i, score, yaw };
  }
  if (!best) return null;

  const c = d[best.i] as XZ;
  const id = `node:${ctx.key}:${ctx.nodeCount++}`;
  const instance: PartInstance = {
    id,
    letter: 'N',
    params,
    pose: { x: c[0], z: c[1], yaw: best.yaw },
    serial: 0,
  };
  const pose: Pose = { x: c[0], y: 0, z: c[1], yaw: best.yaw };
  const draft: Draft = {
    def,
    instance,
    params,
    footprint,
    requested: { x: c[0], z: c[1], yaw: best.yaw },
    pose,
    cells: footprintCells(footprint, pose),
  };
  const [node] = ground([draft], ctx.world).grounded;
  if (!node) return null;
  for (const cell of node.draft.cells) claim(ctx, cell);
  ctx.result.nodes.push(node);

  const xMinus = node.ports.find((p) => p.id === 'x-');
  const xPlus = node.ports.find((p) => p.id === 'x+');
  if (!xMinus || !xPlus) return null;
  useKey(ctx, portKey(id, 'x-'));
  useKey(ctx, portKey(id, 'x+'));

  // Left half: points up to the node's -X port; right half: from its +X port on.
  const left: XZ[] = [];
  for (let i = 0; i <= best.i; i++) {
    const p = d[i] as XZ;
    if (Math.hypot(p[0] - c[0], p[1] - c[1]) >= NODE_R - 1e-6) left.push(p);
    else break;
  }
  left.push([xMinus.position[0], xMinus.position[2]]);
  const right: XZ[] = [[xPlus.position[0], xPlus.position[2]]];
  for (let i = best.i + 1; i < d.length; i++) {
    const p = d[i] as XZ;
    if (Math.hypot(p[0] - c[0], p[1] - c[1]) > NODE_R + 1e-6) right.push(p);
  }
  return [
    { dense: dedupe(left), a: piece.a, b: { ref: { part: id, port: 'x-' }, port: xMinus } },
    { dense: dedupe(right), a: { ref: { part: id, port: 'x+' }, port: xPlus }, b: piece.b },
  ];
}

/** Does an earlier tube have a lattice point within `reach` of (c)? */
function nearTube(points: Set<number>, c: XZ, reach: number): boolean {
  const r = Math.ceil(reach);
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > reach * reach) continue;
      if (points.has(cellKey(c[0] + dx, c[1] + dz))) return true;
    }
  }
  return false;
}

/** Is the polyline one straight line within `reach` metres of point i on both sides? */
function straightAround(d: XZ[], arc: number[], i: number, reach: number): boolean {
  const here = seg(d, i);
  const same = (j: number): boolean => {
    const s = seg(d, j);
    return s.dx * here.dx + s.dz * here.dz > Math.cos(Math.PI / 180);
  };
  for (let j = i; j + 1 < d.length && (arc[j] ?? 0) - (arc[i] ?? 0) < reach; j++) {
    if (!same(j)) return false;
  }
  for (let j = i - 1; j >= 0 && (arc[i] ?? 0) - (arc[j] ?? 0) < reach; j--) {
    if (!same(j)) return false;
  }
  return true;
}

function dedupe(points: XZ[]): XZ[] {
  const out: XZ[] = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  return out;
}

// ---- Routing a link -------------------------------------------------------------

function horizontal(p: ResolvedPort): boolean {
  return isHorizontal(p.normal);
}

function heading(p: ResolvedPort): number {
  return ((Math.round(Math.atan2(p.normal[2], p.normal[0]) / (Math.PI / 4)) % 8) + 8) % 8;
}

/** A lattice point is free when the cells around it, `clearance` extra cells out, are. */
function pointFree(taken: Set<number>, x: number, z: number, clearance = 0): boolean {
  for (let j = z - 1 - clearance; j <= z + clearance; j++) {
    for (let i = x - 1 - clearance; i <= x + clearance; i++) {
      if (taken.has(cellKey(i, j))) return false;
    }
  }
  return true;
}

/** First lattice point at least TUBE_LEAD out along the port's heading that is free. */
function leadPoint(p: ResolvedPort, k: number, free: (x: number, z: number) => boolean): Lattice {
  const [dx, dz] = DIRS[k] as Lattice;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const px = p.position[0];
  const pz = p.position[2];
  let qx: number;
  let qz: number;
  if (dx !== 0) {
    qx = dx > 0 ? Math.ceil(px + ux * TUBE_LEAD - 1e-9) : Math.floor(px + ux * TUBE_LEAD + 1e-9);
    qz = pz + (uz / ux) * (qx - px);
  } else {
    qz = dz > 0 ? Math.ceil(pz + uz * TUBE_LEAD - 1e-9) : Math.floor(pz + uz * TUBE_LEAD + 1e-9);
    qx = px;
  }
  qx = Math.round(qx);
  qz = Math.round(qz);
  const x0 = qx;
  const z0 = qz;
  for (let n = 0; n < 16; n++) {
    if (free(qx, qz)) return [qx, qz];
    qx += dx;
    qz += dz;
  }
  return [x0, z0];
}

/** Does the straight lead from a port to its first lattice point stay off every hull but the port's own (`own`)? */
function leadClear(p: ResolvedPort, q: Lattice, taken: Set<number>, own: Set<number>): boolean {
  const px = p.position[0];
  const pz = p.position[2];
  const steps = Math.max(1, Math.ceil(Math.hypot(q[0] - px, q[1] - pz) / LEAD_STEP));
  for (let s = 0; s <= steps; s++) {
    const x = px + ((q[0] - px) * s) / steps;
    const z = pz + ((q[1] - pz) * s) / steps;
    // The four cells around the sample: a tube is about as wide as one cell.
    for (const dz of [-0.5, 0.5]) {
      for (const dx of [-0.5, 0.5]) {
        const key = cellKey(cellOf(x + dx), cellOf(z + dz));
        if (taken.has(key) && !own.has(key)) return false;
      }
    }
  }
  return true;
}

/**
 * Dense (x,z) route from port a to port b, exact at both ends. `routed` is
 * false when no lattice route exists; `dense` is then a straight fallback.
 */
function routeLink(
  pa: ResolvedPort,
  pb: ResolvedPort,
  taken: Set<number>,
  tubePoints: Set<number>,
  clearance: number,
  own: { a: Set<number>; b: Set<number> },
): { dense: XZ[]; routed: boolean } {
  const ka = heading(pa);
  const kb = heading(pb);
  const hullFree = (x: number, z: number): boolean => pointFree(taken, x, z, clearance);
  const clearFree = (x: number, z: number): boolean =>
    hullFree(x, z) && !tubePoints.has(cellKey(x, z));

  const qa = leadPoint(pa, ka, hullFree);
  const qb = leadPoint(pb, kb, hullFree);
  const goalHeading = (kb + 4) % 8;

  // A port that stares at another hull cannot leave straight: walking the lead out
  // past that hull would put the tube through it. Hand back the flagged fallback.
  if (!leadClear(pa, qa, taken, own.a) || !leadClear(pb, qb, taken, own.b)) {
    return {
      dense: dedupe([
        [pa.position[0], pa.position[2]],
        [qa[0], qa[1]],
        [qb[0], qb[1]],
        [pb.position[0], pb.position[2]],
      ]),
      routed: false,
    };
  }

  // The route's own endpoints must be usable even if a neighbour's cells touch them.
  const withEnds =
    (f: (x: number, z: number) => boolean) =>
    (x: number, z: number): boolean =>
      (x === qa[0] && z === qa[1]) || (x === qb[0] && z === qb[1]) || f(x, z);

  const query = (free: (x: number, z: number) => boolean) =>
    route({ start: qa, startHeading: ka, goal: qb, goalHeading, free });

  const lattice = query(withEnds(clearFree)) ?? query(withEnds(hullFree));
  const mid: XZ[] = lattice
    ? lattice.map((p): XZ => [p[0], p[1]])
    : [
        [qa[0], qa[1]],
        [qb[0], qb[1]],
      ];
  return {
    dense: dedupe([[pa.position[0], pa.position[2]], ...mid, [pb.position[0], pb.position[2]]]),
    routed: lattice !== null,
  };
}
