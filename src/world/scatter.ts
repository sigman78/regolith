/**
 * Ambient rocks (docs/SCATTER.md, stage S1). A pure function of the world
 * seed, the heightfield and a keep-out mask: derived, never stored.
 *
 * Where a rock sits, how big it is, which variant and tint it has come only
 * from `hashInts(i, j, seed)` of its candidate cell. Terrain height and slope
 * only decide whether it is kept and how deep it sinks, so editing the
 * terrain changes only the rocks it touches.
 */
import {
  BOULDER_CAP,
  BOULDER_MAX_SLOPE_DEG,
  BOULDER_MIN_SIZE,
  GRID,
  ROCK_CAP,
  ROCK_FLATTEN,
  ROCK_MAX_SIZE,
  ROCK_MIN_SIZE,
  ROCK_SINK,
  ROCK_SIZE_EXPONENT,
  ROCK_VARIANTS,
  SCATTER_CELL,
  SCATTER_CENTRE_DAMPING,
  SCATTER_CENTRE_RADIUS,
  SCATTER_FADE_RADIUS,
} from '@/geometry/design-constants';
import { fbm2 } from '@/core/noise';
import { hashInts, hashString } from '@/core/rng';
import type { FlatField } from './flatten';
import { heightAt, type Heightfield } from './terrain';

/** Floats per instance: x, y, z, size, yaw (radians), variant, tint (0..1), id. */
export const SCATTER_STRIDE = 8;

export interface ScatterSet {
  count: number;
  /** `count * SCATTER_STRIDE` floats. `y` is the rock's resting origin, already sunk. */
  data: Float32Array;
}

const U32 = 4294967296;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Round to a millimetre so hashing and comparisons do not depend on float noise. */
const mm = (v: number): number => Math.round(v * 1000) / 1000;

/** Where a rock's origin rests: its lowest foothold, sunk in by a share of its size. */
function restingY(
  hc: number,
  hx0: number,
  hx1: number,
  hz0: number,
  hz1: number,
  size: number,
): number {
  return Math.min(hc, hx0, hx1, hz0, hz1) - ROCK_SINK * size * ROCK_FLATTEN;
}

/** Every rock the terrain allows, before the base is considered. */
export function scatterCandidates(hf: Heightfield, seed: string): ScatterSet {
  const s = hashString(seed);
  const extent = hf.size * hf.cell;
  const half = extent / 2;
  const cells = Math.floor(extent / SCATTER_CELL);
  const out: number[] = [];
  let boulders = 0;
  const a = ROCK_SIZE_EXPONENT - 1;
  const tail = 1 - Math.pow(ROCK_MIN_SIZE / ROCK_MAX_SIZE, a);

  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const u = (k: number): number => hashInts(i, j, s, k) / U32;
      const x = mm((i + u(0)) * SCATTER_CELL - half);
      const z = mm((j + u(1)) * SCATTER_CELL - half);

      // Density: a rockiness field, more around crater rims, thinner where the base is built.
      let p =
        0.2 + 0.5 * smoothstep(-0.15, 0.55, fbm2(x * 0.05, z * 0.05, { octaves: 3, seed: s }));
      for (const c of hf.craters) {
        const d = Math.hypot(x - c.x, z - c.z) / c.radius;
        if (d > 0.8 && d < 1.5) p += 0.3 * (1 - Math.abs(d - 1.15) / 0.35);
      }
      const centre = smoothstep(SCATTER_CENTRE_RADIUS, SCATTER_FADE_RADIUS, Math.hypot(x, z));
      p *= SCATTER_CENTRE_DAMPING + (1 - SCATTER_CENTRE_DAMPING) * centre;
      if (u(2) >= p) continue;

      // Truncated power law: many small rocks, few big ones.
      const size = ROCK_MIN_SIZE / Math.pow(1 - u(3) * tail, 1 / a);
      const isBoulder = size > BOULDER_MIN_SIZE;

      const r = Math.max(0.3, size * 0.5);
      const hc = heightAt(hf, x, z);
      const hx0 = heightAt(hf, x - r, z);
      const hx1 = heightAt(hf, x + r, z);
      const hz0 = heightAt(hf, x, z - r);
      const hz1 = heightAt(hf, x, z + r);
      if (isBoulder) {
        const slope = Math.atan(Math.hypot(hx1 - hx0, hz1 - hz0) / (2 * r)) * (180 / Math.PI);
        if (slope > BOULDER_MAX_SLOPE_DEG || boulders >= BOULDER_CAP) continue;
        boulders++;
      }
      if (out.length / SCATTER_STRIDE >= ROCK_CAP) continue;

      const rest = restingY(hc, hx0, hx1, hz0, hz1, size);
      out.push(
        x,
        rest,
        z,
        size,
        u(4) * Math.PI * 2,
        Math.min(ROCK_VARIANTS - 1, Math.floor(u(5) * ROCK_VARIANTS)),
        u(6),
        j * cells + i,
      );
    }
  }
  return { count: out.length / SCATTER_STRIDE, data: Float32Array.from(out) };
}

/** Drop the rocks that touch a keep-out cell (`mask` is `size * size`, 1 m cells, see keepout.ts). */
export function cullScatter(
  set: ScatterSet,
  mask: Uint8Array,
  size: number,
  field: FlatField | null = null,
): ScatterSet {
  const origin = size / 2;
  const kept: number[] = [];
  const blocked = (x: number, z: number): boolean => {
    const i = Math.floor(x / GRID) + origin;
    const j = Math.floor(z / GRID) + origin;
    return i >= 0 && j >= 0 && i < size && j < size && mask[j * size + i] === 1;
  };
  for (let n = 0; n < set.count; n++) {
    const o = n * SCATTER_STRIDE;
    const x = set.data[o] ?? 0;
    const z = set.data[o + 2] ?? 0;
    const r = (set.data[o + 3] ?? 0) * 0.5;
    if (
      blocked(x, z) ||
      blocked(x - r, z) ||
      blocked(x + r, z) ||
      blocked(x, z - r) ||
      blocked(x, z + r)
    ) {
      continue;
    }
    for (let k = 0; k < SCATTER_STRIDE; k++) kept.push(set.data[o + k] ?? 0);
    // A rock on or beside levelled ground settles onto it instead of floating or sinking.
    if (field?.touches(x, z, r + 0.3)) {
      const q = Math.max(0.3, r);
      const h = field.heightAt;
      kept[kept.length - SCATTER_STRIDE + 1] = restingY(
        h(x, z),
        h(x - q, z),
        h(x + q, z),
        h(x, z - q),
        h(x, z + q),
        r * 2,
      );
    }
  }
  return { count: kept.length / SCATTER_STRIDE, data: Float32Array.from(kept) };
}
