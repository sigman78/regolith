import { describe, expect, it } from 'vitest';
import { corners, DIRS, route, type Lattice } from './route';

const open = () => true;

function headings(points: readonly Lattice[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i] as Lattice;
    const b = points[i + 1] as Lattice;
    out.push(
      DIRS.findIndex((d) => d[0] === Math.sign(b[0] - a[0]) && d[1] === Math.sign(b[1] - a[1])),
    );
  }
  return out;
}

describe('route', () => {
  it('goes straight when nothing is in the way', () => {
    const p = route({ start: [0, 0], startHeading: 0, goal: [10, 0], goalHeading: 0, free: open });
    expect(p).not.toBeNull();
    expect(corners(p ?? [])).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it('only ever moves in the eight 45° headings, one lattice step at a time', () => {
    const p = route({ start: [0, 0], startHeading: 0, goal: [7, 13], goalHeading: 2, free: open });
    expect(p).not.toBeNull();
    for (const h of headings(p ?? [])) expect(h).toBeGreaterThanOrEqual(0);
    for (let i = 0; i + 1 < (p?.length ?? 0); i++) {
      const a = p?.[i] as Lattice;
      const b = p?.[i + 1] as Lattice;
      expect(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))).toBe(1);
    }
  });

  it('prefers few turns: a diagonal then straight, not a staircase', () => {
    const p = route({ start: [0, 0], startHeading: 0, goal: [10, 4], goalHeading: 0, free: open });
    expect(corners(p ?? []).length).toBeLessThanOrEqual(4);
  });

  it('detours around a wall and never touches blocked points', () => {
    const wall = (x: number, z: number) => !(x === 5 && z >= -6 && z <= 6);
    const p = route({ start: [0, 0], startHeading: 0, goal: [10, 0], goalHeading: 0, free: wall });
    expect(p).not.toBeNull();
    for (const [x, z] of p ?? []) expect(wall(x, z)).toBe(true);
    expect(p?.some(([, z]) => Math.abs(z) > 6)).toBe(true);
  });

  it('returns null when the goal is sealed off', () => {
    const ring = (x: number, z: number) => Math.max(Math.abs(x - 10), Math.abs(z)) !== 1;
    const p = route({ start: [0, 0], startHeading: 0, goal: [10, 0], goalHeading: 0, free: ring });
    expect(p).toBeNull();
  });

  it('is deterministic', () => {
    const q = {
      start: [0, 0] as Lattice,
      startHeading: 0,
      goal: [9, 9] as Lattice,
      goalHeading: 1,
      free: open,
    };
    expect(route(q)).toEqual(route(q));
  });
});

describe('corners', () => {
  it('drops collinear points and keeps bends', () => {
    expect(
      corners([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 1],
        [4, 2],
        [4, 3],
      ]),
    ).toEqual([
      [0, 0],
      [2, 0],
      [4, 2],
      [4, 3],
    ]);
  });
});
