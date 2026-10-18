/**
 * Where the glass is. The hull builders (geometry/hab.ts) and the window silhouettes
 * (sim/silhouettes.ts) both read these, so a figure can never stand on a bay that has no pane.
 */
import {
  HAB_STRIPE_FROM_END,
  HAB_STRIPE_HALF,
  HAB_WINDOW_LENGTH,
  RIB_SPACING,
} from '@/geometry/design-constants';

/** Rib bays of a hab, as centres along its axis (the same count the ribs use). */
export function habBayCentres(length: number): number[] {
  const count = Math.max(1, Math.round(length / RIB_SPACING));
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(-length / 2 + (length * (i + 0.5)) / count);
  return out;
}

/** Axis position of a hab's accent stripe: variant 1 stripes the -x end, the others the +x end. */
export function habStripeAt(length: number, variant: number): number {
  return (variant === 1 ? -1 : 1) * (length / 2 - HAB_STRIPE_FROM_END);
}

/** Bays that carry a window pane (the bay under the stripe is left plain). */
export function habWindowBays(length: number, variant: number): number[] {
  const stripe = habStripeAt(length, variant);
  return habBayCentres(length).filter(
    (x) => Math.abs(x - stripe) >= HAB_STRIPE_HALF + HAB_WINDOW_LENGTH / 2 + 0.2,
  );
}

/** Floors of a tower that carry a window band (the top floor's band is the accent stripe). */
export function towerWindowFloors(floors: number): number {
  return Math.max(0, Math.floor(floors) - 1);
}
