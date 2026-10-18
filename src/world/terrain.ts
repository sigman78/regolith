/**
 * Terrain is a heightfield on a 1 m grid. It is pure data: the render layer
 * turns it into a mesh, the grammar layer samples it to plant stilts and pads.
 */
import { fbm2 } from '@/core/noise';
import { Rng, hashString } from '@/core/rng';

export interface Crater {
  x: number;
  z: number;
  radius: number;
  depth: number;
}

export interface Heightfield {
  /** number of cells along X and Z */
  size: number;
  /** metres per cell */
  cell: number;
  /** (size+1)*(size+1) heights, row-major by Z */
  heights: Float32Array;
  craters: Crater[];
}

export interface TerrainParams {
  seed: string;
  size?: number;
  cell?: number;
  amplitude?: number;
  craterCount?: number;
}

export function generateTerrain(params: TerrainParams): Heightfield {
  const size = params.size ?? 96;
  const cell = params.cell ?? 1;
  const amplitude = params.amplitude ?? 2.2;
  const seed = hashString(params.seed);
  const rng = new Rng(seed);

  const craters: Crater[] = [];
  const craterCount = params.craterCount ?? 6;
  for (let i = 0; i < craterCount; i++) {
    craters.push({
      x: rng.range(-size * 0.45, size * 0.45) * cell,
      z: rng.range(-size * 0.45, size * 0.45) * cell,
      radius: rng.range(3, 9),
      depth: rng.range(0.6, 1.8),
    });
  }

  const n = size + 1;
  const heights = new Float32Array(n * n);
  const half = (size * cell) / 2;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * cell - half;
      const z = j * cell - half;
      heights[j * n + i] = sampleHeight(x, z, seed, amplitude, craters);
    }
  }
  return { size, cell, heights, craters };
}

function sampleHeight(x: number, z: number, seed: number, amplitude: number, craters: Crater[]): number {
  // Broad dunes + fine ripples.
  let h = fbm2(x * 0.012, z * 0.012, { octaves: 4, seed }) * amplitude;
  h += fbm2(x * 0.09, z * 0.09, { octaves: 2, seed: seed + 7 }) * 0.12;
  // Craters: bowl with a raised rim.
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.radius;
    if (d < 1.4) {
      const bowl = d < 1 ? -(1 - d * d) * c.depth : 0;
      const rim = Math.exp(-((d - 1) * (d - 1)) / 0.02) * c.depth * 0.35;
      h += bowl + rim;
    }
  }
  return h;
}

/** Bilinear height lookup in world metres. Clamps at the edges. */
export function heightAt(hf: Heightfield, x: number, z: number): number {
  const n = hf.size + 1;
  const half = (hf.size * hf.cell) / 2;
  const fx = Math.min(Math.max((x + half) / hf.cell, 0), hf.size - 1e-6);
  const fz = Math.min(Math.max((z + half) / hf.cell, 0), hf.size - 1e-6);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const h00 = hf.heights[j * n + i] ?? 0;
  const h10 = hf.heights[j * n + i + 1] ?? 0;
  const h01 = hf.heights[(j + 1) * n + i] ?? 0;
  const h11 = hf.heights[(j + 1) * n + i + 1] ?? 0;
  const a = h00 + (h10 - h00) * u;
  const b = h01 + (h11 - h01) * u;
  return a + (b - a) * v;
}
