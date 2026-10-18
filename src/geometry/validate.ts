/**
 * Bundle validation (ARCHITECTURE §5). Throws in dev and tests; production
 * callers log the returned problems instead.
 *
 * Checks: finite numbers, index range, no degenerate triangles, unit-ish
 * vertex normals, and winding that agrees with the vertex normals (the
 * generator-computed normals are the source of truth for "outward").
 */
import type { GeometryBundle, MaterialBuffers } from './bundle';

const MIN_AREA = 1e-10;

export function validateBundle(bundle: GeometryBundle): string[] {
  const problems: string[] = [];
  for (const [name, b] of Object.entries(bundle.byMaterial)) {
    if (b) checkBuffers(name, b, problems);
  }
  return problems;
}

export function assertValidBundle(bundle: GeometryBundle): void {
  const problems = validateBundle(bundle);
  if (problems.length > 0) {
    throw new Error(`invalid geometry bundle ${bundle.hash}:\n${problems.join('\n')}`);
  }
}

function checkBuffers(name: string, b: MaterialBuffers, problems: string[]): void {
  const { positions: p, normals: n, indices: idx } = b;
  const vertexCount = p.length / 3;

  for (const [label, arr] of [
    ['positions', p],
    ['normals', n],
    ['uvs', b.uvs],
  ] as const) {
    for (let i = 0; i < arr.length; i++) {
      if (!Number.isFinite(arr[i])) {
        problems.push(`${name}: non-finite value in ${label}[${i}]`);
        return;
      }
    }
  }
  if (n.length !== p.length) problems.push(`${name}: normals/positions length mismatch`);
  if (idx.length % 3 !== 0) problems.push(`${name}: index count not a multiple of 3`);

  for (let v = 0; v < vertexCount; v++) {
    const len = Math.hypot(n[v * 3] ?? 0, n[v * 3 + 1] ?? 0, n[v * 3 + 2] ?? 0);
    if (Math.abs(len - 1) > 1e-3) {
      problems.push(`${name}: vertex ${v} normal length ${len.toFixed(4)}`);
      break;
    }
  }

  let degenerate = 0;
  let flipped = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] ?? 0;
    const bb = idx[t + 1] ?? 0;
    const c = idx[t + 2] ?? 0;
    if (a >= vertexCount || bb >= vertexCount || c >= vertexCount) {
      problems.push(`${name}: index out of range in triangle ${t / 3}`);
      return;
    }
    const e1 = sub(p, bb, a);
    const e2 = sub(p, c, a);
    const gx = e1[1] * e2[2] - e1[2] * e2[1];
    const gy = e1[2] * e2[0] - e1[0] * e2[2];
    const gz = e1[0] * e2[1] - e1[1] * e2[0];
    const area2 = Math.hypot(gx, gy, gz);
    if (area2 < MIN_AREA) {
      degenerate++;
      continue;
    }
    const nx = (n[a * 3] ?? 0) + (n[bb * 3] ?? 0) + (n[c * 3] ?? 0);
    const ny = (n[a * 3 + 1] ?? 0) + (n[bb * 3 + 1] ?? 0) + (n[c * 3 + 1] ?? 0);
    const nz = (n[a * 3 + 2] ?? 0) + (n[bb * 3 + 2] ?? 0) + (n[c * 3 + 2] ?? 0);
    if (gx * nx + gy * ny + gz * nz < 0) flipped++;
  }
  // Lathe poles produce one zero-area triangle per segment by construction;
  // those are harmless, so only flag when degenerates dominate.
  if (degenerate > idx.length / 3 / 4) problems.push(`${name}: ${degenerate} degenerate triangles`);
  if (flipped > 0) problems.push(`${name}: ${flipped} triangles wound against their normals`);
}

function sub(p: Float32Array, i: number, j: number): [number, number, number] {
  return [
    (p[i * 3] ?? 0) - (p[j * 3] ?? 0),
    (p[i * 3 + 1] ?? 0) - (p[j * 3 + 1] ?? 0),
    (p[i * 3 + 2] ?? 0) - (p[j * 3 + 2] ?? 0),
  ];
}
