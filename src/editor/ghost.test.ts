import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { addPart, createDocument } from '@/world/document';
import { Ghost, needsSnapArrow } from './ghost';

describe('snap arrow rule', () => {
  it('stays hidden for a nudge of 0.25 m or less, shows beyond it', () => {
    expect(needsSnapArrow({ x: 0, z: 0 }, { x: 0.2, z: 0 })).toBe(false);
    expect(needsSnapArrow({ x: 0, z: 0 }, { x: 0.25, z: 0 })).toBe(false);
    expect(needsSnapArrow({ x: 0, z: 0 }, { x: 0.26, z: 0 })).toBe(true);
    expect(needsSnapArrow({ x: 1, z: 1 }, { x: 4, z: 5 })).toBe(true);
  });
});

describe('ghost throttle', () => {
  const world = { halfSize: 48, heightAt: () => 0 };
  const make = (doc = createDocument({ seed: 'g' })) => {
    const holder = { doc };
    return { ghost: new Ghost(new Scene(), world, () => holder.doc), holder };
  };

  it('solves again only when the snapped pose, the part or the document changes', () => {
    const { ghost, holder } = make();
    ghost.show('H', {}, { x: 10.1, z: 4.2, yaw: 0 });
    ghost.show('H', {}, { x: 10.3, z: 3.8, yaw: 0 });
    expect(ghost.solves).toBe(1);
    ghost.show('H', {}, { x: 11.2, z: 4, yaw: 0 });
    expect(ghost.solves).toBe(2);
    ghost.show('H', {}, { x: 11.2, z: 4, yaw: 90 });
    expect(ghost.solves).toBe(3);
    ghost.show('N', {}, { x: 11.2, z: 4, yaw: 90 });
    expect(ghost.solves).toBe(4);
    holder.doc = addPart(holder.doc, { id: 'a', letter: 'H', pose: { x: -20, z: 0, yaw: 0 } });
    ghost.show('N', {}, { x: 11.2, z: 4, yaw: 90 });
    expect(ghost.solves).toBe(5);
  });

  it('shows the same part as a fresh solve would', () => {
    const { ghost } = make();
    const first = ghost.show('H', {}, { x: 3, z: 3, yaw: 0 });
    const again = ghost.show('H', {}, { x: 3.2, z: 2.9, yaw: 0 });
    expect(again).toBe(first);
    ghost.hide();
    const fresh = ghost.show('H', {}, { x: 3.2, z: 2.9, yaw: 0 });
    expect(fresh?.pose).toEqual(first?.pose);
    expect(ghost.solves).toBe(2);
  });
});
