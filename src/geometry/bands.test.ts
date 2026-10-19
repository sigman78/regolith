/**
 * M3.5 stage 3: rings (ribs, window bands, the dome stripe) that cross a door's height skip an arc
 * around the door, ending inside the stub's wall, so nothing cuts through a stub.
 */
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/core/math';
import { D } from '@/grammar/parts/D';
import { V } from '@/grammar/parts/V';
import { STUB_HALF_WIDTH } from '@/grammar/stub-depth';
import { stubOps } from '@/grammar/stubs';
import { towerBandY, towerFloorY } from '@/grammar/windows';
import { buildBundle } from './build';
import {
  BAND_END_GAP,
  DOME_COLLAR_HEIGHT,
  DOME_RADII,
  DOME_STRIPE_HALF,
  DOME_STRIPE_Y,
  FLOOR_ABOVE_BELLY,
  TOWER_RADIUS,
  TOWER_RIB_THICK,
  TOWER_WINDOW_HALF,
} from './design-constants';
import { domeRimY } from './dome';
import { lathePhi, ringArcs } from './profiles';
import { assertValidBundle } from './validate';

/** No vertex of `positions` within the height band lies in front of a door nearer its axis than the stub's wall plus the gap. */
function expectClearOfDoors(
  positions: Float32Array | undefined,
  doors: readonly Vec3[],
  yLo: number,
  yHi: number,
): number {
  let seen = 0;
  const p = positions ?? new Float32Array();
  for (let i = 0; i < p.length; i += 3) {
    const [x = 0, y = 0, z = 0] = [p[i], p[i + 1], p[i + 2]];
    if (y < yLo || y > yHi) continue;
    seen++;
    for (const n of doors) {
      const along = x * n[0] + z * n[2];
      const lateral = Math.abs(x * n[2] - z * n[0]);
      const inStub = along > 0 && lateral < STUB_HALF_WIDTH + BAND_END_GAP - 1e-6;
      expect(inStub, `vertex ${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)} in a stub`).toBe(
        false,
      );
    }
  }
  return seen;
}

describe('ringArcs', () => {
  it('is the whole ring with nothing to skip, and leaves gaps of the asked width around doors', () => {
    expect(ringArcs([], 3, 1)).toEqual([[0, Math.PI * 2]]);
    const arcs = ringArcs([[1, 0, 0]], 3, 1.05);
    expect(arcs).toHaveLength(1);
    const half = Math.asin(1.05 / 3);
    expect(arcs[0]?.[0]).toBeCloseTo(lathePhi([1, 0, 0]) + half, 9);
    expect(arcs[0]?.[1]).toBeCloseTo(Math.PI * 2 - 2 * half, 9);
    const four = ringArcs(
      [
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
        [0, 0, -1],
      ],
      3,
      1.05,
    );
    expect(four).toHaveLength(4);
    for (const [, length] of four) expect(length).toBeCloseTo(Math.PI / 2 - 2 * half, 9);
  });
});

describe('tower rings around the doors', () => {
  for (const floors of [2, 4]) {
    it(`keeps every rib and band out of the stubs, ${floors} floors`, () => {
      const p = V.resolve({ floors });
      const bundle = buildBundle({ ops: [...V.geometry(p, { seed: 't' }).ops, ...stubOps(V, p)] });
      expect(() => assertValidBundle(bundle)).not.toThrow();
      // The rings are checked on the letter's own geometry: the stubs' door frames are graphite too.
      const own = buildBundle(V.geometry(p, { seed: 't' }));
      const press = V.ports(p).filter((q) => q.type === 'PRESS');
      for (let k = 0; k < floors; k++) {
        const floorY = towerFloorY(k);
        const doors = press
          .filter((q) => Math.abs(q.position[1] - floorY) < 1e-6)
          .map((q) => q.normal);
        expect(doors.length).toBeGreaterThan(0);
        const ribs = expectClearOfDoors(
          own.byMaterial.graphite?.positions,
          doors,
          floorY - TOWER_RIB_THICK,
          floorY + TOWER_RIB_THICK,
        );
        expect(ribs).toBeGreaterThan(0);
        if (k < floors - 1) {
          const band = expectClearOfDoors(
            own.byMaterial.glass?.positions,
            doors,
            towerBandY(k) - TOWER_WINDOW_HALF - 0.01,
            towerBandY(k) + TOWER_WINDOW_HALF + 0.01,
          );
          expect(band).toBeGreaterThan(0);
        }
      }
    });
  }

  it('stands on a plinth: the ground floor rib is FLOOR_ABOVE_BELLY up and the hull reaches it', () => {
    const own = buildBundle(V.geometry(V.resolve({ floors: 2 }), { seed: 't' }));
    const g = own.byMaterial.graphite?.positions ?? new Float32Array();
    let ground = false;
    for (let i = 1; i < g.length; i += 3) {
      if (Math.abs((g[i] ?? 0) - FLOOR_ABOVE_BELLY) < TOWER_RIB_THICK) ground = true;
    }
    expect(ground).toBe(true);
    expect(own.bounds.min[1]).toBeCloseTo(0, 5);
    expect(own.bounds.max[0]).toBeGreaterThanOrEqual(TOWER_RADIUS);
  });
});

describe('dome rings around the doors', () => {
  for (const radius of DOME_RADII) {
    it(`keeps the rim rib and the stripe out of the stubs, radius ${radius}`, () => {
      const p = D.resolve({ radius });
      const bundle = buildBundle({ ops: [...D.geometry(p, { seed: 't' }).ops, ...stubOps(D, p)] });
      expect(() => assertValidBundle(bundle)).not.toThrow();
      const own = buildBundle(D.geometry(p, { seed: 't' }));
      const doors = D.ports(p)
        .filter((q) => q.type === 'PRESS')
        .map((q) => q.normal);
      const rim = domeRimY();
      expect(rim).toBeCloseTo(FLOOR_ABOVE_BELLY + DOME_COLLAR_HEIGHT, 9);
      expect(
        expectClearOfDoors(own.byMaterial.graphite?.positions, doors, rim - 0.2, rim + 0.2),
      ).toBeGreaterThan(0);
      const sy = FLOOR_ABOVE_BELLY + DOME_STRIPE_Y;
      expect(
        expectClearOfDoors(
          own.byMaterial.accent?.positions,
          doors,
          sy - DOME_STRIPE_HALF - 0.01,
          sy + DOOR_LEAF_SLACK + DOME_STRIPE_HALF,
        ),
      ).toBeGreaterThan(0);
      expect(bundle.bounds.max[1]).toBeCloseTo(rim + radius, 3);
    });
  }
});

/** The accent door leaves sit at the sill; the stripe band check must not sweep them in. */
const DOOR_LEAF_SLACK = 0.01;
