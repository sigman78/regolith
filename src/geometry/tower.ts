/**
 * Letter V geometry: an upright hull with a flat base, a domed cap, a rib at
 * every floor, a window band per floor and one accent stripe under the cap.
 *
 * Frame matches grammar/parts/V.ts: axis along +Y, base at y = 0, centred in X and Z.
 */
import { Vector2 } from 'three';
import type { BundleBuilder } from './bundle';
import {
  BEVEL,
  FLANGE_RATIO,
  TOWER_CAP_RATIO,
  TOWER_CAP_STEPS,
  TOWER_FLOOR_HEIGHT,
  TOWER_RIB_THICK,
  TOWER_SEGMENTS,
  TOWER_STRIPE_BELOW_TOP,
  TOWER_STRIPE_HALF,
  TOWER_WINDOW_HALF,
  TOWER_WINDOW_PROUD,
  TOWER_WINDOW_Y,
} from './design-constants';
import { lathe, ribProfile } from './profiles';

export interface TowerOp {
  floors: number;
  radius: number;
}

export function towerHeight(floors: number): number {
  return floors * TOWER_FLOOR_HEIGHT;
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

  // A rib between every pair of floors and one on the top rim.
  for (let k = 1; k <= floors; k++) {
    out.add(
      'graphite',
      lathe(
        ribProfile(r, k * TOWER_FLOOR_HEIGHT, TOWER_RIB_THICK, r * FLANGE_RATIO),
        TOWER_SEGMENTS,
      ),
    );
  }

  for (let k = 0; k < floors; k++) {
    const y = k * TOWER_FLOOR_HEIGHT + TOWER_WINDOW_Y;
    const wr = r + TOWER_WINDOW_PROUD;
    out.add(
      'glass',
      lathe(
        [new Vector2(wr, y - TOWER_WINDOW_HALF), new Vector2(wr, y + TOWER_WINDOW_HALF)],
        TOWER_SEGMENTS,
      ),
    );
  }

  const sy = h - TOWER_STRIPE_BELOW_TOP;
  const sr = r + TOWER_WINDOW_PROUD;
  out.add(
    'accent',
    lathe(
      [new Vector2(sr, sy - TOWER_STRIPE_HALF), new Vector2(sr, sy + TOWER_STRIPE_HALF)],
      TOWER_SEGMENTS,
    ),
  );
}
