import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/core/math';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addLink, addPart, createDocument } from '@/world/document';
import { CENTRE, navOf, polylineLength, route, stepPolyline } from './nav';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function pair(linked: boolean) {
  let doc = createDocument({ seed: 'nav' });
  doc = addPart(doc, {
    id: 'a',
    letter: 'H',
    params: { length: 8, radius: 2 },
    pose: { x: -12, z: 0, yaw: 0 },
  });
  doc = addPart(doc, {
    id: 'b',
    letter: 'H',
    params: { length: 8, radius: 2 },
    pose: { x: 12, z: 0, yaw: 0 },
  });
  if (linked) {
    doc = addLink(doc, {
      a: { part: 'a', port: 'end+' },
      b: { part: 'b', port: 'end-' },
      kind: 'tube',
    });
  }
  return solve(doc, FLAT);
}

const dist = (p: Vec3, q: Vec3): number => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);

describe('nav', () => {
  it('walks centre to centre through the doors and the corridor, each step joining the next', () => {
    const base = pair(true);
    const nav = navOf(base.graph);
    const steps = route(nav, 'a', 'b');
    expect(steps?.map((s) => s.k)).toEqual(['node', 'edge', 'node']);
    expect(steps?.[0]).toEqual({ k: 'node', node: 'a', from: CENTRE, to: 'end+' });
    let prev: Vec3 | null = null;
    let length = 0;
    for (const s of steps ?? []) {
      const poly = stepPolyline(nav, s);
      expect(poly).not.toBeNull();
      if (!poly) continue;
      const first = poly[0];
      if (prev && first) expect(dist(prev, first)).toBeLessThan(1e-6);
      prev = poly[poly.length - 1] ?? null;
      length += polylineLength(poly);
    }
    // Two half habs, two doors and a corridor: at least the 24 m between the centres.
    expect(length).toBeGreaterThan(24);
  });

  it('finds no route between parts that are not joined, and an empty one to itself', () => {
    const nav = navOf(pair(false).graph);
    expect(route(nav, 'a', 'b')).toBeNull();
    expect(route(nav, 'a', 'a')).toEqual([]);
    expect(route(nav, 'a', 'nobody')).toBeNull();
  });

  it('is built once per graph and reports a vanished piece as null', () => {
    const base = pair(true);
    expect(navOf(base.graph)).toBe(navOf(base.graph));
    expect(stepPolyline(navOf(base.graph), { k: 'edge', edge: 'gone', dir: 1 })).toBeNull();
    expect(
      stepPolyline(navOf(base.graph), { k: 'node', node: 'a', from: CENTRE, to: 'no-port' }),
    ).toBeNull();
  });
});
