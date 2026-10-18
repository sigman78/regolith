/**
 * Letter A: the airlock, a short lock with a door and a ramp on its +z flank.
 *
 * Frame: axis along local +X, centred, like a hab (same radii, so its PRESS port meets a hab's at
 * the same height). The door and ramp face +z.
 * Ports:
 *   end-     PRESS at the -x cap apex, normal -x (docks to a hab flank or a node)
 *   exit     EXT at the ramp foot, normal +z (inert until the exit task; crew leave here)
 *   foot-/+  STRUCT under the hull
 *
 * Params: size (radius 2 / 3). Invariants: radius is one of AIRLOCK_RADII; every port lies inside
 * the footprint, which covers the ramp.
 */
import {
  FLOOR_ABOVE_BELLY,
  AIRLOCK_END_MARGIN,
  AIRLOCK_FOOTPRINT_MARGIN,
  AIRLOCK_LENGTH,
  AIRLOCK_RADII,
  AIRLOCK_RAMP_RUN,
  HAB_CAP_RATIO,
  LEG_MIN_CLEARANCE,
} from '@/geometry/design-constants';
import { readChoice } from '../params';
import { capGap } from '../shell-gap';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type AirlockParams = { radius: number };

const SCHEMA = {
  radius: {
    kind: 'choice',
    options: AIRLOCK_RADII,
    default: AIRLOCK_RADII[0],
    label: 'Size',
    labels: ['Small', 'Large'],
  },
} as const satisfies ParamSchema;

const halfExtent = (p: AirlockParams): number => AIRLOCK_LENGTH / 2 + p.radius * HAB_CAP_RATIO;

/** Local y of the walking floor: FLOOR_ABOVE_BELLY over the belly, which is one radius under the axis. */
function airlockFloor(p: AirlockParams): number {
  return FLOOR_ABOVE_BELLY - p.radius;
}

export const A: PartDefinition<AirlockParams> = {
  letter: 'A',
  name: 'Airlock',
  schema: SCHEMA,

  resolve(raw) {
    return { radius: readChoice(SCHEMA.radius, raw.radius) };
  },

  footprint(p) {
    return {
      kind: 'rect',
      hx: halfExtent(p) + AIRLOCK_END_MARGIN,
      hz: p.radius + AIRLOCK_RAMP_RUN + AIRLOCK_FOOTPRINT_MARGIN,
    };
  },

  floor: airlockFloor,

  shellGap(p) {
    return capGap(p.radius, p.radius * HAB_CAP_RATIO, airlockFloor(p));
  },

  ports(p) {
    const ext = halfExtent(p);
    const foot = AIRLOCK_LENGTH / 2 - 0.4;
    const ports: PortSpec[] = [
      { id: 'end-', type: 'PRESS', position: [-ext, airlockFloor(p), 0], normal: [-1, 0, 0] },
      {
        id: 'exit',
        type: 'EXT',
        position: [0, -p.radius - LEG_MIN_CLEARANCE, p.radius + AIRLOCK_RAMP_RUN],
        normal: [0, 0, 1],
      },
      { id: 'foot-', type: 'STRUCT', position: [-foot, -p.radius, 0], normal: [0, -1, 0] },
      { id: 'foot+', type: 'STRUCT', position: [foot, -p.radius, 0], normal: [0, -1, 0] },
    ];
    return ports;
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE };
  },

  handles(p) {
    return [
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

  geometry(p) {
    return { ops: [{ kind: 'airlock', radius: p.radius, length: AIRLOCK_LENGTH }] };
  },

  summary(p) {
    return p.radius === AIRLOCK_RADII[0] ? 'small' : 'large';
  },
};
