import { describe, expect, it } from 'vitest';
import { FOOT_SINK } from '@/geometry/design-constants';
import { rotateY, snapYaw } from '@/core/math';
import { Rng } from '@/core/rng';
import { addLink, addPart, createDocument, type BaseDocument } from '@/world/document';
import { polygonGap, rectCorners } from '../footprint';
import { allParts, getPart } from '../registry';
import { solve, type ResolvedPart, type SolverWorld } from './index';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

describe('tower in the solver', () => {
  it('stands on four legs that end in the terrain', () => {
    const doc = addPart(createDocument({ seed: 's' }), {
      id: 't',
      letter: 'V',
      params: { floors: 4 },
      pose: { x: 0, z: 0, yaw: 0 },
    });
    const tower = solve(doc, FLAT).parts.get('t');
    expect(tower?.legs).toHaveLength(4);
    for (const leg of tower?.legs ?? []) expect(leg.bottom[1]).toBeCloseTo(-FOOT_SINK, 9);
  });

  it('takes a tube from an upper-floor port down to a hab, flagging only the climb', () => {
    let doc = createDocument({ seed: 's' });
    doc = addPart(doc, {
      id: 't',
      letter: 'V',
      params: { floors: 4 },
      pose: { x: 0, z: 0, yaw: 0 },
    });
    doc = addPart(doc, {
      id: 'h',
      letter: 'H',
      params: { length: 8, radius: 2 },
      pose: { x: 18, z: 0, yaw: 0 },
    });
    doc = addLink(doc, {
      a: { part: 't', port: 'f1-0' },
      b: { part: 'h', port: 'end-' },
      kind: 'tube',
    });
    const base = solve(doc, FLAT);
    expect([...base.tubes.keys()].some((k) => k.startsWith('tube:'))).toBe(true);
    // The tube comes down three metres: a steep corridor is flagged, never refused (P1).
    expect(
      base.diagnostics.filter((d) => d.kind !== 'moved' && d.kind !== 'corridor-steep'),
    ).toEqual([]);
    // Every tube support leg ends on the ground.
    for (const tube of base.tubes.values()) {
      for (const leg of tube.legs) expect(leg.bottom[1]).toBeCloseTo(-FOOT_SINK, 9);
    }
  });
});

describe('every letter together', () => {
  const LETTERS = allParts().map((d) => d.letter);

  /** The footprint as a polygon (discs as inscribed 24-gons, so gaps are never overestimated). */
  function outline(part: ResolvedPart): [number, number][] {
    const fp = part.footprint;
    if (fp.kind === 'rect') return rectCorners(fp.hx, fp.hz, part.pose);
    return Array.from({ length: 24 }, (_, i) => {
      const a = (i * Math.PI * 2) / 24;
      return [part.pose.x + Math.cos(a) * fp.r, part.pose.z + Math.sin(a) * fp.r];
    });
  }

  function mixedBase(seed: number): BaseDocument {
    const rng = new Rng(seed);
    let doc = createDocument({ seed: `mix${seed}` });
    for (let i = 0; i < 24; i++) {
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
        pose: {
          x: rng.range(-30, 30),
          z: rng.range(-30, 30),
          yaw: snapYaw(45 * rng.int(0, 7)),
        },
      });
    }
    return doc;
  }

  it('resolves a random mixed base with no unplaceable parts and no overlaps outside slabs', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const base = solve(mixedBase(seed), FLAT);
      expect(base.diagnostics.filter((d) => d.kind === 'unplaceable')).toEqual([]);
      const solid = [...base.parts.values()].filter((p) => p.letter !== 'P');
      for (let i = 0; i < solid.length; i++) {
        for (let j = i + 1; j < solid.length; j++) {
          const a = solid[i];
          const b = solid[j];
          if (!a || !b) continue;
          expect(polygonGap(outline(a), outline(b))).toBeGreaterThanOrEqual(-1e-9);
        }
      }
    }
  });

  it('gives every part with STRUCT ports one leg each, ending on ground or a slab top', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const base = solve(mixedBase(seed), FLAT);
      const slabs = [...base.parts.values()].filter((p) => p.letter === 'P');
      for (const part of base.parts.values()) {
        expect(part.legs).toHaveLength(part.ports.filter((q) => q.type === 'STRUCT').length);
        for (const leg of part.legs) {
          const onSlab =
            part.letter !== 'P' &&
            slabs.some((s) => {
              if (s.footprint.kind !== 'rect') return false;
              const [lx, , lz] = rotateY(
                [leg.bottom[0] - s.pose.x, 0, leg.bottom[2] - s.pose.z],
                -s.pose.yaw,
              );
              return Math.abs(lx) <= s.footprint.hx && Math.abs(lz) <= s.footprint.hz;
            });
          if (!onSlab) expect(leg.bottom[1]).toBeCloseTo(-FOOT_SINK, 9);
          else expect(leg.bottom[1]).toBeGreaterThan(-FOOT_SINK - 1e-9);
          expect(leg.top[1]).toBeGreaterThan(leg.bottom[1]);
        }
      }
    }
  });

  it('is deterministic for a mixed base', () => {
    const a = solve(mixedBase(3), FLAT);
    const b = solve(mixedBase(3), FLAT);
    expect([...a.parts.values()].map((p) => [p.id, p.pose, p.recipeHash])).toEqual(
      [...b.parts.values()].map((p) => [p.id, p.pose, p.recipeHash]),
    );
  });
});
