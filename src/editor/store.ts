/**
 * The document store: current document, undo/redo, change notification.
 *
 * Drags are gestures: between `beginGesture` and `endGesture` commands update
 * the live document but history gets one entry, so a 40-frame drag is one
 * undo step. `cancelGesture` puts the document back as it was.
 */
import type { BaseDocument } from '@/world/document';
import type { Command } from './commands';

interface HistoryEntry {
  label: string;
  before: BaseDocument;
  after: BaseDocument;
}

type Listener = (doc: BaseDocument) => void;

const HISTORY_LIMIT = 200;

export class DocumentStore {
  private current: BaseDocument;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private readonly listeners = new Set<Listener>();
  private gesture: { label: string; before: BaseDocument } | null = null;

  constructor(initial: BaseDocument) {
    this.current = initial;
  }

  get doc(): BaseDocument {
    return this.current;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Apply a command. Inside a gesture it only updates the live document. */
  execute(command: Command): void {
    const before = this.current;
    const after = command.apply(before);
    if (after === before) return;
    this.current = after;
    if (!this.gesture) this.push({ label: command.label, before, after });
    this.emit();
  }

  beginGesture(label: string): void {
    if (this.gesture) this.endGesture();
    this.gesture = { label, before: this.current };
  }

  endGesture(): void {
    const g = this.gesture;
    this.gesture = null;
    if (g && this.current !== g.before) {
      this.push({ label: g.label, before: g.before, after: this.current });
    }
  }

  cancelGesture(): void {
    const g = this.gesture;
    this.gesture = null;
    if (g && this.current !== g.before) {
      this.current = g.before;
      this.emit();
    }
  }

  undo(): boolean {
    this.endGesture();
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.redoStack.push(entry);
    this.current = entry.before;
    this.emit();
    return true;
  }

  redo(): boolean {
    this.endGesture();
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.undoStack.push(entry);
    this.current = entry.after;
    this.emit();
    return true;
  }

  /** Replace the document wholesale (load). History is cleared. */
  reset(doc: BaseDocument): void {
    this.gesture = null;
    this.undoStack = [];
    this.redoStack = [];
    this.current = doc;
    this.emit();
  }

  private push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.current);
  }
}
