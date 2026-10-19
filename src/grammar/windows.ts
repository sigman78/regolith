/**
 * Where the glass is, and where the paint goes: one layout for the hull builders (geometry/hab.ts,
 * tower.ts, stencil.ts) and the decals, so a pane always sits EYE_HEIGHT over the floor and never
 * where a door's stub is.
 */
import {
  EYE_HEIGHT,
  FLOOR_ABOVE_BELLY,
  HAB_STRIPE_FROM_END,
  HAB_STRIPE_HALF,
  HAB_WINDOW_LENGTH,
  RIB_SPACING,
  TOWER_FLOOR_HEIGHT,
} from '@/geometry/design-constants';
import { habSidePorts } from './parts/H';

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

/**
 * Angle of a hab's window row from the top of the hull, radians: the pane centre is EYE_HEIGHT over
 * the floor, which is FLOOR_ABOVE_BELLY over the belly (grammar/parts/H.ts habFloor), so the row
 * sits above the axis on an S hull and below it on an M hull.
 */
export function habPaneAngle(radius: number): number {
  const y = FLOOR_ABOVE_BELLY - radius + EYE_HEIGHT;
  return Math.acos(Math.max(-1, Math.min(1, y / radius)));
}

/** Bays of one flank that have a door on it (a side port is centred in its bay). */
function doorBays(length: number, side: 1 | -1): number[] {
  return habSidePorts(length)
    .filter((d) => d.side === side)
    .map((d) => d.x);
}

const hasDoor = (doors: readonly number[], x: number): boolean =>
  doors.some((d) => Math.abs(d - x) < 1e-6);

/** Bays of one flank that carry a pane: not under the stripe, not where that flank has a door. */
export function habWindowBays(length: number, variant: number, side: 1 | -1): number[] {
  const stripe = habStripeAt(length, variant);
  const doors = doorBays(length, side);
  return habBayCentres(length).filter(
    (x) =>
      Math.abs(x - stripe) >= HAB_STRIPE_HALF + HAB_WINDOW_LENGTH / 2 + 0.2 && !hasDoor(doors, x),
  );
}

/**
 * The bay on one flank for the serial stencil: the one furthest from the stripe that has no door
 * (ties toward the middle); when every bay has a door, the furthest from the stripe anyway.
 */
export function habStencilBay(length: number, variant: number, side: 1 | -1): number {
  const stripe = habStripeAt(length, variant);
  const doors = doorBays(length, side);
  const pick = (bays: readonly number[]): number | null => {
    let bestAt: number | null = null;
    let bestScore = -Infinity;
    for (const x of bays) {
      const score = Math.abs(x - stripe) - 1e-3 * Math.abs(x);
      if (score > bestScore) {
        bestScore = score;
        bestAt = x;
      }
    }
    return bestAt;
  };
  const bays = habBayCentres(length);
  return pick(bays.filter((x) => !hasDoor(doors, x))) ?? pick(bays) ?? 0;
}

/** Floors of a tower that carry a window band (the top floor's band is the accent stripe). */
export function towerWindowFloors(floors: number): number {
  return Math.max(0, Math.floor(floors) - 1);
}

/** Local y of tower floor k (0 is the ground floor, over the plinth). */
export function towerFloorY(k: number): number {
  return FLOOR_ABOVE_BELLY + k * TOWER_FLOOR_HEIGHT;
}

/** Centre height of tower floor k's window band: EYE_HEIGHT over that floor. */
export function towerBandY(k: number): number {
  return towerFloorY(k) + EYE_HEIGHT;
}
