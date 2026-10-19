/**
 * Letter D: the dome (opaque kind; greenhouse and observatory come with M5).
 *
 * Frame: axis along local +Y, flat base at y = 0, centred in X and Z. The collar stands on a
 * FLOOR_ABOVE_BELLY plinth, so the floor is at the plinth's top.
 * Ports:
 *   c-0..3     PRESS on the collar drum, normals +X, +Z, -X, -Z, on the floor (FLOOR_ABOVE_BELLY)
 *   foot-0..3  STRUCT on the flat underside, DOME_FOOT_RADIAL of the radius out
 *
 * Invariants: radius is one of DOME_RADII; every PRESS port lies on the collar
 * cylinder below the shell; feet lie on the underside inside the footprint.
 */
import {
  FLOOR_ABOVE_BELLY,
  DOME_COLLAR_HEIGHT,
  DOME_FOOTPRINT_MARGIN,
  DOME_FOOT_RADIAL,
  DOME_RADII,
  FLANGE_RATIO,
  LEG_MIN_CLEARANCE,
} from '@/geometry/design-constants';
import type { Vec3 } from '@/core/math';
import { beaconOn } from '../lamps';
import { drumStub } from '../stub-depth';
import { readChoice } from '../params';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type DomeParams = { radius: number };

const SCHEMA = {
  radius: { kind: 'choice', options: DOME_RADII, default: DOME_RADII[0], unit: ' m' },
} as const satisfies ParamSchema;

const DIRS: readonly Vec3[] = [
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, 0, -1],
];

export const D: PartDefinition<DomeParams> = {
  letter: 'D',
  name: 'Dome',
  schema: SCHEMA,

  resolve(raw) {
    return { radius: readChoice(SCHEMA.radius, raw.radius) };
  },

  footprint(p) {
    // The collar rib flanges out FLANGE_RATIO of the radius; the footprint covers it.
    return { kind: 'disc', r: p.radius * (1 + FLANGE_RATIO) + DOME_FOOTPRINT_MARGIN };
  },

  floor() {
    return FLOOR_ABOVE_BELLY;
  },

  stubDepth(p) {
    return drumStub(p.radius, FLOOR_ABOVE_BELLY, FLOOR_ABOVE_BELLY + DOME_COLLAR_HEIGHT);
  },

  ports(p) {
    const ports: PortSpec[] = DIRS.map((d, i): PortSpec => ({
      id: `c-${i}`,
      type: 'PRESS',
      position: [d[0] * p.radius, FLOOR_ABOVE_BELLY, d[2] * p.radius],
      normal: d,
    }));
    const radial = p.radius * DOME_FOOT_RADIAL;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      ports.push({
        id: `foot-${i}`,
        type: 'STRUCT',
        position: [Math.cos(a) * radial, 0, Math.sin(a) * radial],
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
        id: 'radius',
        param: 'radius',
        at: [p.radius * d, 0, p.radius * d],
        axis: [d, 0, d],
        perUnit: 1,
        anchor: [0, 0, 0],
      },
    ];
  },

  geometry(p) {
    return { ops: [{ kind: 'dome', radius: p.radius }] };
  },

  summary(p) {
    return `${p.radius} m`;
  },

  beacon(p) {
    return beaconOn(FLOOR_ABOVE_BELLY + DOME_COLLAR_HEIGHT + p.radius);
  },
};
