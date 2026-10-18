import { describe, expect, it } from 'vitest';
import type { Pose } from '@/core/math';
import { beaconOwner, type BeaconPart } from './beacon';
import { allParts } from './registry';
import type { Letter, ParamValues } from './types';

const at = (x = 0, y = 0, z = 0): Pose => ({ x, y, z, yaw: 0 });
const part = (id: string, letter: Letter, params: ParamValues, pose = at()): BeaconPart => ({
  id,
  letter,
  params,
  pose,
});

describe('beacon owner', () => {
  it('is nobody on an empty base, or one with only parts that cannot carry it', () => {
    expect(beaconOwner([])).toBeNull();
    expect(
      beaconOwner([part('x', 'X', { height: 6 }), part('s', 'S', {}), part('p', 'P', {})]),
    ).toBeNull();
  });

  it('is the tallest part that can carry one, whatever the order', () => {
    const parts = [
      part('h', 'H', { length: 8, radius: 3 }),
      part('v', 'V', { floors: 5 }),
      part('x', 'X', { height: 6 }),
      part('c', 'C', { length: 20, elevation: 30 }),
    ];
    expect(beaconOwner(parts)?.part).toBe('v');
    expect(beaconOwner([...parts].reverse())?.part).toBe('v');
  });

  it('counts the ground under a part: a tower on a slab beats the same tower on the ground', () => {
    const low = part('low', 'V', { floors: 3 });
    const high = part('high', 'V', { floors: 3 }, at(10, 4, 0));
    expect(beaconOwner([low, high])?.part).toBe('high');
  });

  it('breaks a tie by the smaller id', () => {
    const a = part('b', 'V', { floors: 3 }, at(0, 0, 0));
    const b = part('a', 'V', { floors: 3 }, at(20, 0, 0));
    expect(beaconOwner([a, b])?.part).toBe('a');
    expect(beaconOwner([b, a])?.part).toBe('a');
  });

  it('puts the ball above the part it rests on, in the world', () => {
    const pick = beaconOwner([part('m', 'M', { height: 12, head: 1 }, at(5, 2, -3))]);
    expect(pick?.world[0]).toBeCloseTo(5, 9);
    expect(pick?.world[2]).toBeCloseTo(-3, 9);
    expect(pick?.world[1]).toBeCloseTo(2 + 12 + 3, 9);
  });

  it('every part that offers a mount offers a finite one above its origin', () => {
    for (const def of allParts()) {
      if (!def.beacon) continue;
      const mount = def.beacon(def.resolve({}));
      expect(mount.every(Number.isFinite)).toBe(true);
      expect(mount[1]).toBeGreaterThan(0);
    }
  });
});
