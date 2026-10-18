import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { FOOT_SINK } from '@/geometry/design-constants';
import { addPart, createDocument } from '@/world/document';
import { generateTerrain, heightAt } from '@/world/terrain';
import { solve, type SolverWorld } from './index';

const hf = generateTerrain({ seed: 'contact', size: 96 });
const world: SolverWorld = { halfSize: 48, heightAt: (x, z) => heightAt(hf, x, z) };

const hab = (id: string, x: number, z: number) => ({
  id,
  letter: 'H' as const,
  params: { length: 8, radius: 2 },
  pose: { x, z, yaw: snapYaw(0) },
});
const slab = (id: string, x: number, z: number) => ({
  id,
  letter: 'P' as const,
  params: { w: 12, d: 12 },
  pose: { x, z, yaw: snapYaw(0) },
});

describe('solver: ground around contact', () => {
  it('has no levelled terrain for an empty base', () => {
    expect(solve(createDocument({ seed: 's' }), world).terrain).toBeNull();
  });

  it('levels the ground flat under a slab', () => {
    const base = solve(addPart(createDocument({ seed: 's' }), slab('s', 10, 4)), world);
    const field = base.terrain;
    expect(field).not.toBeNull();
    if (!field) return;
    const at = field.heightAt(10, 4);
    for (let x = 4.5; x <= 15.5; x += 0.75) {
      for (let z = -1.5; z <= 9.5; z += 0.75) {
        expect(Math.abs(field.heightAt(x, z) - at)).toBeLessThan(0.01);
      }
    }
  });

  it('levels under slabs only: a hab on its own legs keeps the natural terrain', () => {
    let doc = addPart(createDocument({ seed: 's' }), slab('s', 10, 4));
    doc = addPart(doc, hab('h', -20, 0));
    const base = solve(doc, world);
    expect(base.terrain?.patches.map((p) => p.id)).toEqual(['s']);
    expect(base.terrain?.heightAt(-20, 0)).toBe(world.heightAt(-20, 0));
  });

  it('skips a slab that is being moved, and puts the pylons on the natural terrain', () => {
    let doc = addPart(createDocument({ seed: 's' }), slab('a', -14, 0));
    doc = addPart(doc, slab('b', 14, 6));
    const base = solve(doc, world, { movingId: 'b' });
    expect(base.terrain?.patches.map((p) => p.id)).toEqual(['a']);
    expect(base.terrain?.heightAt(14, 6)).toBe(world.heightAt(14, 6));
  });

  it('stands slab pylons on the levelled ground', () => {
    const base = solve(addPart(createDocument({ seed: 's' }), slab('s', 10, 4)), world);
    const part = base.parts.get('s');
    for (const leg of part?.legs ?? []) {
      const ground = base.terrain?.heightAt(leg.bottom[0], leg.bottom[2]) ?? NaN;
      expect(leg.bottom[1]).toBeCloseTo(ground - FOOT_SINK, 9);
    }
  });

  it('is the same bytes for the same input', () => {
    let doc = addPart(createDocument({ seed: 's' }), hab('a', -12, 0));
    doc = addPart(doc, slab('s', 10, 4));
    const one = solve(doc, world).terrain;
    const two = solve(doc, world).terrain;
    for (let x = -20; x <= 20; x += 1.3) {
      expect(one?.heightAt(x, 2)).toBe(two?.heightAt(x, 2));
    }
  });
});
