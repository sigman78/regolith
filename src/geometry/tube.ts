/**
 * Tube geometry: straight cylinder sections between the path points, a ball
 * joint at every real bend, beveled flanges every 2 m and at both ends.
 * The path is in world space (tubes have no pose) and already starts and
 * ends slightly inside the hulls it connects.
 */
import { CylinderGeometry } from 'three';
import type { Vec3 } from '@/core/math';
import type { BundleBuilder } from './bundle';
import {
  TUBE_BALL_SEGMENTS,
  TUBE_END_THICK,
  TUBE_FLANGE,
  TUBE_KINK_BALL,
  TUBE_PORT_EMBED,
  TUBE_RADIUS,
  TUBE_RIB_SPACING,
  TUBE_RIB_THICK,
  TUBE_SEGMENTS,
} from './design-constants';
import { flangeRing, lathe, placeAlong, sphereProfile } from './profiles';

export interface TubeOp {
  /** flat x,y,z world coordinates, at least two points */
  points: readonly number[];
}

/** Bends below this angle are smooth enough to need no ball joint. */
const KINK_COS = Math.cos((1 * Math.PI) / 180);

export function buildTube(out: BundleBuilder, op: TubeOp): void {
  // Distinct path points, so every section has a direction.
  const segPts: Vec3[] = [];
  for (let i = 0; i + 2 < op.points.length; i += 3) {
    const p: Vec3 = [op.points[i] ?? 0, op.points[i + 1] ?? 0, op.points[i + 2] ?? 0];
    const q = segPts[segPts.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) >= 1e-6) segPts.push(p);
  }
  if (segPts.length < 2) return;

  const dirs: Vec3[] = [];
  const lens: number[] = [];
  const starts: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < segPts.length; i++) {
    const a = segPts[i] as Vec3;
    const b = segPts[i + 1] as Vec3;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    dirs.push([(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len]);
    lens.push(len);
    starts.push(total);
    total += len;
  }

  // Sections.
  for (let i = 0; i < lens.length; i++) {
    const a = segPts[i] as Vec3;
    const b = segPts[i + 1] as Vec3;
    const cyl = new CylinderGeometry(
      TUBE_RADIUS,
      TUBE_RADIUS,
      lens[i] ?? 0,
      TUBE_SEGMENTS,
      1,
      true,
    );
    out.add(
      'hull',
      placeAlong(cyl, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], dirs[i] as Vec3),
    );
  }

  // Ball joints at bends.
  const bendAt: number[] = [];
  for (let i = 1; i + 1 < segPts.length; i++) {
    const d0 = dirs[i - 1] as Vec3;
    const d1 = dirs[i] as Vec3;
    if (d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2] < KINK_COS) {
      bendAt.push(starts[i] ?? 0);
      const p = segPts[i] as Vec3;
      out.add(
        'hull',
        lathe(
          sphereProfile(TUBE_RADIUS * TUBE_KINK_BALL, TUBE_BALL_SEGMENTS),
          TUBE_BALL_SEGMENTS,
        ).translate(p[0], p[1], p[2]),
      );
    }
  }

  // Flanges: both ends, then every TUBE_RIB_SPACING between them.
  const flangeAt: { s: number; thick: number }[] = [
    { s: TUBE_PORT_EMBED, thick: TUBE_END_THICK },
    { s: total - TUBE_PORT_EMBED, thick: TUBE_END_THICK },
  ];
  for (
    let s = TUBE_PORT_EMBED + TUBE_RIB_SPACING;
    s < total - TUBE_PORT_EMBED - 0.5;
    s += TUBE_RIB_SPACING
  ) {
    flangeAt.push({ s, thick: TUBE_RIB_THICK });
  }
  for (const f of flangeAt) {
    if (f.s <= 0 || f.s >= total) continue;
    // A ring across a bend would sit skewed in the ball joint: skip those.
    if (bendAt.some((b) => Math.abs(b - f.s) < TUBE_RADIUS * TUBE_KINK_BALL + f.thick)) continue;
    let i = 0;
    while (i + 1 < lens.length && (starts[i + 1] ?? Infinity) <= f.s) i++;
    const a = segPts[i] as Vec3;
    const d = dirs[i] as Vec3;
    const t = f.s - (starts[i] ?? 0);
    out.add(
      'graphite',
      placeAlong(
        flangeRing(TUBE_RADIUS, f.thick, TUBE_FLANGE, TUBE_SEGMENTS),
        [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t],
        d,
      ),
    );
  }
}
