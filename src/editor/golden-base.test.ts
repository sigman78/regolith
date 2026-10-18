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
