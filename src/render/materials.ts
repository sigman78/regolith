/**
 * The one material library. Every part uses these and only these, which is
 * most of what keeps the look consistent. See docs/DESIGN_GUIDE.md.
 */
import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { MaterialName } from '@/geometry/bundle';
import { patchRegolith } from './shader-patches';

export const PALETTE = {
  regolith: '#b5582f',
  regolithDark: '#7a3a1e',
  regolithLight: '#d98c5a',
  hullWhite: '#e8e4dc',
  hullShadowed: '#cfc8bb',
  accentOrange: '#ff6a2a',
  graphite: '#2b2f36',
  aluminum: '#b9bcc2',
  glassTeal: '#7fe3d6',
  warningYellow: '#f2c230',
  windowWarm: '#ffd9a0',
  rock: '#6e4a3c',
  rockDark: '#4d3329',
  rockLight: '#94705c',
} as const;

// Part materials carry vertex colours too: geometry/tint.ts bakes underside shade and dust into
// the bundle as multipliers of the material colour.
export const materials = {
  // The palette lives in the vertex colours (terrain-mesh.ts); a tinted base colour would square it.
  regolith: new MeshStandardMaterial({
    color: new Color(0xffffff),
    roughness: 0.95,
    metalness: 0.0,
    vertexColors: true,
  }),
  hull: new MeshStandardMaterial({
    color: new Color(PALETTE.hullWhite),
    roughness: 0.55,
    metalness: 0.0,
    vertexColors: true,
  }),
  accent: new MeshStandardMaterial({
    color: new Color(PALETTE.accentOrange),
    roughness: 0.5,
    metalness: 0.0,
    vertexColors: true,
  }),
  graphite: new MeshStandardMaterial({
    color: new Color(PALETTE.graphite),
    roughness: 0.7,
    metalness: 0.2,
    vertexColors: true,
  }),
  aluminum: new MeshStandardMaterial({
    color: new Color(PALETTE.aluminum),
    roughness: 0.35,
    metalness: 1.0,
    vertexColors: true,
  }),
  /** Hazard yellow: slab edges, muzzle bands, reactor rings. Used sparingly (DESIGN_GUIDE §2). */
  warning: new MeshStandardMaterial({
    color: new Color(PALETTE.warningYellow),
    roughness: 0.5,
    metalness: 0.0,
    vertexColors: true,
  }),
  /** Ambient rocks: the colour comes per instance from the rock trio; this is the white base. */
  rock: new MeshStandardMaterial({
    color: new Color(0xffffff),
    roughness: 0.95,
    metalness: 0.0,
    vertexColors: true,
  }),
  /** Placement preview: hull colour at half strength, never casts shadows. */
  ghost: new MeshStandardMaterial({
    color: new Color(PALETTE.hullWhite),
    emissive: new Color(PALETTE.accentOrange),
    emissiveIntensity: 0.25,
    roughness: 0.6,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }),
  glass: new MeshStandardMaterial({
    color: new Color(PALETTE.glassTeal),
    roughness: 0.15,
    metalness: 0.0,
    transparent: true,
    opacity: 0.55,
    emissive: new Color(PALETTE.windowWarm),
    emissiveIntensity: 0.0,
    side: DoubleSide,
    vertexColors: true,
  }),
};

patchRegolith(materials.regolith, PALETTE.regolithDark);

// Compile-time check: every material name geometry/ may emit exists in the library.
const _complete: MaterialName extends keyof typeof materials ? true : never = true;
void _complete;

/** Windows warm up at dusk and glow at night. Called from the sky update. */
export function setNightGlow(amount: number): void {
  materials.glass.emissiveIntensity = amount * 1.6;
}
