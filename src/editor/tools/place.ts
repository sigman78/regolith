/**
 * Place tool: a ghost follows the cursor showing the pose the solver will
 * actually give the part; click commits exactly that pose. R turns the part
 * 45° (Shift+R the other way), Escape goes back to Select.
 */
import { snapYaw } from '@/core/math';
import { getPart } from '@/grammar/registry';
import type { ParamValues } from '@/grammar/types';
import type { Letter } from '@/world/letter';
import { cmd } from '../commands';
import type { ParamEditor, PointerInfo, Tool, ToolHost } from './tool';

export class PlaceTool implements Tool {
  readonly id = 'place';
  readonly label: string;
  readonly key: string;

  private yaw = 0;
  private cursor: { x: number; z: number } | null = null;
  /** Remembered per letter (one PlaceTool each), so Esc and back keeps your choice. */
  private params: ParamValues;

  constructor(
    private readonly host: ToolHost,
    private readonly letter: Letter,
    key: string,
  ) {
    this.label = getPart(letter)?.name ?? letter;
    this.key = key;
    this.params = getPart(letter)?.resolve({}) ?? {};
  }

  activate(): void {}

  editor(): ParamEditor | null {
    const def = getPart(this.letter);
    if (!def) return null;
    return {
      title: `New ${def.name.toLowerCase()}`,
      schema: def.schema,
      values: this.params,
      set: (key, value) => {
        this.params = def.resolve({ ...this.params, [key]: value });
        this.refresh();
        this.host.refreshUi();
      },
    };
  }

  deactivate(): void {
    this.host.ghost.hide();
    this.cursor = null;
  }

  docChanged(): void {
    this.refresh();
  }

  move(p: PointerInfo): void {
    this.cursor = p.ground ? { x: p.ground[0], z: p.ground[2] } : null;
    this.refresh();
  }

  down(p: PointerInfo): void {
    if (p.button !== 0) return;
    const part = this.host.ghost.resolved;
    if (!part) return;
    this.host.store.execute(
      cmd.addPart({
        id: this.host.newId(),
        letter: this.letter,
        params: part.params,
        pose: { x: part.pose.x, z: part.pose.z, yaw: snapYaw(part.pose.yaw) },
      }),
    );
    this.refresh();
  }

  up(): void {}

  keydown(e: KeyboardEvent): boolean {
    if (e.key.toLowerCase() === 'r') {
      this.yaw = (this.yaw + (e.shiftKey ? -45 : 45) + 360) % 360;
      this.refresh();
      return true;
    }
    if (e.key === 'Escape') {
      this.host.setTool('select');
      return true;
    }
    return false;
  }

  private refresh(): void {
    if (!this.cursor) {
      this.host.ghost.hide();
      return;
    }
    this.host.ghost.show(this.letter, this.params, { ...this.cursor, yaw: this.yaw });
  }
}
