/**
 * Ground around contact, heights: a derived field that levels the terrain under every slab and
 * eases it back to the natural ground over a short skirt. Pure data in, a height function out,
 * so the solver (legs, tubes), the terrain mesh, ray picking and rocks all read one terrain.
 *
 * Each patch is a footprint plus a target height, the mean of the natural terrain under it. The
 * field is stored on the terrain lattice and read with the same bilinear rule as the natural
 * terrain, so the drawn mesh and every `heightAt` agree exactly. At a lattice node:
 *
 * - within `√2 · cell` of a footprint (the core) the node takes the patch's target, so every
 *   point under the footprint, and a fringe beyond it, is exactly flat;
 * - elsewhere nodes blend `(raw + Σ K·target) / (1 + Σ K)` with `K = ((S − d) / (d · S))²`, which
 *   is 0 at the end of the skirt and grows without bound toward the core. The blend does not
 *   depend on patch order and is continuous where one patch's skirt reaches another's core.
 */

export type FlatShape =
  | { kind: 'rect'; x: number; z: number; yaw: number; hx: number; hz: number }
  | { kind: 'disc'; x: number; z: number; r: number };

export interface FlatPatch {
  /** stable id (the part's id); patches are processed in id order */
  id: string;
  shape: FlatShape;
  /** metres */
  target: number;
}

export interface FlatGrid {
  /** half the terrain extent in metres */
  half: number;
  /** lattice spacing in metres */
  cell: number;
}

export interface FlatField {
  patches: readonly FlatPatch[];
  /** changes whenever any patch does; lets the mesh skip a rebuild */
  key: string;
  /** the levelled height at a point */
  heightAt(x: number, z: number): number;
  /** True when a disc of radius `r` at (x, z) reaches any patch's core or skirt. */
  touches(x: number, z: number, r?: number): boolean;
}

/** Metres over which a patch fades out beyond its core. */
export const FLATTEN_SKIRT = 2;

const sq = (v: number): number => v * v;

/** Distance from a point to the shape, 0 inside it. */
export function distanceToShape(shape: FlatShape, x: number, z: number): number {
  const dx = x - shape.x;
  const dz = z - shape.z;
  if (shape.kind === 'disc') return Math.max(0, Math.hypot(dx, dz) - shape.r);
  const a = (shape.yaw * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // Same convention as rotateY(-yaw): local x is along the part's axis.
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.hypot(Math.max(0, Math.abs(lx) - shape.hx), Math.max(0, Math.abs(lz) - shape.hz));
}

function reach(shape: FlatShape): number {
  return shape.kind === 'disc' ? shape.r : Math.hypot(shape.hx, shape.hz);
}

/** Mean of `raw` over the shape: a 0.5 m lattice, plus the centre so a tiny shape still has a sample. */
function meanUnder(shape: FlatShape, raw: (x: number, z: number) => number): number {
  const r = reach(shape);
  let sum = raw(shape.x, shape.z);
  let n = 1;
  for (let z = Math.ceil((shape.z - r) * 2) / 2; z <= shape.z + r; z += 0.5) {
    for (let x = Math.ceil((shape.x - r) * 2) / 2; x <= shape.x + r; x += 0.5) {
      if (distanceToShape(shape, x, z) > 0) continue;
      sum += raw(x, z);
      n++;
    }
  }
  return sum / n;
}

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4;

export function buildFlatField(
  raw: (x: number, z: number) => number,
  shapes: readonly { id: string; shape: FlatShape }[],
  grid: FlatGrid,
  skirt: number = FLATTEN_SKIRT,
): FlatField {
  const patches: FlatPatch[] = shapes
    .map((s) => ({ id: s.id, shape: s.shape, target: meanUnder(s.shape, raw) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const { half, cell } = grid;
  const n = Math.round((2 * half) / cell) + 1;
  const pad = cell * Math.SQRT2;
  const wide = skirt + pad;

  /** The blended height at a lattice node. */
  const nodeHeight = (x: number, z: number): number => {
    const base = raw(x, z);
    let nearest: FlatPatch | null = null;
    let nearestD = Infinity;
    let top = 0;
    let sum = 0;
    for (const p of patches) {
      const d = distanceToShape(p.shape, x, z);
      if (d > wide) continue;
      if (d <= pad) {
        if (d < nearestD) {
          nearest = p;
          nearestD = d;
        }
        continue;
      }
      const e = d - pad;
      if (e >= skirt) continue;
      const k = sq((skirt - e) / (e * skirt));
      top += k * p.target;
      sum += k;
    }
    if (nearest) return nearest.target;
    return (base + top) / (1 + sum);
  };

  // Only the nodes a patch can reach differ from the natural terrain.
  const nodes = new Map<number, number>();
  for (const p of patches) {
    const r = reach(p.shape) + wide + cell;
    const i0 = Math.max(0, Math.floor((p.shape.x - r + half) / cell));
    const i1 = Math.min(n - 1, Math.ceil((p.shape.x + r + half) / cell));
    const j0 = Math.max(0, Math.floor((p.shape.z - r + half) / cell));
    const j1 = Math.min(n - 1, Math.ceil((p.shape.z + r + half) / cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const key = j * n + i;
        if (nodes.has(key)) continue;
        nodes.set(key, nodeHeight(i * cell - half, j * cell - half));
      }
    }
  }

  const corner = (i: number, j: number): number =>
    nodes.get(j * n + i) ?? raw(i * cell - half, j * cell - half);

  const heightAt = (x: number, z: number): number => {
    const fx = (x + half) / cell;
    const fz = (z + half) / cell;
    if (fx < 0 || fz < 0 || fx > n - 1 || fz > n - 1) return raw(x, z);
    const i = Math.min(n - 2, Math.floor(fx));
    const j = Math.min(n - 2, Math.floor(fz));
    if (
      !nodes.has(j * n + i) &&
      !nodes.has(j * n + i + 1) &&
      !nodes.has((j + 1) * n + i) &&
      !nodes.has((j + 1) * n + i + 1)
    ) {
      return raw(x, z);
    }
    const u = fx - i;
    const v = fz - j;
    const a = corner(i, j) * (1 - u) + corner(i + 1, j) * u;
    const b = corner(i, j + 1) * (1 - u) + corner(i + 1, j + 1) * u;
    return a * (1 - v) + b * v;
  };

  const touches = (x: number, z: number, r = 0): boolean =>
    patches.some((p) => distanceToShape(p.shape, x, z) < wide + r);

  const key = patches
    .map((p) => {
      const s = p.shape;
      const geo =
        s.kind === 'rect'
          ? `r${round4(s.x)},${round4(s.z)},${s.yaw},${round4(s.hx)},${round4(s.hz)}`
          : `d${round4(s.x)},${round4(s.z)},${round4(s.r)}`;
      return `${p.id}:${geo}:${round4(p.target)}`;
    })
    .join('|');

  return { patches, key, heightAt, touches };
}
