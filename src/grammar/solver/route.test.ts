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

  it('gives up on a start walled into a pocket, and still finds a gap in a wall', () => {
    const box = (hole: boolean) => (x: number, z: number) => {
      const onWall = Math.max(Math.abs(x), Math.abs(z)) === 3;
      return !(onWall && !(hole && x === 3 && z === 0));
    };
    const q = {
      start: [0, 0] as Lattice,
      startHeading: 0,
      goal: [20, 0] as Lattice,
      goalHeading: 0,
    };
    // Start and goal themselves are open; only the box's wall blocks.
    expect(route({ ...q, free: box(false) })).toBeNull();
    const out = route({ ...q, free: box(true) });
    expect(out).not.toBeNull();
    expect(out?.[out.length - 1]).toEqual([20, 0]);
  });

  it('turns at most 45° per step, and runs straight at an end it is told is skewed', () => {
    const step = (a: number, b: number): number => {
      const d = Math.abs(a - b) % 8;
      return Math.min(d, 8 - d);
    };
    const cases: { start: Lattice; startHeading: number; goal: Lattice; goalHeading: number }[] = [
      // straight back behind the start: a U that used to be two 90° corners a cell apart
      { start: [0, 0], startHeading: 0, goal: [0, 3], goalHeading: 0 },
      { start: [0, 0], startHeading: 0, goal: [0, 1], goalHeading: 0 },
      { start: [0, 0], startHeading: 0, goal: [-6, 0], goalHeading: 0 },
      { start: [0, 0], startHeading: 2, goal: [5, -5], goalHeading: 6 },
    ];
    for (let seed = 1; seed <= 12; seed++) {
      cases.push({
        start: [0, 0],
        startHeading: seed % 8,
        goal: [(seed * 7) % 11, (seed * 5) % 9],
        goalHeading: (seed * 3) % 8,
      });
    }
    for (const c of cases) {
      // The cell ahead of the start and the one behind the goal stay open: the first and last
      // steps are straight by rule, so blocking them would make the case unroutable by design.
      const sd = DIRS[c.startHeading] as Lattice;
      const gd = DIRS[c.goalHeading] as Lattice;
      const open: Lattice[] = [
        c.start,
        c.goal,
        [c.start[0] + sd[0], c.start[1] + sd[1]],
        [c.goal[0] - gd[0], c.goal[1] - gd[1]],
      ];
      const blocked = (x: number, z: number): boolean =>
        ((x * 73856093) ^ (z * 19349663) ^ (c.goalHeading * 83492791)) % 7 === 0 &&
        !open.some((o) => o[0] === x && o[1] === z);
      const p = route({ ...c, free: (x, z) => !blocked(x, z) });
      expect(p).not.toBeNull();
      const hs = headings(p ?? []);
      expect(step(hs[0] ?? c.startHeading, c.startHeading)).toBeLessThanOrEqual(1);
      for (let i = 1; i < hs.length; i++) {
        expect(step(hs[i] as number, hs[i - 1] as number)).toBeLessThanOrEqual(1);
      }
      expect(step(hs[hs.length - 1] ?? c.goalHeading, c.goalHeading)).toBeLessThanOrEqual(1);

      // Told the ends are skewed, it leaves and arrives dead straight.
      const strict = route({
        ...c,
        free: (x, z) => !blocked(x, z),
        startStraight: true,
        goalStraight: true,
      });
      expect(strict).not.toBeNull();
      const hs2 = headings(strict ?? []);
      expect(hs2[0] ?? c.startHeading).toBe(c.startHeading);
      expect(hs2[hs2.length - 1] ?? c.goalHeading).toBe(c.goalHeading);
    }
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

  it('asks about each lattice point once, however many headings reach it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const blocked = (x: number, z: number): boolean =>
        ((x * 73856093) ^ (z * 19349663) ^ (seed * 83492791)) % 5 === 0;
      const asked = new Map<string, number>();
      const free = (x: number, z: number): boolean => {
        const k = `${x},${z}`;
        asked.set(k, (asked.get(k) ?? 0) + 1);
        return !blocked(x, z);
      };
      const q = {
        start: [0, 0] as Lattice,
        startHeading: 0,
        goal: [12, 7] as Lattice,
        goalHeading: 1,
      };
      const withMemo = route({ ...q, free });
      expect(Math.max(0, ...asked.values())).toBeLessThanOrEqual(1);
      // Every point on the path is one the predicate really allows.
      for (const p of withMemo ?? [])
        expect(blocked(p[0], p[1]) && p !== withMemo?.[0]).toBe(false);
    }
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
