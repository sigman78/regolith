import { describe, expect, it } from 'vitest';
import { rotateY, snapYaw } from '@/core/math';
import { Rng } from '@/core/rng';
import {
  FOOT_SINK,
  LEG_MIN_CLEARANCE,
  SLAB_THICK,
  CORRIDOR_FLOOR_THICK,
} from '@/geometry/design-constants';
import { addLink, addPart, createDocument, type BaseDocument } from '@/world/document';
import { generateTerrain, heightAt } from '@/world/terrain';
import { solve, type ResolvedBase, type SolverWorld } from './index';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function terrain(seed: string): SolverWorld {
  const hf = generateTerrain({ seed, size: 96 });
  return { halfSize: 48, heightAt: (x, z) => heightAt(hf, x, z) };
}

function slabAt(id: string, x: number, z: number, w = 8, d = 8, yaw = 0) {
  return { id, letter: 'P' as const, params: { w, d }, pose: { x, z, yaw: snapYaw(yaw) } };
}
function habAt(id: string, x: number, z: number, yaw = 0, length = 8) {
  return {
    id,
    letter: 'H' as const,
    params: { length, radius: 2 },
    pose: { x, z, yaw: snapYaw(yaw) },
  };
}

/** The standable surface under (x, z), computed independently of the solver. */
function surfaceAt(base: ResolvedBase, world: SolverWorld, x: number, z: number): number {
  let h = (base.terrain?.heightAt ?? world.heightAt)(x, z);
  for (const p of base.parts.values()) {
    if (p.letter !== 'P' || p.footprint.kind !== 'rect') continue;
    const [lx, , lz] = rotateY([x - p.pose.x, 0, z - p.pose.z], -p.pose.yaw);
    if (Math.abs(lx) <= p.footprint.hx && Math.abs(lz) <= p.footprint.hz) {
      h = Math.max(h, p.pose.y + SLAB_THICK);
    }
  }
  return h;
}

describe('slab hosting', () => {
  it('stands the slab above the highest terrain under it, on pylons', () => {
    const world = terrain('slab');
    const base = solve(addPart(createDocument({ seed: 's' }), slabAt('s', 0, 0, 12, 12)), world);
    const slab = base.parts.get('s');
    expect(slab).toBeDefined();
    if (!slab) return;
    let highest = -Infinity;
    for (let x = -6; x <= 6; x += 0.5)
      for (let z = -6; z <= 6; z += 0.5) {
        highest = Math.max(highest, (base.terrain?.heightAt ?? world.heightAt)(x, z));
      }
    // Terrain is sampled per 1 m cell, so allow it to be finer than that: no clipping at least.
    expect(slab.pose.y).toBeGreaterThanOrEqual(highest);
    expect(slab.legs.length).toBeGreaterThanOrEqual(4);
  });

  it('puts a part placed on a slab on the slab top, without pushing it off', () => {
    let doc = addPart(createDocument({ seed: 's' }), slabAt('s', 0, 0, 12, 12));
    doc = addPart(doc, habAt('h', 0, 0));
    const base = solve(doc, FLAT);
    const slab = base.parts.get('s');
    const hab = base.parts.get('h');
    expect(hab && slab).toBeTruthy();
    if (!hab || !slab) return;
    const top = slab.pose.y + SLAB_THICK;
    expect(hab.pose.x).toBe(0);
    expect(hab.pose.z).toBe(0);
    expect(base.diagnostics.filter((d) => d.kind === 'moved')).toEqual([]);
    for (const leg of hab.legs) expect(leg.bottom[1]).toBeCloseTo(top - FOOT_SINK, 9);
    // Belly (radius 2 below the axis) clears the slab top.
    expect(hab.pose.y - 2).toBeGreaterThanOrEqual(top + LEG_MIN_CLEARANCE - 1e-9);
  });

  it('only resolves overlap between slabs, and does so', () => {
    let doc = addPart(createDocument({ seed: 's' }), slabAt('a', 0, 0));
    doc = addPart(doc, slabAt('b', 1, 0));
    const base = solve(doc, FLAT);
    const a = base.parts.get('a');
    const b = base.parts.get('b');
    expect(a && b).toBeTruthy();
    if (!a || !b) return;
    // Two 8 m slabs must end up at least 8 m apart on one axis.
    expect(
      Math.max(Math.abs(a.pose.x - b.pose.x), Math.abs(a.pose.z - b.pose.z)),
    ).toBeGreaterThanOrEqual(8);
  });

  it('ends every leg of a mixed base on terrain or a slab top', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const world = terrain(`mix${seed}`);
      const rng = new Rng(seed);
      let doc: BaseDocument = createDocument({ seed: `m${seed}` });
      for (let i = 0; i < 4; i++) {
        doc = addPart(
          doc,
          slabAt(
            `s${i}`,
            rng.range(-20, 20),
            rng.range(-20, 20),
            2 * rng.int(2, 6),
            2 * rng.int(2, 6),
            45 * rng.int(0, 7),
          ),
        );
      }
      for (let i = 0; i < 8; i++) {
        doc = addPart(
          doc,
          habAt(
            `h${i}`,
            rng.range(-20, 20),
            rng.range(-20, 20),
            45 * rng.int(0, 7),
            2 * rng.int(2, 8),
          ),
        );
      }
      const base = solve(doc, world);
      for (const part of base.parts.values()) {
        for (const leg of part.legs) {
          const ground =
            part.letter === 'P'
              ? (base.terrain?.heightAt ?? world.heightAt)(leg.bottom[0], leg.bottom[2])
              : surfaceAt(base, world, leg.bottom[0], leg.bottom[2]);
          expect(leg.bottom[1]).toBeCloseTo(ground - FOOT_SINK, 9);
        }
      }
    }
  });

  it('routes a tube over a slab clear of its top', () => {
    let doc = createDocument({ seed: 's' });
    doc = addPart(doc, habAt('a', -22, 0));
    doc = addPart(doc, habAt('b', 22, 0));
    doc = addPart(doc, slabAt('s', 0, 0, 12, 4));
    doc = addLink(doc, {
      a: { part: 'a', port: 'end+' },
      b: { part: 'b', port: 'end-' },
      kind: 'tube',
    });
    const base = solve(doc, FLAT);
    const slab = base.parts.get('s');
    expect(slab).toBeDefined();
    if (!slab || slab.footprint.kind !== 'rect') return;
    const top = slab.pose.y + SLAB_THICK;
    let sampled = 0;
    for (const tube of base.tubes.values()) {
      for (let i = 0; i + 1 < tube.path.length; i++) {
        const a = tube.path[i];
        const b = tube.path[i + 1];
        if (!a || !b) continue;
        for (let t = 0; t <= 1; t += 0.05) {
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t;
          const z = a[2] + (b[2] - a[2]) * t;
          if (
            Math.abs(x - slab.pose.x) <= slab.footprint.hx &&
            Math.abs(z - slab.pose.z) <= slab.footprint.hz
          ) {
            sampled++;
            expect(y - CORRIDOR_FLOOR_THICK).toBeGreaterThanOrEqual(top - 1e-6);
          }
        }
      }
    }
    expect(sampled).toBeGreaterThan(0);
  });
});
