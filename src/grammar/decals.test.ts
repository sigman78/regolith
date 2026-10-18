import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { HAB_STRIPE_FROM_END } from '@/geometry/design-constants';
import { addPart, createDocument, setPartPose } from '@/world/document';
import { decalsFor, serialText } from './decals';
import { solve, type SolverWorld } from './solver';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };
const hab = { length: 8, radius: 2 };
const at = (yaw: number) => ({ x: 3, y: 2.5, z: -4, yaw });

/** World position of the stencil's centre and where its +x runs (the reading direction). */
function frame(yaw: number, variant = 0) {
  const [d] = decalsFor('H', 2, hab, at(yaw), variant);
  const m = d?.matrix ?? [];
  return {
    origin: [m[12] ?? 0, m[13] ?? 0, m[14] ?? 0],
    read: [m[0] ?? 0, m[2] ?? 0],
    // The hull's flank normal (local +z) in world XZ.
    out: [m[8] ?? 0, m[10] ?? 0],
  };
}

describe('serialText', () => {
  it('is the letter, a dash and three digits', () => {
    expect(serialText('H', 2)).toBe('H-002');
    expect(serialText('H', 47)).toBe('H-047');
  });
});

describe('decalsFor', () => {
  it('only stencils habs that came from the document', () => {
    expect(decalsFor('H', 0, hab, at(0), 0)).toEqual([]);
    expect(decalsFor('N', 3, { radius: 2 }, at(0), 0)).toEqual([]);
    expect(decalsFor('H', 3, hab, at(0), 0)).toHaveLength(1);
  });

  it('puts the text on the flank that faces +z and reads left to right, whatever the yaw', () => {
    for (const yaw of [0, 45, 135, 180, 225, 315]) {
      const f = frame(yaw);
      expect(f.out[1] ?? 0).toBeGreaterThan(0);
      expect(f.read[0] ?? 0).toBeGreaterThan(0);
    }
  });

  it('is deterministic and ignores the mirror flag, so a flipped hab never reads backwards', () => {
    expect(frame(90)).toEqual(frame(90));
    let doc = addPart(createDocument({ seed: 's' }), {
      id: 'h',
      letter: 'H',
      params: hab,
      pose: { x: 0, z: 0, yaw: snapYaw(0) },
    });
    const plain = solve(doc, FLAT).parts.get('h')?.decals[0]?.matrix;
    doc = setPartPose(doc, 'h', { x: 0, z: 0, yaw: 0, mirror: true });
    expect(solve(doc, FLAT).parts.get('h')?.decals[0]?.matrix).toEqual(plain);
  });

  it('shares one recipe per text and keeps clear of the stripe', () => {
    const [a] = decalsFor('H', 2, hab, at(0), 0);
    const [b] = decalsFor('H', 2, hab, at(90), 0);
    expect(a?.recipeHash).toBe(b?.recipeHash);
    const [c] = decalsFor('H', 3, hab, at(0), 0);
    expect(c?.recipeHash).not.toBe(a?.recipeHash);
    // Variant 0 stripes the +x end, so the text is on the -x half; variant 1 the other way round.
    const stripe = 8 / 2 - HAB_STRIPE_FROM_END;
    expect((frame(0, 0).origin[0] ?? 0) - 3).toBeLessThan(stripe - 1);
    expect((frame(0, 1).origin[0] ?? 0) - 3).toBeGreaterThan(-stripe + 1);
  });
});
