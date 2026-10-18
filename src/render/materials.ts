/**
 * The one material library. Every part uses these and only these, which is
 * most of what keeps the look consistent. See docs/DESIGN_GUIDE.md.
 */
import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { MaterialName } from '@/geometry/bundle';
import { patchLampEmissive, patchRegolith } from './shader-patches';

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
  plantGreen: '#5fbf6a',
  solarBlue: '#1e3550',
  solarCell: '#4a79b8',
  windowWarm: '#ffd9a0',
  rock: '#6e4a3c',
  rockDark: '#4d3329',
  rockLight: '#94705c',
} as const;

// Part materials carry vertex colours too: geometry/tint.ts bakes underside shade and dust into
// the bundle as multipliers of the material colour.
/** A lamp head glows a little even by day, so its colour reads. */
const LAMP_BASE_GLOW = 0.9;

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
  /** Solar panel face (DESIGN_GUIDE: solar blue); the cell lines are `solarCell`. */
  solar: new MeshStandardMaterial({
    color: new Color(PALETTE.solarBlue),
    roughness: 0.25,
    metalness: 0.3,
    vertexColors: true,
  }),
  solarCell: new MeshStandardMaterial({
    color: new Color(PALETTE.solarCell),
    roughness: 0.3,
    metalness: 0.3,
    vertexColors: true,
  }),
  /** Lamp heads: warm white, glowing at night (the same glow as windows for now). */
  light: new MeshStandardMaterial({
    color: new Color(0xffffff),
    roughness: 0.3,
    metalness: 0.0,
    emissive: new Color(PALETTE.windowWarm),
    emissiveIntensity: 0.0,
    vertexColors: true,
  }),
  /**
   * Lamp heads drawn as instances (render/lamps.ts): the instance colour is both paint and glow
   * (shader-patches.ts), so the airlock lamp can cycle through palette colours.
   */
  lamp: new MeshStandardMaterial({
    color: new Color(0xffffff),
    roughness: 0.3,
    metalness: 0.0,
    emissive: new Color(0xffffff),
    emissiveIntensity: LAMP_BASE_GLOW,
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
patchLampEmissive(materials.lamp);

// Compile-time check: every material name geometry/ may emit exists in the library.
const _complete: MaterialName extends keyof typeof materials ? true : never = true;
void _complete;

/** Windows warm up at dusk and glow at night. Called from the sky update. */
export function setNightGlow(amount: number): void {
  materials.glass.emissiveIntensity = amount * 1.6;
  materials.light.emissiveIntensity = amount * 2.2;
  materials.lamp.emissiveIntensity = LAMP_BASE_GLOW + amount * 1.4;
}
