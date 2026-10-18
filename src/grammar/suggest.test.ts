import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { Rng } from '@/core/rng';
import { addLink, addPart, createDocument, type BaseDocument } from '@/world/document';
import { generateTerrain, heightAt } from '@/world/terrain';
import { allParts, getPart } from './registry';
import { canTakeTube, linkKey, solve, type Diagnostic, type SolverWorld } from './solver';
import { MAX_SUGGESTIONS, suggestLinks, type Suggestion } from './suggest';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function hab(doc: BaseDocument, id: string, x: number, z: number, yaw = 0): BaseDocument {
  return addPart(doc, {
    id,
    letter: 'H',
    params: { length: 8, radius: 2 },
    pose: { x, z, yaw: snapYaw(yaw) },
  });
}

const suggest = (doc: BaseDocument, id: string, world = FLAT): Suggestion[] =>
  suggestLinks(doc, solve(doc, world), id, world);

describe('suggestLinks', () => {
  it('offers the hatches that face each other across a gap, and says it joins two groups', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'a', -12, 0);
    doc = hab(doc, 'b', 12, 0);
    const [best] = suggest(doc, 'a');
    expect(best?.target).toBe('b');
    expect(best?.link.a).toEqual({ part: 'a', port: 'end+' });
    expect(best?.link.b).toEqual({ part: 'b', port: 'end-' });
    expect(best?.joinsComponents).toBe(true);
    expect(best?.length).toBeGreaterThan(10);
    expect(best?.tubes.length).toBeGreaterThan(0);
  });

  it('does not offer a port that is already used, nor a link to a part it is joined to for free', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'a', -12, 0);
    doc = hab(doc, 'b', 12, 0);
    doc = addLink(doc, {
      a: { part: 'a', port: 'end+' },
      b: { part: 'b', port: 'end-' },
      kind: 'tube',
    });
    for (const s of suggest(doc, 'a')) {
      expect(s.link.a.port).not.toBe('end+');
      expect(s.link.b.port).not.toBe('end-');
      expect(s.joinsComponents).toBe(false);
    }
  });

  it('prefers joining a separate part over a second path to one already joined', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'a', 0, 0);
    doc = hab(doc, 'near', -16, 0);
    doc = hab(doc, 'far', 18, 0);
    doc = addLink(doc, {
      a: { part: 'a', port: 'end-' },
      b: { part: 'near', port: 'end+' },
      kind: 'tube',
    });
    const list = suggest(doc, 'a');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]?.target).toBe('far');
    expect(list[0]?.joinsComponents).toBe(true);
  });

  it('stays quiet when nothing is in reach', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'a', -40, 0);
    doc = hab(doc, 'b', 40, 0);
    expect(suggest(doc, 'a')).toEqual([]);
    expect(suggest(doc, 'nobody')).toEqual([]);
  });

  it('never offers a tube the router would have to force through a hull', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'a', -12, 0);
    doc = hab(doc, 'b', 12, 0);
    doc = hab(doc, 'wall', 0, 0, 90);
    for (const s of suggest(doc, 'a')) {
      const base = solve(addLink(doc, s.link), FLAT);
      expect(base.diagnostics.filter((d) => d.kind === 'tube-unroutable')).toEqual([]);
    }
  });
});

// ---- Property: an accepted suggestion is always clean --------------------------------------

function terrain(seed: string): SolverWorld {
  const hf = generateTerrain({ seed, size: 96 });
  return { halfSize: 48, heightAt: (x, z) => heightAt(hf, x, z) };
}

const LETTERS = allParts().map((d) => d.letter);

function randomBase(seed: number): BaseDocument {
  const rng = new Rng(seed);
  let doc = createDocument({ seed: `s${seed}` });
  for (let i = 0; i < 14; i++) {
    const letter = rng.pick(LETTERS);
    const params = Object.fromEntries(
      Object.entries(getPart(letter)?.schema ?? {}).map(([k, spec]) => [
        k,
        spec.kind === 'range'
          ? spec.min + spec.step * rng.int(0, Math.round((spec.max - spec.min) / spec.step))
          : spec.kind === 'choice'
            ? rng.pick(spec.options)
            : spec.default,
      ]),
    );
    doc = addPart(doc, {
      id: `p${i}`,
      letter,
      params,
      pose: { x: rng.range(-20, 20), z: rng.range(-20, 20), yaw: snapYaw(45 * rng.int(0, 7)) },
    });
  }
  return doc;
}

const kinds = (list: Diagnostic[]) =>
  list.filter(
    (d) => d.kind === 'link-skipped' || d.kind === 'tube-unroutable' || d.kind === 'tube-too-long',
  );
const invariants = (list: Diagnostic[]) => list.filter((d) => d.kind === 'invariant');

describe('suggestLinks on random bases', () => {
  for (const [name, world] of [
    ['flat ground', FLAT],
    ['rough terrain', terrain('suggest')],
  ] as const) {
    it(`accepting any suggestion adds no broken link or invariant (${name})`, () => {
      let checked = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const doc = randomBase(seed);
        const base = solve(doc, world);
        const before = solve(doc, world, { diagnose: true });
        for (const part of [...base.parts.values()].filter((p) => !p.derived).slice(0, 8)) {
          const list = suggestLinks(doc, base, part.id, world);
          expect(list.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
          expect(new Set(list.map((s) => s.target)).size).toBe(list.length);
          for (const s of list) {
            const after = solve(addLink(doc, s.link), world, { diagnose: true });
            expect(kinds(after.diagnostics)).toHaveLength(kinds(before.diagnostics).length);
            expect(invariants(after.diagnostics)).toHaveLength(
              invariants(before.diagnostics).length,
            );
            expect(after.usedPorts.has(`${s.link.a.part}/${s.link.a.port}`)).toBe(true);
            expect(after.tubes.has(s.tubes[0]?.id ?? '')).toBe(true);
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(10);
    });
  }

  it('ranks groups first, then cost, and gives the same answer twice', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const doc = randomBase(seed);
      const base = solve(doc, FLAT);
      for (const part of [...base.parts.values()].slice(0, 6)) {
        const a = suggestLinks(doc, base, part.id, FLAT);
        const b = suggestLinks(doc, base, part.id, FLAT);
        expect(a.map((s) => linkKey(s.link))).toEqual(b.map((s) => linkKey(s.link)));
        // A second path between parts that are already joined is only offered when it needs no node.
        for (const s of a) if (!s.joinsComponents) expect(s.nodes).toBe(0);
        const joins = a.map((s) => s.joinsComponents);
        expect(joins).toEqual([...joins].sort((x, y) => Number(y) - Number(x)));
      }
    }
  });

  it('only pairs ports a tube can leave from', () => {
    const doc = randomBase(3);
    const base = solve(doc, FLAT);
    for (const part of base.parts.values()) {
      for (const s of suggestLinks(doc, base, part.id, FLAT)) {
        for (const end of [s.link.a, s.link.b]) {
          const port = base.parts.get(end.part)?.ports.find((p) => p.id === end.port);
          expect(port && canTakeTube(port)).toBe(true);
        }
      }
    }
  });
});

describe('suggestLinks on a slope', () => {
  const HILL: SolverWorld = {
    halfSize: 48,
    heightAt: (x) => Math.max(0, Math.min(8, (x - 6) * 0.9)),
  };

  it('still offers a steep corridor, flagged, and ranks it behind a level one', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'a', -8, 0);
    doc = hab(doc, 'up', 20, 0);
    doc = hab(doc, 'level', -8, 22);
    const list = suggest(doc, 'a', HILL);
    const up = list.find((s) => s.target === 'up');
    const level = list.find((s) => s.target === 'level');
    expect(up?.steep).toBe(true);
    expect(level?.steep).toBe(false);
    expect(list.indexOf(level as Suggestion)).toBeLessThan(list.indexOf(up as Suggestion));
  });

  it('flags nothing on level ground', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'a', -12, 0);
    doc = hab(doc, 'b', 12, 0);
    expect(suggest(doc, 'a').every((s) => !s.steep)).toBe(true);
  });
});
