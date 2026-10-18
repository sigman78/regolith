/**
 * The solver: document + ground -> ResolvedBase. Runs after every command and
 * on every ghost update, so it must stay cheap (budget: < 2 ms for 200 parts).
 *
 * Stages (docs/ARCHITECTURE.md §4.2; power, paths, decorators and the beacon
 * arrive with their milestones):
 *   place -> overlap -> ground -> dock -> tubes -> keep-out
 * `ground` runs before `dock` and `tubes` because both need final port
 * heights; derived nodes inserted by `tubes` are grounded inside that stage.
 * Pure: the same (document, world, options) always yields the same result.
 */
import { hashValue } from '@/core/hash';
import type { BaseDocument } from '@/world/document';
import { diagnose } from './diagnose';
import { dock } from './dock';
import { keepOut } from './keepout';
import { ground, isHost, type Grounded } from './ground';
import { overlap } from './overlap';
import { place } from './place';
import { tubesStage } from './tubes';
import type {
  Diagnostic,
  ResolvedBase,
  ResolvedPart,
  ResolvedTube,
  SolveOptions,
  SolverWorld,
} from './types';

export type * from './types';
export { linkKey } from './tubes';
export { canTakeTube } from './ports';

export function emptyBase(): ResolvedBase {
  return {
    parts: new Map(),
    tubes: new Map(),
    usedPorts: new Set(),
    keepOut: new Uint8Array(0),
    diagnostics: [],
  };
}

export function solve(
  doc: BaseDocument,
  world: SolverWorld,
  opts: SolveOptions = {},
): ResolvedBase {
  const diagnostics: Diagnostic[] = [];
  const placed = place(doc, world, diagnostics);
  const resolved = overlap(placed, world, opts, diagnostics);
  const { grounded, surface } = ground(resolved, world);

  // Tubes route around hulls but not over slabs (they clear a slab's top instead).
  const taken = new Set<number>();
  for (const g of grounded) if (!isHost(g.draft)) for (const c of g.draft.cells) taken.add(c);

  const used = new Set<string>();
  const docks = dock(grounded, surface, used);
  const linked = tubesStage(doc, grounded, surface, taken, used, diagnostics);

  const parts = new Map<string, ResolvedPart>();
  for (const g of grounded) {
    parts.set(g.draft.instance.id, toResolved(g, doc.seed, false));
    const dx = g.draft.pose.x - g.draft.requested.x;
    const dz = g.draft.pose.z - g.draft.requested.z;
    if (Math.hypot(dx, dz) > 0.25) {
      diagnostics.push({ kind: 'moved', part: g.draft.instance.id, dx, dz });
    }
  }
  for (const g of linked.nodes) parts.set(g.draft.instance.id, toResolved(g, doc.seed, true));

  const tubes = new Map<string, ResolvedTube>();
  for (const t of [...docks, ...linked.tubes]) tubes.set(t.id, t);

  const mask = keepOut([...grounded, ...linked.nodes], [...tubes.values()], world.halfSize);
  const base: ResolvedBase = { parts, tubes, usedPorts: used, keepOut: mask, diagnostics };
  if (opts.diagnose) diagnostics.push(...diagnose(doc, base, { terrain: world, surface }));
  return base;
}

function toResolved(g: Grounded, seed: string, derived: boolean): ResolvedPart {
  const { draft } = g;
  const recipe = draft.def.geometry(draft.params, { seed });
  return {
    id: draft.instance.id,
    letter: draft.instance.letter,
    serial: draft.instance.serial,
    params: draft.params,
    pose: draft.pose,
    requested: draft.requested,
    footprint: draft.footprint,
    ports: g.ports,
    legs: g.legs,
    recipe,
    recipeHash: hashValue(recipe),
    ...(derived ? { derived: true as const } : {}),
  };
}
