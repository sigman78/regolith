/**
 * M3.5 exit, checked headless (PLAN, "Exit (what a reviewer checks)"): a 1.8 m person has
 * headroom at every walkable point, every door is on its floor and every graph vertex is on a
 * floor, and every walk on level ground stays level. Run on the golden base, the stress base and
 * random linked bases over flat and rough ground.
 */
import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import { Rng } from '@/core/rng';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_MAX_SLOPE,
  CREW_HEIGHT,
  DECK_HEIGHT,
  DOME_COLLAR_HEIGHT,
  DOOR_H,
  DOOR_SILL,
  FLOOR_ABOVE_BELLY,
  HEADROOM_MARGIN,
  TOWER_FLOOR_HEIGHT,
  TOWER_RIB_THICK,
} from '@/geometry/design-constants';
import { getPart } from '@/grammar/registry';
import { solve, type ResolvedBase, type ResolvedPart, type SolverWorld } from '@/grammar/solver';
import { isHorizontal } from '@/grammar/solver/ports';
import type { Letter } from '@/grammar/types';
import { navOf, route, stepPolyline } from '@/sim/nav';
import { addLink, addPart, createDocument, type BaseDocument } from '@/world/document';
import { generateTerrain, heightAt } from '@/world/terrain';
import { goldenBase } from './golden-base';
import { stressBase } from './stress-base';

const CLEAR = CREW_HEIGHT + HEADROOM_MARGIN;
const FLAT: SolverWorld = { halfSize: 64, heightAt: () => 0 };
const roughWorld = (seed: string): SolverWorld => {
  const hf = generateTerrain({ seed, size: 128 });
  return { halfSize: 64, heightAt: (x, z) => heightAt(hf, x, z) };
};

function golden(): BaseDocument {
  const g = goldenBase();
  let doc = createDocument({ seed: 'golden' });
  for (const p of g.parts) doc = addPart(doc, p);
  for (const l of g.links) doc = addLink(doc, l);
  return doc;
}

function stress(): BaseDocument {
  let doc = createDocument({ seed: 'stress' });
  for (const p of stressBase(60)) doc = addPart(doc, p);
  return doc;
}

const LETTERS: Letter[] = ['H', 'H', 'N', 'D', 'V', 'A'];

/** A random base of pressurised letters with some links between free end ports. */
function random(seed: number): BaseDocument {
  const rng = new Rng(seed * 7919 + 11);
  let doc = createDocument({ seed: `exit${seed}` });
  const ids: string[] = [];
  const letters = new Map<string, Letter>();
  for (let i = 0; i < 14; i++) {
    const letter = rng.pick(LETTERS);
    const id = `p${i}`;
    ids.push(id);
    letters.set(id, letter);
    doc = addPart(doc, {
      id,
      letter,
      params: {},
      pose: { x: rng.int(-40, 40), z: rng.int(-40, 40), yaw: snapYaw(rng.int(0, 7) * 45) },
    });
  }
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const a = ids[i] as string;
    const b = ids[i + 1] as string;
    const portOf = (id: string): string | null => {
      const letter = letters.get(id);
      const def = letter ? getPart(letter) : undefined;
      if (!def) return null;
      const press = def
        .ports(def.resolve({}))
        .filter((q) => q.type === 'PRESS' && isHorizontal(q.normal));
      return press[0]?.id ?? null;
    };
    const pa = portOf(a);
    const pb = portOf(b);
    if (pa && pb)
      doc = addLink(doc, { a: { part: a, port: pa }, b: { part: b, port: pb }, kind: 'tube' });
  }
  return doc;
}

/** Clear height over the floor at a part's centre, from its letter's shape. */
function clearAtCentre(part: ResolvedPart): number {
  const r = Number(part.params['radius'] ?? part.params['size'] ?? 0);
  switch (part.letter) {
    case 'H':
    case 'A':
    case 'N':
      return 2 * r - FLOOR_ABOVE_BELLY; // axis is r - 1 over the floor, the hull top r over the axis
    case 'V':
      return TOWER_FLOOR_HEIGHT - TOWER_RIB_THICK / 2; // the next floor's rib
    case 'D':
      return DOME_COLLAR_HEIGHT + r; // collar rim plus the shell, over the floor at the plinth top
    default:
      return Infinity;
  }
}

function checkBase(base: ResolvedBase, world: SolverWorld, level: boolean): void {
  // 1. Headroom: corridors and doors by their constants, every room at its centre.
  expect(CORRIDOR_HEIGHT).toBeGreaterThanOrEqual(CLEAR);
  expect(DOOR_H).toBeGreaterThanOrEqual(CLEAR);
  for (const node of base.graph.nodes.values()) {
    const part = base.parts.get(node.id);
    expect(part).toBeDefined();
    if (part)
      expect(clearAtCentre(part), `${part.letter} ${part.id}`).toBeGreaterThanOrEqual(CLEAR);
  }

  // 2. Doors on floors, graph vertices on floors.
  for (const part of base.parts.values()) {
    const def = getPart(part.letter);
    if (!def?.floor) continue;
    const decks = (def.floors?.(part.params) ?? [def.floor(part.params)]).map(
      (y) => part.pose.y + y,
    );
    for (const port of part.ports) {
      if (port.type !== 'PRESS' || !isHorizontal(port.normal)) continue;
      const off = Math.min(...decks.map((y) => Math.abs(port.position[1] - y)));
      expect(off, `${part.id}/${port.id}`).toBeLessThanOrEqual(DOOR_SILL + 1e-9);
    }
    const node = base.graph.nodes.get(part.id);
    if (node) {
      expect(
        decks.some((y) => Math.abs(node.centre[1] - y) < 1e-6),
        `${part.id} centre`,
      ).toBe(true);
      for (const [id, p] of node.ports) {
        const port = part.ports.find((q) => q.id === id);
        expect(port && Math.abs(port.position[1] - p[1]) < 1e-3, `${part.id}/${id}`).toBe(true);
      }
    }
  }
  for (const e of base.graph.edges) {
    const tube = base.tubes.get(e.id);
    expect(tube).toBeDefined();
    if (!tube) continue;
    expect(e.path).toEqual(tube.path);
    const first = e.path[0];
    const last = e.path[e.path.length - 1];
    const pa = base.graph.nodes.get(e.a.part)?.ports.get(e.a.port);
    const pb = base.graph.nodes.get(e.b.part)?.ports.get(e.b.port);
    expect(first && pa && Math.abs(first[1] - pa[1]) < 1e-3).toBe(true);
    expect(last && pb && Math.abs(last[1] - pb[1]) < 1e-3).toBe(true);
  }

  // 3. Walks: on level ground no step changes height; on rough ground a climb is within the slope
  // limit or the corridor is flagged.
  const nav = navOf(base.graph);
  const steep = new Set(
    base.diagnostics.filter((d) => d.kind === 'corridor-steep').map((d) => d.tube),
  );
  const ids = [...base.graph.nodes.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const steps = route(nav, ids[i] as string, ids[j] as string);
      if (!steps) continue;
      for (const step of steps) {
        const poly = stepPolyline(nav, step) ?? [];
        for (let k = 1; k < poly.length; k++) {
          const a = poly[k - 1];
          const b = poly[k];
          if (!a || !b) continue;
          const rise = Math.abs(b[1] - a[1]);
          const run = Math.hypot(b[0] - a[0], b[2] - a[2]);
          if (step.k === 'node') {
            // Inside a part: the tower's stairs are not modelled; everything else is level.
            if (base.parts.get(step.node)?.letter !== 'V') expect(rise).toBeLessThan(1e-6);
            continue;
          }
          if (level) expect(rise, `${step.edge}`).toBeLessThan(1e-6);
          else if (run >= 0.5 && !steep.has(step.edge)) {
            expect(rise / run, `${step.edge}`).toBeLessThanOrEqual(CORRIDOR_MAX_SLOPE + 1e-6);
          }
        }
      }
    }
  }
  // Every floor is DECK_HEIGHT over the ground under its part on level ground.
  if (level) {
    for (const node of base.graph.nodes.values()) {
      const part = base.parts.get(node.id);
      if (part?.letter === 'V') continue;
      expect(node.centre[1] - world.heightAt(node.centre[0], node.centre[2])).toBeCloseTo(
        DECK_HEIGHT,
        6,
      );
    }
  }
}

describe('M3.5 exit: built for a 1.8 m person', () => {
  it('holds on the golden base', () => {
    checkBase(solve(golden(), FLAT, { diagnose: true }), FLAT, true);
  });

  it('holds on the stress base', () => {
    checkBase(solve(stress(), FLAT, { diagnose: true }), FLAT, true);
  });

  it('holds on random linked bases, flat and rough', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const world = seed % 2 ? FLAT : roughWorld(`exit-${seed}`);
      const base = solve(random(seed), world, { diagnose: true });
      expect(base.graph.edges.length).toBeGreaterThan(0);
      checkBase(base, world, seed % 2 === 1);
    }
  });
});
