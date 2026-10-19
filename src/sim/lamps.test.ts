import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { solve, type SolverWorld } from '@/grammar/solver';
import type { Letter } from '@/grammar/types';
import { addPart, createDocument, type BaseDocument } from '@/world/document';
import { newLock, type Lock } from './airlock';
import { baseLamps, lampsKey } from './lamps';

const FLAT: SolverWorld = { halfSize: 64, heightAt: () => 0 };

interface Spec {
  id: string;
  letter: Letter;
  params: Record<string, number>;
  x: number;
  z: number;
  mirror?: boolean;
}

function docWith(...parts: Spec[]): BaseDocument {
  let doc = createDocument({ seed: 'lamps' });
  for (const p of parts) {
    doc = addPart(doc, {
      id: p.id,
      letter: p.letter,
      params: p.params,
      pose: { x: p.x, z: p.z, yaw: snapYaw(0), ...(p.mirror ? { mirror: true } : {}) },
    });
  }
  return doc;
}

const det = (m: number[]): number =>
  (m[0] ?? 0) * ((m[5] ?? 0) * (m[10] ?? 0) - (m[6] ?? 0) * (m[9] ?? 0)) -
  (m[1] ?? 0) * ((m[4] ?? 0) * (m[10] ?? 0) - (m[6] ?? 0) * (m[8] ?? 0)) +
  (m[2] ?? 0) * ((m[4] ?? 0) * (m[9] ?? 0) - (m[5] ?? 0) * (m[8] ?? 0));

describe('base lamps', () => {
  it('is empty for an empty base', () => {
    expect(baseLamps(new Map(), solve(createDocument({ seed: 'e' }), FLAT))).toEqual([]);
  });

  it('has a head per pole and exactly one beacon on the tallest part', () => {
    const doc = docWith(
      { id: 'h0', letter: 'H', params: { length: 8, radius: 2 }, x: 0, z: 0 },
      { id: 'v0', letter: 'V', params: { floors: 3 }, x: 20, z: 0 },
      { id: 'x0', letter: 'X', params: { height: 6 }, x: -12, z: 0 },
      { id: 'x1', letter: 'X', params: { height: 4 }, x: -12, z: 8, mirror: true },
    );
    const lamps = baseLamps(new Map(), solve(doc, FLAT));
    expect(lamps.map((l) => l.id)).toEqual(['x0', 'x1', 'beacon:v0']);
    expect(lamps.filter((l) => l.tone === 'beacon')).toHaveLength(1);
    expect(lamps.filter((l) => l.tone === 'idle')).toHaveLength(2);
  });

  it('keeps every plate right-handed, even on a mirrored part', () => {
    const doc = docWith(
      { id: 'x0', letter: 'X', params: { height: 4 }, x: 0, z: 0 },
      { id: 'x1', letter: 'X', params: { height: 4 }, x: 8, z: 0, mirror: true },
    );
    for (const l of baseLamps(new Map(), solve(doc, FLAT))) {
      expect(det(l.matrix)).toBeGreaterThan(0);
    }
  });

  it('moves the beacon, and changes the key, when a taller part appears', () => {
    const tower: Spec = { id: 'v0', letter: 'V', params: { floors: 2 }, x: 0, z: 0 };
    const mast: Spec = { id: 'm0', letter: 'M', params: { height: 20, head: 1 }, x: 20, z: 0 };
    const small = baseLamps(new Map(), solve(docWith(tower), FLAT));
    const resolved = solve(docWith(tower, mast), FLAT);
    const tall = baseLamps(new Map(), resolved);
    expect(small.map((l) => l.id)).toEqual(['beacon:v0']);
    expect(tall.map((l) => l.id)).toEqual(['beacon:m0']);
    expect(lampsKey(small)).not.toBe(lampsKey(tall));
    // The beacon centre is the whip tip: the mast's base height, its 20 m and the 3 m whip.
    const base = resolved.parts.get('m0')?.pose.y ?? NaN;
    expect(tall[0]?.matrix[13]).toBeCloseTo(base + 23, 6);
  });

  it('shows an airlock mid-cycle in its phase', () => {
    const doc = docWith(
      { id: 'h0', letter: 'H', params: { length: 10, radius: 2 }, x: 0, z: 0 },
      { id: 'a0', letter: 'A', params: { radius: 2 }, x: -2, z: 5 },
    );
    const lock: Lock = { ...newLock(), phase: 'pump', left: 3 };
    const lamps = baseLamps(new Map([['a0', lock]]), solve(doc, FLAT));
    expect(lamps.find((l) => l.id === 'a0')?.tone).toBe('pump');
  });

  it('shows an airlock at rest as idle', () => {
    const doc = docWith(
      { id: 'h0', letter: 'H', params: { length: 10, radius: 2 }, x: 0, z: 0 },
      { id: 'a0', letter: 'A', params: { radius: 2 }, x: -2, z: 5 },
    );
    const lamps = baseLamps(new Map(), solve(doc, FLAT));
    expect(lamps.find((l) => l.id === 'a0')?.tone).toBe('idle');
  });
});
