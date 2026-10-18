/**
 * Stage 2 — overlap. Hulls never intersect: parts are claimed onto the grid
 * in order (oldest first, the moving part last); a part whose cells are taken
 * is pushed to the nearest free grid pose by an expanding ring search.
 *
 * Invariant: after this stage no two drafts share a cell, hence (footprint
 * cells are conservative) no two footprints overlap. The search always ends:
 * rings grow until the world edge, and a part that finds nothing is reported
 * `unplaceable` and left where it is (cannot happen on a non-full world).
 *
 * Candidate poses are whole-cell shifts of the current pose, so each one is
 * tested by shifting the part's cell keys, not by rasterising again.
 */
import { GRID } from '@/geometry/design-constants';
import { shiftCellKey } from '../footprint';
import type { Diagnostic, Draft, SolveOptions, SolverWorld } from './types';

interface Offset {
  dx: number;
  dz: number;
}

/** Offsets on each Chebyshev ring, nearest first, ties by scan order. Pure, so cached. */
const RING_CACHE: Offset[][] = [];

function ringOffsets(ring: number): Offset[] {
  const hit = RING_CACHE[ring];
  if (hit) return hit;
  const list: (Offset & { d2: number })[] = [];
  for (let dz = -ring; dz <= ring; dz++) {
    for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) === ring)
        list.push({ dx, dz, d2: dx * dx + dz * dz });
    }
  }
  list.sort((a, b) => a.d2 - b.d2);
  RING_CACHE[ring] = list;
  return list;
}

export function overlap(
  drafts: Draft[],
  world: SolverWorld,
  opts: SolveOptions,
  diagnostics: Diagnostic[],
): Draft[] {
  const ordered = drafts.slice();
  if (opts.movingId) {
    ordered.sort(
      (a, b) => Number(a.instance.id === opts.movingId) - Number(b.instance.id === opts.movingId),
    );
  }

  const taken = new Set<number>();
  const maxRing = Math.ceil((world.halfSize * 2) / GRID);

  for (const d of ordered) {
    if (!collides(d.cells, taken, 0, 0)) {
      claim(d.cells, taken);
      continue;
    }
    const found = search(d, taken, world, maxRing);
    if (!found) {
      diagnostics.push({ kind: 'unplaceable', part: d.instance.id });
      claim(d.cells, taken);
      continue;
    }
    d.pose = { ...d.pose, x: d.pose.x + found.dx * GRID, z: d.pose.z + found.dz * GRID };
    d.cells = d.cells.map((c) => shiftCellKey(c, found.dx, found.dz));
    claim(d.cells, taken);
  }
  return drafts;
}

function collides(cells: number[], taken: Set<number>, di: number, dj: number): boolean {
  for (const c of cells) if (taken.has(shiftCellKey(c, di, dj))) return true;
  return false;
}

function claim(cells: number[], taken: Set<number>): void {
  for (const c of cells) taken.add(c);
}

function search(
  d: Draft,
  taken: Set<number>,
  world: SolverWorld,
  maxRing: number,
): Offset | undefined {
  const reach =
    d.footprint.kind === 'rect' ? Math.hypot(d.footprint.hx, d.footprint.hz) : d.footprint.r;
  const limit = Math.max(0, world.halfSize - reach);

  for (let ring = 1; ring <= maxRing; ring++) {
    for (const o of ringOffsets(ring)) {
      if (Math.abs(d.pose.x + o.dx * GRID) > limit || Math.abs(d.pose.z + o.dz * GRID) > limit)
        continue;
      if (!collides(d.cells, taken, o.dx, o.dz)) return o;
    }
  }
  return undefined;
}
