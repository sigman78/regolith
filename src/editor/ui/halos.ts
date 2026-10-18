/**
 * Port halos for the Connect tool: a ring on every PRESS port that can still
 * take a tube (never a halo on a port that cannot be used). Drag from one
 * ring to another, or click one then the other, to run a tube; the ghost shows
 * the routed result while you drag.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import { TUBE_RADIUS } from '@/geometry/design-constants';
import { canTakeTube, type ResolvedBase } from '@/grammar/solver';
import type { Link, PartId } from '@/world/document';
import { cmd } from '../commands';
import type { Ghost } from '../ghost';
import type { DocumentStore } from '../store';

export interface HalosHost {
  readonly store: DocumentStore;
  readonly ghost: Ghost;
  readonly camera: PerspectiveCamera;
  base(): ResolvedBase;
}

interface Slot {
  el: HTMLElement;
  part: PartId;
  port: string;
  x: number;
  y: number;
}

/** Screen distance (px) within which a released drag counts as landing on a ring. */
const SNAP_PX = 22;

export class Halos {
  private readonly pool: HTMLElement[] = [];
  private slots: Slot[] = [];
  private enabled = false;
  private armed: Slot | null = null;
  private drag: Slot | null = null;
  private readonly tmp = new Vector3();

  constructor(
    private readonly host: HalosHost,
    private readonly container: HTMLElement,
  ) {}

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.armed = null;
    this.drag = null;
    if (!on) {
      for (const el of this.pool) el.hidden = true;
      this.slots = [];
      this.host.ghost.hide();
    }
  }

  /** Call once per frame. */
  update(): void {
    if (!this.enabled) return;
    const base = this.host.base();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const slots: Slot[] = [];
    let n = 0;
    for (const part of base.parts.values()) {
      for (const port of part.ports) {
        if (!canTakeTube(port)) continue;
        if (base.usedPorts.has(`${part.id}/${port.id}`)) continue;
        this.tmp
          .set(port.position[0], port.position[1] + TUBE_RADIUS, port.position[2])
          .project(this.host.camera);
        if (this.tmp.z > 1) continue;
        const x = ((this.tmp.x + 1) / 2) * w;
        const y = ((1 - this.tmp.y) / 2) * h;
        if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
        const el = this.element(n++);
        el.hidden = false;
        el.style.transform = `translate(${x - 11}px, ${y - 11}px)`;
        slots.push({ el, part: part.id, port: port.id, x, y });
      }
    }
    for (let i = n; i < this.pool.length; i++) {
      const el = this.pool[i];
      if (el) el.hidden = true;
    }
    this.slots = slots;
    for (const s of slots) {
      s.el.classList.toggle('armed', this.armed?.part === s.part && this.armed.port === s.port);
    }
  }

  private element(i: number): HTMLElement {
    const hit = this.pool[i];
    if (hit) return hit;
    const el = document.createElement('div');
    el.className = 'halo';
    el.addEventListener('pointerdown', (e) => this.down(e, el));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e, el));
    el.addEventListener('pointercancel', (e) => this.cancel(e, el));
    this.container.appendChild(el);
    this.pool[i] = el;
    return el;
  }

  private slotOf(el: HTMLElement): Slot | undefined {
    return this.slots.find((s) => s.el === el);
  }

  private nearest(e: PointerEvent, except: Slot): Slot | null {
    let best: Slot | null = null;
    let bestD = SNAP_PX;
    for (const s of this.slots) {
      if (s.part === except.part) continue; // a part cannot connect to itself
      const d = Math.hypot(s.x - e.clientX, s.y - e.clientY);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  private down(e: PointerEvent, el: HTMLElement): void {
    if (e.button !== 0) return;
    const slot = this.slotOf(el);
    if (!slot) return;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    this.drag = slot;
  }

  private move(e: PointerEvent): void {
    const from = this.drag;
    if (!from) return;
    const to = this.nearest(e, from);
    if (to) this.host.ghost.showLink(link(from, to));
    else this.host.ghost.hide();
  }

  private up(e: PointerEvent, el: HTMLElement): void {
    const from = this.drag;
    this.drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    this.host.ghost.hide();
    if (!from) return;

    const to = this.nearest(e, from);
    if (to) {
      this.commit(from, to);
      return;
    }
    // A click (no drag): arm this ring, or complete a pending connection.
    const moved = Math.hypot(e.clientX - from.x, e.clientY - from.y) > SNAP_PX;
    if (moved) return;
    if (this.armed && this.armed.part !== from.part) {
      this.commit(this.armed, from);
    } else {
      this.armed = from;
    }
  }

  private cancel(e: PointerEvent, el: HTMLElement): void {
    this.drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    this.host.ghost.hide();
  }

  private commit(a: Slot, b: Slot): void {
    this.armed = null;
    this.host.store.execute(cmd.addLink(link(a, b)));
  }
}

function link(a: Slot, b: Slot): Link {
  return { a: { part: a.part, port: a.port }, b: { part: b.part, port: b.port }, kind: 'tube' };
}
