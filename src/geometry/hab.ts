/**
 * Letter H geometry: a lathe hull with ribs and an accent stripe, built from
 * one shared bevel/flange vocabulary. Pure: (op) -> BufferGeometries per
 * material. Meshes and materials are assembled in render/.
 *
 * Frame matches grammar/parts/H.ts: axis along +X, origin at the centre.
 */
import { Vector2, type LatheGeometry } from 'three';
import { habStripeAt, habWindowBays } from '@/grammar/windows';
import type { BundleBuilder } from './bundle';
import { bevelBox, lathe, ribProfile } from './profiles';
import {
  FLANGE_RATIO,
  HAB_CAP_RATIO,
  HAB_CAP_STEPS,
  HAB_RIB_THICK_END,
  HAB_RIB_THICK_MID,
  HAB_SEGMENTS,
  HAB_STRIPE_HALF,
  HAB_STRIPE_PROUD,
  HAB_WINDOW_ANGLE_DEG,
  HAB_WINDOW_ARC,
  HAB_WINDOW_LENGTH,
  HAB_WINDOW_PROUD,
  HAB_WINDOW_THICK,
  RIB_SPACING,
} from './design-constants';

export interface HabOp {
  /** metres, cylinder section between the end caps */
  length: number;
  radius: number;
  /** individual.ts: which end carries the stripe and in which material (see HAB_STRIPE_VARIANTS) */
  variant?: number;
}

/** Lathe profile in (r, y) with y along the module axis. */
function hullProfile(length: number, r: number): Vector2[] {
  const half = length / 2;
  const cap = r * HAB_CAP_RATIO;
  const pts: Vector2[] = [new Vector2(0, -half - cap)];
  for (let i = 1; i <= HAB_CAP_STEPS; i++) {
    const a = (i / HAB_CAP_STEPS) * (Math.PI / 2);
    pts.push(new Vector2(Math.sin(a) * r, -half - Math.cos(a) * cap));
  }
  pts.push(new Vector2(r, half));
  for (let i = HAB_CAP_STEPS - 1; i >= 0; i--) {
    const a = (i / HAB_CAP_STEPS) * (Math.PI / 2);
    pts.push(new Vector2(Math.sin(a) * r, half + Math.cos(a) * cap));
  }
  return pts;
}

/** The lathe is built along +Y; turn it so the hab lies along +X. */
function layDown(g: LatheGeometry): LatheGeometry {
  g.rotateZ(-Math.PI / 2);
  return g;
}

export function buildHab(out: BundleBuilder, op: HabOp): void {
  const { length, radius } = op;

  out.add('hull', layDown(lathe(hullProfile(length, radius), HAB_SEGMENTS)));

  const count = Math.max(1, Math.round(length / RIB_SPACING));
  for (let i = 0; i <= count; i++) {
    const y = -length / 2 + (length * i) / count;
    const thick = i === 0 || i === count ? HAB_RIB_THICK_END : HAB_RIB_THICK_MID;
    out.add(
      'graphite',
      layDown(lathe(ribProfile(radius, y, thick, radius * FLANGE_RATIO), HAB_SEGMENTS)),
    );
  }

  // Variant 0 and 2 stripe the +x end, 1 the -x end; 2 is graphite instead of accent.
  const variant = op.variant ?? 0;
  const stripeY = habStripeAt(length, variant);
  addWindows(out, length, radius, variant);
  const r = radius + HAB_STRIPE_PROUD;
  out.add(
    variant === 2 ? 'graphite' : 'accent',
    layDown(
      lathe(
        [new Vector2(r, stripeY - HAB_STRIPE_HALF), new Vector2(r, stripeY + HAB_STRIPE_HALF)],
        HAB_SEGMENTS,
      ),
    ),
  );
}

/**
 * One window pane in the middle of each rib bay, on both upper flanks, so a
 * camera looking down sees a row of lit panes (they glow at night). The bay
 * under the accent stripe is left plain.
 */
function addWindows(out: BundleBuilder, length: number, radius: number, variant: number): void {
  const angle = (HAB_WINDOW_ANGLE_DEG * Math.PI) / 180;
  for (const x of habWindowBays(length, variant)) {
    for (const side of [1, -1]) {
      // A thin box with its outer face HAB_WINDOW_PROUD off the hull, turned to face outward.
      const pane = bevelBox(HAB_WINDOW_LENGTH, HAB_WINDOW_THICK, HAB_WINDOW_ARC);
      pane.translate(0, radius + HAB_WINDOW_PROUD - HAB_WINDOW_THICK, 0);
      pane.rotateX(side * angle);
      pane.translate(x, 0, 0);
      out.add('glass', pane);
    }
  }
}
