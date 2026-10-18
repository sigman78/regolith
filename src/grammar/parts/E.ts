/**
 * Letter E: the power plant (compact reactor).
 *
 * Frame: axis along local +Y, flat base at y = 0, centred in X and Z.
 * Ports:
 *   power-0..2  POWER on the drum, 120° apart at REACTOR_PORT_Y (inert until the power layer, M3)
 *   foot-0..3   STRUCT on the flat underside, REACTOR_FOOT_RADIAL of the radius out
 *
 * Invariants: radius is one of REACTOR_RADII; POWER ports lie on the drum
 * cylinder; the footprint covers the radiator fins.
 */
import {
  LEG_MIN_CLEARANCE,
  REACTOR_FIN_REACH,
  REACTOR_FOOTPRINT_MARGIN,
  REACTOR_FOOT_RADIAL,
  REACTOR_PORT_COUNT,
  REACTOR_PORT_Y,
  REACTOR_RADII,
} from '@/geometry/design-constants';
import { readChoice } from '../params';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type ReactorParams = { radius: number };

const SCHEMA = {
  radius: {
    kind: 'choice',
    options: REACTOR_RADII,
    default: REACTOR_RADII[0],
    label: 'Size',
    labels: ['Small', 'Large'],
  },
} as const satisfies ParamSchema;

export const E: PartDefinition<ReactorParams> = {
  letter: 'E',
  name: 'Power plant',
  schema: SCHEMA,

  resolve(raw) {
    return { radius: readChoice(SCHEMA.radius, raw.radius) };
  },

  footprint(p) {
    return { kind: 'disc', r: p.radius * (1 + REACTOR_FIN_REACH) + REACTOR_FOOTPRINT_MARGIN };
  },

  ports(p) {
    const ports: PortSpec[] = Array.from({ length: REACTOR_PORT_COUNT }, (_, i): PortSpec => {
      const a = (i * Math.PI * 2) / REACTOR_PORT_COUNT;
      return {
        id: `power-${i}`,
        type: 'POWER',
        position: [Math.cos(a) * p.radius, REACTOR_PORT_Y, Math.sin(a) * p.radius],
        normal: [Math.cos(a), 0, Math.sin(a)],
      };
    });
    const radial = p.radius * REACTOR_FOOT_RADIAL;
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
    const c = Math.cos(Math.PI / REACTOR_PORT_COUNT);
    const s = Math.sin(Math.PI / REACTOR_PORT_COUNT);
    // Between two POWER ports, so the grip never sits over a hatch.
    return [
      {
        id: 'radius',
        param: 'radius',
        at: [p.radius * c, 0, p.radius * s],
        axis: [c, 0, s],
        perUnit: 1,
        anchor: [0, 0, 0],
      },
    ];
  },

  geometry(p) {
    return { ops: [{ kind: 'reactor', radius: p.radius }] };
  },

  summary(p) {
    return p.radius === REACTOR_RADII[0] ? 'small' : 'large';
  },
};
