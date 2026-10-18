/**
 * The placement ghost. It runs the real solver on a scratch document with the
 * proposed change, so the preview shows exactly what the player will get
 * (snap, overlap push, legs on the real terrain, docks, routed tubes, nodes).
 */
import type { Scene } from 'three';
import { snap, snapYaw } from '@/core/math';
import { GRID, SNAP_ARROW_MIN } from '@/geometry/design-constants';
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
import { SnapArrow } from '@/render/snap-arrow';
import { addLink, addPart, type BaseDocument, type Link, type PartPose } from '@/world/document';
import type { Letter } from '@/world/letter';

export const GHOST_ID = '__ghost__';

/** True when the solver moved a ghost far enough from the cursor that the player should be told. */
export function needsSnapArrow(
  cursor: { x: number; z: number },
  resolved: { x: number; z: number },
): boolean {
  return Math.hypot(resolved.x - cursor.x, resolved.z - cursor.z) > SNAP_ARROW_MIN;
}

export class Ghost {
  private readonly sync: SceneSync;
  private readonly arrow: SnapArrow;
  private shown: ResolvedPart | null = null;
  /** What the last preview was solved for; an identical request needs no new solve. */
  private last: { doc: BaseDocument; key: string } | null = null;
  /** Solver runs so far (the throttle is tested through this). */
  solves = 0;

  constructor(
    scene: Scene,
    private readonly world: SolverWorld,
    private readonly getDoc: () => BaseDocument,
  ) {
    this.sync = new SceneSync(scene, { override: materials.ghost });
    this.arrow = new SnapArrow(scene);
  }

  /** The pose the solver resolved for the last `show`, or null when hidden. */
  get resolved(): ResolvedPart | null {
    return this.shown;
  }

  /** Preview a part at `at`; docks the part would make are shown with it. */
  show(
    letter: Letter,
    params: ParamValues,
    at: { x: number; z: number; yaw: number; mirror?: boolean },
  ): ResolvedPart | null {
    if (!getPart(letter)) return this.hide();
    // The solver snaps to the grid, so the preview only changes when the snapped
    // pose, the part or the document does; between those the cursor just moves the arrow.
    const yaw = snapYaw(at.yaw);
    const base = this.getDoc();
    const key = JSON.stringify([
      letter,
      params,
      snap(at.x, GRID),
      snap(at.z, GRID),
      yaw,
      !!at.mirror,
    ]);
    if (!(this.last && this.last.doc === base && this.last.key === key)) {
      const pose: PartPose = {
        x: at.x,
        z: at.z,
        yaw,
        ...(at.mirror ? { mirror: true as const } : {}),
      };
      const doc = addPart(base, { id: GHOST_ID, letter, params, pose });
      const solved = solve(doc, this.world, { movingId: GHOST_ID, lean: true });
      this.solves++;
      this.shown = solved.parts.get(GHOST_ID) ?? null;

      const view = emptyBase();
      if (this.shown) view.parts.set(GHOST_ID, this.shown);
      for (const t of solved.tubes.values()) {
        if (t.a.part === GHOST_ID || t.b.part === GHOST_ID) view.tubes.set(t.id, t);
      }
      this.sync.sync(view);
      this.last = { doc: base, key };
    }
    const part = this.shown;

    if (part && needsSnapArrow(at, part.pose)) {
      this.arrow.show(
        [at.x, this.world.heightAt(at.x, at.z), at.z],
        [part.pose.x, this.world.heightAt(part.pose.x, part.pose.z), part.pose.z],
      );
    } else {
      this.arrow.hide();
    }
    return part;
  }

  /** Preview the tube (and any nodes) a new link would create. Returns false if none would. */
  showLink(link: Link): boolean {
    this.shown = null;
    this.last = null;
    this.arrow.hide();
    const doc = addLink(this.getDoc(), link);
    const base = solve(doc, this.world, { lean: true });
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
    this.last = null;
    this.arrow.hide();
    this.sync.clear();
    return null;
  }
}
