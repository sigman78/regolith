import { describe, expect, it } from 'vitest';
import { SOLAR_COLS, SOLAR_ROWS } from '@/geometry/design-constants';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument } from '@/world/document';
import { getPart } from '../registry';
import { solarDepth, solarPostXs, solarWidth } from '../solar-layout';
import { pressVolume } from '../volume';

const FLAT: SolverWorld = { halfSize: 64, heightAt: () => 0 };

const hab = {
  id: 'h',
  letter: 'H' as const,
  params: { length: 10, radius: 2 },
  pose: { x: 0, z: 0, yaw: 0 as const },
};

describe('letter A, the airlock', () => {
  it('docks to a hab flank and joins the press graph', () => {
    let doc = addPart(createDocument({ seed: 'a' }), hab);
    // The first side port is at (x, z) = (-2, 2); the lock's PRESS end sits 3 m out from the axis.
    doc = addPart(doc, {
      id: 'a',
      letter: 'A',
      params: { radius: 2 },
      pose: { x: -2, z: 5, yaw: 270 },
    });
    const base = solve(doc, FLAT, { diagnose: true });
    expect(base.diagnostics).toEqual([]);
    expect([...base.tubes.values()].some((t) => t.kind === 'dock')).toBe(true);
    expect(base.graph.nodes.has('a')).toBe(true);
    expect(base.graph.edges.length).toBeGreaterThan(0);
    expect(base.parts.get('a')?.ports.some((p) => p.type === 'EXT')).toBe(true);
  });

  it('holds air (a little) and stands on two feet', () => {
    expect(pressVolume('A', { radius: 2 })).toBeGreaterThan(0);
    expect(pressVolume('A', { radius: 3 })).toBeGreaterThan(pressVolume('A', { radius: 2 }));
    const part = getPart('A');
    const p = part?.resolve({});
    expect(part?.ports(p ?? {}).filter((q) => q.type === 'STRUCT')).toHaveLength(2);
  });
});

describe('letter S, the solar array', () => {
  it('grows with its params, and posts stay under the panels', () => {
    for (let i = 1; i < SOLAR_COLS.length; i++) {
      expect(solarWidth(SOLAR_COLS[i] ?? 0)).toBeGreaterThan(solarWidth(SOLAR_COLS[i - 1] ?? 0));
    }
    for (let i = 1; i < SOLAR_ROWS.length; i++) {
      expect(solarDepth(SOLAR_ROWS[i] ?? 0)).toBeGreaterThan(solarDepth(SOLAR_ROWS[i - 1] ?? 0));
    }
    for (const cols of SOLAR_COLS) {
      for (const x of solarPostXs(cols)) expect(Math.abs(x)).toBeLessThan(solarWidth(cols) / 2);
    }
  });
});

describe('letter X, the light pole', () => {
  it('stands on one foot at every height', () => {
    for (const height of [3, 4, 6]) {
      let doc = createDocument({ seed: 'x' });
      doc = addPart(doc, {
        id: 'x',
        letter: 'X',
        params: { height },
        pose: { x: 3, z: 3, yaw: 0 },
      });
      const base = solve(doc, FLAT, { diagnose: true });
      expect(base.diagnostics).toEqual([]);
      expect(base.parts.get('x')?.legs).toHaveLength(1);
    }
  });

  it('holds no air, so no crew', () => {
    expect(pressVolume('X', { height: 4 })).toBe(0);
    expect(pressVolume('S', { rows: 2, cols: 6 })).toBe(0);
  });
});
