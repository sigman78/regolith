/**
 * Suggested connections, shown for the part you just placed or selected: up to three translucent
 * ghost tubes with a small pill on each. Clicking a pill adds the link, exactly as drawing it with
 * the Connect tool would (`cmd.addLink`), so the solver's rules apply as usual.
 *
 * Suggestions are computed once the current event has finished and never while a part is being
 * dragged: each candidate costs a trial solve (grammar/suggest.ts).
 */
import { Vector3, type PerspectiveCamera, type Scene } from 'three';
import { suggestLinks, type Suggestion } from '@/grammar/suggest';
import { emptyBase, type ResolvedBase, type SolverWorld } from '@/grammar/solver';
import { materials } from '@/render/materials';
import { SceneSync } from '@/render/scene-sync';
import type { PartId } from '@/world/document';
import { cmd } from '../commands';
import type { DocumentStore } from '../store';

export interface SuggestionsHost {
  readonly store: DocumentStore;
  readonly world: SolverWorld;
  readonly camera: PerspectiveCamera;
  base(): ResolvedBase;
  /** The picture changed outside a pointer event: draw a frame. */
  wake(): void;
}

export class Suggestions {
  private readonly sync: SceneSync;
  private readonly pills: HTMLButtonElement[] = [];
  private shown: Suggestion[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly tmp = new Vector3();
  /** What the last request was for, so an unchanged request is not solved again. */
  private last: { doc: unknown; part: PartId } | null = null;

  constructor(
    scene: Scene,
    private readonly host: SuggestionsHost,
    private readonly container: HTMLElement,
  ) {
    this.sync = new SceneSync(scene, { override: materials.ghost });
  }

  /** Suggestions currently offered (tests, and the HUD). */
  get current(): readonly Suggestion[] {
    return this.shown;
  }

  /** Offer connections for `partId` once the current event is done; null removes them. */
  request(partId: PartId | null): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!partId) {
      this.clear();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.compute(partId);
    }, 0);
  }

  clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.last = null;
    if (this.shown.length === 0) return;
    this.shown = [];
    this.sync.clear();
    for (const p of this.pills) p.hidden = true;
    this.host.wake();
  }

  private compute(partId: PartId): void {
    const { store, world } = this.host;
    if (this.last && this.last.doc === store.doc && this.last.part === partId) return;
    this.last = { doc: store.doc, part: partId };
    this.shown = suggestLinks(store.doc, this.host.base(), partId, world);

    const view = emptyBase();
    for (const s of this.shown) {
      for (const t of s.tubes) view.tubes.set(t.id, t);
      for (const p of s.parts) view.parts.set(p.id, p);
    }
    this.sync.sync(view);
    this.shown.forEach((s, i) => this.pill(i, s));
    for (let i = this.shown.length; i < this.pills.length; i++) {
      const el = this.pills[i];
      if (el) el.hidden = true;
    }
    this.host.wake();
  }

  /** Call once per frame: keeps each pill on its tube. */
  update(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.shown.forEach((s, i) => {
      const el = this.pills[i];
      if (!el) return;
      this.tmp.set(s.anchor[0], s.anchor[1] + 1, s.anchor[2]).project(this.host.camera);
      el.hidden = this.tmp.z > 1;
      el.style.transform = `translate(${((this.tmp.x + 1) / 2) * w}px, ${((1 - this.tmp.y) / 2) * h}px) translate(-50%, -50%)`;
    });
  }

  private pill(i: number, s: Suggestion): void {
    let el = this.pills[i];
    if (!el) {
      el = document.createElement('button');
      el.className = 'suggest';
      el.type = 'button';
      this.container.appendChild(el);
      this.pills[i] = el;
    }
    const part = this.host.base().parts.get(s.target);
    const name = part ? `${part.letter}-${String(part.serial).padStart(3, '0')}` : s.target;
    el.textContent = `Connect to ${name}`;
    el.title = `${Math.round(s.length)} m of tube${s.nodes > 0 ? ' with a node' : ''}`;
    el.hidden = false;
    // Replace the handler: the pill is reused for a different suggestion.
    el.onpointerdown = (e) => e.stopPropagation();
    el.onclick = (e) => {
      e.stopPropagation();
      this.host.store.execute(cmd.addLink(s.link));
    };
  }
}
