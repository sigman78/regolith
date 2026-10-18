/**
 * Letter C: the launcher, an electromagnetic mass driver on a sled.
 *
 * Frame: barrel along local +X, sled underside at y = 0, centred in X and Z.
 * Ports:
 *   foot-0..3  STRUCT under the sled, LAUNCHER_FOOT_INSET in from each end
 *   power      POWER on the rear face of the sled, normal -X (inert until the power layer, M3)
 *
 * Params: length 8–20 m in steps of 4; barrel elevation 10 / 20 / 30°.
 *
 * Invariants: the POWER port lies on the sled's rear face; feet lie on the
 * underside inside the footprint; the barrel stays inside the footprint in plan.
 */
import {
  LAUNCHER_ELEVATIONS,
  LAUNCHER_FOOTPRINT_MARGIN,
  LAUNCHER_FOOT_HALF_Z,
  LAUNCHER_FOOT_INSET,
  LAUNCHER_LENGTH,
  LAUNCHER_SLED_HEIGHT,
  LAUNCHER_SLED_WIDTH,
  LEG_MIN_CLEARANCE,
} from '@/geometry/design-constants';
import { readChoice, readRange } from '../params';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type LauncherParams = { length: number; elevation: number };

const SCHEMA = {
  length: {
    kind: 'range',
    min: LAUNCHER_LENGTH.min,
    max: LAUNCHER_LENGTH.max,
    step: LAUNCHER_LENGTH.step,
    default: LAUNCHER_LENGTH.default,
  },
  elevation: { kind: 'choice', options: LAUNCHER_ELEVATIONS, default: 20 },
} as const satisfies ParamSchema;

export const C: PartDefinition<LauncherParams> = {
  letter: 'C',
  name: 'Launcher',
  schema: SCHEMA,

  resolve(raw) {
    return {
      length: readRange(SCHEMA.length, raw.length),
      elevation: readChoice(SCHEMA.elevation, raw.elevation),
    };
  },

  footprint(p) {
    return {
      kind: 'rect',
      hx: p.length / 2 + LAUNCHER_FOOTPRINT_MARGIN,
      hz: LAUNCHER_SLED_WIDTH / 2 + LAUNCHER_FOOTPRINT_MARGIN,
    };
  },

  ports(p) {
    const fx = p.length / 2 - LAUNCHER_FOOT_INSET;
    const ports: PortSpec[] = [];
    for (const x of [-fx, fx]) {
      for (const z of [-LAUNCHER_FOOT_HALF_Z, LAUNCHER_FOOT_HALF_Z]) {
        ports.push({
          id: `foot-${ports.length}`,
          type: 'STRUCT',
          position: [x, 0, z],
          normal: [0, -1, 0],
        });
      }
    }
    ports.push({
      id: 'power',
      type: 'POWER',
      position: [-p.length / 2, LAUNCHER_SLED_HEIGHT / 2, 0],
      normal: [-1, 0, 0],
    });
    return ports;
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE };
  },

  geometry(p) {
    return { ops: [{ kind: 'launcher', length: p.length, elevation: p.elevation }] };
  },

  summary(p) {
    return `${p.length} m at ${p.elevation}°`;
  },
};
