/**
 * Letter C geometry: an electromagnetic launcher. A graphite sled carries a
 * breech block and trestle posts; an aluminum barrel hinges at the rear and
 * rises at the chosen elevation, ringed by coils and ending in a hazard band.
 *
 * Frame matches grammar/parts/C.ts: barrel points along +X, sled underside at y = 0.
 */
import type { BundleBuilder } from './bundle';
import type { Vec3 } from '@/core/math';
import {
  LAUNCHER_BARREL_RADIUS,
  LAUNCHER_BREECH,
  LAUNCHER_COIL_END,
  LAUNCHER_COIL_RADIUS,
  LAUNCHER_COIL_SPACING,
  LAUNCHER_COIL_START,
  LAUNCHER_COIL_THICK,
  LAUNCHER_HINGE_HEIGHT,
  LAUNCHER_HINGE_INSET,
  LAUNCHER_MUZZLE_BAND,
  LAUNCHER_MUZZLE_BAND_RADIUS,
  LAUNCHER_MUZZLE_INSET,
  LAUNCHER_POSTS,
  LAUNCHER_POST_DEPTH,
  LAUNCHER_POST_WIDTH,
  LAUNCHER_SEGMENTS,
  LAUNCHER_SLED_HEIGHT,
  LAUNCHER_SLED_WIDTH,
} from './design-constants';
import { bevelBox, bevelCylinder, placeAlong, rod } from './profiles';
import { translated } from './transform';

export interface LauncherOp {
  length: number;
  /** degrees above horizontal */
  elevation: number;
}

/** Hinge point and barrel direction for a launcher of this length and elevation. */
export function barrelFrame(op: LauncherOp): { hinge: Vec3; dir: Vec3; length: number } {
  const e = (op.elevation * Math.PI) / 180;
  const hingeX = -op.length / 2 + LAUNCHER_HINGE_INSET;
  const endX = op.length / 2 - LAUNCHER_MUZZLE_INSET;
  return {
    hinge: [hingeX, LAUNCHER_SLED_HEIGHT + LAUNCHER_HINGE_HEIGHT, 0],
    dir: [Math.cos(e), Math.sin(e), 0],
    length: (endX - hingeX) / Math.cos(e),
  };
}

function along(hinge: Vec3, dir: Vec3, s: number): Vec3 {
  return [hinge[0] + dir[0] * s, hinge[1] + dir[1] * s, hinge[2] + dir[2] * s];
}

export function buildLauncher(out: BundleBuilder, op: LauncherOp): void {
  const { hinge, dir, length: barrel } = barrelFrame(op);

  out.add('graphite', bevelBox(op.length, LAUNCHER_SLED_HEIGHT, LAUNCHER_SLED_WIDTH));

  // Breech block: from the sled up past the barrel's underside, centred just behind the hinge.
  const breechH = LAUNCHER_HINGE_HEIGHT + LAUNCHER_BARREL_RADIUS + LAUNCHER_BREECH.extra;
  out.add(
    'graphite',
    translated(
      bevelBox(LAUNCHER_BREECH.w, breechH, LAUNCHER_BREECH.d),
      hinge[0] - 0.1,
      LAUNCHER_SLED_HEIGHT,
      0,
    ),
  );

  out.add(
    'aluminum',
    rod(hinge, along(hinge, dir, barrel), LAUNCHER_BARREL_RADIUS, LAUNCHER_SEGMENTS),
  );

  // Coils at a steady spacing between the breech and the muzzle band.
  const last = barrel - LAUNCHER_COIL_END;
  for (let s = LAUNCHER_COIL_START; s <= last + 1e-9; s += LAUNCHER_COIL_SPACING) {
    out.add(
      'hull',
      placeAlong(
        bevelCylinder(LAUNCHER_COIL_RADIUS, LAUNCHER_COIL_THICK, LAUNCHER_SEGMENTS),
        along(hinge, dir, s - LAUNCHER_COIL_THICK / 2),
        dir,
      ),
    );
  }

  out.add(
    'warning',
    placeAlong(
      bevelCylinder(LAUNCHER_MUZZLE_BAND_RADIUS, LAUNCHER_MUZZLE_BAND, LAUNCHER_SEGMENTS),
      along(hinge, dir, barrel - LAUNCHER_MUZZLE_BAND),
      dir,
    ),
  );

  // Trestle posts from the sled up to just under the barrel.
  for (const f of LAUNCHER_POSTS) {
    const c = along(hinge, dir, barrel * f);
    const top = c[1] - LAUNCHER_BARREL_RADIUS * 0.9;
    const h = top - LAUNCHER_SLED_HEIGHT;
    if (h <= 0.05) continue;
    out.add(
      'graphite',
      translated(
        bevelBox(LAUNCHER_POST_WIDTH, h, LAUNCHER_POST_DEPTH),
        c[0],
        LAUNCHER_SLED_HEIGHT,
        0,
      ),
    );
  }
}
