/**
 * Lattice router for tubes: A* over integer (x, z) lattice points in the eight
 * 45° directions, with a turn penalty so tubes prefer long straight runs.
 *
 * State is (point, heading). The first move may continue the start heading for
 * free; turns of up to 90° are allowed per step, each 45° costing TUBE_TURN_COST;
 * reaching the goal adds the cost of turning into the goal heading.
 *
 * Pure: the caller supplies `free(x, z)` for lattice points (a point is free
 * when all four cells around it are). Moves are checked by their endpoints,
 * which also covers the cell a diagonal step passes through.
 */
import { TUBE_TURN_COST } from '@/geometry/design-constants';

export type Lattice = readonly [number, number];

/** Heading k points 45°·k from +X toward +Z. */
export const DIRS: readonly Lattice[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export interface RouteQuery {
  start: Lattice;
  startHeading: number;
  goal: Lattice;
  /** Heading the tube should be travelling when it reaches the goal. */
  goalHeading: number;
  free(x: number, z: number): boolean;
  /** Search window around the start/goal box, in lattice units. */
  margin?: number;
}

const turns = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 8;
  return Math.min(d, 8 - d);
};

/** Lattice points from start to goal inclusive with collinear points removed, or null. */
export function route(q: RouteQuery): Lattice[] | null {
  const margin = q.margin ?? 24;
  const x0 = Math.min(q.start[0], q.goal[0]) - margin;
  const x1 = Math.max(q.start[0], q.goal[0]) + margin;
  const z0 = Math.min(q.start[1], q.goal[1]) - margin;
  const z1 = Math.max(q.start[1], q.goal[1]) + margin;
  const w = x1 - x0 + 1;
  const h = z1 - z0 + 1;
  const id = (x: number, z: number, k: number): number => ((x - x0) * h + (z - z0)) * 8 + k;

  const g = new Float64Array(w * h * 8).fill(Infinity);
  const from = new Int32Array(w * h * 8).fill(-1);
  const heap = new MinHeap();

  const heuristic = (x: number, z: number): number => {
    const dx = Math.abs(x - q.goal[0]);
    const dz = Math.abs(z - q.goal[1]);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };

  const s = id(q.start[0], q.start[1], q.startHeading);
  g[s] = 0;
  heap.push(s, heuristic(q.start[0], q.start[1]));

  let best = Infinity;
  let bestState = -1;

  while (heap.size > 0) {
    const popped = heap.pop();
    if (!popped) break;
    const [cur, f] = popped;
    if (f >= best) break;
    const k = cur % 8;
    const cell = (cur - k) / 8;
    const z = (cell % h) + z0;
    const x = (cell - (cell % h)) / h + x0;
    const gc = g[cur] ?? Infinity;

    if (x === q.goal[0] && z === q.goal[1]) {
      const total = gc + TUBE_TURN_COST * turns(k, q.goalHeading);
      if (total < best) {
        best = total;
        bestState = cur;
      }
      continue;
    }

    for (let nk = 0; nk < 8; nk++) {
      const t = turns(k, nk);
      if (t > 2) continue;
      const d = DIRS[nk] as Lattice;
      const nx = x + d[0];
      const nz = z + d[1];
      if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
      if (!q.free(nx, nz)) continue;
      const step = (d[0] !== 0 && d[1] !== 0 ? Math.SQRT2 : 1) + TUBE_TURN_COST * t;
      const next = id(nx, nz, nk);
      const ng = gc + step;
      if (ng < (g[next] ?? Infinity)) {
        g[next] = ng;
        from[next] = cur;
        heap.push(next, ng + heuristic(nx, nz));
      }
    }
  }
  if (bestState < 0) return null;

  const pts: Lattice[] = [];
  for (let c = bestState; c >= 0; c = from[c] ?? -1) {
    const k = c % 8;
    const cell = (c - k) / 8;
    const z = (cell % h) + z0;
    const x = (cell - (cell % h)) / h + x0;
    pts.push([x, z]);
  }
  pts.reverse();
  return pts;
}

/** Drop lattice points that lie on a straight line between their neighbours. */
export function corners(points: readonly Lattice[]): Lattice[] {
  const out: Lattice[] = [];
  for (const p of points) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    if (b && b[0] === p[0] && b[1] === p[1]) continue;
    if (a && b) {
      const cross = (b[0] - a[0]) * (p[1] - b[1]) - (b[1] - a[1]) * (p[0] - b[0]);
      const dot = (b[0] - a[0]) * (p[0] - b[0]) + (b[1] - a[1]) * (p[1] - b[1]);
      if (cross === 0 && dot > 0) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/** Binary min-heap of (id, priority). */
class MinHeap {
  private ids: number[] = [];
  private prio: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, p: number): void {
    let i = this.ids.length;
    this.ids.push(id);
    this.prio.push(p);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.prio[parent] ?? 0) <= p) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): [number, number] | undefined {
    const n = this.ids.length;
    if (n === 0) return undefined;
    const top: [number, number] = [this.ids[0] ?? 0, this.prio[0] ?? 0];
    const lastId = this.ids.pop() ?? 0;
    const lastP = this.prio.pop() ?? 0;
    if (n > 1) {
      this.ids[0] = lastId;
      this.prio[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n - 1 && (this.prio[l] ?? 0) < (this.prio[m] ?? 0)) m = l;
        if (r < n - 1 && (this.prio[r] ?? 0) < (this.prio[m] ?? 0)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(i: number, j: number): void {
    const ti = this.ids[i] ?? 0;
    const tp = this.prio[i] ?? 0;
    this.ids[i] = this.ids[j] ?? 0;
    this.prio[i] = this.prio[j] ?? 0;
    this.ids[j] = ti;
    this.prio[j] = tp;
  }
}
