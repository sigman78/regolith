/**
 * Decals: paint that sits on a part's hull but is not part of its body recipe. Today that is the
 * serial stencil on a hab ("H-002", the same tag the HUD and the debug names use). A decal is a
 * small recipe of its own (cached and shared by text) plus a world matrix, derived in the solver
 * and never stored.
 *
 * The matrix is built from the part's yaw alone, never its mirror flag: the part flips its body,
 * the paint does not, so a flipped hab can never read backwards. The text goes on the flank that
 * faces the default camera (+z), reading left to right.
 */
import { hashValue } from '@/core/hash';
import { HAB_STRIPE_FROM_END, RIB_SPACING } from '@/geometry/design-constants';
import type { Letter, GeometryRecipe, ParamValues } from './types';

export interface Decal {
  recipe: GeometryRecipe;
  recipeHash: string;
  /** body frame to world, column-major 4 × 4 */
  matrix: readonly number[];
}

/** The tag text: letter, dash, three digits. */
export function serialText(letter: Letter, serial: number): string {
  return `${letter}-${String(serial % 1000).padStart(3, '0')}`;
}

/** Bay centres along a hab (between its ribs), and the one furthest from the stripe. */
function stencilBay(length: number, variant: number): number {
  const count = Math.max(1, Math.round(length / RIB_SPACING));
  const stripe = (variant === 1 ? -1 : 1) * (length / 2 - HAB_STRIPE_FROM_END);
  let bestAt = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + (length * (i + 0.5)) / count;
    const score = Math.abs(x - stripe) - 1e-3 * Math.abs(x);
    if (score > bestScore) {
      bestScore = score;
      bestAt = x;
    }
  }
  return bestAt;
}

export function decalsFor(
  letter: Letter,
  serial: number,
  params: ParamValues,
  pose: { x: number; y: number; z: number; yaw: number },
  variant: number,
): Decal[] {
  if (serial <= 0 || letter !== 'H') return [];
  const length = Number(params['length']);
  const radius = Number(params['radius']);
  if (!(length > 0) || !(radius > 0)) return [];

  const psi = (pose.yaw * Math.PI) / 180;
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  // Which flank faces +z (or +x when the hab lies along z); the paint reads left to right from outside.
  const side = c > 1e-6 ? 1 : c < -1e-6 ? -1 : s > 0 ? 1 : -1;
  const turn = psi + (side < 0 ? Math.PI : 0);
  const ct = Math.cos(turn);
  const st = Math.sin(turn);
  const bay = stencilBay(length, variant);

  const recipe: GeometryRecipe = {
    ops: [{ kind: 'stencil', text: serialText(letter, serial), radius }],
  };
  // Ry(turn), then the bay's offset along the hab's own axis.
  // prettier-ignore
  const matrix = [
    ct, 0, -st, 0,
    0, 1, 0, 0,
    st, 0, ct, 0,
    pose.x + bay * c, pose.y, pose.z - bay * s, 1,
  ];
  return [{ recipe, recipeHash: hashValue(recipe), matrix }];
}
