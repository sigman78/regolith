/**
 * Letter X: the light pole.
 *
 * Frame: axis along local +Y, base underside at y = 0, the lamp arm reaching along +x.
 * Ports:
 *   power  POWER on the base rim, normal +x (inert until the power layer)
 *
 * Params: height 3 / 4 / 6 m. Stands on its small base plate by one short foot.
 */
import {
  POLE_BASE_RADIUS,
  POLE_BASE_THICK,
  POLE_CLEARANCE,
  POLE_FOOTPRINT_MARGIN,
  POLE_HEIGHTS,
} from '@/geometry/design-constants';
import { readChoice } from '../params';
import type { ParamSchema, PartDefinition } from '../types';

export type PoleParams = { height: number };

const SCHEMA = {
  height: { kind: 'choice', options: POLE_HEIGHTS, default: 4, unit: ' m' },
} as const satisfies ParamSchema;

export const X: PartDefinition<PoleParams> = {
  letter: 'X',
  name: 'Light pole',
  schema: SCHEMA,

  resolve(raw) {
    return { height: readChoice(SCHEMA.height, raw.height) };
  },

  footprint() {
    return { kind: 'disc', r: POLE_BASE_RADIUS + POLE_FOOTPRINT_MARGIN };
  },

  ports() {
    return [
      { id: 'foot', type: 'STRUCT', position: [0, 0, 0], normal: [0, -1, 0] },
      {
        id: 'power',
        type: 'POWER',
        position: [POLE_BASE_RADIUS, POLE_BASE_THICK / 2, 0],
        normal: [1, 0, 0],
      },
    ];
  },

  ground() {
    return { mode: 'legs', minClearance: POLE_CLEARANCE };
  },

  handles(p) {
    return [
      {
        id: 'height',
        param: 'height',
        at: [0, p.height, 0],
        axis: [0, 1, 0],
        perUnit: 1,
        anchor: [0, 0, 0],
      },
    ];
  },

  geometry(p) {
    return { ops: [{ kind: 'pole', height: p.height }] };
  },

  summary(p) {
    return `${p.height} m`;
  },
};
