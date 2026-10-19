/**
 * Letter V geometry: an upright hull on a FLOOR_ABOVE_BELLY plinth, a domed cap, a rib at every
 * floor's level and on the top rim, a window band at eye height on every floor but the top, and
 * one accent stripe under the cap. A rib or band at a floor with doors skips an arc around each
 * door, where the door's stub would otherwise cut through it.
 *
 * Frame matches grammar/parts/V.ts: axis along +Y, base at y = 0, centred in X and Z.
 */
import { Vector2 } from 'three';
import type { Vec3 } from '@/core/math';
import { V } from '@/grammar/parts/V';
import { STUB_HALF_WIDTH } from '@/grammar/stub-depth';
import { towerBandY, towerFloorY, towerWindowFloors } from '@/grammar/windows';
import type { BundleBuilder } from './bundle';
import {
  BAND_END_GAP,
  BEVEL,
  FLANGE_RATIO,
  FLOOR_ABOVE_BELLY,
  HAB_RIB_INSET,
  TOWER_CAP_RATIO,
  TOWER_CAP_STEPS,
  TOWER_FLOOR_HEIGHT,
  TOWER_RIB_THICK,
  TOWER_SEGMENTS,
  TOWER_STRIPE_BELOW_TOP,
  TOWER_STRIPE_HALF,
  TOWER_WINDOW_HALF,
  TOWER_WINDOW_PROUD,
} from './design-constants';
import { lathe, latheArcs, ribProfile, ringArcs } from './profiles';

export interface TowerOp {
  floors: number;
  radius: number;
}

/** Height of the drum: the plinth plus the floors; the cap sits on top. */
export function towerHeight(floors: number): number {
  return FLOOR_ABOVE_BELLY + floors * TOWER_FLOOR_HEIGHT;
}

function hullProfile(floors: number, r: number): Vector2[] {
  const h = towerHeight(floors);
  const cap = r * TOWER_CAP_RATIO;
  const b = BEVEL;
  const pts = [new Vector2(0, 0), new Vector2(r - b, 0), new Vector2(r, b), new Vector2(r, h)];
  for (let i = 1; i <= TOWER_CAP_STEPS; i++) {
    const a = (i / TOWER_CAP_STEPS) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a) * r, h + Math.sin(a) * cap));
  }
  return pts;
}

export function buildTower(out: BundleBuilder, op: TowerOp): void {
  const { floors, radius: r } = op;
  const h = towerHeight(floors);

  out.add('hull', lathe(hullProfile(floors, r), TOWER_SEGMENTS));

  // The doors on a floor, from the letter itself, so a ring can never disagree with a stub.
  const press = V.ports(V.resolve({ floors })).filter((q) => q.type === 'PRESS');
  const doorsAt = (y: number): Vec3[] =>
    press.filter((q) => Math.abs(q.position[1] - y) < 1e-6).map((q) => q.normal);
  // Rings stop a gap beside each stub's wall, measured where the ring is nearest the hull.
  const skip = STUB_HALF_WIDTH + BAND_END_GAP;

  // A rib at every floor's level (the ground floor's is the plinth rim) and one on the top rim.
  for (let k = 0; k <= floors; k++) {
    const y = towerFloorY(k);
    const profile = ribProfile(r, y, TOWER_RIB_THICK, r * FLANGE_RATIO);
    const arcs = ringArcs(doorsAt(y), r - HAB_RIB_INSET, skip);
    for (const g of latheArcs(profile, TOWER_SEGMENTS, arcs)) {
      out.add('graphite', g);
    }
  }

  // The top floor's band is the accent stripe: a glass band there would share its cylinder
  // (and z-fight with it), so it gets none.
  const wr = r + TOWER_WINDOW_PROUD;
  for (let k = 0; k < towerWindowFloors(floors); k++) {
    const y = towerBandY(k);
    const band = [new Vector2(wr, y - TOWER_WINDOW_HALF), new Vector2(wr, y + TOWER_WINDOW_HALF)];
    const arcs = ringArcs(doorsAt(towerFloorY(k)), wr, skip);
    for (const g of latheArcs(band, TOWER_SEGMENTS, arcs)) {
      out.add('glass', g);
    }
  }

  const sy = h - TOWER_STRIPE_BELOW_TOP;
  out.add(
    'accent',
    lathe(
      [new Vector2(wr, sy - TOWER_STRIPE_HALF), new Vector2(wr, sy + TOWER_STRIPE_HALF)],
      TOWER_SEGMENTS,
    ),
  );
}
