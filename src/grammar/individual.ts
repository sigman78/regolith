/**
 * Individuality: the small differences between two parts of the same params. A pure function of
 * (letter, serial, document seed), derived in the solver and never stored, so a reload or an undo
 * gives the same part the same look.
 *
 * - `tint` (0..INDIVIDUAL_TINT_MAX): how far the hull leans from Hull white toward Hull shaded, a
 *   move along an existing palette segment, so the palette stays closed. Applied per instance by
 *   render/, so it never splits a shared geometry.
 * - `variant`: a small index (0..VARIANTS-1) a part may fold into its recipe, e.g. which end of a
 *   hab carries the stripe. Few values, so identical parts still share most bundles.
 */
import { hashInts, hashString } from '@/core/rng';
import { HAB_STRIPE_VARIANTS, INDIVIDUAL_TINT_MAX } from '@/geometry/design-constants';
import type { Letter } from './types';

export interface Individual {
  variant: number;
  tint: number;
}

/** Letters whose hull takes a tint. Others (and solver-made nodes, serial 0) stay as authored. */
const TINTED: ReadonlySet<string> = new Set(['H', 'V', 'D', 'N', 'P']);

const U32 = 4294967296;

export function individualOf(letter: Letter, serial: number, seed: string): Individual {
  if (serial <= 0) return { variant: 0, tint: 0 };
  const s = hashString(seed);
  const variant = hashInts(serial, s, 1) % HAB_STRIPE_VARIANTS;
  const tint = TINTED.has(letter) ? (hashInts(serial, s, 2) / U32) * INDIVIDUAL_TINT_MAX : 0;
  return { variant, tint };
}
