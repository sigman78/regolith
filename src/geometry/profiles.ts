/**
 * The profile library: the rib/flange vocabulary every part is composed from,
 * so bevels and proportions match automatically (ARCHITECTURE §5), plus the
 * helper that stands an axis-aligned (Y-up) lathe along any direction.
 */
import {
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Vec3 } from '@/core/math';
import { BEVEL, BEVEL_SEGMENTS, HAB_RIB_INSET } from './design-constants';

/** A beveled flange ring profile in (r, y): from the hull at `r` out to `r + flange`. */
export function ribProfile(r: number, y: number, thick: number, flange: number): Vector2[] {
  const b = Math.min(BEVEL, thick / 2);
  return [
    new Vector2(r - HAB_RIB_INSET, y - thick / 2),
    new Vector2(r + flange - b, y - thick / 2),
    new Vector2(r + flange, y - thick / 2 + b),
    new Vector2(r + flange, y + thick / 2 - b),
    new Vector2(r + flange - b, y + thick / 2),
    new Vector2(r - HAB_RIB_INSET, y + thick / 2),
  ];
}

/**
 * LatheGeometry with sound normals. three leaves the first and last profile
 * normals unnormalised and tilted; at a pole (r = 0) the normal is the axis, so
 * set it exactly, and normalise everything else.
 */
export function lathe(points: Vector2[], segments: number): LatheGeometry {
  const g = new LatheGeometry(points, segments);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    if (Math.hypot(pos.getX(i), pos.getZ(i)) < 1e-6) {
      nor.setXYZ(i, 0, Math.sign(nor.getY(i)) || 1, 0);
    } else {
      const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) || 1;
      nor.setXYZ(i, nor.getX(i) / l, nor.getY(i) / l, nor.getZ(i) / l);
    }
  }
  return g;
}

export function flangeRing(
  r: number,
  thick: number,
  flange: number,
  segments: number,
): LatheGeometry {
  return lathe(ribProfile(r, 0, thick, flange), segments);
}

/** Pole-to-pole semicircle in (r, y), ascending in y so lathe normals face outward. */
export function sphereProfile(radius: number, steps: number): Vector2[] {
  const pts: Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    pts.push(new Vector2(Math.sin(a) * radius, -Math.cos(a) * radius));
  }
  return pts;
}

const Y_UP = new Vector3(0, 1, 0);

/** Rotate a Y-axis geometry so +Y points along `dir`, then move it to `at`. Mutates and returns it. */
export function placeAlong<G extends BufferGeometry>(g: G, at: Vec3, dir: Vec3): G {
  const q = new Quaternion().setFromUnitVectors(Y_UP, new Vector3(...dir).normalize());
  g.applyMatrix4(new Matrix4().compose(new Vector3(...at), q, new Vector3(1, 1, 1)));
  return g;
}

/** Beveled box, centred in X and Z with its base at y = 0. The bevel is the one BEVEL size. */
export function bevelBox(w: number, h: number, d: number): BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, BEVEL_SEGMENTS, Math.min(BEVEL, w / 2, h / 2, d / 2));
  g.translate(0, h / 2, 0);
  return g;
}

/** Beveled upright cylinder with its base at y = 0 (a lathe, so the poles are sound). */
export function bevelCylinder(r: number, h: number, segments: number): LatheGeometry {
  const b = Math.min(BEVEL, r, h / 2);
  return lathe(
    [
      new Vector2(0, 0),
      new Vector2(r - b, 0),
      new Vector2(r, b),
      new Vector2(r, h - b),
      new Vector2(r - b, h),
      new Vector2(0, h),
    ],
    segments,
  );
}

/** Thin straight rod between two points (lattice members, rails, braces). */
export function rod(a: Vec3, b: Vec3, radius: number, segments: number): BufferGeometry {
  const dir: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...dir);
  const g = new CylinderGeometry(radius, radius, len, segments, 1, false);
  return placeAlong(
    g,
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    [dir[0] / len, dir[1] / len, dir[2] / len],
  );
}
