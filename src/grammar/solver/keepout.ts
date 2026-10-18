/**
 * Stage 6 — keep-out. A mask of the 1 m grid cells that ambient decoration
 * (rocks, docs/SCATTER.md) must stay out of: every part's cells, slab hosts
 * included, widened by a margin, and every tube and dock path widened by its
 * radius plus a margin.
 *
 * The solver's own `taken` set cannot serve: it leaves out slab hosts and
 * never holds tube corridors. Index of a cell is `j * size + i`, with
 * `i = floor(x / GRID) + size / 2` (the same grid as the terrain).
 */
import {
  GRID,
  KEEPOUT_PART_MARGIN,
  KEEPOUT_TUBE_MARGIN,
  TUBE_RADIUS,
} from '@/geometry/design-constants';
import { cellCenter } from '../footprint';
import type { Grounded } from './ground';
import type { ResolvedTube } from './types';

export function keepOutSize(halfSize: number): number {
  return Math.round((2 * halfSize) / GRID);
}

function mark(mask: Uint8Array, size: number, i: number, j: number): void {
  if (i >= 0 && j >= 0 && i < size && j < size) mask[j * size + i] = 1;
}

export function keepOut(
  grounded: readonly Grounded[],
  tubes: readonly ResolvedTube[],
  halfSize: number,
): Uint8Array {
  const size = keepOutSize(halfSize);
  const mask = new Uint8Array(size * size);
  const origin = size / 2;

  for (const g of grounded) {
    for (const key of g.draft.cells) {
      const [cx, cz] = cellCenter(key);
      const i = Math.floor(cx / GRID) + origin;
      const j = Math.floor(cz / GRID) + origin;
      for (let dj = -KEEPOUT_PART_MARGIN; dj <= KEEPOUT_PART_MARGIN; dj++) {
        for (let di = -KEEPOUT_PART_MARGIN; di <= KEEPOUT_PART_MARGIN; di++) {
          mark(mask, size, i + di, j + dj);
        }
      }
    }
  }

  const reach = TUBE_RADIUS + KEEPOUT_TUBE_MARGIN;
  const span = Math.ceil(reach / GRID);
  const step = GRID / 2;
  for (const t of tubes) {
    for (let k = 0; k + 1 < t.path.length; k++) {
      const a = t.path[k];
      const b = t.path[k + 1];
      if (!a || !b) continue;
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const n = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s <= n; s++) {
        const x = a[0] + ((b[0] - a[0]) * s) / n;
        const z = a[2] + ((b[2] - a[2]) * s) / n;
        const ci = Math.floor(x / GRID) + origin;
        const cj = Math.floor(z / GRID) + origin;
        for (let dj = -span; dj <= span; dj++) {
          for (let di = -span; di <= span; di++) {
            const px = (ci + di + 0.5 - origin) * GRID;
            const pz = (cj + dj + 0.5 - origin) * GRID;
            if (Math.hypot(px - x, pz - z) <= reach + GRID * 0.5)
              mark(mask, size, ci + di, cj + dj);
          }
        }
      }
    }
  }
  return mask;
}
