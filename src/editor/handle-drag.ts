/**
 * What a handle drag does to the document, without any DOM or camera: the part's params at the
 * start of the drag, how far the grip was pulled, and the document to resolve against. The grip
 * stops where the solver would have to move the part to resolve it (it has met something), instead
 * of shoving the part sideways.
 */
import { localDirToWorld, snap, snapYaw } from '@/core/math';
import { GRID } from '@/geometry/design-constants';
import { applyHandleDelta, type HandleSpec } from '@/grammar/handles';
import { getPart } from '@/grammar/registry';
import { solve, type SolverWorld } from '@/grammar/solver';
import type { ParamValues } from '@/grammar/types';
import { keepMirror, type BaseDocument, type PartId, type PartPose } from '@/world/document';
import { cmd } from './commands';

export interface HandleStart {
  /** the part's params when the drag began */
  params: ParamValues;
  /** the part's pose in the document when the drag began */
  pose: PartPose;
}

export interface HandleResize {
  params: ParamValues;
  pose: PartPose;
}

/** The part after pulling `spec` by `delta` metres along its axis, or null if that is blocked. */
export function resizeByHandle(
  doc: BaseDocument,
  world: SolverWorld,
  id: PartId,
  spec: HandleSpec,
  start: HandleStart,
  delta: number,
): HandleResize | null {
  const part = doc.parts[id];
  const def = part ? getPart(part.letter) : undefined;
  if (!part || !def) return null;

  const edit = applyHandleDelta(def, start.params, spec, delta);
  // The opposite end stays where it was: the part's own position moves by the anchor's shift.
  const move = localDirToWorld(
    { x: 0, y: 0, z: 0, yaw: start.pose.yaw, mirror: !!start.pose.mirror },
    edit.shift,
  );
  const x = start.pose.x + move[0];
  const z = start.pose.z + move[2];
  const pose = keepMirror(start.pose, { x, z, yaw: snapYaw(start.pose.yaw) });

  const trial = cmd.edit(id, { params: edit.params, pose }).apply(doc);
  const resolved = solve(trial, world, { movingId: id }).parts.get(id);
  if (!resolved) return null;
  if (
    Math.abs(resolved.pose.x - snap(x, GRID)) > 1e-6 ||
    Math.abs(resolved.pose.z - snap(z, GRID)) > 1e-6
  ) {
    return null;
  }
  return { params: edit.params, pose };
}
