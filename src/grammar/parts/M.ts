/**
 * Letter M: the radio mast, a three-legged lattice on a round base plate.
 *
 * Frame: axis along local +Y, base underside at y = 0, centred in X and Z.
 * Ports:
 *   foot-0..2  STRUCT tripod on the underside of the plate
 *   power      POWER on the plate rim, normal +X (inert until the power layer, M3)
 *
 * Params: height 6 / 12 / 20 m; head 0 dish, 1 whip, 2 relay.
 *
 * Invariants: both params come from their schema options; the POWER port lies
 * on the plate rim; feet lie on the underside inside the footprint.
 */
import {
  LEG_MIN_CLEARANCE,
  MAST_BASE_RADIUS,
  MAST_BASE_THICK,
  MAST_FOOTPRINT_MARGIN,
  MAST_FOOT_RADIAL,
  MAST_HEADS,
  MAST_HEAD_DISH,
  MAST_HEAD_WHIP,
  MAST_HEIGHTS,
} from '@/geometry/design-constants';
import { readChoice } from '../params';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type MastParams = { height: number; head: number };

const SCHEMA = {
  height: { kind: 'choice', options: MAST_HEIGHTS, default: 12 },
  head: { kind: 'choice', options: MAST_HEADS, default: MAST_HEAD_DISH },
} as const satisfies ParamSchema;

export const M: PartDefinition<MastParams> = {
  letter: 'M',
  name: 'Mast',
  schema: SCHEMA,

  resolve(raw) {
    return {
      height: readChoice(SCHEMA.height, raw.height),
      head: readChoice(SCHEMA.head, raw.head),
    };
  },

  footprint() {
    return { kind: 'disc', r: MAST_BASE_RADIUS + MAST_FOOTPRINT_MARGIN };
  },

  ports() {
    const radial = MAST_BASE_RADIUS * MAST_FOOT_RADIAL;
    const ports: PortSpec[] = [0, 1, 2].map((i) => {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      return {
        id: `foot-${i}`,
        type: 'STRUCT',
        position: [Math.cos(a) * radial, 0, Math.sin(a) * radial],
        normal: [0, -1, 0],
      };
    });
    ports.push({
      id: 'power',
      type: 'POWER',
      position: [MAST_BASE_RADIUS, MAST_BASE_THICK / 2, 0],
      normal: [1, 0, 0],
    });
    return ports;
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE };
  },

  geometry(p) {
    return { ops: [{ kind: 'mast', height: p.height, head: p.head }] };
  },

  summary(p) {
    const head = p.head === MAST_HEAD_DISH ? 'dish' : p.head === MAST_HEAD_WHIP ? 'whip' : 'relay';
    return `${p.height} m ${head}`;
  },
};
