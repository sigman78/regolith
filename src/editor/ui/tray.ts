/**
 * The tool tray along the bottom: one button per tool, undo and redo, plus a
 * one-line hint. Plain DOM; state flows in through `refresh()`.
 */
import type { ToolId } from '../tools/tool';
import type { DocumentStore } from '../store';

export interface TrayEntry {
  id: ToolId;
  label: string;
  key: string;
  /** Called when the button is pressed. */
  activate(): void;
}

const HINTS: Record<ToolId, string> = {
  select: 'click: pick · drag: move · R: turn · F: flip · Del: delete · orange discs: resize',
  place: 'click: place · R: turn 45° · F: flip · Esc: done',
  connect: 'drag from one ring to another to run a tube · Esc: done',
  delete: 'click a part or tube to delete it · Ctrl+Z brings it back',
};

export class Tray {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly hint: HTMLElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    entries: TrayEntry[],
    private readonly store: DocumentStore,
  ) {
    container.replaceChildren();
    const row = document.createElement('div');
    row.className = 'tray-row';
    for (const e of entries) {
      const b = this.button(`${e.label}`, e.key.toUpperCase(), e.activate);
      this.buttons.set(e.id + e.label, b);
      row.appendChild(b);
    }
    const sep = document.createElement('span');
    sep.className = 'tray-sep';
    row.appendChild(sep);
    this.undoBtn = this.button('Undo', 'Ctrl+Z', () => store.undo());
    this.redoBtn = this.button('Redo', 'Ctrl+Y', () => store.redo());
    row.append(this.undoBtn, this.redoBtn);

    this.hint = document.createElement('div');
    this.hint.className = 'tray-hint';
    container.append(row, this.hint);
    this.entries = entries;
  }

  private readonly entries: TrayEntry[];

  /** Highlight the active tool and refresh undo/redo availability. */
  refresh(active: { id: ToolId; label: string }): void {
    for (const e of this.entries) {
      this.buttons
        .get(e.id + e.label)
        ?.classList.toggle('active', e.id === active.id && e.label === active.label);
    }
    this.undoBtn.disabled = !this.store.canUndo;
    this.redoBtn.disabled = !this.store.canRedo;
    this.hint.textContent = HINTS[active.id];
  }

  private button(label: string, key: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${label}</span><kbd>${key}</kbd>`;
    b.addEventListener('click', onClick);
    return b;
  }
}
