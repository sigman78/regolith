import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { rotateY, snapYaw, type Vec3 } from '@/core/math';
import {
  FOOT_SINK,
  NODE_RADII,
  TUBE_GROUND_GAP,
  TUBE_MAX_SPAN,
  TUBE_PORT_EMBED,
  TUBE_RADIUS,
} from '@/geometry/design-constants';
import {
  addLink,
  addPart,
  createDocument,
  removePart,
  type BaseDocument,
  type Link,
} from '@/world/document';
import { generateTerrain, heightAt } from '@/world/terrain';
import { habHalfExtent, type HabParams } from '../parts/H';
import { solve, type ResolvedBase, type ResolvedPart, type SolverWorld } from './index';

const flat: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function terrainWorld(seed: string): SolverWorld {
  const hf = generateTerrain({ seed, size: 96 });
  return { halfSize: 48, heightAt: (x, z) => heightAt(hf, x, z) };
}

function hab(doc: BaseDocument, id: string, x: number, z: number, yaw: 0 | 90 = 0, length = 8) {
  return addPart(doc, { id, letter: 'H', params: { length, radius: 2 }, pose: { x, z, yaw } });
}

function tube(a: string, ap: string, b: string, bp: string): Link {
  return { a: { part: a, port: ap }, b: { part: b, port: bp }, kind: 'tube' };
}

/** Distance from a world XZ point to the hull of a resolved part (0 inside). */
function distToHull(part: ResolvedPart, x: number, z: number): number {
  const l = rotateY([x - part.pose.x, 0, z - part.pose.z], -part.pose.yaw);
  if (part.letter === 'N') return Math.max(0, Math.hypot(l[0], l[2]) - Number(part.params['size']));
  const p = part.params as HabParams;
  const dx = Math.max(Math.abs(l[0]) - habHalfExtent(p), 0);
  const dz = Math.max(Math.abs(l[2]) - p.radius, 0);
  return Math.hypot(dx, dz);
}

function samples(path: readonly Vec3[], step = 0.25) {
  const out: { x: number; y: number; z: number; s: number }[] = [];
  let s = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Vec3;
    const b = path[i + 1] as Vec3;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (let t = 0; t < len; t += step) {
      const k = t / len;
      out.push({
        x: a[0] + (b[0] - a[0]) * k,
        y: a[1] + (b[1] - a[1]) * k,
        z: a[2] + (b[2] - a[2]) * k,
        s: s + t,
      });
    }
    s += len;
  }
  return out;
}

function pathLength(path: readonly Vec3[]): number {
  let l = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Vec3;
    const b = path[i + 1] as Vec3;
    l += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return l;
}

/** Bends of more than ~1° along a path, counted in the horizontal plane. */
function bends(path: readonly Vec3[]): number {
  let n = 0;
  for (let i = 1; i + 1 < path.length; i++) {
    const p = path[i - 1] as Vec3;
    const q = path[i] as Vec3;
    const r = path[i + 1] as Vec3;
    const ux = q[0] - p[0];
    const uz = q[2] - p[2];
    const vx = r[0] - q[0];
    const vz = r[2] - q[2];
    const c = (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) || 1);
    if (c < Math.cos(Math.PI / 180)) n++;
  }
  return n;
}

/** Invariants every tube in a base must satisfy. */
function expectSoundTubes(base: ResolvedBase, world: SolverWorld): void {
  const parts = [...base.parts.values()];
  for (const t of base.tubes.values()) {
    const total = pathLength(t.path);
    for (const q of samples(t.path)) {
      if (t.kind === 'dock') continue; // a dock is a collar between two touching hulls
      for (const part of parts) {
        const own = part.id === t.a.part || part.id === t.b.part;
        if (own && (q.s < 1.6 || total - q.s < 1.6)) continue;
        // Clear of every hull except where it enters its own two ports.
        expect(distToHull(part, q.x, q.z)).toBeGreaterThanOrEqual(TUBE_RADIUS - 0.05);
      }
      if (q.s > 1.6 && total - q.s > 1.6) {
        expect(q.y).toBeGreaterThanOrEqual(
          world.heightAt(q.x, q.z) + TUBE_RADIUS + TUBE_GROUND_GAP - 0.05,
        );
      }
    }
    for (const leg of t.legs) {
      expect(leg.bottom[1]).toBeCloseTo(
        world.heightAt(leg.bottom[0], leg.bottom[2]) - FOOT_SINK,
        2,
      );
      expect(leg.top[1]).toBeGreaterThan(leg.bottom[1]);
    }
  }
}

describe('docks', () => {
  it('bridges two habs whose end ports face each other across a short gap', () => {
    let doc = createDocument({ seed: 'd' });
    doc = hab(doc, 'A', 0, 0);
    doc = hab(doc, 'B', 10, 0);
    const base = solve(doc, flat);
    const docks = [...base.tubes.values()].filter((t) => t.kind === 'dock');
    expect(docks).toHaveLength(1);
    expect(base.usedPorts.has('A/end+')).toBe(true);
    expect(base.usedPorts.has('B/end-')).toBe(true);
    expect(docks[0]?.path).toHaveLength(2);
  });

  it('does not dock across a wide gap or with a lateral offset', () => {
    let doc = createDocument({ seed: 'd' });
    doc = hab(doc, 'A', 0, 0);
    doc = hab(doc, 'B', 14, 0); // 4.6 m gap
    doc = hab(doc, 'C', -10, 3); // end faces A but 3 m off axis
    expect([...solve(doc, flat).tubes.values()]).toEqual([]);
  });

  it('docks each port at most once', () => {
    let doc = createDocument({ seed: 'd' });
    doc = hab(doc, 'A', 0, 0);
    doc = hab(doc, 'B', 10, 0);
    doc = hab(doc, 'C', 20, 0);
    const base = solve(doc, flat);
    const ports = [...base.tubes.values()].flatMap((t) => [
      `${t.a.part}/${t.a.port}`,
      `${t.b.part}/${t.b.port}`,
    ]);
    expect(new Set(ports).size).toBe(ports.length);
    expect(base.tubes.size).toBe(2);
  });
});

describe('tubes', () => {
  it('runs a straight tube between two habs 20 m apart, ends embedded in the hulls', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -15, 0);
    doc = hab(doc, 'B', 15, 0);
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    const base = solve(doc, flat);
    const t = [...base.tubes.values()].find((x) => x.kind === 'tube');
    expect(t).toBeTruthy();
    if (!t) return;
    const a = base.parts.get('A')?.ports.find((p) => p.id === 'end+');
    expect(t.path[0]?.[0]).toBeCloseTo((a?.position[0] ?? 0) - TUBE_PORT_EMBED, 2);
    expect(t.path[0]?.[2]).toBeCloseTo(0, 2);
    expect(t.path[t.path.length - 1]?.[2]).toBeCloseTo(0, 2);
    expect(bends(t.path)).toBe(0);
    expect(base.usedPorts.has('A/end+')).toBe(true);
    expect([...base.parts.values()].filter((p) => p.derived)).toHaveLength(0);
    expectSoundTubes(base, flat);
  });

  it('routes around a hull in the way', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -18, 0);
    doc = hab(doc, 'B', 18, 0);
    doc = hab(doc, 'WALL', 0, 0, 90, 16); // 8.7 m each side of the line
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    const base = solve(doc, flat);
    const pieces = [...base.tubes.values()].filter((x) => x.kind === 'tube');
    expect(pieces.length).toBeGreaterThan(0);
    const reach = Math.max(...pieces.flatMap((t) => t.path.map((p) => Math.abs(p[2]))));
    expect(reach).toBeGreaterThan(9);
    expect(base.diagnostics.filter((d) => d.kind.startsWith('tube'))).toEqual([]);
    expectSoundTubes(base, flat);
  });

  it('inserts a node when the span is over the limit, and every piece obeys it', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -28, 0);
    doc = hab(doc, 'B', 28, 0);
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    const base = solve(doc, flat);
    const nodes = [...base.parts.values()].filter((p) => p.derived);
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    const pieces = [...base.tubes.values()].filter((t) => t.kind === 'tube');
    expect(pieces).toHaveLength(nodes.length + 1);
    for (const piece of pieces) {
      expect(pathLength(piece.path)).toBeLessThanOrEqual(
        TUBE_MAX_SPAN + 2 * TUBE_PORT_EMBED + 0.01,
      );
    }
    for (const n of nodes) {
      expect(NODE_RADII).toContain(Number(n.params['size']));
      expect(n.legs).toHaveLength(3);
    }
    expect(base.diagnostics.filter((d) => d.kind === 'tube-too-long')).toEqual([]);
    expectSoundTubes(base, flat);
  });

  it('keeps a bendy route legal: nodes where needed, no hull crossings', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -20, 0);
    doc = hab(doc, 'B', 20, 14);
    doc = hab(doc, 'W1', -2, 4, 90, 10);
    doc = hab(doc, 'W2', 4, 10, 90, 10);
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    const base = solve(doc, flat);
    expect([...base.tubes.values()].some((t) => t.kind === 'tube')).toBe(true);
    expectSoundTubes(base, flat);
  });

  it('follows rough terrain with legs under the tube', () => {
    const world = terrainWorld('tube-terrain');
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -20, -10);
    doc = hab(doc, 'B', 20, -10);
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    const base = solve(doc, world);
    const t = [...base.tubes.values()].find((x) => x.kind === 'tube');
    expect(t?.legs.length).toBeGreaterThan(0);
    expectSoundTubes(base, world);
  });

  it('skips links that cannot be built, without throwing (P1)', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -15, 0);
    doc = hab(doc, 'B', 15, 0);
    doc = hab(doc, 'C', 0, 20);
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    doc = addLink(doc, tube('A', 'end+', 'C', 'end-')); // A.end+ already used
    doc = addLink(doc, tube('A', 'foot-', 'C', 'end+')); // STRUCT port
    doc = addLink(doc, tube('A', 'nope', 'C', 'end+')); // missing port
    const base = solve(doc, flat);
    expect(base.diagnostics.filter((d) => d.kind === 'link-skipped')).toHaveLength(3);
    expect([...base.tubes.values()].filter((t) => t.kind === 'tube')).toHaveLength(1);
  });

  it('drops the tube when a part is removed', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -15, 0);
    doc = hab(doc, 'B', 15, 0);
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    expect(solve(doc, flat).tubes.size).toBe(1);
    expect(solve(removePart(doc, 'B'), flat).tubes.size).toBe(0);
  });

  it('is deterministic', () => {
    let doc = createDocument({ seed: 't' });
    doc = hab(doc, 'A', -28, 0);
    doc = hab(doc, 'B', 28, 6);
    doc = addLink(doc, tube('A', 'end+', 'B', 'end-'));
    const a = solve(doc, flat);
    const b = solve(doc, flat);
    expect(JSON.stringify([...a.tubes.values()])).toBe(JSON.stringify([...b.tubes.values()]));
    expect(JSON.stringify([...a.parts.values()])).toBe(JSON.stringify([...b.parts.values()]));
  });
});

describe('property: random bases', () => {
  it('never lets a tube cross a hull, never overlaps hulls, always grounds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = new Rng(seed * 7919);
      const world = seed % 2 ? flat : terrainWorld(`prop${seed}`);
      let doc = createDocument({ seed: `s${seed}` });
      for (let i = 0; i < 7; i++) {
        doc = addPart(doc, {
          id: `h${i}`,
          letter: 'H',
          params: { length: rng.int(2, 6) * 2, radius: rng.pick([2, 3]) },
          pose: { x: rng.range(-34, 34), z: rng.range(-34, 34), yaw: snapYaw(rng.int(0, 7) * 45) },
        });
      }
      // Link random free end ports pairwise.
      const placed = solve(doc, world);
      const free = [...placed.parts.values()].flatMap((p) =>
        p.ports
          .filter(
            (q) =>
              q.type === 'PRESS' &&
              q.id.startsWith('end') &&
              !placed.usedPorts.has(`${p.id}/${q.id}`),
          )
          .map((q) => ({ part: p.id, port: q.id })),
      );
      for (let k = 0; k + 1 < free.length && k < 8; k += 2) {
        const a = free[k];
        const b = free[k + 1];
        if (a && b && a.part !== b.part) doc = addLink(doc, { a, b, kind: 'tube' });
      }
      const base = solve(doc, world);
      expectSoundTubes(base, world);

      // Hull-to-hull separation, derived nodes included: sample a's axis against b.
      const parts = [...base.parts.values()];
      for (let i = 0; i < parts.length; i++) {
        for (let j = 0; j < parts.length; j++) {
          if (i === j) continue;
          const a = parts[i] as ResolvedPart;
          const b = parts[j] as ResolvedPart;
          const A =
            a.letter === 'N' ? Number(a.params['size']) : habHalfExtent(a.params as HabParams);
          for (let s = -A; s <= A; s += 0.5) {
            const w = rotateY([s, 0, 0], a.pose.yaw);
            expect(distToHull(b, a.pose.x + w[0], a.pose.z + w[2])).toBeGreaterThan(0.05);
          }
        }
      }
    }
  });
});
