import { describe, expect, it } from 'vitest';
import { FOOT_SINK } from '@/geometry/design-constants';
import { addLink, addPart, createDocument } from '@/world/document';
import { solve, type SolverWorld } from './index';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

describe('tower in the solver', () => {
  it('stands on four legs that end in the terrain', () => {
    const doc = addPart(createDocument({ seed: 's' }), {
      id: 't',
      letter: 'V',
      params: { floors: 4 },
      pose: { x: 0, z: 0, yaw: 0 },
    });
    const tower = solve(doc, FLAT).parts.get('t');
    expect(tower?.legs).toHaveLength(4);
    for (const leg of tower?.legs ?? []) expect(leg.bottom[1]).toBeCloseTo(-FOOT_SINK, 9);
  });

  it('takes a tube from an upper-floor port down to a hab, without diagnostics', () => {
    let doc = createDocument({ seed: 's' });
    doc = addPart(doc, {
      id: 't',
      letter: 'V',
      params: { floors: 4 },
      pose: { x: 0, z: 0, yaw: 0 },
    });
    doc = addPart(doc, {
      id: 'h',
      letter: 'H',
      params: { length: 8, radius: 2 },
      pose: { x: 18, z: 0, yaw: 0 },
    });
    doc = addLink(doc, {
      a: { part: 't', port: 'f1-0' },
      b: { part: 'h', port: 'end-' },
      kind: 'tube',
    });
    const base = solve(doc, FLAT);
    expect([...base.tubes.keys()].some((k) => k.startsWith('tube:'))).toBe(true);
    expect(base.diagnostics.filter((d) => d.kind !== 'moved')).toEqual([]);
    // Every tube support leg ends on the ground.
    for (const tube of base.tubes.values()) {
      for (const leg of tube.legs) expect(leg.bottom[1]).toBeCloseTo(-FOOT_SINK, 9);
    }
  });
});
