/**
 * Stage — flatten. Levels the terrain under every placed slab before anything is grounded, so legs,
 * docks and tubes all see the ground the player will see (world/flatten.ts has the field itself).
 *
 * Only slabs (hosts) level the ground; parts on legs keep the natural terrain and stand on it with
 * a worn ring instead. Slabs never overlap each other (overlap.ts), so their footprints are
 * disjoint. The part being dragged or previewed is skipped: it floats on the natural terrain and
 * the ground settles under it when it is committed.
 */
import { buildFlatField, type FlatField, type FlatShape } from '@/world/flatten';
import type { PartId } from '@/world/document';
import { isHost } from './ground';
import type { Draft, SolverWorld } from './types';

export function flattenStage(
  drafts: readonly Draft[],
  world: SolverWorld,
  movingId?: PartId,
): { world: SolverWorld; field: FlatField | null } {
  const shapes: { id: string; shape: FlatShape }[] = [];
  for (const d of drafts) {
    if (d.instance.id === movingId || !isHost(d) || d.footprint.kind !== 'rect') continue;
    const { footprint: fp, pose } = d;
    shapes.push({
      id: d.instance.id,
      shape: { kind: 'rect', x: pose.x, z: pose.z, yaw: pose.yaw, hx: fp.hx, hz: fp.hz },
    });
  }
  if (shapes.length === 0) return { world, field: null };

  const field = buildFlatField(world.heightAt, shapes, { half: world.halfSize, cell: 1 });
  return { world: { halfSize: world.halfSize, heightAt: field.heightAt }, field };
}
