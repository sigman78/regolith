/**
 * Letter P geometry: a graphite deck with a hazard band running just inside
 * its top edge. Base at y = 0, top at SLAB_THICK, centred in X and Z.
 */
import type { BundleBuilder } from './bundle';
import { SLAB_BAND_INSET, SLAB_BAND_PROUD, SLAB_BAND_WIDTH, SLAB_THICK } from './design-constants';
import { bevelBox } from './profiles';
import { translated } from './transform';

export interface SlabOp {
  /** extent along X and Z, metres */
  w: number;
  d: number;
}

export function buildSlab(out: BundleBuilder, op: SlabOp): void {
  const { w, d } = op;
  out.add('graphite', bevelBox(w, SLAB_THICK, d));

  // Band centreline inset from the edge; skipped when the slab is too small to hold one.
  const hx = w / 2 - SLAB_BAND_INSET - SLAB_BAND_WIDTH / 2;
  const hz = d / 2 - SLAB_BAND_INSET - SLAB_BAND_WIDTH / 2;
  if (hx <= SLAB_BAND_WIDTH || hz <= SLAB_BAND_WIDTH) return;
  const y = SLAB_THICK - SLAB_BAND_PROUD;
  const proud = SLAB_BAND_PROUD * 2;
  for (const s of [-1, 1]) {
    out.add(
      'warning',
      translated(bevelBox(2 * hx + SLAB_BAND_WIDTH, proud, SLAB_BAND_WIDTH), 0, y, s * hz),
    );
    out.add(
      'warning',
      translated(bevelBox(SLAB_BAND_WIDTH, proud, 2 * hz - SLAB_BAND_WIDTH), s * hx, y, 0),
    );
  }
}
