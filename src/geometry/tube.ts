/**
 * Corridor geometry. The path is the floor line (world space, tubes have no pose, already starting
 * and ending slightly inside the hulls it joins); the section stands on it: a flat floor slab, two
 * walls, a round crown. Straight pieces meet on mitre planes, a collar covers each bend, and a D
 * flange rings the corridor every 2 m and at both ends.
 */
import type { Vec3 } from '@/core/math';
import type { BundleBuilder } from './bundle';
import {
  CORRIDOR_FLOOR_THICK,
  CORRIDOR_HALF_WIDTH,
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
  KINK_COLLAR_THICK,
  TUBE_END_THICK,
  TUBE_FLANGE,
  TUBE_PORT_EMBED,
  TUBE_RIB_SPACING,
  TUBE_RIB_THICK,
  TUBE_SEGMENTS,
} from './design-constants';
import {
  corridorSection,
  lateralOf,
  sectionCap,
  sectionRing,
  sectionSweep,
  type SectionFrame,
} from './profiles';

export interface TubeOp {
  /** flat x,y,z world coordinates of the floor line, at least two points */
  points: readonly number[];
}

/** The corridor's skin, built once: every corridor in a base has this section. */
export const CORRIDOR_SECTION = corridorSection(
  CORRIDOR_WIDTH,
  CORRIDOR_HEIGHT,
  CORRIDOR_FLOOR_THICK,
  TUBE_SEGMENTS / 2,
);

/** Plan turns below this are smooth enough to need neither a mitre nor a collar. */
const KINK_COS = Math.cos((1 * Math.PI) / 180);
/** Never stretch a mitre past this half-turn (a 135° corner); the router makes 45° steps. */
const MAX_HALF_TURN = (67.5 * Math.PI) / 180;

export function buildTube(out: BundleBuilder, op: TubeOp): void {
  // Distinct points in plan, so every piece has a heading.
  const pts: Vec3[] = [];
  for (let i = 0; i + 2 < op.points.length; i += 3) {
    const p: Vec3 = [op.points[i] ?? 0, op.points[i + 1] ?? 0, op.points[i + 2] ?? 0];
    const q = pts[pts.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[2] - q[2]) >= 1e-6) pts.push(p);
  }
  if (pts.length < 2) return;

  // Piece headings (unit, horizontal) and 3D lengths.
  const heads: Vec3[] = [];
  const lens: number[] = [];
  const starts: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i] as Vec3;
    const b = pts[i + 1] as Vec3;
    const h = Math.hypot(b[0] - a[0], b[2] - a[2]);
    heads.push([(b[0] - a[0]) / h, 0, (b[2] - a[2]) / h]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    lens.push(len);
    starts.push(total);
    total += len;
  }

  // One frame per vertex: the end headings at the ends, the bisector (stretched) at a bend.
  const frames: SectionFrame[] = [];
  const bends: { s: number; turn: number; frame: SectionFrame }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const at = pts[i] as Vec3;
    const before = heads[i - 1];
    const after = heads[i];
    if (!before || !after) {
      frames.push({ at, lat: lateralOf((after ?? before) as Vec3), stretch: 1 });
      continue;
    }
    const cosTurn = before[0] * after[0] + before[2] * after[2];
    if (cosTurn >= KINK_COS) {
      frames.push({ at, lat: lateralOf(after), stretch: 1 });
      continue;
    }
    const bx = before[0] + after[0];
    const bz = before[2] + after[2];
    const bl = Math.hypot(bx, bz);
    const bis: Vec3 = bl < 1e-6 ? after : [bx / bl, 0, bz / bl];
    const half = Math.min(MAX_HALF_TURN, Math.acos(Math.max(-1, Math.min(1, cosTurn))) / 2);
    const frame: SectionFrame = { at, lat: lateralOf(bis), stretch: 1 / Math.cos(half) };
    frames.push(frame);
    bends.push({ s: starts[i] ?? 0, turn: half, frame });
  }

  out.add('hull', sectionSweep(CORRIDOR_SECTION, frames));
  // Closed at both ends: inside a hull the caps are hidden, outside one they are the wall.
  out.add('hull', sectionCap(CORRIDOR_SECTION, frames[0] as SectionFrame, false));
  out.add('hull', sectionCap(CORRIDOR_SECTION, frames[frames.length - 1] as SectionFrame, true));

  for (const bend of bends) {
    out.add('graphite', sectionRing(CORRIDOR_SECTION, bend.frame, KINK_COLLAR_THICK, TUBE_FLANGE));
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
    // A plain ring near a bend would cut through the neighbouring piece: keep clear of the collar
    // and of the corner the mitre leaves on the inside of the turn.
    const clash = bends.some(
      (b) =>
        Math.abs(b.s - f.s) <
        (CORRIDOR_HALF_WIDTH + TUBE_FLANGE) * Math.tan(b.turn) +
          Math.max(f.thick, KINK_COLLAR_THICK) / 2 +
          TUBE_FLANGE,
    );
    if (clash) continue;
    let i = 0;
    while (i + 1 < lens.length && (starts[i + 1] ?? Infinity) <= f.s) i++;
    const a = pts[i] as Vec3;
    const b = pts[i + 1] as Vec3;
    const t = (f.s - (starts[i] ?? 0)) / (lens[i] ?? 1);
    const at: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    out.add(
      'graphite',
      sectionRing(
        CORRIDOR_SECTION,
        { at, lat: lateralOf(heads[i] as Vec3), stretch: 1 },
        f.thick,
        TUBE_FLANGE,
      ),
    );
  }
}
