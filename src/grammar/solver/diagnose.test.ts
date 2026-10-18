import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { Rng } from '@/core/rng';
import { addLink, addPart, createDocument, type BaseDocument } from '@/world/document';
import { generateTerrain, heightAt } from '@/world/terrain';
import { allParts, getPart } from '../registry';
import { diagnose } from './diagnose';
import { canTakeTube, solve, type Diagnostic, type SolverWorld } from './index';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function terrain(seed: string): SolverWorld {
  const hf = generateTerrain({ seed, size: 96 });
  return { halfSize: 48, heightAt: (x, z) => heightAt(hf, x, z) };
}

const LETTERS = allParts().map((d) => d.letter);

/** A random mixed base with random tube links between free, usable ports. */
function linkedBase(seed: number, world: SolverWorld): BaseDocument {
  const rng = new Rng(seed);
  let doc = createDocument({ seed: `d${seed}` });
  for (let i = 0; i < 22; i++) {
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
      pose: { x: rng.range(-34, 34), z: rng.range(-34, 34), yaw: snapYaw(45 * rng.int(0, 7)) },
    });
  }
  // Resolve once to learn the real ports, then link random pairs of them.
  const first = solve(doc, world);
  const free = [...first.parts.values()]
    .filter((p) => !p.derived)
    .flatMap((p) => p.ports.filter(canTakeTube).map((q) => ({ part: p.id, port: q.id })));
  const used = new Set<string>();
  for (let n = 0; n < 16 && free.length > 1; n++) {
    const a = rng.pick(free);
    const b = rng.pick(free);
    const ka = `${a.part}/${a.port}`;
    const kb = `${b.part}/${b.port}`;
    if (a.part === b.part || used.has(ka) || used.has(kb)) continue;
    used.add(ka);
    used.add(kb);
    doc = addLink(doc, { a, b, kind: 'tube' });
  }
  return doc;
}

const invariants = (diag: Diagnostic[]) => diag.filter((d) => d.kind === 'invariant');

describe('diagnose: random mixed bases with links', () => {
  it('finds no violation on flat ground or rough terrain', () => {
    let tubes = 0;
    let nodes = 0;
    let towerOrDomeLinks = 0;
    for (let seed = 1; seed <= 25; seed++) {
      for (const world of [FLAT, terrain(`rough${seed}`)]) {
        const doc = linkedBase(seed, world);
        const base = solve(doc, world, { diagnose: true });
        expect(invariants(base.diagnostics)).toEqual([]);
        tubes += [...base.tubes.values()].filter((t) => t.kind === 'tube').length;
        nodes += [...base.parts.values()].filter((p) => p.derived).length;
        towerOrDomeLinks += doc.links.filter((l) =>
          [l.a.part, l.b.part].some((id) => ['V', 'D'].includes(doc.parts[id]?.letter ?? '')),
        ).length;
      }
    }
    // The property is only meaningful if the generator really made tubes, nodes and
    // links to the taller and rounder letters.
    expect(tubes).toBeGreaterThan(60);
    expect(nodes).toBeGreaterThan(5);
    expect(towerOrDomeLinks).toBeGreaterThan(10);
  }, 60_000);

  it('still holds while a part is being dragged', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const doc = linkedBase(seed, FLAT);
      const id = Object.keys(doc.parts)[seed % 20] ?? 'p0';
      const base = solve(doc, FLAT, { movingId: id, diagnose: true });
      expect(invariants(base.diagnostics)).toEqual([]);
    }
  }, 30_000);

  it('is off by default, so the hot path pays nothing', () => {
    const doc = linkedBase(3, FLAT);
    expect(solve(doc, FLAT).diagnostics.some((d) => d.kind === 'invariant')).toBe(false);
  });
});

describe('diagnose: it really detects each broken rule', () => {
  function twoHabsLinked() {
    let doc = createDocument({ seed: 'x' });
    doc = addPart(doc, { id: 'a', letter: 'H', pose: { x: -16, z: 0, yaw: 0 } });
    doc = addPart(doc, { id: 'b', letter: 'H', pose: { x: 16, z: 0, yaw: 0 } });
    doc = addLink(doc, {
      a: { part: 'a', port: 'end+' },
      b: { part: 'b', port: 'end-' },
      kind: 'tube',
    });
    return { doc, base: solve(doc, FLAT) };
  }
  const rules = (doc: BaseDocument, base: ReturnType<typeof solve>) =>
    diagnose(doc, base, { terrain: FLAT, surface: FLAT }).flatMap((d) =>
      d.kind === 'invariant' ? [d.rule] : [],
    );

  it('is quiet on a healthy base', () => {
    const { doc, base } = twoHabsLinked();
    expect(rules(doc, base)).toEqual([]);
  });

  it('flags overlapping hulls', () => {
    const { doc, base } = twoHabsLinked();
    const a = base.parts.get('a');
    const b = base.parts.get('b');
    if (a && b) b.pose = { ...b.pose, x: a.pose.x, z: a.pose.z };
    expect(rules(doc, base)).toContain('hull-gap');
  });

  it('flags a floating foot', () => {
    const { doc, base } = twoHabsLinked();
    const leg = base.parts.get('a')?.legs[0];
    if (leg) leg.bottom = [leg.bottom[0], leg.bottom[1] + 0.5, leg.bottom[2]];
    expect(rules(doc, base)).toContain('stands-on-something');
  });

  it('flags a tube with a free end', () => {
    const { doc, base } = twoHabsLinked();
    const tube = [...base.tubes.values()].find((t) => t.kind === 'tube');
    if (tube) tube.path = [[tube.path[0]?.[0] ?? 0, 9, 0], ...tube.path.slice(1)];
    expect(rules(doc, base)).toContain('tube-free-end');
  });

  it('flags a tube through a hull it is not attached to', () => {
    const doc = addPart(twoHabsLinked().doc, {
      id: 'wall',
      letter: 'H',
      pose: { x: 0, z: 0, yaw: 90 },
    });
    const base = solve(doc, FLAT);
    // Drag the routed tube straight through the wall.
    const tube = [...base.tubes.values()].find((t) => t.kind === 'tube');
    if (tube)
      tube.path = [
        [-12, 2, 0],
        [12, 2, 0],
      ];
    expect(rules(doc, base)).toContain('tube-crosses-hull');
  });

  it('flags a repeated stencil number', () => {
    const { doc, base } = twoHabsLinked();
    const parts = doc.parts as Record<string, { serial: number }>;
    const a = parts['a'];
    const b = parts['b'];
    if (a && b) (b as { serial: number }).serial = a.serial;
    expect(rules(doc, base)).toContain('unique-serial');
  });
});
