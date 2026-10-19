/** M3.5 stage 3: windows at eye height, never on a door's bay; the stencil below (or above) them. */
import { describe, expect, it } from 'vitest';
import {
  EYE_HEIGHT,
  HAB_LENGTH,
  HAB_RADII,
  HAB_STRIPE_HALF,
  TOWER_FLOORS,
} from '@/geometry/design-constants';
import { H, habSidePorts } from './parts/H';
import { V } from './parts/V';
import {
  habBayCentres,
  habPaneAngle,
  habStencilBay,
  habStripeAt,
  habWindowBays,
  towerBandY,
  towerFloorY,
} from './windows';

const lengths = [HAB_LENGTH.min, HAB_LENGTH.default, HAB_LENGTH.max];

describe('hab panes', () => {
  it('put the pane centre EYE_HEIGHT over the floor for every radius (below the axis on M)', () => {
    for (const radius of HAB_RADII) {
      const p = H.resolve({ length: 8, radius });
      const floor = H.floor?.(p) ?? NaN;
      const y = radius * Math.cos(habPaneAngle(radius));
      expect(y - floor).toBeCloseTo(EYE_HEIGHT, 6);
    }
    expect(habPaneAngle(2)).toBeLessThan(Math.PI / 2);
    expect(habPaneAngle(3)).toBeGreaterThan(Math.PI / 2);
  });

  it('skip the stripe bay and, on each flank, the bay with a door', () => {
    for (const length of lengths) {
      for (const variant of [0, 1, 2]) {
        const stripe = habStripeAt(length, variant);
        for (const side of [1, -1] as const) {
          const bays = habWindowBays(length, variant, side);
          const doors = habSidePorts(length).filter((d) => d.side === side);
          for (const x of bays) {
            expect(Math.abs(x - stripe)).toBeGreaterThan(HAB_STRIPE_HALF);
            for (const d of doors) expect(Math.abs(d.x - x)).toBeGreaterThan(0.5);
          }
          // Every door bay is a real bay, and is a pane bay on the other flank unless the stripe is there.
          for (const d of doors) {
            expect(habBayCentres(length).some((x) => Math.abs(x - d.x) < 1e-6)).toBe(true);
            const other = habWindowBays(length, variant, side === 1 ? -1 : 1);
            if (Math.abs(d.x - stripe) > HAB_STRIPE_HALF + 1) {
              expect(other.some((x) => Math.abs(x - d.x) < 1e-6)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('give the stencil a bay with no door on its flank, away from the stripe', () => {
    for (const length of lengths) {
      for (const variant of [0, 1]) {
        for (const side of [1, -1] as const) {
          const bay = habStencilBay(length, variant, side);
          const doors = habSidePorts(length).filter((d) => d.side === side);
          const free = habBayCentres(length).filter(
            (x) => !doors.some((d) => Math.abs(d.x - x) < 1e-6),
          );
          if (free.length > 0) expect(free).toContain(bay);
          if (length >= 8) {
            expect(Math.abs(bay - habStripeAt(length, variant))).toBeGreaterThan(
              HAB_STRIPE_HALF + 1,
            );
          }
        }
      }
    }
  });
});

describe('tower bands', () => {
  it('sit EYE_HEIGHT over each floor, and the floors are where the ports are', () => {
    for (const floors of [TOWER_FLOORS.min, TOWER_FLOORS.max]) {
      const p = V.resolve({ floors });
      const decks = V.floors?.(p) ?? [];
      expect(decks).toHaveLength(floors);
      decks.forEach((y, k) => {
        expect(y).toBeCloseTo(towerFloorY(k), 9);
        expect(towerBandY(k) - y).toBeCloseTo(EYE_HEIGHT, 9);
      });
      for (const q of V.ports(p).filter((q) => q.type === 'PRESS')) {
        expect(decks.some((y) => Math.abs(y - q.position[1]) < 1e-9)).toBe(true);
      }
    }
  });
});
