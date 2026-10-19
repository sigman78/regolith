/**
 * The profile library: the rib/flange vocabulary every part is composed from,
 * so bevels and proportions match automatically (ARCHITECTURE §5), plus the
 * helper that stands an axis-aligned (Y-up) lathe along any direction.
 */
import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
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
  return soundLathe(new LatheGeometry(points, segments));
}

function soundLathe(g: LatheGeometry): LatheGeometry {
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

/** The lathe angle a horizontal direction sits at: three puts angle phi at (r sin phi, y, r cos phi). */
export function lathePhi(dir: Vec3): number {
  return Math.atan2(dir[0], dir[2]);
}

/**
 * The arcs of a ring that skips a gap `halfWidth` wide (a lateral distance at radius r) around each
 * direction, as [phiStart, phiLength] pairs; the whole ring when there is nothing to skip.
 */
export function ringArcs(dirs: readonly Vec3[], r: number, halfWidth: number): [number, number][] {
  const TAU = Math.PI * 2;
  if (dirs.length === 0) return [[0, TAU]];
  if (halfWidth >= r) return [];
  const half = Math.asin(halfWidth / r);
  const centres = dirs.map((d) => ((lathePhi(d) % TAU) + TAU) % TAU).sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i < centres.length; i++) {
    const start = (centres[i] ?? 0) + half;
    const next = (centres[(i + 1) % centres.length] ?? 0) + (i + 1 === centres.length ? TAU : 0);
    const length = next - half - start;
    if (length > 1e-6) out.push([start, length]);
  }
  return out;
}

/**
 * A lathe over only the given arcs, the segments shared pro rata. A thin band (two profile points)
 * just ends; a solid profile (a rib) gets a flat face at each arc end, so no hollow shows.
 */
export function latheArcs(
  points: Vector2[],
  segments: number,
  arcs: readonly [number, number][],
): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (const [start, length] of arcs) {
    const n = Math.max(1, Math.round((segments * length) / (Math.PI * 2)));
    out.push(soundLathe(new LatheGeometry(points, n, start, length)));
    if (points.length > 2 && length < Math.PI * 2 - 1e-9) {
      out.push(arcCap(points, start, -1), arcCap(points, start + length, 1));
    }
  }
  return out;
}

/** The profile as a flat face at angle phi, looking along (sign) the direction of increasing phi. */
function arcCap(points: Vector2[], phi: number, sign: 1 | -1): BufferGeometry {
  const n: Vec3 = [Math.cos(phi) * sign, 0, -Math.sin(phi) * sign];
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const p of points) {
    pos.push(p.x * Math.sin(phi), p.y, p.x * Math.cos(phi));
    nor.push(...n);
    uv.push(p.x, p.y);
  }
  // A fan over the (convex) profile, wound to face the normal.
  const a = points[0] as Vector2;
  const b = points[1] as Vector2;
  const c = points[2] as Vector2;
  const u = [b.x - a.x, b.y - a.y];
  const v = [c.x - a.x, c.y - a.y];
  // Profile winding in the (radial, y) plane; the face normal is the tangent, so the sign of the
  // cross product against it decides the order.
  const ccw = (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0) > 0;
  const flip = ccw === sign > 0;
  for (let i = 1; i + 1 < points.length; i++) {
    if (flip) idx.push(0, i + 1, i);
    else idx.push(0, i, i + 1);
  }
  return buildIndexed(pos, nor, uv, idx);
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

// ---- The corridor section ---------------------------------------------------

/** One vertex of a closed 2D section: x lateral, y up from the floor line, and its outward normal. */
export interface SectionPoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** A closed loop, counter-clockwise in (x, y), consecutive normals continuous (no hard corners). */
export type Section = readonly SectionPoint[];

/**
 * The corridor's skin: a flat underside `floorThick` below the floor line with 6 cm bevelled
 * corners, straight walls, and a semicircular crown of radius width / 2 whose top is `height` over
 * the floor. Normals are continuous all round, so one vertex per point shades correctly.
 */
export function corridorSection(
  width: number,
  height: number,
  floorThick: number,
  roofSteps: number,
): Section {
  const hw = width / 2;
  const wallTop = height - hw;
  const b = Math.min(BEVEL, hw);
  const out: SectionPoint[] = [];
  const arc = (cx: number, cy: number, r: number, from: number, to: number, n: number): void => {
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      out.push({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        nx: Math.cos(a),
        ny: Math.sin(a),
      });
    }
  };
  arc(-hw + b, -floorThick + b, b, Math.PI, 1.5 * Math.PI, BEVEL_SEGMENTS);
  arc(hw - b, -floorThick + b, b, 1.5 * Math.PI, 2 * Math.PI, BEVEL_SEGMENTS);
  arc(0, wallTop, hw, 0, Math.PI, roofSteps);
  return out;
}

/**
 * Where a section stands in the world: its origin on the floor line, the unit horizontal axis
 * across the corridor, and a stretch of that axis. The heading is lat × up. A bend's mitre plane
 * stretches the section by 1 / cos(half the turn), which is what makes two straight runs meet
 * without a gap.
 */
export interface SectionFrame {
  at: Vec3;
  lat: Vec3;
  stretch: number;
}

/** The horizontal unit heading of a frame: lat × up. */
function headingOf(lat: Vec3): Vec3 {
  return [-lat[2], 0, lat[0]];
}

/** The across axis of a horizontal heading: up × heading. */
export function lateralOf(heading: Vec3): Vec3 {
  return [heading[2], 0, -heading[0]];
}

function sectionAt(f: SectionFrame, p: SectionPoint, offset = 0): Vec3 {
  const x = p.x * f.stretch + p.nx * offset;
  const y = p.y + p.ny * offset;
  return [f.at[0] + f.lat[0] * x, f.at[1] + y, f.at[2] + f.lat[2] * x];
}

function pushQuad(idx: number[], a: number, b: number, c: number, e: number): void {
  idx.push(a, b, c, a, c, e);
}

/**
 * The skin of a corridor: the section lofted through a frame per path vertex. Frames at a bend sit
 * on its mitre plane and are stretched, so each straight piece is an exact prism, and the pieces
 * meet on the plane with no overlap. A piece's normals are exact for a climbing piece too (the
 * tangent in the section plane crossed with the piece's direction). Open at both ends; with
 * `closed` false the section is an open run (a window strip) rather than a loop.
 */
export function sectionSweep(
  section: Section,
  frames: readonly SectionFrame[],
  closed = true,
): BufferGeometry {
  const n = section.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let s = 0;
  for (let i = 0; i + 1 < frames.length; i++) {
    const fa = frames[i] as SectionFrame;
    const fb = frames[i + 1] as SectionFrame;
    const dx = fb.at[0] - fa.at[0];
    const dy = fb.at[1] - fa.at[1];
    const dz = fb.at[2] - fa.at[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-9) continue;
    const dir = new Vector3(dx / len, dy / len, dz / len);
    const h = Math.hypot(dx, dz);
    if (h < 1e-9) continue;
    const lat = new Vector3(dz / h, 0, -dx / h);
    const base = pos.length / 3;
    for (const [f, along] of [
      [fa, s],
      [fb, s + len],
    ] as const) {
      for (let j = 0; j < n; j++) {
        const p = section[j] as SectionPoint;
        pos.push(...sectionAt(f, p));
        // Tangent of the loop (counter-clockwise) is (-ny, nx); the outward normal is tangent × dir.
        const t = lat
          .clone()
          .multiplyScalar(-p.ny)
          .add(new Vector3(0, p.nx, 0));
        const nn = t.cross(dir).normalize();
        nor.push(nn.x, nn.y, nn.z);
        uv.push(j / n, along);
      }
    }
    for (let j = 0; j + (closed ? 0 : 1) < n; j++) {
      const k = (j + 1) % n;
      pushQuad(idx, base + j, base + k, base + n + k, base + n + j);
    }
    s += len;
  }
  return buildIndexed(pos, nor, uv, idx);
}

/**
 * The run of a section between two heights on each wall (x < 0, then x > 0), its ends interpolated
 * exactly at the heights and every point pushed out by `proud`: the open runs a window strip is
 * swept from. Each run keeps the loop's order, so sectionSweep(run, frames, false) faces outward.
 */
export function sectionBands(section: Section, yLo: number, yHi: number, proud: number): Section[] {
  const n = section.length;
  const out: Section[] = [];
  for (const side of [-1, 1]) {
    const run: SectionPoint[] = [];
    let lastRaw: SectionPoint | null = null;
    const push = (p: SectionPoint): void => {
      // Consecutive edges share a point: keep it once (compared before the offset).
      if (lastRaw && Math.abs(lastRaw.x - p.x) < 1e-9 && Math.abs(lastRaw.y - p.y) < 1e-9) return;
      lastRaw = p;
      const l = Math.hypot(p.nx, p.ny) || 1;
      const nx = p.nx / l;
      const ny = p.ny / l;
      run.push({ x: p.x + nx * proud, y: p.y + ny * proud, nx, ny });
    };
    const lerp = (p: SectionPoint, q: SectionPoint, t: number): SectionPoint => ({
      x: p.x + (q.x - p.x) * t,
      y: p.y + (q.y - p.y) * t,
      nx: p.nx + (q.nx - p.nx) * t,
      ny: p.ny + (q.ny - p.ny) * t,
    });
    for (let j = 0; j < n; j++) {
      const p = section[j] as SectionPoint;
      const q = section[(j + 1) % n] as SectionPoint;
      if (Math.sign((p.x + q.x) / 2) !== side) continue;
      // The part of this edge between the heights, as a parameter range.
      let t0 = 0;
      let t1 = 1;
      const dy = q.y - p.y;
      if (Math.abs(dy) < 1e-12) {
        if (p.y < yLo || p.y > yHi) continue;
      } else {
        const a = (yLo - p.y) / dy;
        const b = (yHi - p.y) / dy;
        t0 = Math.max(0, Math.min(a, b));
        t1 = Math.min(1, Math.max(a, b));
        if (t1 - t0 <= 1e-9) continue;
      }
      push(lerp(p, q, t0));
      push(lerp(p, q, t1));
    }
    if (run.length >= 2) out.push(run);
  }
  return out;
}

/** The D-shaped flange: the section pushed out by `flange`, `thick` along the heading, bevelled. */
export function sectionRing(
  section: Section,
  frame: SectionFrame,
  thick: number,
  flange: number,
): BufferGeometry {
  const n = section.length;
  const b = Math.min(BEVEL, thick / 2);
  // The profile across the band in (offset along the section normal, along the heading), counter-
  // clockwise, with its own normal in the same two axes.
  const rows: { o: number; a: number; no: number; na: number }[] = [
    { o: -HAB_RIB_INSET, a: -thick / 2, no: 0, na: -1 },
    { o: flange - b, a: -thick / 2, no: 0, na: -1 },
  ];
  for (let i = 1; i <= BEVEL_SEGMENTS; i++) {
    const t = -Math.PI / 2 + (i / BEVEL_SEGMENTS) * (Math.PI / 2);
    rows.push({
      o: flange - b + Math.cos(t) * b,
      a: -thick / 2 + b + Math.sin(t) * b,
      no: Math.cos(t),
      na: Math.sin(t),
    });
  }
  for (let i = 0; i <= BEVEL_SEGMENTS; i++) {
    const t = (i / BEVEL_SEGMENTS) * (Math.PI / 2);
    rows.push({
      o: flange - b + Math.cos(t) * b,
      a: thick / 2 - b + Math.sin(t) * b,
      no: Math.cos(t),
      na: Math.sin(t),
    });
  }
  rows.push({ o: -HAB_RIB_INSET, a: thick / 2, no: 0, na: 1 });

  const head = headingOf(frame.lat);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const r of rows) {
    for (let j = 0; j < n; j++) {
      const p = section[j] as SectionPoint;
      const q = sectionAt(frame, p, r.o);
      pos.push(q[0] + head[0] * r.a, q[1], q[2] + head[2] * r.a);
      // Section normal (nx lateral, ny up) mixed with the heading.
      const x = frame.lat[0] * p.nx * r.no + head[0] * r.na;
      const y = p.ny * r.no;
      const z = frame.lat[2] * p.nx * r.no + head[2] * r.na;
      const l = Math.hypot(x, y, z) || 1;
      nor.push(x / l, y / l, z / l);
      uv.push(j / n, r.a);
    }
  }
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      pushQuad(idx, i * n + j, i * n + k, (i + 1) * n + k, (i + 1) * n + j);
    }
  }
  return buildIndexed(pos, nor, uv, idx);
}

function buildIndexed(pos: number[], nor: number[], uv: number[], idx: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * A flat face closing the section at a frame: facing along the heading (`forward`) or against it.
 * The section is convex, so a fan from its middle is enough. Buried inside a hull it is never seen;
 * where a corridor mouth would otherwise show daylight (a round hull the crown overtops) it is the wall.
 */
export function sectionCap(
  section: Section,
  frame: SectionFrame,
  forward: boolean,
): BufferGeometry {
  const n = section.length;
  const head = headingOf(frame.lat);
  const sign = forward ? 1 : -1;
  let cy = 0;
  for (const p of section) cy += p.y / n;
  const pos: number[] = [...frame.at];
  pos[1] = frame.at[1] + cy;
  const nor: number[] = [head[0] * sign, 0, head[2] * sign];
  const uv: number[] = [0.5, 0.5];
  for (const p of section) {
    pos.push(...sectionAt(frame, p));
    nor.push(head[0] * sign, 0, head[2] * sign);
    uv.push(p.x, p.y);
  }
  const idx: number[] = [];
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    if (forward) idx.push(0, 1 + j, 1 + k);
    else idx.push(0, 1 + k, 1 + j);
  }
  return buildIndexed(pos, nor, uv, idx);
}
