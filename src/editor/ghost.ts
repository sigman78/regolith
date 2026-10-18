/**
 * The placement ghost. It runs the real solver on a scratch document with the
 * proposed change, so the preview shows exactly what the player will get
 * (snap, overlap push, legs on the real terrain, docks, routed tubes, nodes).
 */
import type { Scene } from 'three';
import { snapYaw } from '@/core/math';
import {
  emptyBase,
  linkKey,
  solve,
  type ResolvedBase,
  type ResolvedPart,
  type SolverWorld,
} from '@/grammar/solver';
import { getPart } from '@/grammar/registry';
import type { ParamValues } from '@/grammar/types';
import { materials } from '@/render/materials';
import { SceneSync } from '@/render/scene-sync';
import { addLink, addPart, type BaseDocument, type Link, type PartPose } from '@/world/document';
import type { Letter } from '@/world/letter';

export const GHOST_ID = '__ghost__';

export class Ghost {
  private readonly sync: SceneSync;
  private shown: ResolvedPart | null = null;

  constructor(
    scene: Scene,
    private readonly world: SolverWorld,
    private readonly getDoc: () => BaseDocument,
  ) {
    this.sync = new SceneSync(scene, { override: materials.ghost });
  }

  /** The pose the solver resolved for the last `show`, or null when hidden. */
  get resolved(): ResolvedPart | null {
    return this.shown;
  }

  /** Preview a part at `at`; docks the part would make are shown with it. */
  show(
    letter: Letter,
    params: ParamValues,
    at: { x: number; z: number; yaw: number },
  ): ResolvedPart | null {
    if (!getPart(letter)) return this.hide();
    const pose: PartPose = { x: at.x, z: at.z, yaw: snapYaw(at.yaw) };
    const doc = addPart(this.getDoc(), { id: GHOST_ID, letter, params, pose });
    const base = solve(doc, this.world, { movingId: GHOST_ID });
    const part = base.parts.get(GHOST_ID) ?? null;
    this.shown = part;

    const view = emptyBase();
    if (part) view.parts.set(GHOST_ID, part);
    for (const t of base.tubes.values()) {
      if (t.a.part === GHOST_ID || t.b.part === GHOST_ID) view.tubes.set(t.id, t);
    }
    this.sync.sync(view);
    return part;
  }

  /** Preview the tube (and any nodes) a new link would create. Returns false if none would. */
  showLink(link: Link): boolean {
    this.shown = null;
    const doc = addLink(this.getDoc(), link);
    const base = solve(doc, this.world);
    const key = linkKey(link);
    const view: ResolvedBase = emptyBase();
    for (const t of base.tubes.values())
      if (t.id.startsWith(`tube:${key}:`)) view.tubes.set(t.id, t);
    for (const p of base.parts.values())
      if (p.id.startsWith(`node:${key}:`)) view.parts.set(p.id, p);
    this.sync.sync(view);
    return view.tubes.size > 0;
  }

  hide(): null {
    this.shown = null;
    this.sync.clear();
    return null;
  }
}
