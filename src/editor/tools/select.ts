/**
 * Select tool: click picks a part, dragging a picked part moves it (the
 * solver resolves overlaps live, the dragged part yields), Delete removes the
 * selection, R turns it 45°. One drag is one undo step.
 */
import { snapYaw } from '@/core/math';
import { cmd } from '../commands';
import type { PointerInfo, Tool, ToolHost } from './tool';
import { pickPart } from '../pick';
import type { PartId } from '@/world/document';

export class SelectTool implements Tool {
  readonly id = 'select';
  readonly label = 'Select';
  readonly key = 'v';

  private drag: { id: PartId; dx: number; dz: number } | null = null;

  constructor(private readonly host: ToolHost) {}

  activate(): void {}

  deactivate(): void {
    this.endDrag();
    this.host.tip(null);
  }

  docChanged(): void {}

  move(p: PointerInfo): void {
    const { host } = this;
    if (this.drag) {
      const part = host.store.doc.parts[this.drag.id];
      if (!p.ground || !part) return;
      host.store.execute(
        cmd.setPose(this.drag.id, {
          x: p.ground[0] + this.drag.dx,
          z: p.ground[2] + this.drag.dz,
          yaw: part.pose.yaw,
        }),
      );
      return;
    }
    const hit = pickPart(p.ray, host.base());
    host.tip(hit ? host.describe(hit.id) : null, p.clientX, p.clientY);
  }

  down(p: PointerInfo): void {
    if (p.button !== 0) return;
    const { host } = this;
    const hit = pickPart(p.ray, host.base());
    if (!hit) {
      host.select(null);
      return;
    }
    host.select(hit.id);
    const part = host.base().parts.get(hit.id);
    if (!part || !p.ground) return;
    this.drag = { id: hit.id, dx: part.pose.x - p.ground[0], dz: part.pose.z - p.ground[2] };
    host.setMoving(hit.id);
    host.store.beginGesture('Move part');
  }

  up(): void {
    this.endDrag();
  }

  keydown(e: KeyboardEvent): boolean {
    const { host } = this;
    const id = host.selected;
    if (!id) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      host.store.execute(cmd.removePart(id));
      host.select(null);
      return true;
    }
    if (e.key.toLowerCase() === 'r') {
      const part = host.store.doc.parts[id];
      if (!part) return false;
      host.setMoving(id);
      host.store.execute(
        cmd.setPose(id, {
          x: part.pose.x,
          z: part.pose.z,
          yaw: snapYaw(part.pose.yaw + (e.shiftKey ? -45 : 45)),
        }),
      );
      host.commitResolved(id);
      host.setMoving(null);
      return true;
    }
    return false;
  }

  private endDrag(): void {
    if (!this.drag) return;
    const { host } = this;
    host.commitResolved(this.drag.id);
    host.store.endGesture();
    host.setMoving(null);
    this.drag = null;
  }
}
