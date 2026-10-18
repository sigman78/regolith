import { Color, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { solve, type SolverWorld } from '@/grammar/solver';
import { INDIVIDUAL_TINT_MAX } from '@/geometry/design-constants';
import { addPart, createDocument, removePart } from '@/world/document';
import { hullTint, SceneSync } from './scene-sync';
import { materials, PALETTE } from './materials';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };
const hab = (id: string, x: number) => ({
  id,
  letter: 'H' as const,
  params: { length: 8, radius: 2 },
  pose: { x, z: 0, yaw: 0 as const },
});

describe('hullTint', () => {
  it('is neutral at 0 and lands on Hull shaded at 1, a point on a palette segment', () => {
    const none = hullTint(0);
    expect([none.r, none.g, none.b]).toEqual([1, 1, 1]);
    const full = hullTint(1);
    const white = new Color(PALETTE.hullWhite);
    const shaded = new Color(PALETTE.hullShadowed);
    expect(full.r * white.r).toBeCloseTo(shaded.r, 9);
    expect(full.g * white.g).toBeCloseTo(shaded.g, 9);
    expect(full.b * white.b).toBeCloseTo(shaded.b, 9);
    const max = hullTint(INDIVIDUAL_TINT_MAX);
    expect(max.r).toBeGreaterThan(0.9);
  });
});

describe('individual tint in the scene', () => {
  /** The hull batch's instance colours, red channel, sorted. */
  const hullReds = (sync: SceneSync): number[] => {
    const mesh = sync.batchMeshes.find((m) => m.material === materials.hull);
    const out: number[] = [];
    const c = new Color();
    for (let i = 0; i < (mesh?.maxInstanceCount ?? 0); i++) {
      try {
        mesh?.getColorAt(i, c);
      } catch {
        continue; // deleted instance
      }
      out.push(Math.round(c.r * 1e4) / 1e4);
    }
    return out.sort((x, y) => x - y);
  };
  const expected = (base: ReturnType<typeof solve>): number[] =>
    [...base.parts.values()]
      .map((p) => Math.round(hullTint(p.tint).r * 1e4) / 1e4)
      .sort((x, y) => x - y);

  it('gives same-param habs different hull colours, and a reused instance id its own', () => {
    const sync = new SceneSync(new Scene());
    let doc = createDocument({ seed: 'ind' });
    for (let i = 0; i < 6; i++) doc = addPart(doc, hab(`h${i}`, i * 14 - 35));
    let base = solve(doc, FLAT);
    expect(new Set([...base.parts.values()].map((p) => p.tint.toFixed(4))).size).toBeGreaterThan(3);
    sync.sync(base);
    expect(hullReds(sync)).toEqual(expected(base));

    // Remove one, add another: the freed instance id is reused and must carry the new part's tint.
    doc = removePart(doc, 'h0');
    sync.sync(solve(doc, FLAT));
    sync.tick(5);
    doc = addPart(doc, hab('h9', 40));
    base = solve(doc, FLAT);
    sync.sync(base);
    // Whatever id each part holds, it carries its own tint and the removed one is gone.
    expect(hullReds(sync)).toEqual(expected(base));
  });
});
