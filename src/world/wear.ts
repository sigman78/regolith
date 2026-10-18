/**
 * Ground around contact, wear: a 2-channel byte raster over the whole map that darkens the
 * regolith where parts and footpads have disturbed it. Pure data in, bytes out; the render layer
 * uploads the bytes as a texture and the regolith shader reads it.
 *
 * Channel 0 is the disturbed-regolith ring around footprints and footpads. Channel 1 is reserved
 * for M4's worn paths. Texel (i, j) is centred at `(-half + (i + 0.5) / TEXELS_PER_M, ...)` and the
 * texture is read with linear filtering, so wear is a soft stain, never a hard edge.
 */
import { distanceToShape, type FlatShape } from './flatten';

export const WEAR_TEXELS_PER_M = 2;
export const WEAR_CHANNELS = 2;
/** Metres past a footprint over which the ring fades out. */
export const WEAR_RING = 2.2;
/** Metres past a footpad's rim over which its mark fades out. */
export const WEAR_FOOT_RING = 0.9;

export interface WearField {
  /** texels along each side */
  size: number;
  /** `size * size * WEAR_CHANNELS` bytes, row `j` (z) major */
  data: Uint8Array;
  /** changes whenever the bytes do */
  key: string;
}

const fade = (d: number, ring: number): number => {
  const t = 1 - Math.min(1, Math.max(0, d / ring));
  return t * t * (3 - 2 * t);
};

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export function buildWear(
  half: number,
  footprints: readonly FlatShape[],
  footpads: readonly { x: number; z: number; r: number }[],
): WearField {
  const size = Math.round(2 * half * WEAR_TEXELS_PER_M);
  const data = new Uint8Array(size * size * WEAR_CHANNELS);

  const stamp = (
    cx: number,
    cz: number,
    reach: number,
    strength: (x: number, z: number) => number,
  ): void => {
    const i0 = Math.max(0, Math.floor((cx - reach + half) * WEAR_TEXELS_PER_M));
    const i1 = Math.min(size - 1, Math.ceil((cx + reach + half) * WEAR_TEXELS_PER_M));
    const j0 = Math.max(0, Math.floor((cz - reach + half) * WEAR_TEXELS_PER_M));
    const j1 = Math.min(size - 1, Math.ceil((cz + reach + half) * WEAR_TEXELS_PER_M));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = -half + (i + 0.5) / WEAR_TEXELS_PER_M;
        const z = -half + (j + 0.5) / WEAR_TEXELS_PER_M;
        const v = Math.round(strength(x, z) * 255);
        const o = (j * size + i) * WEAR_CHANNELS;
        if (v > (data[o] ?? 0)) data[o] = v;
      }
    }
  };

  for (const s of footprints) {
    const reach = (s.kind === 'disc' ? s.r : Math.hypot(s.hx, s.hz)) + WEAR_RING;
    stamp(s.x, s.z, reach, (x, z) => fade(distanceToShape(s, x, z), WEAR_RING));
  }
  for (const f of footpads) {
    stamp(f.x, f.z, f.r + WEAR_FOOT_RING, (x, z) =>
      fade(Math.max(0, Math.hypot(x - f.x, z - f.z) - f.r), WEAR_FOOT_RING),
    );
  }

  // A cheap, order-stable digest of the bytes: FNV-1a.
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ (data[i] ?? 0), 16777619) >>> 0;
  return { size, data, key: `${size}:${h.toString(16)}:${r3(half)}` };
}
