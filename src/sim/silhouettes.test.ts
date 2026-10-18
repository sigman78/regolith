import { describe, expect, it } from 'vitest';
import { YAWS, worldToLocal, type Vec3 } from '@/core/math';
import { FIGURE_CAPACITY, FIGURE_PROUD, HAB_WINDOW_PROUD } from '@/geometry/design-constants';
import { buildBundle } from '@/geometry/build';
import { habWindowBays } from '@/grammar/windows';
import { solve, type ResolvedBase, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument } from '@/world/document';
import { emptyCrew, type Agent, type CrewState } from './crew';
import { silhouetteSlots, slotsKey } from './silhouettes';

const FLAT: SolverWorld = { halfSize: 64, heightAt: () => 0 };

function agent(index: number, at: string, partial: Partial<Agent> = {}): Agent {
  return {
    index,
    home: at,
    at,
    route: [],
    step: 0,
    s: 0,
    dwell: 0,
    stopsHour: -1,
    stops: [],
    stop: 0,
    ...partial,
  };
}

function crewOf(...agents: Agent[]): CrewState {
  return { ...emptyCrew(), agents };
}

function oneHab(yaw: (typeof YAWS)[number], mirror: boolean, length = 10): ResolvedBase {
  const doc = addPart(createDocument({ seed: 'sil' }), {
    id: 'a',
    letter: 'H',
    params: { length, radius: 2 },
    pose: { x: 3, z: -4, yaw, ...(mirror ? { mirror: true as const } : {}) },
  });
  return solve(doc, FLAT);
}

describe('window silhouettes', () => {
  it('stands each figure on a real pane for every yaw and flip, both flanks', () => {
    for (const length of [4, 8, 12]) {
      for (const yaw of YAWS) {
        for (const mirror of [false, true]) {
          const base = oneHab(yaw, mirror, length);
          const part = base.parts.get('a');
          if (!part) throw new Error('no part');
          const glass = buildBundle(part.recipe).byMaterial.glass;
          expect(glass).toBeTruthy();
          const pos = glass?.positions ?? new Float32Array();
          const bays = habWindowBays(length, 0);
          const slots = silhouetteSlots(crewOf(...bays.map((_, i) => agent(i, 'a'))), base);
          expect(slots.length).toBe(bays.length * 2);
          for (const slot of slots) {
            const m = slot.matrix;
            const local = worldToLocal(part.pose, [m[12] ?? 0, m[13] ?? 0, m[14] ?? 0]);
            // The pane nearest this figure: glass vertices within a bay's width and on its flank.
            let n = 0;
            let cx = 0;
            let cy = 0;
            let cz = 0;
            for (let i = 0; i < pos.length; i += 3) {
              const x = pos[i] ?? 0;
              const y = pos[i + 1] ?? 0;
              const z = pos[i + 2] ?? 0;
              if (Math.abs(x - local[0]) > 0.5 || Math.sign(z) !== Math.sign(local[2])) continue;
              cx += x;
              cy += y;
              cz += z;
              n++;
            }
            expect(n).toBeGreaterThan(0);
            // Within 5 cm of the pane centre along the hull, same angle round it, just proud of the glass.
            expect(Math.abs(local[0] - cx / n)).toBeLessThan(0.05);
            const figAngle = Math.atan2(local[2], local[1]);
            const paneAngle = Math.atan2(cz / n, cy / n);
            expect(Math.abs(figAngle - paneAngle)).toBeLessThan(0.03);
            // The glass is flat: stand-off is measured along the pane's own normal.
            const ny = Math.cos(paneAngle);
            const nz = Math.sin(paneAngle);
            let outer = -Infinity;
            for (let i = 0; i < pos.length; i += 3) {
              const x = pos[i] ?? 0;
              const z = pos[i + 2] ?? 0;
              if (Math.abs(x - local[0]) > 0.5 || Math.sign(z) !== Math.sign(local[2])) continue;
              outer = Math.max(outer, (pos[i + 1] ?? 0) * ny + z * nz);
            }
            const stand = local[1] * ny + local[2] * nz - outer;
            expect(stand).toBeGreaterThan(0);
            expect(stand).toBeLessThan(FIGURE_PROUD + 0.01);
          }
        }
      }
    }
    expect(HAB_WINDOW_PROUD).toBeGreaterThan(0);
  });

  it('keeps a right-handed basis, so a flipped hab never turns a figure inside out', () => {
    for (const yaw of YAWS) {
      for (const mirror of [false, true]) {
        const slots = silhouetteSlots(crewOf(agent(0, 'a')), oneHab(yaw, mirror));
        expect(slots.length).toBe(2);
        for (const s of slots) {
          const m = s.matrix;
          const x: Vec3 = [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
          const y: Vec3 = [m[4] ?? 0, m[5] ?? 0, m[6] ?? 0];
          const z: Vec3 = [m[8] ?? 0, m[9] ?? 0, m[10] ?? 0];
          const det =
            x[0] * (y[1] * z[2] - y[2] * z[1]) -
            x[1] * (y[0] * z[2] - y[2] * z[0]) +
            x[2] * (y[0] * z[1] - y[1] * z[0]);
          expect(det).toBeCloseTo(1, 6);
          // Facing outward: away from the hab's axis.
          expect(z[1]).toBeGreaterThan(0);
        }
      }
    }
  });

  it('shows nobody on a tube, on a part with no windows, or when the node is gone', () => {
    const base = oneHab(0, false);
    const onEdge = agent(0, 'a', { route: [{ k: 'edge', edge: 'e', dir: 1 }] });
    expect(silhouetteSlots(crewOf(onEdge), base)).toHaveLength(0);
    expect(silhouetteSlots(crewOf(agent(0, 'nope')), base)).toHaveLength(0);
    const node = solve(
      addPart(createDocument({ seed: 's' }), {
        id: 's',
        letter: 'N',
        params: {},
        pose: { x: 0, z: 0, yaw: 0 },
      }),
      FLAT,
    );
    expect(node.graph.nodes.has('s')).toBe(true);
    expect(silhouetteSlots(crewOf(agent(0, 's')), node)).toHaveLength(0);
  });

  it('follows a walker bay to bay and is deterministic', () => {
    const base = oneHab(0, false, 12);
    const keys = new Set<string>();
    for (let s = 0; s <= 6; s += 0.25) {
      const a = agent(0, 'a', {
        route: [{ k: 'node', node: 'a', from: 'end-', to: '@centre' }],
        s,
      });
      keys.add(slotsKey(silhouetteSlots(crewOf(a), base)));
    }
    expect(keys.size).toBeGreaterThan(1);
    const a = agent(3, 'a');
    expect(slotsKey(silhouetteSlots(crewOf(a), base))).toBe(
      slotsKey(silhouetteSlots(crewOf(a), base)),
    );
  });

  it('never exceeds the instance capacity', () => {
    const base = oneHab(0, false);
    const many = Array.from({ length: 24 }, (_, i) => agent(i, 'a'));
    expect(silhouetteSlots(crewOf(...many), base).length).toBeLessThanOrEqual(FIGURE_CAPACITY);
  });
});
