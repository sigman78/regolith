import { describe, expect, it } from 'vitest';
import { solve } from '@/grammar/solver';
import { addPart, createDocument } from '@/world/document';
import { pickPart } from './pick';

const world = { halfSize: 48, heightAt: () => 0 };

function baseWith(...parts: { id: string; x: number; z: number; yaw?: 0 | 90 }[]) {
  let doc = createDocument({ seed: 'pick' });
  for (const p of parts) {
    doc = addPart(doc, { id: p.id, letter: 'H', pose: { x: p.x, z: p.z, yaw: p.yaw ?? 0 } });
  }
  return solve(doc, world);
}

describe('pickPart', () => {
  it('hits the hab under a downward ray and misses beside it', () => {
    const base = baseWith({ id: 'a', x: 0, z: 0 });
    expect(pickPart({ origin: [0, 20, 0], dir: [0, -1, 0] }, base)?.id).toBe('a');
    expect(pickPart({ origin: [0, 20, 12], dir: [0, -1, 0] }, base)).toBeNull();
  });

  it('respects yaw: a rotated hab is long along Z', () => {
    const base = baseWith({ id: 'a', x: 0, z: 0, yaw: 90 });
    expect(pickPart({ origin: [0, 20, 4], dir: [0, -1, 0] }, base)?.id).toBe('a');
    expect(pickPart({ origin: [0, 20, 4.9 + 1], dir: [0, -1, 0] }, base)).toBeNull();
    expect(pickPart({ origin: [4, 20, 0], dir: [0, -1, 0] }, base)).toBeNull();
  });

  it('returns the nearest of several', () => {
    const base = baseWith({ id: 'a', x: 0, z: 0 }, { id: 'b', x: 0, z: 8 });
    const ray = { origin: [0, 1, 30] as const, dir: [0, 0, -1] as const };
    expect(pickPart(ray, base)?.id).toBe('b');
  });
});
