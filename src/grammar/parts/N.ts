/**
 * Letter N: the node, a sphere junction.
 *
 * Frame: origin at the sphere centre, +Y up.
 * Ports:
 *   x+, x-, z+, z-, top   PRESS on the shell, normals along the axes
 *   foot-0..2             STRUCT tripod feet under the sphere (120° apart,
 *                         NODE_FOOT_RADIAL of the radius out), on the shell
 *
 * Invariants: every port lies exactly on the sphere surface; radius is one of
 * NODE_RADII; ids are stable for a given radius.
 */
import {
  FLOOR_ABOVE_BELLY,
  LEG_MIN_CLEARANCE,
  NODE_FOOTPRINT_MARGIN,
  NODE_FOOT_RADIAL,
  NODE_PRESS_DIRS,
  NODE_RADII,
} from '@/geometry/design-constants';
import { beaconOn } from '../lamps';
import { readChoice } from '../params';
import { roundGap } from '../shell-gap';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type NodeParams = { size: number };

const SCHEMA = {
  size: {
    kind: 'choice',
    options: NODE_RADII,
    default: NODE_RADII[0],
    label: 'Radius',
    unit: ' m',
  },
} as const satisfies ParamSchema;

const PRESS_IDS = ['x+', 'x-', 'z+', 'z-', 'top'] as const;

/** The feet sit sqrt(1 - NODE_FOOT_RADIAL^2) of the radius under the centre; the floor is above them. */
function nodeFloor(p: NodeParams): number {
  return FLOOR_ABOVE_BELLY - Math.sqrt(1 - NODE_FOOT_RADIAL ** 2) * p.size;
}

export const N: PartDefinition<NodeParams> = {
  letter: 'N',
  name: 'Node',
  schema: SCHEMA,

  resolve(raw) {
    return { size: readChoice(SCHEMA.size, raw.size) };
  },

  footprint(p) {
    return { kind: 'disc', r: p.size + NODE_FOOTPRINT_MARGIN };
  },

  floor: nodeFloor,

  shellGap(p, portId) {
    return portId === 'top' ? 0 : roundGap(p.size, nodeFloor(p));
  },

  ports(p) {
    const r = p.size;
    const floor = nodeFloor(p);
    // The side ports are doors on the floor; the top hatch stays a vertical hatch on the sphere.
    const ports: PortSpec[] = NODE_PRESS_DIRS.map((d, i) => ({
      id: PRESS_IDS[i] ?? `press-${i}`,
      type: 'PRESS',
      position: [d[0] * r, d[1] === 0 ? floor : d[1] * r, d[2] * r],
      normal: d,
    }));
    const radial = r * NODE_FOOT_RADIAL;
    const drop = -Math.sqrt(r * r - radial * radial);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      const x = Math.cos(a) * radial;
      const z = Math.sin(a) * radial;
      ports.push({
        id: `foot-${i}`,
        type: 'STRUCT',
        position: [x, drop, z],
        normal: [0, -1, 0],
      });
    }
    return ports;
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE };
  },

  handles(p) {
    const d = Math.SQRT1_2;
    return [
      {
        id: 'size',
        param: 'size',
        at: [p.size * d, 0, p.size * d],
        axis: [d, 0, d],
        perUnit: 1,
        anchor: [0, 0, 0],
      },
    ];
  },

  geometry(p) {
    return { ops: [{ kind: 'node', radius: p.size }] };
  },

  beacon(p) {
    return beaconOn(p.size);
  },
};
