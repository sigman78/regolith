/**
 * Window silhouettes: hulls are opaque, so a crew member indoors shows only as a flat figure on a
 * window pane of the part they are in. This maps agents to panes. Pure numbers in, numbers out
 * (no three): the renderer copies the matrices into one instanced mesh.
 *
 * Rules: an agent walking a tube or dock is not shown (the strips are deferred); inside a hab it
 * stands in the pane bay nearest to it (or, standing about, in a bay picked from its index); in a
 * tower it takes a floor and a side from its index. Figures go on both flanks of a hab so the
 * picture does not depend on the camera. A matrix is built in world space with a proper
 * right-handed basis, so a mirrored part never flips a figure inside out.
 */
import { hashInts } from '@/core/rng';
import { localDirToWorld, localToWorld, worldToLocal, type Vec3 } from '@/core/math';
import {
  FIGURE_PROUD,
  HAB_WINDOW_ANGLE_DEG,
  HAB_WINDOW_PROUD,
  TOWER_FLOOR_HEIGHT,
  TOWER_WINDOW_PROUD,
  TOWER_WINDOW_Y,
} from '@/geometry/design-constants';
import { habWindowBays, towerWindowFloors } from '@/grammar/windows';
import type { PartId } from '@/world/document';
import type { ResolvedBase, ResolvedPart } from '@/grammar/solver';
import type { GeomOp } from '@/grammar/types';
import type { CrewState } from './crew';

export interface Slot {
  part: PartId;
  /** which pane: stable text, used to tell whether anything moved */
  key: string;
  /** figure frame to world, column-major 4 x 4 */
  matrix: number[];
}

const RAD = Math.PI / 180;

function opOf<K extends GeomOp['kind']>(
  part: ResolvedPart,
  kind: K,
): Extract<GeomOp, { kind: K }> | undefined {
  return part.recipe.ops.find((o): o is Extract<GeomOp, { kind: K }> => o.kind === kind);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** A figure standing at body-frame `at`, facing body-frame `normal`, its head toward body-frame `up`. */
function figureAt(part: ResolvedPart, at: Vec3, normal: Vec3, up: Vec3): number[] {
  const n = localDirToWorld(part.pose, normal);
  const u = localDirToWorld(part.pose, up);
  const x = cross(u, n);
  const p = localToWorld(part.pose, at);
  // prettier-ignore
  return [
    x[0], x[1], x[2], 0,
    u[0], u[1], u[2], 0,
    n[0], n[1], n[2], 0,
    p[0], p[1], p[2], 1,
  ];
}

function habFigures(part: ResolvedPart, index: number, along: number | null, out: Slot[]): void {
  const length = Number(part.params['length']);
  const radius = Number(part.params['radius']);
  const variant = opOf(part, 'hab')?.variant ?? 0;
  const bays = habWindowBays(length, variant);
  if (bays.length === 0 || !(radius > 0)) return;

  let bay = 0;
  if (along === null) {
    bay = hashInts(index, 17) % bays.length;
  } else {
    let best = Infinity;
    bays.forEach((x, i) => {
      const d = Math.abs(x - along);
      if (d < best) {
        best = d;
        bay = i;
      }
    });
  }
  const x = bays[bay] ?? 0;
  const theta = HAB_WINDOW_ANGLE_DEG * RAD;
  const r = radius + HAB_WINDOW_PROUD + FIGURE_PROUD;
  for (const side of [1, -1]) {
    const normal: Vec3 = [0, Math.cos(theta), side * Math.sin(theta)];
    const up: Vec3 = [0, Math.sin(theta), -side * Math.cos(theta)];
    out.push({
      part: part.id,
      key: `${part.id}:${bay}:${side}`,
      matrix: figureAt(part, [x, r * normal[1], r * normal[2]], normal, up),
    });
  }
}

function towerFigure(part: ResolvedPart, index: number, out: Slot[]): void {
  const bands = towerWindowFloors(Number(part.params['floors']));
  const radius = opOf(part, 'tower')?.radius ?? 0;
  if (bands === 0 || !(radius > 0)) return;
  const floor = hashInts(index, 29) % bands;
  // Eight sides keep a figure from sitting on the seam and make the key short.
  const side = hashInts(index, 31) % 8;
  const phi = (side * Math.PI) / 4;
  const r = radius + TOWER_WINDOW_PROUD + FIGURE_PROUD;
  const normal: Vec3 = [Math.cos(phi), 0, Math.sin(phi)];
  out.push({
    part: part.id,
    key: `${part.id}:${floor}:${side}`,
    matrix: figureAt(
      part,
      [r * normal[0], floor * TOWER_FLOOR_HEIGHT + TOWER_WINDOW_Y, r * normal[2]],
      normal,
      [0, 1, 0],
    ),
  });
}

/** Every figure to show now, in agent order. Reads the committed base only. */
export function silhouetteSlots(crew: CrewState, base: ResolvedBase): Slot[] {
  const out: Slot[] = [];
  for (const a of crew.agents) {
    const step = a.route[a.step];
    // On a tube or dock there is no pane; otherwise the node is the step's, or where it stands about.
    if (step && step.k === 'edge') continue;
    const id = step ? step.node : a.at;
    const part = base.parts.get(id);
    const node = base.graph.nodes.get(id);
    if (!part || !node) continue;

    if (part.letter === 'H') {
      let along: number | null = null;
      if (step) {
        // Walking inside: where along the axis? Use the step's current point projected onto it.
        const from = step.from === '@centre' ? node.centre : node.ports.get(step.from);
        const to = step.to === '@centre' ? node.centre : node.ports.get(step.to);
        if (from && to) {
          const len = Math.hypot(to[0] - from[0], to[2] - from[2]);
          const t = len > 1e-9 ? Math.min(1, a.s / len) : 0;
          const at: Vec3 = [
            from[0] + (to[0] - from[0]) * t,
            from[1] + (to[1] - from[1]) * t,
            from[2] + (to[2] - from[2]) * t,
          ];
          along = worldToLocal(part.pose, at)[0];
        }
      }
      habFigures(part, a.index, along, out);
    } else if (part.letter === 'V') {
      towerFigure(part, a.index, out);
    }
  }
  return out;
}

/** One string that changes exactly when a figure appears, leaves or changes pane. */
export function slotsKey(slots: readonly Slot[]): string {
  return slots.map((s) => s.key).join('|');
}
