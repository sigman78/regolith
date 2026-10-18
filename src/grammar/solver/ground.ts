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
import { localToWorld, rotateY } from '@/core/math';
import { cellCenter } from '../footprint';
import type { Draft, Leg, ResolvedPort, SolverWorld } from './types';

export interface Grounded {
  draft: Draft;
  ports: ResolvedPort[];
  legs: Leg[];
}

/** A part other parts can stand on (a slab). */
export function isHost(draft: Draft): boolean {
  const spec = draft.def.ground(draft.params);
  return spec.mode === 'legs' && spec.hostTop !== undefined;
}

interface HostTop {
  x: number;
  z: number;
  yaw: number;
  hx: number;
  hz: number;
  top: number;
}

/**
 * Hosts are grounded on bare terrain first; everything else then stands on the
 * `surface`: the terrain, or a host's top wherever one is underfoot. The surface
 * is also what dock and tubes see, so tubes and their legs clear a slab.
 */
export function ground(
  drafts: Draft[],
  world: SolverWorld,
): { grounded: Grounded[]; surface: SolverWorld } {
  const hosted = new Map<Draft, Grounded>();
  const tops: HostTop[] = [];
  for (const draft of drafts) {
    if (!isHost(draft) || draft.footprint.kind !== 'rect') continue;
    const g = groundOne(draft, world);
    hosted.set(draft, g);
    const spec = draft.def.ground(draft.params);
    tops.push({
      x: draft.pose.x,
      z: draft.pose.z,
      yaw: draft.pose.yaw,
      hx: draft.footprint.hx,
      hz: draft.footprint.hz,
      top: draft.pose.y + (spec.mode === 'legs' ? (spec.hostTop ?? 0) : 0),
    });
  }
  const surface: SolverWorld =
    tops.length === 0
      ? world
      : {
          halfSize: world.halfSize,
          heightAt(x, z) {
            let h = world.heightAt(x, z);
            for (const t of tops) {
              const [lx, , lz] = rotateY([x - t.x, 0, z - t.z], -t.yaw);
              if (Math.abs(lx) <= t.hx && Math.abs(lz) <= t.hz) h = Math.max(h, t.top);
            }
            return h;
          },
        };
  return {
    grounded: drafts.map((draft) => hosted.get(draft) ?? groundOne(draft, surface)),
    surface,
  };
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
