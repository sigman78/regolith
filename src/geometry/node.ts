/**
 * Letter N geometry: a sphere shell with a graphite collar around each PRESS
 * port. Port layout is shared with grammar/parts/N.ts through `NODE_PRESS_DIRS` in design-constants
 * (checked in node.test.ts).
 */

import type { BundleBuilder } from './bundle';
import {
  HATCH_DIAMETER,
  NODE_ARC_STEPS,
  NODE_COLLAR_EMBED,
  NODE_COLLAR_FLANGE,
  NODE_COLLAR_THICK,
  NODE_PRESS_DIRS,
  NODE_SEGMENTS,
} from './design-constants';
import { flangeRing, lathe, placeAlong, sphereProfile } from './profiles';

export interface NodeOp {
  radius: number;
}

export function buildNode(out: BundleBuilder, op: NodeOp): void {
  const { radius } = op;

  out.add('hull', lathe(sphereProfile(radius, NODE_ARC_STEPS), NODE_SEGMENTS));

  for (const dir of NODE_PRESS_DIRS) {
    const d = radius - NODE_COLLAR_EMBED;
    out.add(
      'graphite',
      placeAlong(
        flangeRing(HATCH_DIAMETER / 2, NODE_COLLAR_THICK, NODE_COLLAR_FLANGE, NODE_SEGMENTS),
        [dir[0] * d, dir[1] * d, dir[2] * d],
        dir,
      ),
    );
  }
}
