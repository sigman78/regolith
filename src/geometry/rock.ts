/**
 * Rock: a lumpy, low icosphere (80 triangles) with smooth normals, resting on
 * y = 0. One unit of size is the rock's footprint diameter; the instance
 * transform scales it. Chunky and soft on purpose (DESIGN_GUIDE §1): no
 * crags, no grime.
 */
import { BufferAttribute, BufferGeometry } from 'three';
import { hashInts } from '@/core/rng';
import type { BundleBuilder } from './bundle';
import { ROCK_FLATTEN, ROCK_LUMP } from './design-constants';

export interface RockOp {
  variant: number;
}

type V3 = [number, number, number];

/** Icosahedron subdivided once: 42 vertices, 80 triangles, vertices on the unit sphere. */
function icosphere(): { verts: V3[]; tris: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: V3[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const norm = (v: V3): V3 => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const verts = raw.map(norm);
  const base: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const mid = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const hit = mid.get(key);
    if (hit !== undefined) return hit;
    const va = verts[a] ?? [0, 0, 0];
    const vb = verts[b] ?? [0, 0, 0];
    verts.push(norm([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]));
    mid.set(key, verts.length - 1);
    return verts.length - 1;
  };
  const tris: [number, number, number][] = [];
  for (const [a, b, c] of base) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    tris.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  return { verts, tris };
}

export function buildRock(out: BundleBuilder, op: RockOp): void {
  const { verts, tris } = icosphere();
  const pts: V3[] = verts.map((d, i) => {
    // Per-vertex lump from a hash: stable for (variant, vertex), no float noise in the loop.
    const lump = hashInts(i, op.variant, 0x70c4) / 4294967296;
    const r = 0.5 * (1 - ROCK_LUMP + 2 * ROCK_LUMP * lump);
    return [d[0] * r, d[1] * r * ROCK_FLATTEN, d[2] * r];
  });
  const minY = Math.min(...pts.map((p) => p[1]));
  for (const p of pts) p[1] -= minY;

  const normals: V3[] = pts.map(() => [0, 0, 0]);
  for (const [a, b, c] of tris) {
    const pa = pts[a] ?? [0, 0, 0];
    const pb = pts[b] ?? [0, 0, 0];
    const pc = pts[c] ?? [0, 0, 0];
    const e1: V3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const e2: V3 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    // Area-weighted face normal (not normalised): bigger faces pull harder.
    const n: V3 = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    for (const i of [a, b, c]) {
      const acc = normals[i];
      if (acc) {
        acc[0] += n[0];
        acc[1] += n[1];
        acc[2] += n[2];
      }
    }
  }

  const position = new Float32Array(pts.length * 3);
  const normal = new Float32Array(pts.length * 3);
  const uv = new Float32Array(pts.length * 2);
  pts.forEach((p, i) => {
    const n = normals[i] ?? [0, 1, 0];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    position.set(p, i * 3);
    normal.set([n[0] / l, n[1] / l, n[2] / l], i * 3);
    const d = verts[i] ?? [0, 1, 0];
    uv.set([Math.atan2(d[2], d[0]) / (2 * Math.PI) + 0.5, d[1] * 0.5 + 0.5], i * 2);
  });

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(position, 3));
  geo.setAttribute('normal', new BufferAttribute(normal, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(tris.flat());
  out.add('rock', geo);
}
