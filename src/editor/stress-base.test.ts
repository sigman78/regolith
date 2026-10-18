import { describe, expect, it } from 'vitest';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument } from '@/world/document';
import { stressBase } from './stress-base';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

describe('stress base', () => {
  it('places 200 parts, all of them, deterministically', () => {
    const parts = stressBase(200);
    expect(parts).toHaveLength(200);
    expect(stressBase(200)).toEqual(parts);
    let doc = createDocument({ seed: 'stress' });
    for (const p of parts) doc = addPart(doc, p);
    const base = solve(doc, FLAT);
    expect(base.parts.size).toBe(200);
    expect(base.diagnostics.filter((d) => d.kind === 'unplaceable')).toEqual([]);
  });
});
