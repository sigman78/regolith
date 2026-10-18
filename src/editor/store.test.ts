import { describe, expect, it, vi } from 'vitest';
import { createDocument, partList } from '@/world/document';
import { cmd } from './commands';
import { DocumentStore } from './store';

const pose = (x: number) => ({ x, z: 0, yaw: 0 as const });
const hab = (id: string, x = 0) => cmd.addPart({ id, letter: 'H', pose: pose(x) });

function fresh() {
  return new DocumentStore(createDocument({ seed: 'test' }));
}

describe('document commands', () => {
  it('adds, moves, resizes and deletes parts', () => {
    const s = fresh();
    s.execute(hab('a'));
    s.execute(cmd.setPose('a', pose(5)));
    s.execute(cmd.setParams('a', { length: 12 }));
    expect(s.doc.parts.a?.pose.x).toBe(5);
    expect(s.doc.parts.a?.params).toEqual({ length: 12 });
    s.execute(cmd.removePart('a'));
    expect(partList(s.doc)).toHaveLength(0);
  });

  it('allocates serials once and never reuses them after a delete', () => {
    const s = fresh();
    s.execute(hab('a'));
    s.execute(hab('b'));
    s.execute(cmd.removePart('a'));
    s.execute(hab('c'));
    expect(s.doc.parts.b?.serial).toBe(2);
    expect(s.doc.parts.c?.serial).toBe(3);
  });

  it('removing a part removes its links', () => {
    const s = fresh();
    s.execute(hab('a'));
    s.execute(hab('b', 10));
    s.execute(
      cmd.addLink({ a: { part: 'a', port: 'end+' }, b: { part: 'b', port: 'end-' }, kind: 'tube' }),
    );
    expect(s.doc.links).toHaveLength(1);
    s.execute(cmd.removePart('b'));
    expect(s.doc.links).toHaveLength(0);
  });

  it('treats links as undirected and ignores duplicates', () => {
    const s = fresh();
    s.execute(hab('a'));
    s.execute(hab('b', 10));
    const l = {
      a: { part: 'a', port: 'end+' },
      b: { part: 'b', port: 'end-' },
      kind: 'tube',
    } as const;
    s.execute(cmd.addLink(l));
    s.execute(cmd.addLink({ ...l, a: l.b, b: l.a }));
    expect(s.doc.links).toHaveLength(1);
  });

  it('ignores no-op commands (no history entry, no notification)', () => {
    const s = fresh();
    s.execute(hab('a'));
    const fn = vi.fn();
    s.subscribe(fn);
    s.execute(cmd.setPose('a', pose(0)));
    s.execute(cmd.removePart('missing'));
    expect(fn).not.toHaveBeenCalled();
    s.undo();
    expect(s.canUndo).toBe(false);
  });
});

describe('undo / redo', () => {
  it('undoes everything back to the empty document and redoes it', () => {
    const s = fresh();
    const empty = s.doc;
    s.execute(hab('a'));
    s.execute(hab('b', 8));
    s.execute(cmd.setPose('a', pose(3)));
    const full = s.doc;
    while (s.undo());
    expect(s.doc).toBe(empty);
    while (s.redo());
    expect(s.doc).toBe(full);
  });

  it('clears redo when a new command arrives', () => {
    const s = fresh();
    s.execute(hab('a'));
    s.undo();
    expect(s.canRedo).toBe(true);
    s.execute(hab('b'));
    expect(s.canRedo).toBe(false);
  });

  it('coalesces a drag into one undo step', () => {
    const s = fresh();
    s.execute(hab('a'));
    s.beginGesture('Move part');
    for (let x = 1; x <= 40; x++) s.execute(cmd.setPose('a', pose(x)));
    s.endGesture();
    expect(s.doc.parts.a?.pose.x).toBe(40);
    s.undo();
    expect(s.doc.parts.a?.pose.x).toBe(0);
    s.undo();
    expect(partList(s.doc)).toHaveLength(0);
  });

  it('cancels a gesture back to the pre-drag document', () => {
    const s = fresh();
    s.execute(hab('a'));
    const before = s.doc;
    s.beginGesture('Move part');
    s.execute(cmd.setPose('a', pose(9)));
    s.cancelGesture();
    expect(s.doc).toBe(before);
    s.undo();
    expect(partList(s.doc)).toHaveLength(0);
  });

  it('notifies subscribers on execute, undo and redo', () => {
    const s = fresh();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.execute(hab('a'));
    s.undo();
    s.redo();
    expect(fn).toHaveBeenCalledTimes(3);
    off();
    s.undo();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
