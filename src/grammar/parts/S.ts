/**
 * Letter S: the solar array, rows of tilted panels on posts.
 *
 * Frame: centred on the origin, posts' feet at y = 0, panels leaning toward +z.
 * Ports:
 *   power    POWER at the -x end, normal -x (inert until the power layer)
 *   post-N   STRUCT at the foot of each post (legs reach the ground from here)
 *
 * Params: rows 1-4, cols 2-12 (even), tracking on/off (the sim turns the panels; the resting
 * shape is the same). Invariants: every port lies inside the footprint.
 */
import {
  LEG_MIN_CLEARANCE,
  SOLAR_COLS,
  SOLAR_FOOTPRINT_MARGIN,
  SOLAR_ROWS,
} from '@/geometry/design-constants';
import { solarDepth, solarPostXs, solarWidth } from '../solar-layout';
import { readChoice, readToggle } from '../params';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type SolarParams = { rows: number; cols: number; tracking: boolean };

const SCHEMA = {
  rows: { kind: 'choice', options: SOLAR_ROWS, default: 2, label: 'Rows' },
  cols: { kind: 'choice', options: SOLAR_COLS, default: 6, label: 'Columns' },
  tracking: { kind: 'toggle', default: true, label: 'Tracking' },
} as const satisfies ParamSchema;

export const S: PartDefinition<SolarParams> = {
  letter: 'S',
  name: 'Solar array',
  schema: SCHEMA,

  resolve(raw) {
    return {
      rows: readChoice(SCHEMA.rows, raw.rows),
      cols: readChoice(SCHEMA.cols, raw.cols),
      tracking: readToggle(SCHEMA.tracking, raw.tracking),
    };
  },

  footprint(p) {
    return {
      kind: 'rect',
      hx: solarWidth(p.cols) / 2 + 0.3 + SOLAR_FOOTPRINT_MARGIN,
      hz: solarDepth(p.rows) / 2 + SOLAR_FOOTPRINT_MARGIN,
    };
  },

  ports(p) {
    const ports: PortSpec[] = [
      {
        id: 'power',
        type: 'POWER',
        position: [-solarWidth(p.cols) / 2 - 0.3, 0.3, 0],
        normal: [-1, 0, 0],
      },
    ];
    solarPostXs(p.cols).forEach((x, i) =>
      ports.push({ id: `post-${i}`, type: 'STRUCT', position: [x, 0, 0], normal: [0, -1, 0] }),
    );
    return ports;
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE };
  },

  handles(p) {
    const half = solarWidth(p.cols) / 2;
    const unit = (solarWidth(p.cols) + 0.08) / p.cols;
    return [
      {
        id: 'cols',
        param: 'cols',
        at: [half, 0.4, 0],
        axis: [1, 0, 0],
        perUnit: unit,
        anchor: [-half, 0, 0],
      },
    ];
  },

  geometry(p) {
    return { ops: [{ kind: 'solar', rows: p.rows, cols: p.cols, tracking: p.tracking }] };
  },

  summary(p) {
    return `${p.rows} x ${p.cols}${p.tracking ? ' tracking' : ''}`;
  },
};
