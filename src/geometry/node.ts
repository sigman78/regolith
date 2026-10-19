/**
 * Letter N geometry: a sphere shell with a graphite collar around the top hatch. The four side
 * ports are doors on corridor stubs, which the solver adds to the recipe (grammar/stubs.ts), so
 * the port layout lives in grammar/parts/N.ts alone.
 */

import type { BundleBuilder } from './bundle';
import {
  NODE_ARC_STEPS,
  NODE_COLLAR_EMBED,
  NODE_COLLAR_FLANGE,
  NODE_COLLAR_THICK,
  NODE_HATCH_DIAMETER,
  NODE_SEGMENTS,
} from './design-constants';
import { flangeRing, lathe, placeAlong, sphereProfile } from './profiles';

export interface NodeOp {
  radius: number;
}

export function buildNode(out: BundleBuilder, op: NodeOp): void {
  const { radius } = op;

  out.add('hull', lathe(sphereProfile(radius, NODE_ARC_STEPS), NODE_SEGMENTS));

  // The top hatch keeps its ring: a vertical hatch, never a door.
  out.add(
    'graphite',
    placeAlong(
      flangeRing(NODE_HATCH_DIAMETER / 2, NODE_COLLAR_THICK, NODE_COLLAR_FLANGE, NODE_SEGMENTS),
      [0, radius - NODE_COLLAR_EMBED, 0],
      [0, 1, 0],
    ),
  );
}
