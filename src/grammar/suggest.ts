/**
 * Suggested connections: given a part, which tubes would the player most likely want from it?
 * Derived on demand and never stored; accepting one is an ordinary `addLink`, so every rule of the
 * solver (P1: nothing is rejected) holds for it exactly as for a link drawn by hand.
 *
 * A candidate is a free, tube-capable PRESS port on the part paired with one on another part that
 * is close enough and roughly faces it. Each is verified with a trial solve, which is the real
 * router, so a suggestion that is offered is one that routes cleanly: no skipped link, no
 * unroutable or too-long tube. They are ranked by what they achieve first (joining two separate
 * groups of parts beats adding a second path between parts that are already joined), then by how
 * cheap the tube is (length, bends, nodes).
 */
import type { Vec3 } from '@/core/math';
import { TUBE_MAX_SPAN } from '@/geometry/design-constants';
import { addLink, type BaseDocument, type Link, type PartId } from '@/world/document';
import {
  canTakeTube,
  linkKey,
  solve,
  type ResolvedBase,
  type ResolvedPart,
  type ResolvedPort,
  type ResolvedTube,
  type SolverWorld,
} from './solver';

export const MAX_SUGGESTIONS = 3;
/** Targets tried per request; each costs one trial solve (two when the nearest pairing fails). */
const MAX_TARGETS = 6;
/** Ports facing at most this far past sideways still count as facing (cosine of the angle). */
const FACING_SLACK = -0.2;
/** A route longer than this many times the straight distance, plus the slack, is a detour, not a suggestion. */
const DETOUR_RATIO = 1.7;
const DETOUR_SLACK = 5;
/** What a bend and a node cost, in metres of tube, when ranking. */
const KINK_COST = 3;
const NODE_COST = 6;

export interface Suggestion {
  link: Link;
  /** the other end's part, for labels */
  target: PartId;
  /** total tube length in metres, over every piece */
  length: number;
  kinks: number;
  /** derived nodes the route needs */
  nodes: number;
  /** true when the two parts are not connected to each other yet */
  joinsComponents: boolean;
  /** Where to hang a label: the middle of the route, world space. */
  anchor: Vec3;
  /** What accepting would add, as the trial solve built it, so a preview needs no second solve. */
  tubes: ResolvedTube[];
  parts: ResolvedPart[];
}

interface Pair {
  mine: ResolvedPort;
  theirs: ResolvedPort;
  target: PartId;
  distance: number;
}

/** Up to MAX_SUGGESTIONS connections from `partId`, best first. Empty if there is nothing sensible. */
export function suggestLinks(
  doc: BaseDocument,
  base: ResolvedBase,
  partId: PartId,
  world: SolverWorld,
): Suggestion[] {
  const part = base.parts.get(partId);
  if (!part || part.derived) return [];

  const group = components(base);
  const free = (id: PartId, p: ResolvedPort): boolean =>
    canTakeTube(p) && !base.usedPorts.has(`${id}/${p.id}`);
  const mine = part.ports.filter((p) => free(partId, p));
  if (mine.length === 0) return [];

  // The best pairings per target part, nearest first.
  const byTarget = new Map<PartId, Pair[]>();
  for (const other of base.parts.values()) {
    if (other.id === partId || other.derived) continue;
    for (const theirs of other.ports) {
      if (!free(other.id, theirs)) continue;
      for (const m of mine) {
        const pair = pairing(m, theirs, other.id);
        if (!pair) continue;
        const list = byTarget.get(other.id);
        if (list) list.push(pair);
        else byTarget.set(other.id, [pair]);
      }
    }
  }
  const targets = [...byTarget.entries()]
    .map(([id, pairs]) => ({ id, pairs: pairs.sort((a, b) => a.distance - b.distance) }))
    .sort((a, b) => {
      const ja = group.get(a.id) !== group.get(partId) ? 0 : 1;
      const jb = group.get(b.id) !== group.get(partId) ? 0 : 1;
      return (
        ja - jb || (a.pairs[0]?.distance ?? 0) - (b.pairs[0]?.distance ?? 0) || cmp(a.id, b.id)
      );
    })
    .slice(0, MAX_TARGETS);

  const found: Suggestion[] = [];
  for (const t of targets) {
    // Targets come best first (separate groups, then nearest), so three clean ones are enough.
    if (found.length >= MAX_SUGGESTIONS) break;
    for (const pair of t.pairs.slice(0, 2)) {
      const link: Link = {
        a: { part: partId, port: pair.mine.id },
        b: { part: pair.target, port: pair.theirs.id },
        kind: 'tube',
      };
      const s = verify(doc, world, link, pair, group.get(partId) !== group.get(pair.target));
      if (s) {
        found.push(s);
        break;
      }
    }
  }

  return found.sort(rank).slice(0, MAX_SUGGESTIONS);
}

function pairing(mine: ResolvedPort, theirs: ResolvedPort, target: PartId): Pair | null {
  const dx = theirs.position[0] - mine.position[0];
  const dz = theirs.position[2] - mine.position[2];
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-3 || distance > TUBE_MAX_SPAN) return null;
  const facingMine = (mine.normal[0] * dx + mine.normal[2] * dz) / distance;
  const facingTheirs = -(theirs.normal[0] * dx + theirs.normal[2] * dz) / distance;
  if (facingMine < FACING_SLACK || facingTheirs < FACING_SLACK) return null;
  return { mine, theirs, target, distance };
}

/** The suggestion for `link`, or null if the real router cannot build it cleanly. */
function verify(
  doc: BaseDocument,
  world: SolverWorld,
  link: Link,
  pair: Pair,
  joinsComponents: boolean,
): Suggestion | null {
  const key = linkKey(link);
  const trial = solve(addLink(doc, link), world);
  const mineTube = `tube:${key}`;
  for (const d of trial.diagnostics) {
    if (d.kind === 'link-skipped' && linkKey(d.link) === key) return null;
    if ((d.kind === 'tube-unroutable' || d.kind === 'tube-too-long') && d.tube.startsWith(mineTube))
      return null;
  }
  const tubes = [...trial.tubes.values()].filter((t) => t.id.startsWith(`${mineTube}:`));
  if (tubes.length === 0) return null;
  const parts = [...trial.parts.values()].filter((p) => p.id.startsWith(`node:${key}:`));

  let length = 0;
  let kinks = 0;
  const line: Vec3[] = [];
  for (const t of tubes) {
    length += polylineLength(t.path);
    kinks += bends(t.path);
    line.push(...t.path);
  }
  if (length > DETOUR_RATIO * pair.distance + DETOUR_SLACK) return null;
  // A second path between parts that are already joined is only worth offering when it is plain.
  if (!joinsComponents && parts.length > 0) return null;
  return {
    link,
    target: pair.target,
    length,
    kinks,
    nodes: parts.length,
    joinsComponents,
    anchor: midpoint(line),
    tubes,
    parts,
  };
}

function rank(a: Suggestion, b: Suggestion): number {
  if (a.joinsComponents !== b.joinsComponents) return a.joinsComponents ? -1 : 1;
  const cost = (s: Suggestion): number => s.length + KINK_COST * s.kinks + NODE_COST * s.nodes;
  return cost(a) - cost(b) || cmp(linkKey(a.link), linkKey(b.link));
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Which group of connected parts each part is in (docks, tubes and their derived nodes count). */
function components(base: ResolvedBase): Map<PartId, PartId> {
  const parent = new Map<PartId, PartId>();
  const find = (x: PartId): PartId => {
    let root = x;
    for (let p = parent.get(root); p !== undefined && p !== root; p = parent.get(root)) root = p;
    parent.set(x, root);
    return root;
  };
  for (const id of base.parts.keys()) parent.set(id, id);
  for (const t of base.tubes.values()) {
    const ra = find(t.a.part);
    const rb = find(t.b.part);
    if (ra !== rb) parent.set(ra, rb);
  }
  const out = new Map<PartId, PartId>();
  for (const id of base.parts.keys()) out.set(id, find(id));
  return out;
}

function polylineLength(path: readonly Vec3[]): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a && b) sum += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return sum;
}

/** Turns of more than about 10° in plan. */
function bends(path: readonly Vec3[]): number {
  let n = 0;
  let last: [number, number] | null = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const dir: [number, number] = [dx / len, dz / len];
    if (last && last[0] * dir[0] + last[1] * dir[1] < Math.cos(Math.PI / 18)) n++;
    last = dir;
  }
  return n;
}

function midpoint(path: readonly Vec3[]): Vec3 {
  const total = polylineLength(path);
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (walked + seg >= total / 2 && seg > 0) {
      const t = (total / 2 - walked) / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    walked += seg;
  }
  return path[0] ?? [0, 0, 0];
}
