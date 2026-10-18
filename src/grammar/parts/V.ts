/**
 * Letter V: the vertical habitat (tower).
 *
 * Frame: axis along local +Y, base (flat underside) at y = 0, centred in X and Z.
 * Ports:
 *   g-0..3     PRESS on the ground floor, normals +X, +Z, -X, -Z
 *   f<k>-0/1   PRESS on each upper floor k (1-based), opposite each other,
 *              along X on odd floors and Z on even ones, so stacked hatches never line up
 *   foot-0..3  STRUCT on the flat underside, TOWER_FOOT_RADIAL of the radius out
 *
 * Invariants: floors is an integer within [2, 5]; every PRESS port lies on the
 * hull cylinder at its floor's port height; feet lie on the underside inside
 * the footprint; ids are unique and stable for a given floor count.
 */
import {
  LEG_MIN_CLEARANCE,
  TOWER_FLOORS,
  TOWER_FLOOR_HEIGHT,
  TOWER_FOOTPRINT_MARGIN,
  TOWER_FOOT_RADIAL,
  TOWER_PORT_Y,
  TOWER_RADIUS,
} from '@/geometry/design-constants';
import type { Vec3 } from '@/core/math';
import { readRange } from '../params';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type TowerParams = { floors: number };

const SCHEMA = {
  floors: {
    kind: 'range',
    min: TOWER_FLOORS.min,
    max: TOWER_FLOORS.max,
    step: TOWER_FLOORS.step,
    default: TOWER_FLOORS.default,
    label: 'Floors',
  },
} as const satisfies ParamSchema;

const GROUND_DIRS: readonly Vec3[] = [
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, 0, -1],
];

function pressPort(id: string, dir: Vec3, y: number): PortSpec {
  return {
    id,
    type: 'PRESS',
    position: [dir[0] * TOWER_RADIUS, y, dir[2] * TOWER_RADIUS],
    normal: dir,
  };
}

export const V: PartDefinition<TowerParams> = {
  letter: 'V',
  name: 'Tower',
  schema: SCHEMA,

  resolve(raw) {
    return { floors: readRange(SCHEMA.floors, raw.floors) };
  },

  footprint() {
    return { kind: 'disc', r: TOWER_RADIUS + TOWER_FOOTPRINT_MARGIN };
  },

  ports(p) {
    const ports: PortSpec[] = GROUND_DIRS.map((d, i) => pressPort(`g-${i}`, d, TOWER_PORT_Y));
    for (let k = 1; k < p.floors; k++) {
      const y = k * TOWER_FLOOR_HEIGHT + TOWER_PORT_Y;
      const a: Vec3 = k % 2 === 1 ? [1, 0, 0] : [0, 0, 1];
      const b: Vec3 = [-a[0], 0, -a[2]];
      ports.push(pressPort(`f${k}-0`, a, y), pressPort(`f${k}-1`, b, y));
    }
    const radial = TOWER_RADIUS * TOWER_FOOT_RADIAL;
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      ports.push({
        id: `foot-${i}`,
        type: 'STRUCT',
        position: [Math.cos(angle) * radial, 0, Math.sin(angle) * radial],
        normal: [0, -1, 0],
      });
    }
    return ports;
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE };
  },

  handles(p) {
    return [
      {
        id: 'floors',
        param: 'floors',
        at: [0, p.floors * TOWER_FLOOR_HEIGHT, 0],
        axis: [0, 1, 0],
        perUnit: TOWER_FLOOR_HEIGHT,
        anchor: [0, 0, 0],
      },
    ];
  },

  geometry(p) {
    return { ops: [{ kind: 'tower', floors: p.floors, radius: TOWER_RADIUS }] };
  },

  summary(p) {
    return `${p.floors} floors`;
  },
};
