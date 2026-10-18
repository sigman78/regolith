import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { addLink, addPart, createDocument, removePart, type BaseDocument } from '@/world/document';
import { solve, type PressGraph, type SolverWorld } from '@/grammar/solver';
import { CREW_MAX } from '@/geometry/design-constants';
import { CREW_STRIDE, crewCount, crewPoints, emptyCrew, stepCrew } from './crew';
import { navOf, polylineLength, route, sampleAlong, stepPolyline } from './nav';

const FLAT: SolverWorld = { halfSize: 64, heightAt: () => 0 };

const hab = (id: string, x: number, z = 0, length = 8) => ({
  id,
  letter: 'H' as const,
  params: { length, radius: 2 },
  pose: { x, z, yaw: snapYaw(0) },
});

function base(n = 3): BaseDocument {
  let doc = createDocument({ seed: 'crew' });
  for (let i = 0; i < n; i++) doc = addPart(doc, hab(`h${i}`, -30 + i * 20));
  for (let i = 0; i + 1 < n; i++) {
    doc = addLink(doc, {
      a: { part: `h${i}`, port: 'end+' },
      b: { part: `h${i + 1}`, port: 'end-' },
      kind: 'tube',
    });
  }
  return doc;
}

const graphOf = (doc: BaseDocument): PressGraph => solve(doc, FLAT).graph;

function run(doc: BaseDocument, ticks: number, hour = 9) {
  const graph = graphOf(doc);
  const crew = emptyCrew();
  for (let t = 0; t < ticks; t++) stepCrew(crew, graph, doc.seed, t, hour);
  return { crew, graph };
}

describe('crew count', () => {
  it('is floor(volume / 60), capped', () => {
    expect(crewCount(graphOf(base(1)))).toBe(2);
    expect(crewCount(graphOf(createDocument({ seed: 'e' })))).toBe(0);
    let doc = createDocument({ seed: 'big' });
    for (let i = 0; i < 30; i++)
      doc = addPart(doc, hab(`h${i}`, -50 + (i % 6) * 20, -50 + Math.floor(i / 6) * 20));
    expect(crewCount(graphOf(doc))).toBe(CREW_MAX);
  });
});

describe('nav', () => {
  it('routes between linked habs and not between separate ones', () => {
    const graph = graphOf(base(3));
    const nav = navOf(graph);
    const r = route(nav, 'h0', 'h2');
    expect(r).not.toBeNull();
    expect((r ?? []).length).toBeGreaterThan(0);
    for (const st of r ?? []) expect(stepPolyline(nav, st)).not.toBeNull();
    expect(route(nav, 'h0', 'h0')).toEqual([]);
    expect(route(nav, 'h0', 'nope')).toBeNull();
    const split = graphOf(addPart(base(1), hab('far', 40, 40)));
    expect(route(navOf(split), 'h0', 'far')).toBeNull();
  });

  it('samples a polyline by arc length', () => {
    const poly: [number, number, number][] = [
      [0, 0, 0],
      [4, 0, 0],
      [4, 0, 3],
    ];
    expect(polylineLength(poly)).toBeCloseTo(7, 9);
    expect(sampleAlong(poly, 2).point).toEqual([2, 0, 0]);
    expect(sampleAlong(poly, 5.5).point[2]).toBeCloseTo(1.5, 9);
    expect(sampleAlong(poly, 99).point).toEqual([4, 0, 3]);
  });
});

describe('crew walk', () => {
  it('is byte-identical for the same base, seed and ticks', () => {
    const a = run(base(), 600);
    const b = run(base(), 600);
    expect(Array.from(crewPoints(a.crew, a.graph))).toEqual(
      Array.from(crewPoints(b.crew, b.graph)),
    );
    expect(JSON.stringify(a.crew.agents)).toBe(JSON.stringify(b.crew.agents));
  });

  it('moves, and every agent stays on the graph', () => {
    const doc = base();
    const graph = graphOf(doc);
    const nav = navOf(graph);
    const crew = emptyCrew();
    let moved = 0;
    for (let t = 0; t < 1500; t++) {
      stepCrew(crew, graph, doc.seed, t, 9);
      for (const a of crew.agents) {
        const st = a.route[a.step];
        if (!st) continue;
        moved++;
        const poly = stepPolyline(nav, st);
        expect(poly).not.toBeNull();
        expect(a.s).toBeGreaterThanOrEqual(0);
        expect(a.s).toBeLessThanOrEqual(polylineLength(poly ?? []) + 1e-6);
      }
    }
    expect(crew.agents.length).toBeGreaterThan(0);
    expect(moved).toBeGreaterThan(0);
    const pts = crewPoints(crew, graph);
    expect(pts.length).toBe(crew.agents.length * CREW_STRIDE);
    for (const v of pts) expect(Number.isFinite(v)).toBe(true);
  });

  it('walks at the set speed', () => {
    const doc = base();
    const graph = graphOf(doc);
    const crew = emptyCrew();
    let prev: Float32Array | null = null;
    let worst = 0;
    for (let t = 0; t < 800; t++) {
      stepCrew(crew, graph, doc.seed, t, 9);
      const p = crewPoints(crew, graph);
      if (prev && prev.length === p.length) {
        for (let i = 0; i < p.length; i += CREW_STRIDE) {
          const d = Math.hypot(
            (p[i] ?? 0) - (prev[i] ?? 0),
            (p[i + 1] ?? 0) - (prev[i + 1] ?? 0),
            (p[i + 2] ?? 0) - (prev[i + 2] ?? 0),
          );
          worst = Math.max(worst, d);
        }
      }
      prev = Float32Array.from(p);
    }
    // 1.4 m/s at 10 Hz is 0.14 m a tick; a corner may cut a little.
    expect(worst).toBeLessThanOrEqual(0.14 + 1e-3);
  });

  it('survives a part being deleted or moved under it', () => {
    const doc = base(3);
    const g1 = graphOf(doc);
    const crew = emptyCrew();
    for (let t = 0; t < 400; t++) stepCrew(crew, g1, doc.seed, t, 9);
    const cut = removePart(doc, 'h1');
    const g2 = graphOf(cut);
    for (let t = 400; t < 900; t++) {
      stepCrew(crew, g2, doc.seed, t, 9);
      for (const a of crew.agents) {
        expect(g2.nodes.has(a.at)).toBe(true);
        expect(g2.nodes.has(a.home)).toBe(true);
      }
    }
    for (const v of crewPoints(crew, g2)) expect(Number.isFinite(v)).toBe(true);
    // Everyone gone: no agents, no crash.
    const g3 = graphOf(createDocument({ seed: 'crew' }));
    stepCrew(crew, g3, doc.seed, 901, 9);
    expect(crew.agents).toHaveLength(0);
    expect(crewPoints(crew, g3)).toHaveLength(0);
  });

  it('replans errands when the sol hour changes', () => {
    const doc = base();
    const graph = graphOf(doc);
    const crew = emptyCrew();
    stepCrew(crew, graph, doc.seed, 0, 9.0);
    const first = crew.agents.map((a) => a.stopsHour);
    for (let t = 1; t < 3000; t++) stepCrew(crew, graph, doc.seed, t, 10.2);
    const second = crew.agents.map((a) => a.stopsHour);
    expect(first.every((h) => h === 9)).toBe(true);
    expect(second.every((h) => h === 10)).toBe(true);
  });
});
