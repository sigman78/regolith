/**
 * Handles: orange grips on the selected part, one per `PartDefinition.handles` entry. Dragging a
 * grip turns its param (length, radius, floors, height, width, depth) and keeps the part's opposite
 * end in place. DOM elements positioned by projecting each grip every frame (DESIGN_GUIDE §12).
 *
 * The grip is dragged along its own axis: the pointer ray is reduced to a distance along that line,
 * so it works the same for a hab's end, a tower's top and a slab's edge. What the distance means is
 * `applyHandleDelta` (grammar) and `resizeByHandle` (blocking by the solver); this file is the DOM.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import { localDirToWorld, localToWorld, type Vec3 } from '@/core/math';
import type { HandleSpec } from '@/grammar/handles';
import { getPart } from '@/grammar/registry';
import type { ResolvedBase, SolverWorld } from '@/grammar/solver';
import type { ParamSpec } from '@/grammar/types';
import type { PartId } from '@/world/document';
import type { Letter } from '@/world/letter';
import { rayClosestOnLine, type Ray } from '@/world/raycast';
import { cmd } from '../commands';
import { resizeByHandle, type HandleStart } from '../handle-drag';
import type { DocumentStore } from '../store';

export interface HandlesHost {
  readonly store: DocumentStore;
  readonly world: SolverWorld;
  readonly selected: PartId | null;
  readonly camera: PerspectiveCamera;
  base(): ResolvedBase;
  rayAt(clientX: number, clientY: number): Ray;
  setMoving(id: PartId | null): void;
  commitResolved(id: PartId): void;
}

/** How far the disc floats off the surface along its axis, so it never covers a hatch or the hull. */
const GRIP_OFFSET = 1.2;

interface Drag {
  id: PartId;
  spec: HandleSpec;
  start: HandleStart;
  /** the grip's world position and axis when the drag began; the drag line */
  origin: Vec3;
  axis: Vec3;
  /** distance along the line where the pointer first grabbed */
  grabbed: number;
  last: number;
  element: HTMLElement;
}

export class Handles {
  private readonly discs: HTMLElement[] = [];
  private drag: Drag | null = null;
  private readonly tmp = new Vector3();

  constructor(
    private readonly host: HandlesHost,
    private readonly container: HTMLElement,
  ) {}

  /** Call once per frame. */
  update(): void {
    const part = this.selectedPart();
    const specs = part ? (getPart(part.letter)?.handles?.(part.params) ?? []) : [];
    while (this.discs.length < specs.length) this.discs.push(this.makeDisc(this.discs.length));
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.discs.forEach((disc, i) => {
      const spec = specs[i];
      if (!part || !spec) {
        disc.hidden = true;
        return;
      }
      const at = localToWorld(part.pose, spec.at);
      const out = localDirToWorld(part.pose, spec.axis);
      this.tmp
        .set(
          at[0] + out[0] * GRIP_OFFSET,
          at[1] + out[1] * GRIP_OFFSET,
          at[2] + out[2] * GRIP_OFFSET,
        )
        .project(this.host.camera);
      disc.hidden = this.tmp.z > 1;
      disc.title = `Drag to resize ${this.label(part.letter, spec)}`;
      disc.style.transform = `translate(${((this.tmp.x + 1) / 2) * w - 12}px, ${((1 - this.tmp.y) / 2) * h - 12}px)`;
    });
  }

  private selectedPart() {
    const id = this.host.selected;
    return id ? this.host.base().parts.get(id) : undefined;
  }

  private label(letter: Letter, spec: HandleSpec): string {
    const schema = getPart(letter)?.schema[spec.param];
    return (schema?.label ?? spec.param).toLowerCase();
  }

  private makeDisc(index: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'handle';
    el.hidden = true;
    el.addEventListener('pointerdown', (e) => this.begin(e, el, index));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.end(e, el));
    el.addEventListener('pointercancel', (e) => this.end(e, el));
    this.container.appendChild(el);
    return el;
  }

  private begin(e: PointerEvent, el: HTMLElement, index: number): void {
    const { host } = this;
    const id = host.selected;
    const part = this.selectedPart();
    const inDoc = id ? host.store.doc.parts[id] : undefined;
    const spec = part ? getPart(part.letter)?.handles?.(part.params)[index] : undefined;
    if (!id || !part || !inDoc || !spec || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);

    const origin = localToWorld(part.pose, spec.at);
    const axis = localDirToWorld(part.pose, spec.axis);
    const grabbed = rayClosestOnLine(host.rayAt(e.clientX, e.clientY), origin, axis) ?? 0;
    this.drag = {
      id,
      spec,
      start: { params: { ...part.params }, pose: inDoc.pose },
      origin,
      axis,
      grabbed,
      last: Number(part.params[spec.param]),
      element: el,
    };
    host.setMoving(id);
    host.store.beginGesture('Resize part');
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const { host } = this;
    const s = rayClosestOnLine(host.rayAt(e.clientX, e.clientY), d.origin, d.axis);
    if (s === null) return;

    const next = resizeByHandle(host.store.doc, host.world, d.id, d.spec, d.start, s - d.grabbed);
    if (!next) return;
    const value = Number(next.params[d.spec.param]);
    if (value === d.last) return;
    host.store.execute(cmd.edit(d.id, next));
    d.last = value;
    d.element.dataset['value'] = this.format(d.id, d.spec, value);
  }

  private end(e: PointerEvent, el: HTMLElement): void {
    const d = this.drag;
    if (!d) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    delete el.dataset['value'];
    this.host.commitResolved(d.id);
    this.host.store.endGesture();
    this.host.setMoving(null);
    this.drag = null;
  }

  /** "12 m" or the option's name, as the picker would show it. */
  private format(id: PartId, spec: HandleSpec, value: number): string {
    const letter = this.host.store.doc.parts[id]?.letter;
    const schema: ParamSpec | undefined = letter ? getPart(letter)?.schema[spec.param] : undefined;
    if (schema?.kind === 'choice' && schema.labels) {
      const name = schema.labels[schema.options.indexOf(value)];
      if (name) return name;
    }
    return `${value}${schema?.kind === 'toggle' ? '' : (schema?.unit ?? '')}`;
  }
}
