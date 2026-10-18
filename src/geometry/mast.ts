/**
 * Letter M geometry: a three-legged lattice mast on a round base plate with a
 * dish, whip or relay head and an accent beacon ball.
 *
 * Frame matches grammar/parts/M.ts: axis along +Y, base underside at y = 0.
 */
import { Matrix4, Vector2 } from 'three';
import type { Vec3 } from '@/core/math';
import type { BundleBuilder } from './bundle';
import {
  MAST_BASE_RADIUS,
  MAST_BASE_SEGMENTS,
  MAST_BASE_THICK,
  MAST_BEACON_RADIUS,
  MAST_BEACON_SEGMENTS,
  MAST_BRACE_RADIUS,
  MAST_DISH_DEPTH,
  MAST_DISH_LIFT,
  MAST_DISH_RADIUS,
  MAST_DISH_STEPS,
  MAST_DISH_THICK,
  MAST_DISH_TILT_DEG,
  MAST_FEED_LENGTH,
  MAST_HEAD_DISH,
  MAST_HEAD_WHIP,
  MAST_LATTICE_R0,
  MAST_LATTICE_R1,
  MAST_LEG_RADIUS,
  MAST_RELAY_BOX,
  MAST_RELAY_LIFT,
  MAST_ROD_SEGMENTS,
  MAST_SECTION,
  MAST_WHIP_LENGTH,
  MAST_WHIP_RADIUS,
} from './design-constants';
import { bevelBox, bevelCylinder, lathe, rod, sphereProfile } from './profiles';
import { translated } from './transform';

export interface MastOp {
  height: number;
  /** 0 dish, 1 whip, 2 relay (MAST_HEAD_*) */
  head: number;
}

const LEG_ANGLES = [0, 1, 2].map((k) => Math.PI / 2 + (k * Math.PI * 2) / 3);

/** Lattice circumradius at height y. */
function radiusAt(y: number, height: number): number {
  const t = (y - MAST_BASE_THICK) / (height - MAST_BASE_THICK);
  return MAST_LATTICE_R0 + (MAST_LATTICE_R1 - MAST_LATTICE_R0) * t;
}

function legPoint(k: number, y: number, height: number): Vec3 {
  const r = radiusAt(y, height);
  const a = LEG_ANGLES[k] ?? 0;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
}

export function buildMast(out: BundleBuilder, op: MastOp): void {
  const { height, head } = op;

  out.add('graphite', bevelCylinder(MAST_BASE_RADIUS, MAST_BASE_THICK, MAST_BASE_SEGMENTS));

  // Legs, one rod each from the plate to the top.
  for (let k = 0; k < 3; k++) {
    out.add(
      'aluminum',
      rod(
        legPoint(k, MAST_BASE_THICK, height),
        legPoint(k, height, height),
        MAST_LEG_RADIUS,
        MAST_ROD_SEGMENTS,
      ),
    );
  }

  // Rings and diagonals per section.
  const sections = Math.max(1, Math.round((height - MAST_BASE_THICK) / MAST_SECTION));
  for (let i = 0; i <= sections; i++) {
    const y = MAST_BASE_THICK + ((height - MAST_BASE_THICK) * i) / sections;
    for (let k = 0; k < 3; k++) {
      const next = (k + 1) % 3;
      out.add(
        'aluminum',
        rod(
          legPoint(k, y, height),
          legPoint(next, y, height),
          MAST_BRACE_RADIUS,
          MAST_ROD_SEGMENTS,
        ),
      );
      if (i < sections) {
        const yUp = MAST_BASE_THICK + ((height - MAST_BASE_THICK) * (i + 1)) / sections;
        out.add(
          'aluminum',
          rod(
            legPoint(k, y, height),
            legPoint(next, yUp, height),
            MAST_BRACE_RADIUS,
            MAST_ROD_SEGMENTS,
          ),
        );
      }
    }
  }

  switch (head) {
    case MAST_HEAD_DISH:
      buildDish(out, height);
      break;
    case MAST_HEAD_WHIP:
      out.add(
        'aluminum',
        rod([0, height, 0], [0, height + MAST_WHIP_LENGTH, 0], MAST_WHIP_RADIUS, MAST_ROD_SEGMENTS),
      );
      beacon(out, [0, height + MAST_WHIP_LENGTH, 0]);
      break;
    default:
      buildRelay(out, height);
  }
}

function beacon(out: BundleBuilder, at: Vec3): void {
  out.add(
    'accent',
    translated(
      lathe(sphereProfile(MAST_BEACON_RADIUS, 6), MAST_BEACON_SEGMENTS),
      at[0],
      at[1],
      at[2],
    ),
  );
}

function buildDish(out: BundleBuilder, height: number): void {
  const centre: Vec3 = [0, height + MAST_DISH_LIFT, 0];
  out.add('graphite', rod([0, height, 0], centre, MAST_BRACE_RADIUS * 2, MAST_ROD_SEGMENTS));

  // A thin parabolic shell: outer surface from the pole out, rim, inner surface back.
  const R = MAST_DISH_RADIUS;
  const depth = (r: number): number => MAST_DISH_DEPTH * R * (r / R) ** 2;
  const profile: Vector2[] = [];
  for (let i = 0; i <= MAST_DISH_STEPS; i++) {
    const r = (i / MAST_DISH_STEPS) * R;
    profile.push(new Vector2(r, depth(r)));
  }
  for (let i = MAST_DISH_STEPS; i >= 0; i--) {
    const r = (i / MAST_DISH_STEPS) * R;
    profile.push(new Vector2(r, depth(r) + MAST_DISH_THICK));
  }
  const tilt = (MAST_DISH_TILT_DEG * Math.PI) / 180;
  const dish = lathe(profile, 24);
  dish.applyMatrix4(new Matrix4().makeRotationZ(-tilt));
  out.add('aluminum', translated(dish, centre[0], centre[1], centre[2]));

  // Feed horn along the dish axis, tipped with the beacon.
  const axis: Vec3 = [Math.sin(tilt), Math.cos(tilt), 0];
  const tip: Vec3 = [
    centre[0] + axis[0] * MAST_FEED_LENGTH,
    centre[1] + axis[1] * MAST_FEED_LENGTH,
    centre[2],
  ];
  out.add('graphite', rod(centre, tip, MAST_BRACE_RADIUS, MAST_ROD_SEGMENTS));
  beacon(out, tip);
}

function buildRelay(out: BundleBuilder, height: number): void {
  const { w, h, d } = MAST_RELAY_BOX;
  out.add(
    'graphite',
    rod([0, height, 0], [0, height + MAST_RELAY_LIFT, 0], MAST_BRACE_RADIUS * 2, MAST_ROD_SEGMENTS),
  );
  out.add('hull', translated(bevelBox(w, h, d), 0, height + MAST_RELAY_LIFT, 0));
  out.add(
    'glass',
    translated(bevelBox(w * 0.6, 0.05, d + 0.02), 0, height + MAST_RELAY_LIFT + h * 0.55, 0),
  );
  beacon(out, [0, height + MAST_RELAY_LIFT + h + MAST_BEACON_RADIUS * 0.5, 0]);
}
