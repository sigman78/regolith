/**
 * Stage 1 — place. Resolves params, snaps the pose to the grid and the eight
 * yaw stops, clamps it into the world, and computes the footprint cells.
 *
 * Invariant: every known part comes out with a finite, grid-snapped,
 * in-bounds pose. Unknown letters are dropped with a diagnostic (P1: never throw).
 */
import { GRID } from '@/geometry/design-constants';
import { clamp, snap, snapYaw } from '@/core/math';
import type { BaseDocument } from '@/world/document';
import { footprintCells } from '../footprint';
import { getPart } from '../registry';
import type { Diagnostic, Draft, SolverWorld } from './types';

export function place(doc: BaseDocument, world: SolverWorld, diagnostics: Diagnostic[]): Draft[] {
  const drafts: Draft[] = [];
  for (const instance of Object.values(doc.parts)) {
    const def = getPart(instance.letter);
    if (!def) {
      diagnostics.push({ kind: 'unknown-letter', part: instance.id, letter: instance.letter });
      continue;
    }
    const params = def.resolve(instance.params);
    const footprint = def.footprint(params);
    const reach = footprint.kind === 'rect' ? Math.hypot(footprint.hx, footprint.hz) : footprint.r;
    const limit = Math.max(0, world.halfSize - reach);

    const finite = (v: number) => (Number.isFinite(v) ? v : 0);
    const pose = {
      x: clamp(snap(finite(instance.pose.x), GRID), -limit, limit),
      z: clamp(snap(finite(instance.pose.z), GRID), -limit, limit),
      y: 0,
      yaw: snapYaw(finite(instance.pose.yaw)),
    };
    drafts.push({
      instance,
      def,
      params,
      footprint,
      requested: { x: instance.pose.x, z: instance.pose.z, yaw: instance.pose.yaw },
      pose,
      cells: footprintCells(footprint, pose),
    });
  }
  // Stable order: oldest serial first, so existing parts keep their spots.
  drafts.sort((a, b) => a.instance.serial - b.instance.serial);
  return drafts;
}
