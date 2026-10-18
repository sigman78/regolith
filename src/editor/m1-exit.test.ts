/**
 * The M1 exit criteria that can be checked headless (docs/PLAN.md, M1 Exit):
 * connect two habs ~20 m apart and get a routed tube (with a node when the way
 * is blocked or the span is long); drag a hab through another and watch it
 * resolve; build 30 parts and undo everything.
 */
import { describe, expect, it } from 'vitest';
import { cmd } from './commands';
import { DocumentStore } from './store';
import { addLink, addPart, createDocument, partList } from '@/world/document';
import { allParts } from '@/grammar/registry';
import { canTakeTube, solve, type ResolvedBase, type SolverWorld } from '@/grammar/solver';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

const tubesOf = (base: ResolvedBase) => [...base.tubes.values()].filter((t) => t.kind === 'tube');
const nodesOf = (base: ResolvedBase) => [...base.parts.values()].filter((p) => p.derived);
const invariants = (base: ResolvedBase) => base.diagnostics.filter((d) => d.kind === 'invariant');

/** Two habs end to end with their centres `ax`..`bx` apart, optionally a third across the way. */
function habs(ax: number, bx: number, wall = false) {
  let doc = createDocument({ seed: 'exit' });
  doc = addPart(doc, { id: 'a', letter: 'H', pose: { x: ax, z: 0, yaw: 0 } });
  doc = addPart(doc, { id: 'b', letter: 'H', pose: { x: bx, z: 0, yaw: 0 } });
  if (wall)
    doc = addPart(doc, { id: 'wall', letter: 'H', pose: { x: (ax + bx) / 2, z: 0, yaw: 90 } });
  return addLink(doc, {
    a: { part: 'a', port: 'end+' },
    b: { part: 'b', port: 'end-' },
    kind: 'tube',
  });
}

function portGap(base: ResolvedBase): number {
  const a = base.parts.get('a')?.ports.find((p) => p.id === 'end+');
  const b = base.parts.get('b')?.ports.find((p) => p.id === 'end-');
  return a && b ? b.position[0] - a.position[0] : NaN;
}

describe('M1 exit: connect two habs about 20 m apart', () => {
  it('is one plain tube when nothing is in the way (the span limit is 24 m)', () => {
    const base = solve(habs(-15, 15), FLAT, { diagnose: true });
    expect(portGap(base)).toBeGreaterThan(19);
    expect(portGap(base)).toBeLessThan(22);
    expect(tubesOf(base)).toHaveLength(1);
    expect(nodesOf(base)).toHaveLength(0);
    expect(base.diagnostics).toEqual([]);
  });

  it('routes around a part in the way and puts a node on the detour', () => {
    const base = solve(habs(-15, 15, true), FLAT, { diagnose: true });
    expect(portGap(base)).toBeLessThan(22);
    expect(nodesOf(base).length).toBeGreaterThanOrEqual(1);
    expect(tubesOf(base)).toHaveLength(nodesOf(base).length + 1);
    expect(invariants(base)).toEqual([]);
    expect(base.diagnostics.filter((d) => d.kind.startsWith('tube-'))).toEqual([]);
  });

  it('puts a node on a clear span longer than 24 m', () => {
    const base = solve(habs(-18, 18), FLAT, { diagnose: true });
    expect(portGap(base)).toBeGreaterThan(24);
    expect(nodesOf(base)).toHaveLength(1);
    expect(tubesOf(base)).toHaveLength(2);
    expect(invariants(base)).toEqual([]);
  });
});

describe('M1 exit: drag a hab through another', () => {
  it('resolves to a free spot, and one undo puts it back', () => {
    const store = new DocumentStore(createDocument({ seed: 'drag' }));
    store.execute(cmd.addPart({ id: 'a', letter: 'H', pose: { x: 0, z: 0, yaw: 0 } }));
    store.execute(cmd.addPart({ id: 'b', letter: 'H', pose: { x: 20, z: 0, yaw: 0 } }));
    const before = solve(store.doc, FLAT);

    store.beginGesture('Move');
    for (const x of [16, 10, 4, 1, 0]) {
      store.execute(cmd.setPose('b', { x, z: 0, yaw: 0 }));
      const live = solve(store.doc, FLAT, { movingId: 'b', diagnose: true });
      expect(invariants(live)).toEqual([]);
    }
    store.endGesture();

    const after = solve(store.doc, FLAT, { movingId: 'b', diagnose: true });
    expect(invariants(after)).toEqual([]);
    // The dragged part gives way; the one already standing there does not.
    expect(after.parts.get('a')?.pose).toEqual(before.parts.get('a')?.pose);
    const b = after.parts.get('b');
    expect(Math.hypot((b?.pose.x ?? 0) - 0, (b?.pose.z ?? 0) - 0)).toBeGreaterThan(5);
    expect(after.diagnostics.some((d) => d.kind === 'moved' && d.part === 'b')).toBe(true);

    expect(store.undo()).toBe(true);
    expect(store.doc.parts['b']?.pose.x).toBe(20);
  });
});

describe('M1 exit: a 30-part build and undo everything', () => {
  it('builds, stays valid, and undoes back to the empty document within the history cap', () => {
    const store = new DocumentStore(createDocument({ seed: 'thirty' }));
    const empty = store.doc;
    const letters = allParts().map((d) => d.letter);
    let steps = 0;
    for (let i = 0; i < 30; i++) {
      const letter = letters[i % letters.length] ?? 'H';
      store.execute(
        cmd.addPart({
          id: `p${i}`,
          letter,
          pose: { x: -40 + (i % 6) * 15, z: -35 + Math.floor(i / 6) * 15, yaw: 0 },
        }),
      );
      steps++;
    }
    // Link neighbouring parts (consecutive ids sit 15 m apart) through ports that can take a tube.
    const solved = solve(store.doc, FLAT);
    const free = (id: string) => solved.parts.get(id)?.ports.filter((p) => canTakeTube(p)) ?? [];
    for (let i = 0; i + 1 < 30 && store.doc.links.length < 8; i++) {
      const pa = free(`p${i}`)[0];
      const pb = free(`p${i + 1}`)[1] ?? free(`p${i + 1}`)[0];
      if (!pa || !pb || (i + 1) % 6 === 0) continue;
      store.execute(
        cmd.addLink({
          a: { part: `p${i}`, port: pa.id },
          b: { part: `p${i + 1}`, port: pb.id },
          kind: 'tube',
        }),
      );
      steps++;
    }
    store.execute(cmd.setParams('p0', { length: 12 }));
    store.beginGesture('Move');
    for (const x of [-30, -20, -10]) store.execute(cmd.setPose('p1', { x, z: -35, yaw: 0 }));
    store.endGesture();
    steps += 2;

    expect(partList(store.doc)).toHaveLength(30);
    expect(store.doc.links.length).toBeGreaterThanOrEqual(4);
    expect(tubesOf(solve(store.doc, FLAT)).length).toBeGreaterThanOrEqual(4);
    expect(steps).toBeLessThan(200);
    expect(invariants(solve(store.doc, FLAT, { diagnose: true }))).toEqual([]);

    let undone = 0;
    while (store.canUndo) {
      store.undo();
      undone++;
      expect(undone).toBeLessThanOrEqual(200);
    }
    expect(undone).toBe(steps);
    expect(store.doc).toBe(empty);
  });
});
