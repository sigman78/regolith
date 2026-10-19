import { describe, expect, it } from 'vitest';
import { footprintContains } from '@/grammar/footprint';
import { solve, type SolverWorld } from '@/grammar/solver';
import { CORRIDOR_HALF_WIDTH } from '@/geometry/design-constants';
import { addLink, addPart, createDocument } from '@/world/document';
import { cullScatter, scatterCandidates, SCATTER_STRIDE } from '@/world/scatter';
import { generateTerrain, heightAt } from '@/world/terrain';
import { goldenBase } from './golden-base';

const hf = generateTerrain({ seed: 'olympus-07' });
const world: SolverWorld = { halfSize: 48, heightAt: (x, z) => heightAt(hf, x, z) };

function goldenResolved() {
  const g = goldenBase();
  let doc = createDocument({ seed: 'olympus-07' });
  for (const p of g.parts) doc = addPart(doc, p);
  for (const l of g.links) doc = addLink(doc, l);
  return solve(doc, world);
}

describe('rocks and the base', () => {
  const base = goldenResolved();
  const culled = cullScatter(scatterCandidates(hf, 'olympus-07'), base.keepOut, 96);

  it('leaves most of the world rocky while clearing the base', () => {
    expect(base.keepOut.length).toBe(96 * 96);
    expect(culled.count).toBeGreaterThan(200);
    expect(culled.count).toBeLessThan(scatterCandidates(hf, 'olympus-07').count);
  });

  it('puts no rock inside any footprint, slab hosts included', () => {
    for (let n = 0; n < culled.count; n++) {
      const x = culled.data[n * SCATTER_STRIDE] ?? 0;
      const z = culled.data[n * SCATTER_STRIDE + 2] ?? 0;
      for (const p of base.parts.values()) {
        expect(footprintContains(p.footprint, p.pose, x, z)).toBe(false);
      }
    }
  });

  it('keeps every rock clear of every tube centreline by more than the tube radius', () => {
    for (let n = 0; n < culled.count; n++) {
      const x = culled.data[n * SCATTER_STRIDE] ?? 0;
      const z = culled.data[n * SCATTER_STRIDE + 2] ?? 0;
      const r = (culled.data[n * SCATTER_STRIDE + 3] ?? 0) / 2;
      for (const t of base.tubes.values()) {
        for (let k = 0; k + 1 < t.path.length; k++) {
          const a = t.path[k];
          const b = t.path[k + 1];
          if (!a || !b) continue;
          const dx = b[0] - a[0];
          const dz = b[2] - a[2];
          const len2 = dx * dx + dz * dz || 1;
          const u = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[2]) * dz) / len2));
          const d = Math.hypot(x - (a[0] + dx * u), z - (a[2] + dz * u));
          expect(d - r).toBeGreaterThan(CORRIDOR_HALF_WIDTH);
        }
      }
    }
  });
});
