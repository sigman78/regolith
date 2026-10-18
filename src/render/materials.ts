/**
 * The one material library. Every part uses these and only these, which is
 * most of what keeps the look consistent. See docs/DESIGN_GUIDE.md.
 */
import { Color, DoubleSide, MeshStandardMaterial } from 'three';

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
} as const;

export const materials = {
  regolith: new MeshStandardMaterial({
    color: new Color(PALETTE.regolith),
    roughness: 0.95,
    metalness: 0.0,
    vertexColors: true,
  }),
  hull: new MeshStandardMaterial({
    color: new Color(PALETTE.hullWhite),
    roughness: 0.55,
    metalness: 0.0,
  }),
  accent: new MeshStandardMaterial({
    color: new Color(PALETTE.accentOrange),
    roughness: 0.5,
    metalness: 0.0,
  }),
  graphite: new MeshStandardMaterial({
    color: new Color(PALETTE.graphite),
    roughness: 0.7,
    metalness: 0.2,
  }),
  aluminum: new MeshStandardMaterial({
    color: new Color(PALETTE.aluminum),
    roughness: 0.35,
    metalness: 1.0,
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
  }),
};

/** Windows warm up at dusk and glow at night. Called from the sky update. */
export function setNightGlow(amount: number): void {
  materials.glass.emissiveIntensity = amount * 1.6;
}
