/**
 * Vertex tints, baked into the bundle (DESIGN_GUIDE §9: "Vertex tints only
 * through two helpers"). Both return colour multipliers for the material
 * colour, so the closed palette stays closed.
 *
 * Tints are a pure function of the vertex (position, normal) and the
 * material, so the same recipe still gives the same bytes. They live in the
 * part's local frame: dust sits on the same side whatever the part's yaw.
 */
import { Color } from 'three';
import {
  CONTACT_HEIGHT,
  CONTACT_STRENGTH,
  DUST_HEIGHT,
  DUST_MAX,
  TINT_DUST,
  TINT_UNDERSIDE,
  UNDERSIDE_FADE_BOTTOM,
  UNDERSIDE_FADE_TOP,
  WIND_FROM_DEG,
} from './design-constants';
import type { MaterialName } from './bundle';

export type Rgb = readonly [number, number, number];

const underside = new Color(TINT_UNDERSIDE);
const dust = new Color(TINT_DUST);
const WIND = [Math.cos((WIND_FROM_DEG * Math.PI) / 180), Math.sin((WIND_FROM_DEG * Math.PI) / 180)];

/** Materials that stay clean: glass reads as glass, not as dusty hull. */
const UNTINTED: ReadonlySet<MaterialName> = new Set(['glass', 'light']);
/** Rocks are already dust-coloured and small: underside shade only, no contact band or dust. */
const SHADE_ONLY: ReadonlySet<MaterialName> = new Set(['rock']);

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Shade for down-facing surfaces, and a touch of contact shadow near the ground. */
export function tintUnderside(ny: number, y: number): Rgb {
  const down = 1 - smoothstep(UNDERSIDE_FADE_BOTTOM, UNDERSIDE_FADE_TOP, ny);
  const contact = (1 - smoothstep(0, CONTACT_HEIGHT, y)) * CONTACT_STRENGTH;
  const k = 1 - contact;
  return [
    (1 + (underside.r - 1) * down) * k,
    (1 + (underside.g - 1) * down) * k,
    (1 + (underside.b - 1) * down) * k,
  ];
}

/** Dust on the lowest part of a module, thickest on the windward side and on up-facing surfaces. */
export function tintDust(nx: number, ny: number, nz: number, y: number): Rgb {
  const low = 1 - smoothstep(0, DUST_HEIGHT, y);
  const lee = Math.hypot(nx, nz);
  const windward =
    lee < 1e-4 ? 0.5 : 0.5 + 0.5 * ((nx * (WIND[0] ?? 0) + nz * (WIND[1] ?? 0)) / lee);
  const settle = 0.6 + 0.4 * Math.max(0, ny);
  const s = DUST_MAX * low * windward * settle;
  return [1 + (dust.r - 1) * s, 1 + (dust.g - 1) * s, 1 + (dust.b - 1) * s];
}

/** One rgb multiplier per vertex for a merged material buffer. */
export function bakeTints(
  material: MaterialName,
  positions: Float32Array,
  normals: Float32Array,
): Float32Array {
  const out = new Float32Array(positions.length);
  if (UNTINTED.has(material)) return out.fill(1);
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1] ?? 0;
    const nx = normals[i] ?? 0;
    const ny = normals[i + 1] ?? 0;
    const nz = normals[i + 2] ?? 0;
    if (SHADE_ONLY.has(material)) {
      const u = tintUnderside(ny, CONTACT_HEIGHT);
      for (let c = 0; c < 3; c++) out[i + c] = u[c] ?? 1;
      continue;
    }
    const u = tintUnderside(ny, y);
    const d = tintDust(nx, ny, nz, y);
    for (let c = 0; c < 3; c++) out[i + c] = (u[c] ?? 1) * (d[c] ?? 1);
  }
  return out;
}
