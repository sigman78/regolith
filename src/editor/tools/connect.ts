/**
 * Connect tool: shows a halo on every free PRESS port; dragging from one halo
 * to another (or clicking one, then the other) runs a tube. The work happens
 * in ui/halos.ts because halos are DOM elements; this class only switches it on.
 */
import type { Halos } from '../ui/halos';
import type { Tool, ToolHost } from './tool';

export class ConnectTool implements Tool {
  readonly id = 'connect';
  readonly label = 'Connect';
  readonly key = 'c';

  constructor(
    private readonly host: ToolHost,
    private readonly halos: Halos,
  ) {}

  activate(): void {
    this.host.select(null);
    this.halos.setEnabled(true);
  }

  deactivate(): void {
    this.halos.setEnabled(false);
  }

  docChanged(): void {}

  editor(): null {
    return null;
  }
  move(): void {}
  down(): void {}
  up(): void {}

  keydown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.host.setTool('select');
      return true;
    }
    return false;
  }
}
