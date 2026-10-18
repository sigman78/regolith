import { describe, expect, it } from 'vitest';
import { solve, type SolverWorld } from '@/grammar/solver';
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
