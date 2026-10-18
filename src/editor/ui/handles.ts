/**
 * Grow handles: two orange discs at the ends of a selected hab. Dragging one
 * pulls that end out along the hull axis; the other end stays put and the
 * length snaps to rib segments. DOM elements positioned by projecting the end
 * ports each frame (DESIGN_GUIDE §12).
 *
 * Growth stops at obstacles instead of shoving the hab sideways: a candidate
 * length that the solver would have to move to resolve is simply not applied.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import { rotateY, snap, snapYaw } from '@/core/math';
import { GRID, HAB_CAP_RATIO } from '@/geometry/design-constants';
import { getPart } from '@/grammar/registry';
import { habHalfExtent } from '@/grammar/parts/H';
import { solve, type ResolvedBase, type SolverWorld } from '@/grammar/solver';
import type { PartId } from '@/world/document';
import type { Ray } from '@/world/raycast';
import { cmd } from '../commands';
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

interface Drag {
  id: PartId;
  /** +1 for the end at +X, -1 for -X */
  sign: 1 | -1;
  /** fixed end, world XZ */
  fixed: [number, number];
  /** unit axis, world XZ */
  axis: [number, number];
  /** world height of the end port, for the drag plane */
  planeY: number;
  lastLength: number;
}

export class GrowHandles {
  private readonly discs: [HTMLElement, HTMLElement];
  private drag: Drag | null = null;
  private readonly tmp = new Vector3();

  constructor(
    private readonly host: HandlesHost,
    container: HTMLElement,
  ) {
    this.discs = [this.makeDisc(container, -1), this.makeDisc(container, 1)];
  }

  /** Call once per frame. */
  update(): void {
    const id = this.host.selected;
    const part = id ? this.host.base().parts.get(id) : undefined;
    if (!part || part.letter !== 'H') {
      for (const d of this.discs) d.hidden = true;
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const [i, sign] of [-1, 1].entries()) {
      const disc = this.discs[i];
      const port = part.ports.find((p) => p.id === (sign > 0 ? 'end+' : 'end-'));
      if (!disc || !port) continue;
      // Sit just outside the cap so the disc never covers the hatch.
      this.tmp
        .set(
          port.position[0] + port.normal[0] * 1.2,
          port.position[1] + port.normal[1] * 1.2,
          port.position[2] + port.normal[2] * 1.2,
        )
        .project(this.host.camera);
      disc.hidden = this.tmp.z > 1;
      disc.style.transform = `translate(${((this.tmp.x + 1) / 2) * w - 12}px, ${((1 - this.tmp.y) / 2) * h - 12}px)`;
    }
  }

  private makeDisc(container: HTMLElement, sign: 1 | -1): HTMLElement {
    const el = document.createElement('div');
    el.className = 'handle';
    el.hidden = true;
    el.title = 'Drag to grow';
    el.addEventListener('pointerdown', (e) => this.begin(e, el, sign));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.end(e, el));
    el.addEventListener('pointercancel', (e) => this.end(e, el));
    container.appendChild(el);
    return el;
  }

  private begin(e: PointerEvent, el: HTMLElement, sign: 1 | -1): void {
    const { host } = this;
    const id = host.selected;
    const part = id ? host.base().parts.get(id) : undefined;
    if (!id || !part || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);

    const length = Number(part.params['length']);
    const a = rotateY([1, 0, 0], part.pose.yaw);
    const axis: [number, number] = [a[0], a[2]];
    const ext = habHalfExtent({ length, radius: Number(part.params['radius']) });
    const port = part.ports.find((p) => p.id === (sign > 0 ? 'end+' : 'end-'));
    this.drag = {
      id,
      sign,
      axis,
      fixed: [part.pose.x - sign * axis[0] * ext, part.pose.z - sign * axis[1] * ext],
      planeY: port?.position[1] ?? part.pose.y,
      lastLength: length,
    };
    host.setMoving(id);
    host.store.beginGesture('Resize part');
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const { host } = this;
    const part = host.store.doc.parts[d.id];
    const def = getPart('H');
    if (!part || !def) return;

    const ray = host.rayAt(e.clientX, e.clientY);
    if (Math.abs(ray.dir[1]) < 1e-6) return;
    const t = (d.planeY - ray.origin[1]) / ray.dir[1];
    if (t <= 0) return;
    const px = ray.origin[0] + ray.dir[0] * t;
    const pz = ray.origin[2] + ray.dir[2] * t;

    // Span from the fixed end to the pointer, along the outward axis.
    const radius = Number(part.params['radius']);
    const span = (px - d.fixed[0]) * d.sign * d.axis[0] + (pz - d.fixed[1]) * d.sign * d.axis[1];
    const next = def.resolve({ ...part.params, length: span - 2 * radius * HAB_CAP_RATIO });
    const length = Number(next['length']);
    if (length === d.lastLength) return;

    const ext = habHalfExtent({ length, radius });
    const x = d.fixed[0] + d.sign * d.axis[0] * ext;
    const z = d.fixed[1] + d.sign * d.axis[1] * ext;
    const yaw = snapYaw(part.pose.yaw);
    const params = { ...part.params, length };

    // Would the solver have to move it? Then it has hit something: stay put.
    const trial = cmd.edit(d.id, { params, pose: { x, z, yaw } }).apply(host.store.doc);
    const resolved = solve(trial, host.world, { movingId: d.id }).parts.get(d.id);
    if (!resolved) return;
    if (
      Math.abs(resolved.pose.x - snap(x, GRID)) > 1e-6 ||
      Math.abs(resolved.pose.z - snap(z, GRID)) > 1e-6
    ) {
      return;
    }
    host.store.execute(cmd.edit(d.id, { params, pose: { x, z, yaw } }));
    d.lastLength = length;
  }

  private end(e: PointerEvent, el: HTMLElement): void {
    const d = this.drag;
    if (!d) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    this.host.commitResolved(d.id);
    this.host.store.endGesture();
    this.host.setMoving(null);
    this.drag = null;
  }
}
