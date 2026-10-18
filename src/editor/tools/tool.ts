/**
 * Tool contract. One tool is active at a time; the app shell turns raw
 * pointer and key events into these calls. Tools change the document only by
 * executing commands on the store (ARCHITECTURE §8).
 */
import type { Vec3 } from '@/core/math';
import type { ResolvedBase } from '@/grammar/solver';
import type { ParamSchema, ParamValue, ParamValues } from '@/grammar/types';
import type { PartId } from '@/world/document';
import type { Ray } from '@/world/raycast';
import type { Ghost } from '../ghost';
import type { DocumentStore } from '../store';

export type ToolId = 'select' | 'place' | 'connect' | 'delete';

/** What the parameter picker shows for the active tool: a schema, its current values, and a setter. */
export interface ParamEditor {
  title: string;
  schema: ParamSchema;
  values: ParamValues;
  /** Clamps and applies; one call is one undo step when it edits the document. */
  set(key: string, value: ParamValue): void;
}

export interface PointerInfo {
  ray: Ray;
  /** where the ray meets the terrain, or null when it misses */
  ground: Vec3 | null;
  clientX: number;
  clientY: number;
  button: number;
  shift: boolean;
}

export interface ToolHost {
  readonly store: DocumentStore;
  readonly ghost: Ghost;
  readonly selected: PartId | null;
  /** The resolved live document. */
  base(): ResolvedBase;
  newId(): PartId;
  setTool(id: ToolId): void;
  select(id: PartId | null): void;
  /** Mark a part as being dragged so the solver lets it yield on overlap. */
  setMoving(id: PartId | null): void;
  /** Store the solver's resolved pose in the document so it does not drift back later. */
  commitResolved(id: PartId): void;
  /** Small text near the cursor; null hides it. */
  tip(text: string | null, clientX?: number, clientY?: number): void;
  describe(id: PartId): string;
  /** Rebuild the tray and the parameter picker (selection or tool state changed). */
  refreshUi(): void;
}

export interface Tool {
  readonly id: ToolId;
  readonly label: string;
  /** Single key that activates the tool. */
  readonly key: string;
  activate(): void;
  deactivate(): void;
  /** Parameters the picker should offer right now, or null for none. */
  editor(): ParamEditor | null;
  move(p: PointerInfo): void;
  down(p: PointerInfo): void;
  up(p: PointerInfo): void;
  /** Return true when the key was used. */
  keydown(e: KeyboardEvent): boolean;
  /** The document changed (undo, redo, another tool); refresh any preview. */
  docChanged(): void;
}
