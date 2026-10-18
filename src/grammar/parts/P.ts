/**
 * Letter P: the slab, a raised deck other parts can stand on.
 *
 * Frame: centred in X and Z, underside at local y = 0, top at SLAB_THICK.
 * Ports:
 *   foot-N   STRUCT pylons on the underside, inset SLAB_FOOT_INSET from the edge,
 *            at the corners and along each edge at most SLAB_FOOT_SPACING apart
 *
 * It is a host (`hostTop`): the solver stands any part whose footprint lands on
 * it on its top surface, and slabs only resolve overlap against other slabs.
 *
 * Invariants: w and d are multiples of the schema step within [2, 12]; every
 * foot lies inside the footprint on the underside; foot ids are unique.
 */
import {
  LEG_MIN_CLEARANCE,
  SLAB_FOOTPRINT_MARGIN,
  SLAB_FOOT_INSET,
  SLAB_FOOT_SPACING,
  SLAB_SIZE,
  SLAB_THICK,
} from '@/geometry/design-constants';
import { readRange } from '../params';
import type { ParamSchema, PartDefinition, PortSpec } from '../types';

export type SlabParams = { w: number; d: number };

const SIZE_SPEC = {
  kind: 'range',
  min: SLAB_SIZE.min,
  max: SLAB_SIZE.max,
  step: SLAB_SIZE.step,
  default: SLAB_SIZE.default,
} as const;

const SCHEMA = {
  w: { ...SIZE_SPEC, label: 'Width', unit: ' m' },
  d: { ...SIZE_SPEC, label: 'Depth', unit: ' m' },
} as const satisfies ParamSchema;

/** `count` points from -half to +half, spaced evenly, at most SLAB_FOOT_SPACING apart. */
function along(half: number): number[] {
  const n = Math.max(2, Math.ceil((2 * half) / SLAB_FOOT_SPACING) + 1);
  return Array.from({ length: n }, (_, i) => -half + (2 * half * i) / (n - 1));
}

export const P: PartDefinition<SlabParams> = {
  letter: 'P',
  name: 'Slab',
  schema: SCHEMA,

  resolve(raw) {
    return { w: readRange(SCHEMA.w, raw.w), d: readRange(SCHEMA.d, raw.d) };
  },

  footprint(p) {
    return {
      kind: 'rect',
      hx: p.w / 2 + SLAB_FOOTPRINT_MARGIN,
      hz: p.d / 2 + SLAB_FOOTPRINT_MARGIN,
    };
  },

  ports(p) {
    const fx = p.w / 2 - SLAB_FOOT_INSET;
    const fz = p.d / 2 - SLAB_FOOT_INSET;
    const spots: [number, number][] = [];
    for (const x of along(fx)) spots.push([x, -fz], [x, fz]);
    const zs = along(fz);
    for (const z of zs.slice(1, -1)) spots.push([-fx, z], [fx, z]);
    return spots.map(([x, z], i): PortSpec => ({
      id: `foot-${i}`,
      type: 'STRUCT',
      position: [x, 0, z],
      normal: [0, -1, 0],
    }));
  },

  ground() {
    return { mode: 'legs', minClearance: LEG_MIN_CLEARANCE, hostTop: SLAB_THICK };
  },

  handles(p) {
    const hw = p.w / 2;
    const hd = p.d / 2;
    const y = SLAB_THICK / 2;
    return [
      { id: 'w+', param: 'w', at: [hw, y, 0], axis: [1, 0, 0], perUnit: 1, anchor: [-hw, y, 0] },
      { id: 'w-', param: 'w', at: [-hw, y, 0], axis: [-1, 0, 0], perUnit: 1, anchor: [hw, y, 0] },
      { id: 'd+', param: 'd', at: [0, y, hd], axis: [0, 0, 1], perUnit: 1, anchor: [0, y, -hd] },
      { id: 'd-', param: 'd', at: [0, y, -hd], axis: [0, 0, -1], perUnit: 1, anchor: [0, y, hd] },
    ];
  },

  geometry(p) {
    return { ops: [{ kind: 'slab', w: p.w, d: p.d }] };
  },

  summary(p) {
    return `${p.w} × ${p.d} m`;
  },
};
