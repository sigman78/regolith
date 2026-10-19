/**
 * M3.5 stage 2: every door sits on a corridor stub whose back is inside the hull. The containment
 * checks here are written against each hull's own shape, independently of stub-depth.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  BEVEL,
  CREW_HEIGHT,
  DECK_HEIGHT,
  DOME_COLLAR_HEIGHT,
  DOOR_H,
  FLOOR_ABOVE_BELLY,
  HAB_CAP_RATIO,
  HEADROOM_MARGIN,
  LEG_MIN_CLEARANCE,
  NODE_RADII,
  PORT_STUB_DEPTH,
  TOWER_CAP_RATIO,
  TOWER_FLOOR_HEIGHT,
  TOWER_RADIUS,
} from '@/geometry/design-constants';
import type { Vec3 } from '@/core/math';
import { allParts, getPart } from './registry';
import { paramSets } from './params';
import { STUB_BOTTOM, STUB_HALF_WIDTH, STUB_TOP } from './stub-depth';
import { stubOps } from './stubs';
import type { ParamValues } from './types';

/** Is a local point inside this letter's hull? Written per shape, not from the stub formulas. */
function inside(letter: string, p: ParamValues, q: Vec3): boolean {
  const [x, y, z] = q;
  switch (letter) {
    case 'H':
    case 'A': {
      const r = Number(p['radius']);
      const length = letter === 'H' ? Number(p['length']) : 2.4;
      const cap = r * HAB_CAP_RATIO;
      const half = length / 2;
      const radial = Math.hypot(y, z);
      if (Math.abs(x) <= half) return radial <= r;
      const u = Math.abs(x) - half;
      if (u > cap) return false;
      return radial <= r * Math.sqrt(1 - (u / cap) ** 2);
    }
    case 'N':
      return Math.hypot(x, y, z) <= Number(p['size']);
    case 'V': {
      const h = TOWER_FLOOR_HEIGHT * Number(p['floors']);
      if (y < 0) return false;
      if (y <= h) return Math.hypot(x, z) <= TOWER_RADIUS;
      const cap = TOWER_RADIUS * TOWER_CAP_RATIO;
      if (y > h + cap) return false;
      return Math.hypot(x, z) <= TOWER_RADIUS * Math.sqrt(1 - ((y - h) / cap) ** 2);
    }
    case 'D': {
      const r = Number(p['radius']);
      if (y < 0) return false;
      if (y <= DOME_COLLAR_HEIGHT) return Math.hypot(x, z) <= r;
      return Math.hypot(x, y - DOME_COLLAR_HEIGHT, z) <= r;
    }
    default:
      return false;
  }
}

describe('corridor stubs', () => {
  it('leave a door taller than the crew member and their headroom', () => {
    expect(DOOR_H).toBeGreaterThanOrEqual(CREW_HEIGHT + HEADROOM_MARGIN);
  });

  it('are at least PORT_STUB_DEPTH deep and have their back face inside the hull, every letter and size', () => {
    let checked = 0;
    for (const def of allParts()) {
      for (const raw of paramSets(def.schema)) {
        const p = def.resolve(raw);
        for (const stub of stubOps(def, p)) {
          if (stub.kind !== 'stub') continue;
          expect(stub.depth).toBeGreaterThanOrEqual(PORT_STUB_DEPTH);
          const n = stub.normal;
          const lat: Vec3 = [n[2], 0, -n[0]];
          const back: Vec3 = [
            stub.at[0] - n[0] * stub.depth,
            stub.at[1] - n[1] * stub.depth,
            stub.at[2] - n[2] * stub.depth,
          ];
          // The four corners of the back face, a bevel in from its extremes.
          for (const sx of [-1, 1]) {
            for (const sy of [-STUB_BOTTOM + BEVEL, STUB_TOP - BEVEL]) {
              const w = (STUB_HALF_WIDTH - BEVEL) * sx;
              const q: Vec3 = [back[0] + lat[0] * w, back[1] + sy, back[2] + lat[2] * w];
              expect(
                inside(def.letter, p, q),
                `${def.letter} ${JSON.stringify(raw)} ${stub.at}`,
              ).toBe(true);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('is the same op list on every call', () => {
    const H = getPart('H');
    if (!H) throw new Error('H');
    const p = H.resolve({});
    expect(stubOps(H, p)).toEqual(stubOps(H, p));
    expect(stubOps(H, p).length).toBe(H.ports(p).filter((q) => q.type === 'PRESS').length);
  });
});

describe('the node on its belly (stage 2 decision)', () => {
  it('has its floor FLOOR_ABOVE_BELLY over the bottom of the sphere, so headroom is 3, 4 and 5 m', () => {
    const N = getPart('N');
    if (!N) throw new Error('N');
    for (const size of NODE_RADII) {
      const p = N.resolve({ size });
      const floor = N.floor?.(p) ?? NaN;
      expect(floor).toBeCloseTo(FLOOR_ABOVE_BELLY - size, 9);
      expect(size - floor).toBeCloseTo(2 * size - FLOOR_ABOVE_BELLY, 9);
      // The feet are above the belly, so the clearance they ask for keeps the belly LEG_MIN_CLEARANCE up.
      const feet = N.ports(p).filter((q) => q.type === 'STRUCT');
      const lowest = Math.min(...feet.map((q) => q.position[1]));
      const g = N.ground(p);
      expect(g.mode).toBe('legs');
      if (g.mode !== 'legs') continue;
      // The pose puts the lowest foot minClearance up, so the belly (one radius under the origin)
      // ends up LEG_MIN_CLEARANCE over the ground and the floor DECK_HEIGHT over it.
      expect(g.minClearance - lowest - size).toBeCloseTo(LEG_MIN_CLEARANCE, 9);
      expect(g.minClearance - lowest + floor).toBeCloseTo(DECK_HEIGHT, 9);
    }
  });
});
