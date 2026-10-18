/**
 * Stage 5 — ground. Nothing floats, ever.
 *
 * For a `legs` part: the pose elevation puts the lowest STRUCT port
 * `minClearance` above the highest terrain under the footprint (cell centres
 * and the ports themselves), then every STRUCT port gets a leg from the hull
 * down to the terrain height at that spot, sunk FOOT_SINK into the ground.
 * A document `pose.y` overrides the elevation (e.g. hosted on a pad); legs are
 * still generated down to the terrain.
 *
 * Invariants: leg.bottom.y == terrain(x,z) - FOOT_SINK exactly; leg.top is the
 * port's world position; top is above bottom by at least minClearance + sink;
 * the hull belly never dips below the sampled terrain.
 */
import { FOOT_SINK } from '@/geometry/design-constants';
import { localToWorld } from '@/core/math';
import { cellCenter } from '../footprint';
import type { Draft, Leg, ResolvedPort, SolverWorld } from './types';

export interface Grounded {
  draft: Draft;
  ports: ResolvedPort[];
  legs: Leg[];
}

export function ground(drafts: Draft[], world: SolverWorld): Grounded[] {
  return drafts.map((draft) => groundOne(draft, world));
}

function groundOne(draft: Draft, world: SolverWorld): Grounded {
  const { def, params, pose } = draft;
  const localPorts = def.ports(params);
  const spec = def.ground(params);

  if (spec.mode === 'legs') {
    const structs = localPorts.filter((p) => p.type === 'STRUCT');
    const lowest = structs.reduce((m, p) => Math.min(m, p.position[1]), 0);

    let highest = -Infinity;
    for (const key of draft.cells) {
      const [cx, cz] = cellCenter(key);
      highest = Math.max(highest, world.heightAt(cx, cz));
    }
    for (const p of structs) {
      const w = localToWorld({ ...pose, y: 0 }, p.position);
      highest = Math.max(highest, world.heightAt(w[0], w[2]));
    }
    if (!Number.isFinite(highest)) highest = world.heightAt(pose.x, pose.z);

    const instanceY = draft.instance.pose.y;
    pose.y = instanceY !== undefined ? instanceY : highest + spec.minClearance - lowest;
  } else {
    pose.y = draft.instance.pose.y ?? world.heightAt(pose.x, pose.z);
  }

  const ports: ResolvedPort[] = localPorts.map((p) => ({
    id: p.id,
    type: p.type,
    position: localToWorld(pose, p.position),
    normal: localToWorld({ x: 0, y: 0, z: 0, yaw: pose.yaw }, p.normal),
  }));

  const legs: Leg[] = [];
  if (spec.mode === 'legs') {
    for (const p of ports) {
      if (p.type !== 'STRUCT') continue;
      const x = p.position[0];
      const z = p.position[2];
      legs.push({
        portId: p.id,
        top: p.position,
        bottom: [x, world.heightAt(x, z) - FOOT_SINK, z],
      });
    }
  }
  return { draft, ports, legs };
}
