/**
 * 2D value noise with smooth interpolation plus fBm. Deterministic via hash.
 * Good enough for terrain and dust; swap for simplex later if needed.
 */
import { hashInts } from './rng';

function lattice(ix: number, iy: number, seed: number): number {
  return hashInts(ix, iy, seed) / 4294967296;
}

function smooth(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function valueNoise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = lattice(ix, iy, seed);
  const b = lattice(ix + 1, iy, seed);
  const c = lattice(ix, iy + 1, seed);
  const d = lattice(ix + 1, iy + 1, seed);
  const u = smooth(fx);
  const v = smooth(fy);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v; // 0..1
}

export interface FbmOptions {
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  seed?: number;
}

export function fbm2(x: number, y: number, opts: FbmOptions = {}): number {
  const { octaves = 5, lacunarity = 2.0, gain = 0.5, seed = 0 } = opts;
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise2(x * freq, y * freq, seed + i * 101) * 2 - 1);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm; // -1..1
}
