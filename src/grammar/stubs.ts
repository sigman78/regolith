/**
 * The corridor stubs a part wears: one per door (every tube-capable PRESS port), in the part's own
 * frame, each as deep as its letter says the hull needs (grammar/stub-depth.ts). The solver appends
 * them to the letter's recipe, so a part's geometry never has to know its own ports twice.
 */
import { PORT_STUB_DEPTH } from '@/geometry/design-constants';
import { canTakeTube } from './solver/ports';
import type { GeomOp, ParamValues, PartDefinition } from './types';

export function stubOps<P extends ParamValues>(def: PartDefinition<P>, params: P): GeomOp[] {
  return def
    .ports(params)
    .filter(canTakeTube)
    .map((port) => ({
      kind: 'stub',
      at: port.position,
      normal: port.normal,
      depth: def.stubDepth?.(params, port.id) ?? PORT_STUB_DEPTH,
    }));
}
