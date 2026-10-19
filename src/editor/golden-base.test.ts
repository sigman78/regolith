import { describe, expect, it } from 'vitest';
import { DECK_HEIGHT } from '@/geometry/design-constants';
import { graphComponents, solve, type SolverWorld } from '@/grammar/solver';
import { navOf, route, stepPolyline } from '@/sim/nav';
import { addLink, addPart, createDocument } from '@/world/document';
import { goldenBase } from './golden-base';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

describe('golden base', () => {
  it('resolves cleanly: every part stays put, every link becomes a tube, no invariant breaks', () => {
    const g = goldenBase();
    let doc = createDocument({ seed: 'golden' });
    for (const p of g.parts) doc = addPart(doc, p);
    for (const l of g.links) doc = addLink(doc, l);
    const base = solve(doc, FLAT, { diagnose: true });
    expect(base.diagnostics).toEqual([]);
    expect([...base.tubes.values()].filter((t) => t.kind === 'tube').length).toBeGreaterThanOrEqual(
      g.links.length,
    );
    for (const p of g.parts) expect(base.parts.has(p.id)).toBe(true);
  });
});

describe('golden base on the level (M3.5 stage 0)', () => {
  const resolved = (): ReturnType<typeof solve> => {
    const g = goldenBase();
    let doc = createDocument({ seed: 'golden' });
    for (const p of g.parts) doc = addPart(doc, p);
    for (const l of g.links) doc = addLink(doc, l);
    return solve(doc, FLAT, { diagnose: true });
  };

  it('keeps its one dock and turns no link into one, now that sills meet', () => {
    const base = resolved();
    const docks = [...base.tubes.values()].filter((t) => t.kind === 'dock').map((t) => t.id);
    expect(docks).toEqual(['dock:g-hab-e/side-0~g-lock/end-']);
    expect([...base.tubes.values()].filter((t) => t.kind === 'tube')).toHaveLength(
      goldenBase().links.length,
    );
  });

  it('is level: every pipe stands a radius over the deck, every walk stays on the floor', () => {
    const base = resolved();
    for (const t of base.tubes.values()) {
      for (const p of t.path) expect(p[1]).toBeCloseTo(DECK_HEIGHT, 9);
    }
    for (const e of base.graph.edges) {
      for (const p of e.path) expect(p[1]).toBeCloseTo(DECK_HEIGHT, 9);
    }
    for (const node of base.graph.nodes.values()) {
      expect(node.centre[1], node.id).toBeCloseTo(DECK_HEIGHT, 9);
      // The tower's upper floors are higher; every other door is on the deck.
      for (const [id, p] of node.ports) {
        if (node.letter === 'V' && id.startsWith('f')) continue;
        expect(p[1]).toBeCloseTo(DECK_HEIGHT, 9);
      }
    }
  });
});

describe('golden base walks (M3.5 stage 0)', () => {
  it('has a route between every pair of nodes it had before, and no step leaves the floor', () => {
    const g = goldenBase();
    let doc = createDocument({ seed: 'golden' });
    for (const p of g.parts) doc = addPart(doc, p);
    for (const l of g.links) doc = addLink(doc, l);
    const base = solve(doc, FLAT);
    const nav = navOf(base.graph);
    const groups = graphComponents(base.graph);
    const ids = [...base.graph.nodes.keys()];
    let pairs = 0;
    for (const a of ids) {
      for (const b of ids) {
        if (a === b || groups.get(a) !== groups.get(b)) continue;
        const steps = route(nav, a, b);
        expect(steps).not.toBeNull();
        pairs++;
        for (const step of steps ?? []) {
          // The tower's stairs are not modelled; every other step is level.
          const touchesTower = step.k === 'node' && step.node === 'g-tower';
          if (touchesTower) continue;
          for (const p of stepPolyline(nav, step) ?? []) expect(p[1]).toBeCloseTo(DECK_HEIGHT, 9);
        }
      }
    }
    expect(pairs).toBeGreaterThan(20);
  });
});

describe('golden base, flipped', () => {
  it('still resolves with no invariant broken when every other part is mirrored', () => {
    const g = goldenBase();
    let doc = createDocument({ seed: 'golden' });
    g.parts.forEach((p, i) => {
      doc = addPart(doc, i % 2 === 0 ? { ...p, pose: { ...p.pose, mirror: true as const } } : p);
    });
    for (const l of g.links) doc = addLink(doc, l);
    const base = solve(doc, FLAT, { diagnose: true });
    expect(base.diagnostics.filter((d) => d.kind === 'invariant')).toEqual([]);
    expect(base.parts.size).toBeGreaterThanOrEqual(g.parts.length);
    expect([...base.parts.values()].filter((p) => p.pose.mirror).length).toBe(
      Math.ceil(g.parts.length / 2),
    );
  });
});
