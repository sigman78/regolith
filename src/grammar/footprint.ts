/**
 * Footprints on the 1 m placement grid.
 *
 * `footprintCells` is deliberately conservative: a cell is claimed if its
 * square could touch the shape, so two parts with disjoint cell sets are
 * guaranteed to have disjoint shapes. The overlap stage relies on that.
 */
import { GRID } from '@/geometry/design-constants';
import { rotateY, type Pose } from '@/core/math';
import type { Footprint } from './types';

const CELL_OFFSET = 4096;
const CELL_STRIDE = 8192;

export function cellKey(i: number, j: number): number {
  return (i + CELL_OFFSET) * CELL_STRIDE + (j + CELL_OFFSET);
}

/**
 * The key of the cell `di`,`dj` cells away. Footprint cells are translation
 * covariant under whole-cell moves, so a candidate pose that is a whole-cell
 * shift of another can reuse its cells without re-rasterising.
 */
export function shiftCellKey(key: number, di: number, dj: number): number {
  return key + di * CELL_STRIDE + dj;
}

/** World XZ of the centre of a cell key. */
export function cellCenter(key: number): [number, number] {
  const i = Math.floor(key / CELL_STRIDE) - CELL_OFFSET;
  const j = (key % CELL_STRIDE) - CELL_OFFSET;
  return [(i + 0.5) * GRID, (j + 0.5) * GRID];
}

export function cellOf(v: number): number {
  return Math.floor(v / GRID);
}

/** All grid cells the footprint (placed at `pose`) may cover, as cell keys. */
export function footprintCells(fp: Footprint, pose: Pose): number[] {
  const half = GRID / 2;
  const reach = fp.kind === 'rect' ? Math.hypot(fp.hx, fp.hz) : fp.r;
  const i0 = cellOf(pose.x - reach - GRID);
  const i1 = cellOf(pose.x + reach + GRID);
  const j0 = cellOf(pose.z - reach - GRID);
  const j1 = cellOf(pose.z + reach + GRID);
  const c = Math.cos((pose.yaw * Math.PI) / 180);
  const s = Math.sin((pose.yaw * Math.PI) / 180);
  // Half-extent of a grid square projected on the part's local axes.
  const sq = half * (Math.abs(c) + Math.abs(s));
  const hx = fp.kind === 'rect' ? fp.hx + sq : 0;
  const hz = fp.kind === 'rect' ? fp.hz + sq : 0;
  const discR = fp.kind === 'disc' ? fp.r + half * Math.SQRT2 : 0;

  const out: number[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cx = (i + 0.5) * GRID - pose.x;
      const cz = (j + 0.5) * GRID - pose.z;
      let inside: boolean;
      if (fp.kind === 'disc') {
        inside = Math.hypot(cx, cz) <= discR;
      } else {
        // Cell centre in the part's local frame (inverse yaw, same math as rotateY(-yaw)).
        inside = Math.abs(cx * c - cz * s) <= hx && Math.abs(cx * s + cz * c) <= hz;
      }
      if (inside) out.push(cellKey(i, j));
    }
  }
  return out;
}

/** Oriented-rectangle corners in world XZ, for exact separation tests. */
export function rectCorners(hx: number, hz: number, pose: Pose): [number, number][] {
  return (
    [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ] as const
  ).map(([x, z]) => {
    const r = rotateY([x, 0, z], pose.yaw);
    return [r[0] + pose.x, r[2] + pose.z] as [number, number];
  });
}

/** Smallest gap between two convex polygons in XZ; negative = overlap depth (SAT). */
export function polygonGap(a: [number, number][], b: [number, number][]): number {
  let best = -Infinity;
  for (const poly of [a, b]) {
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k];
      const q = poly[(k + 1) % poly.length];
      if (!p || !q) continue;
      const nx = q[1] - p[1];
      const nz = p[0] - q[0];
      const len = Math.hypot(nx, nz) || 1;
      const proj = (pts: [number, number][]) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const [x, z] of pts) {
          const d = (x * nx + z * nz) / len;
          lo = Math.min(lo, d);
          hi = Math.max(hi, d);
        }
        return [lo, hi] as const;
      };
      const [aLo, aHi] = proj(a);
      const [bLo, bHi] = proj(b);
      best = Math.max(best, bLo - aHi, aLo - bHi);
    }
  }
  return best;
}
