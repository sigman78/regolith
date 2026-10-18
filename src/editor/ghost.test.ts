import { describe, expect, it } from 'vitest';
import { needsSnapArrow } from './ghost';

describe('snap arrow rule', () => {
  it('stays hidden for a nudge of 0.25 m or less, shows beyond it', () => {
    expect(needsSnapArrow({ x: 0, z: 0 }, { x: 0.2, z: 0 })).toBe(false);
    expect(needsSnapArrow({ x: 0, z: 0 }, { x: 0.25, z: 0 })).toBe(false);
    expect(needsSnapArrow({ x: 0, z: 0 }, { x: 0.26, z: 0 })).toBe(true);
    expect(needsSnapArrow({ x: 1, z: 1 }, { x: 4, z: 5 })).toBe(true);
  });
});
