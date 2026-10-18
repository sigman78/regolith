/**
 * Delete tool: click a part to remove it. No confirmation (pillar P1): undo
 * is one key away.
 */
import { cmd } from '../commands';
import { linkKey } from '@/grammar/solver';
import { pickPart, pickTube } from '../pick';
import type { PointerInfo, Tool, ToolHost } from './tool';

export class DeleteTool implements Tool {
  readonly id = 'delete';
  readonly label = 'Delete';
  readonly key = 'x';

  constructor(private readonly host: ToolHost) {}

  activate(): void {
    this.host.select(null);
  }

  deactivate(): void {
    this.host.tip(null);
  }

  docChanged(): void {}

  editor(): null {
    return null;
  }

  move(p: PointerInfo): void {
    const hit = this.target(p);
    this.host.tip(hit ? `Delete ${hit.label}` : null, p.clientX, p.clientY);
  }

  down(p: PointerInfo): void {
    if (p.button !== 0) return;
    this.target(p)?.run();
    this.move(p);
  }

  /** Nearest thing under the cursor that can be deleted, tubes included. */
  private target(p: PointerInfo): { label: string; run: () => void } | null {
    const { host } = this;
    const base = host.base();
    const part = pickPart(p.ray, base);
    const tube = pickTube(p.ray, base);
    // Derived nodes belong to a tube; they are not in the document.
    const partHit = part && !base.parts.get(part.id)?.derived ? part : null;
    if (tube && (!partHit || tube.t < partHit.t)) {
      const key = tube.id.split(':').slice(1, -1).join(':');
      const link = host.store.doc.links.find((l) => linkKey(l) === key);
      return link ? { label: 'tube', run: () => host.store.execute(cmd.removeLink(link)) } : null;
    }
    if (partHit) {
      return {
        label: host.describe(partHit.id),
        run: () => host.store.execute(cmd.removePart(partHit.id)),
      };
    }
    return null;
  }

  up(): void {}

  keydown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.host.setTool('select');
      return true;
    }
    return false;
  }
}
