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
  CORRIDOR_STRIP_GAP,
  CORRIDOR_STRIP_HALF,
  CORRIDOR_STRIP_MIN,
  CORRIDOR_STRIP_PROUD,
  CORRIDOR_WIDTH,
  EYE_HEIGHT,
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
  sectionBands,
  sectionCap,
  sectionRing,
  sectionSweep,
  type SectionFrame,
} from './profiles';

export interface TubeOp {
  /** flat x,y,z world coordinates of the floor line, at least two points */
  points: readonly number[];
  /** window strips along both walls at eye height (a corridor; never a dock bridge) */
  windows?: boolean;
}

/** The corridor's skin, built once: every corridor in a base has this section. */
export const CORRIDOR_SECTION = corridorSection(
  CORRIDOR_WIDTH,
  CORRIDOR_HEIGHT,
  CORRIDOR_FLOOR_THICK,
  TUBE_SEGMENTS / 2,
);

/** The window strips' runs of the section, one per wall, straddling the wall top and the first crown chord. */
const STRIP_BANDS = sectionBands(
  CORRIDOR_SECTION,
  EYE_HEIGHT - CORRIDOR_STRIP_HALF,
  EYE_HEIGHT + CORRIDOR_STRIP_HALF,
  CORRIDOR_STRIP_PROUD,
);

/** Plan turns below this are smooth enough to need neither a mitre nor a collar. */
const KINK_COS = Math.cos((1 * Math.PI) / 180);
/** Never stretch a mitre past this half-turn (a 135° corner); the router makes 45° steps. */
/** A mitre eased for short pieces never narrows the section below this fraction. */
const MIN_STRETCH = 0.5;
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

  // Half the plan turn at each vertex (0 where the run is straight), then the mitre fitted to the
  // pieces: a piece must be long enough for the outer corners at both its ends, or the stretched
  // rings would cross. Short ones get a shallower mitre (a small notch, never a hole).
  const halves: number[] = pts.map((_, i) => {
    const before = heads[i - 1];
    const after = heads[i];
    if (!before || !after) return 0;
    const cosTurn = before[0] * after[0] + before[2] * after[2];
    if (cosTurn >= KINK_COS) return 0;
    return Math.min(MAX_HALF_TURN, Math.acos(Math.max(-1, Math.min(1, cosTurn))) / 2);
  });
  const fit: number[] = halves.map(() => 1);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i] as Vec3;
    const c = pts[i + 1] as Vec3;
    const run = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const need =
      (CORRIDOR_HALF_WIDTH + TUBE_FLANGE) *
      (Math.tan(halves[i] ?? 0) + Math.tan(halves[i + 1] ?? 0));
    if (need > run) {
      const f = run / need;
      fit[i] = Math.min(fit[i] ?? 1, f);
      fit[i + 1] = Math.min(fit[i + 1] ?? 1, f);
    }
  }

  // One frame per vertex: the end headings at the ends, the bisector (stretched) at a bend. On a
  // climb the two prisms' true intersection is not a vertical plane; the shared ring skews each
  // piece by about slope * x * tan(half turn), under 6 cm at CORRIDOR_MAX_SLOPE.
  const frames: SectionFrame[] = [];
  const bends: { s: number; turn: number; frame: SectionFrame }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const at = pts[i] as Vec3;
    const before = heads[i - 1];
    const after = heads[i];
    const half = halves[i] ?? 0;
    if (!before || !after || half === 0) {
      frames.push({ at, lat: lateralOf((after ?? before) as Vec3), stretch: 1 });
      continue;
    }
    const bx = before[0] + after[0];
    const bz = before[2] + after[2];
    const bl = Math.hypot(bx, bz);
    const bis: Vec3 = bl < 1e-6 ? after : [bx / bl, 0, bz / bl];
    // Scaling the stretch scales how far the ring slides along the pieces, so it never overruns them.
    const stretch = Math.max(MIN_STRETCH, (fit[i] ?? 1) / Math.cos(half));
    const frame: SectionFrame = { at, lat: lateralOf(bis), stretch };
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

  // Window strips: along each straight piece, clear of the end flanges (the stubs) and of the
  // bend collars and their mitre corners; a strip runs under the plain flanges between.
  if (op.windows) {
    const endClear = TUBE_PORT_EMBED + TUBE_END_THICK / 2 + CORRIDOR_STRIP_GAP;
    const bendClear = (v: number): number =>
      (CORRIDOR_HALF_WIDTH + CORRIDOR_STRIP_PROUD) * Math.tan(halves[v] ?? 0) +
      KINK_COLLAR_THICK / 2 +
      CORRIDOR_STRIP_GAP;
    for (let i = 0; i + 1 < pts.length; i++) {
      const len = lens[i] ?? 0;
      const s0 = i === 0 ? endClear : bendClear(i);
      const s1 = len - (i + 2 === pts.length ? endClear : bendClear(i + 1));
      if (s1 - s0 < CORRIDOR_STRIP_MIN) continue;
      const a = pts[i] as Vec3;
      const b = pts[i + 1] as Vec3;
      const lat = lateralOf(heads[i] as Vec3);
      const along = (s: number): Vec3 => [
        a[0] + ((b[0] - a[0]) * s) / len,
        a[1] + ((b[1] - a[1]) * s) / len,
        a[2] + ((b[2] - a[2]) * s) / len,
      ];
      const frames: SectionFrame[] = [
        { at: along(s0), lat, stretch: 1 },
        { at: along(s1), lat, stretch: 1 },
      ];
      for (const band of STRIP_BANDS) out.add('glass', sectionSweep(band, frames, false));
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
