/**
 * Letter H: the horizontal habitat module.
 *
 * Frame: axis along local +X, origin at the hull centre on the axis, +Y up.
 * Ports (all derived from the same design constants the hull geometry uses,
 * so they sit on the generated surface — see geometry/hab.test.ts):
 *   end-, end+   PRESS at the cap apexes, normals along -X / +X
 *   side-N       PRESS on the hull flank, one every 4 m, alternating +Z / -Z,
 *                centred in a rib bay so no hatch lands on a rib
 *   foot-, foot+ STRUCT at the belly, HAB_STRUCT_INSET in from each end
 *
 * Invariants: length is a multiple of the schema step within [4, 16]; radius
 * is one of HAB_RADII; every port lies inside the footprint; port ids are
 * unique and stable for a given param set.
 */
import {
  HAB_CAP_RATIO,
  HAB_FOOTPRINT_MARGIN,
  HAB_LENGTH,
  HAB_RADII,
  HAB_SIDE_PORT_SPACING,
  FLOOR_ABOVE_BELLY,
  HAB_STRUCT_INSET,
  LEG_MIN_CLEARANCE,
  RIB_SPACING,
} from '@/geometry/design-constants';
import { beaconOn } from '../lamps';
import { readChoice, readRange } from '../params';
import { capStub, flankStub } from '../stub-depth';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type HabParams = { length: number; radius: number };

const SCHEMA = {
  length: {
    kind: 'range',
    min: HAB_LENGTH.min,
    max: HAB_LENGTH.max,
    step: HAB_LENGTH.step,
    default: HAB_LENGTH.default,
    unit: ' m',
  },
  radius: { kind: 'choice', options: HAB_RADII, default: HAB_RADII[0], unit: ' m' },
} as const satisfies ParamSchema;

/** Distance from the centre to a cap apex. */
export function habHalfExtent(p: HabParams): number {
  return p.length / 2 + p.radius * HAB_CAP_RATIO;
}

/** Axial positions (local X) of the side PRESS ports. */
export function habSidePortXs(p: HabParams): number[] {
  const bays = Math.max(1, Math.round(p.length / RIB_SPACING));
  const bayStride = Math.max(1, Math.round(HAB_SIDE_PORT_SPACING / RIB_SPACING));
  const n = Math.max(1, Math.floor(bays / bayStride));
  const first = Math.max(0, Math.floor((bays - bayStride * n + bayStride - 1) / 2));
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const bay = Math.min(bays - 1, first + i * bayStride);
    xs.push(-p.length / 2 + RIB_SPACING * (bay + 0.5));
  }
  return xs;
}

/** The side PRESS ports: axial position and flank, alternating +z / -z from the first bay used. */
export function habSidePorts(length: number): { x: number; side: 1 | -1 }[] {
  return habSidePortXs({ length, radius: HAB_RADII[0] }).map((x, i) => ({
    x,
    side: i % 2 === 0 ? 1 : -1,
  }));
}

/** Local y of the walking floor: FLOOR_ABOVE_BELLY over the belly, which is one radius under the axis. */
export function habFloor(p: HabParams): number {
  return FLOOR_ABOVE_BELLY - p.radius;
}

export const H: PartDefinition<HabParams> = {
  letter: 'H',
  name: 'Hab',
  schema: SCHEMA,

  resolve(raw) {
    return {
      length: readRange(SCHEMA.length, raw.length),
      radius: readChoice(SCHEMA.radius, raw.radius),
    };
  },

  footprint(p) {
    return {
      kind: 'rect',
      hx: habHalfExtent(p) + HAB_FOOTPRINT_MARGIN,
      hz: p.radius + HAB_FOOTPRINT_MARGIN,
    };
  },

  floor: habFloor,

  stubDepth(p, portId) {
    const y = habFloor(p);
    return portId.startsWith('end')
      ? capStub(p.radius, p.radius * HAB_CAP_RATIO, y)
      : flankStub(p.radius, y);
  },

  ports(p) {
    const ext = habHalfExtent(p);
    const y = habFloor(p);
    const ports: PortSpec[] = [
      { id: 'end-', type: 'PRESS', position: [-ext, y, 0], normal: [-1, 0, 0] },
      { id: 'end+', type: 'PRESS', position: [ext, y, 0], normal: [1, 0, 0] },
    ];
    habSidePorts(p.length).forEach(({ x, side }, i) => {
      ports.push({
        id: `side-${i}`,
        type: 'PRESS',
        position: [x, y, side * p.radius],
        normal: [0, 0, side],
      });
    });
    const foot = p.length / 2 - HAB_STRUCT_INSET;
    ports.push(
      { id: 'foot-', type: 'STRUCT', position: [-foot, -p.radius, 0], normal: [0, -1, 0] },
      { id: 'foot+', type: 'STRUCT', position: [foot, -p.radius, 0], normal: [0, -1, 0] },
    );
    return ports;
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE };
  },

  handles(p) {
    const ext = habHalfExtent(p);
    return [
      {
        id: 'length+',
        param: 'length',
        at: [ext, 0, 0],
        axis: [1, 0, 0],
        perUnit: 1,
        anchor: [-ext, 0, 0],
      },
      {
        id: 'length-',
        param: 'length',
        at: [-ext, 0, 0],
        axis: [-1, 0, 0],
        perUnit: 1,
        anchor: [ext, 0, 0],
      },
      {
        id: 'radius',
        param: 'radius',
        at: [0, p.radius, 0],
        axis: [0, 1, 0],
        perUnit: 1,
        anchor: [0, 0, 0],
      },
    ];
  },

  geometry(p, ctx) {
    // Variant 0 keeps the plain recipe, so it hashes as it always did.
    const variant = ctx.variant ? { variant: ctx.variant } : {};
    return { ops: [{ kind: 'hab', length: p.length, radius: p.radius, ...variant }] };
  },

  summary(p) {
    return `${p.length} m`;
  },

  beacon(p) {
    // On top of the hull in the middle of a rib gap, so no rib flange hides the ball.
    const half = p.length / 2;
    const step = p.length / Math.max(1, Math.round(p.length / RIB_SPACING));
    const rib = -half + Math.round(half / step) * step;
    return beaconOn(p.radius, Math.abs(rib) < step / 2 ? step / 2 : 0);
  },
};
