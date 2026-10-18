import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { Rng } from '@/core/rng';
import { CREW_VOLUME, DECK_HEIGHT } from '@/geometry/design-constants';
import { addLink, addPart, createDocument, type BaseDocument } from '@/world/document';
import { crossLength, graphComponents, solve, type SolverWorld } from './index';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

const hab = (id: string, x: number, z = 0, yaw = 0, length = 8) => ({
  id,
  letter: 'H' as const,
  params: { length, radius: 2 },
  pose: { x, z, yaw: snapYaw(yaw) },
});

function linked(): BaseDocument {
  let doc = createDocument({ seed: 'g' });
  doc = addPart(doc, hab('a', -12));
  doc = addPart(doc, hab('b', 12));
  return addLink(doc, {
    a: { part: 'a', port: 'end+' },
    b: { part: 'b', port: 'end-' },
    kind: 'tube',
  });
}

describe('graph stage', () => {
  it('is empty for an empty base and for a lean solve', () => {
    expect(solve(createDocument({ seed: 'g' }), FLAT).graph.nodes.size).toBe(0);
    const lean = solve(linked(), FLAT, { lean: true });
    expect(lean.graph.nodes.size).toBe(0);
    expect(lean.graph.edges).toHaveLength(0);
  });

  it('has a node per PRESS part and an edge per tube, at floor level', () => {
    const base = solve(linked(), FLAT);
    const g = base.graph;
    for (const id of ['a', 'b']) expect(g.nodes.has(id)).toBe(true);
    expect(base.tubes.size).toBeGreaterThan(0);
    expect(g.edges.length).toBe(base.tubes.size);
    const a = g.nodes.get('a');
    const part = base.parts.get('a');
    // The floor is one deck over the ground (flat at y = 0 here).
    expect(a?.centre[1]).toBeCloseTo(DECK_HEIGHT, 9);
    expect(part).toBeDefined();
    for (const e of g.edges) {
      expect(e.length).toBeGreaterThan(0);
      expect(e.path.length).toBeGreaterThanOrEqual(2);
    }
    // Every edge endpoint is a real port of a real node.
    for (const e of g.edges) {
      expect(g.nodes.get(e.a.part)?.ports.has(e.a.port)).toBe(true);
      expect(g.nodes.get(e.b.part)?.ports.has(e.b.port)).toBe(true);
    }
  });

  it('measures walking through a node as port to centre to port', () => {
    const node = solve(linked(), FLAT).graph.nodes.get('a');
    expect(node).toBeDefined();
    if (!node) return;
    const ids = [...node.ports.keys()];
    const [p, q] = [ids[0] ?? '', ids[1] ?? ''];
    expect(crossLength(node, p, p)).toBe(0);
    expect(crossLength(node, p, q)).toBeCloseTo(crossLength(node, q, p), 9);
    expect(crossLength(node, p, q)).toBeGreaterThan(0);
    expect(crossLength(node, p, 'nope')).toBe(Infinity);
  });

  it('puts docked habs in one component and a far hab in another', () => {
    let doc = createDocument({ seed: 'g' });
    doc = addPart(doc, hab('a', 0));
    doc = addPart(doc, hab('b', 9.2)); // end to end: docks
    doc = addPart(doc, hab('c', 40, 30));
    const base = solve(doc, FLAT);
    expect(base.tubes.size).toBeGreaterThan(0);
    const groups = graphComponents(base.graph);
    expect(groups.get('a')).toBe(groups.get('b'));
    expect(groups.get('c')).not.toBe(groups.get('a'));
  });

  it('includes solver-made nodes on a long tube, and stays one piece', () => {
    let doc = createDocument({ seed: 'g' });
    doc = addPart(doc, hab('a', -28));
    doc = addPart(doc, hab('b', 28));
    doc = addLink(doc, {
      a: { part: 'a', port: 'end+' },
      b: { part: 'b', port: 'end-' },
      kind: 'tube',
    });
    const base = solve(doc, FLAT);
    const derived = [...base.graph.nodes.values()].filter((n) => n.derived);
    expect(derived.length).toBeGreaterThan(0);
    const groups = graphComponents(base.graph);
    expect(new Set(groups.values()).size).toBe(1);
  });

  it('agrees with the tube topology on random bases, deterministically', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = new Rng(seed);
      let doc = createDocument({ seed: `r${seed}` });
      for (let i = 0; i < 8; i++) {
        doc = addPart(
          doc,
          hab(`h${i}`, rng.range(-30, 30), rng.range(-30, 30), 45 * rng.int(0, 7)),
        );
      }
      const one = solve(doc, FLAT).graph;
      const two = solve(doc, FLAT).graph;
      expect(JSON.stringify([...one.edges])).toBe(JSON.stringify([...two.edges]));
      // Union-find over the solved tubes gives the same grouping as the graph.
      const base = solve(doc, FLAT);
      const parent = new Map<string, string>();
      const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r && parent.has(r)) r = parent.get(r) ?? r;
        return r;
      };
      for (const id of base.graph.nodes.keys()) parent.set(id, id);
      for (const t of base.tubes.values()) parent.set(find(t.a.part), find(t.b.part));
      const groups = graphComponents(base.graph);
      const ids = [...base.graph.nodes.keys()];
      for (const a of ids) {
        for (const b of ids) {
          expect(find(a) === find(b)).toBe(groups.get(a) === groups.get(b));
        }
      }
    }
  });

  it('counts volume per part and so crew', () => {
    const base = solve(addPart(createDocument({ seed: 'g' }), hab('a', 0)), FLAT);
    const node = base.graph.nodes.get('a');
    expect(node?.volume).toBeCloseTo(Math.PI * 4 * 8 + (4 / 3) * Math.PI * 8, 6);
    expect(Math.floor((node?.volume ?? 0) / CREW_VOLUME)).toBe(2);
  });
});
