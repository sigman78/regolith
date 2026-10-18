import { describe, expect, it } from 'vitest';
import { solve, type ResolvedBase, type SolverWorld } from '@/grammar/solver';
import { addLink, addPart, createDocument } from '@/world/document';
import { cmd } from '../commands';
import type { Ghost } from '../ghost';
import { DocumentStore } from '../store';
import { PlaceTool } from './place';
import { SelectTool } from './select';
import type { ToolHost } from './tool';

const WORLD: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function setup() {
  const store = new DocumentStore(createDocument({ seed: 's' }));
  let selected: string | null = null;
  let moving: string | null = null;
  let base: ResolvedBase = solve(store.doc, WORLD);
  store.subscribe(() => {
    base = solve(store.doc, WORLD, moving ? { movingId: moving } : {});
  });
  const shown: unknown[] = [];
  const host: ToolHost = {
    store,
    ghost: {
      show: (...args: unknown[]) => {
        shown.push(args);
        return null;
      },
      hide: () => null,
      resolved: null,
    } as unknown as Ghost,
    get selected() {
      return selected;
    },
    base: () => base,
    newId: () => 'new',
    setTool: () => {},
    select: (id) => {
      selected = id;
    },
    setMoving: (id) => {
      moving = id;
    },
    commitResolved: (id) => {
      const part = base.parts.get(id);
      if (part)
        store.execute(cmd.setPose(id, { x: part.pose.x, z: part.pose.z, yaw: part.pose.yaw as 0 }));
    },
    tip: () => {},
    describe: (id) => id,
    refreshUi: () => {},
  };
  return { store, host, base: () => base, select: host.select };
}

describe('parameter picker: select tool', () => {
  it('changes a parameter as exactly one undo step, clamped to the schema', () => {
    const { store, host } = setup();
    store.execute(
      cmd.addPart({ id: 't', letter: 'V', params: { floors: 3 }, pose: { x: 0, z: 0, yaw: 0 } }),
    );
    host.select('t');
    const editor = new SelectTool(host).editor();
    expect(editor?.values).toEqual({ floors: 3 });

    const depth = store.canUndo;
    editor?.set('floors', 99);
    expect(store.doc.parts['t']?.params['floors']).toBe(5); // clamped, not rejected

    expect(store.undo()).toBe(true);
    expect(store.doc.parts['t']?.params['floors']).toBe(3);
    // One undo undid the whole change, so we are back at the single "add" entry.
    expect(store.canUndo).toBe(depth);
  });

  it('offers nothing for a derived node or an empty selection', () => {
    const { host } = setup();
    const tool = new SelectTool(host);
    expect(tool.editor()).toBeNull();
    host.select('node:a/end+~b/end-:0');
    expect(tool.editor()).toBeNull();
  });

  it('turns a link into link-skipped when its port goes away, and restores it', () => {
    const { store, host, base } = setup();
    store.execute(
      cmd.addPart({ id: 't', letter: 'V', params: { floors: 5 }, pose: { x: 0, z: 0, yaw: 0 } }),
    );
    store.execute(
      cmd.addPart({
        id: 'h',
        letter: 'H',
        params: { length: 8, radius: 2 },
        pose: { x: 20, z: 0, yaw: 0 },
      }),
    );
    store.execute(
      cmd.addLink({
        a: { part: 't', port: 'f4-0' },
        b: { part: 'h', port: 'end-' },
        kind: 'tube',
      }),
    );
    expect([...base().tubes.keys()].some((k) => k.startsWith('tube:'))).toBe(true);

    host.select('t');
    new SelectTool(host).editor()?.set('floors', 3);
    expect(base().diagnostics.some((d) => d.kind === 'link-skipped')).toBe(true);
    expect(store.doc.links).toHaveLength(1); // kept, not pruned

    store.undo();
    expect([...base().tubes.keys()].some((k) => k.startsWith('tube:'))).toBe(true);
  });
});

describe('parameter picker: place tool', () => {
  it('remembers its parameters across Esc and re-activation', () => {
    const { host } = setup();
    const tool = new PlaceTool(host, 'V', '3');
    tool.activate();
    tool.editor()?.set('floors', 5);
    tool.deactivate();
    tool.activate();
    expect(tool.editor()?.values).toEqual({ floors: 5 });
  });
});

describe('solver with parameter-edited parts stays valid', () => {
  it('never throws for any floors value', () => {
    for (const floors of [-5, 0, 2.4, 5, 99]) {
      let doc = createDocument({ seed: 's' });
      doc = addPart(doc, {
        id: 't',
        letter: 'V',
        params: { floors },
        pose: { x: 0, z: 0, yaw: 0 },
      });
      doc = addLink(doc, {
        a: { part: 't', port: 'g-0' },
        b: { part: 't', port: 'g-2' },
        kind: 'tube',
      });
      expect(() => solve(doc, WORLD)).not.toThrow();
    }
  });
});
