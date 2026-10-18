import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import {
  GRID,
  LOCK_OPEN_TICKS,
  LOCK_PUMP_TICKS,
  LOCK_RIDERS,
  LOCK_SEAL_TICKS,
  LOITER_ANGLES_DEG,
  LOITER_DISTANCES,
} from '@/geometry/design-constants';
import { solve, type ResolvedBase, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument, removePart, type BaseDocument } from '@/world/document';
import { enqueue, newLock, stepLock, type LockPhase } from './airlock';
import {
  CREW_STRIDE,
  crewPoints,
  emptyCrew,
  stepCrew,
  type CrewState,
  type CrewWorld,
} from './crew';
import { LOITER_CANDIDATES, loiterSpot, type NavEnv } from './loiter';

const FLAT: SolverWorld = { halfSize: 64, heightAt: () => 0 };

/** Two habs and an airlock docked to the first one's flank (-2, 2), so there are three crew. */
function base(): BaseDocument {
  let doc = createDocument({ seed: 'out' });
  doc = addPart(doc, {
    id: 'h0',
    letter: 'H',
    params: { length: 10, radius: 2 },
    pose: { x: 0, z: 0, yaw: snapYaw(0) },
  });
  doc = addPart(doc, {
    id: 'a0',
    letter: 'A',
    params: { radius: 2 },
    pose: { x: -2, z: 5, yaw: snapYaw(270) },
  });
  doc = addPart(doc, {
    id: 'h1',
    letter: 'H',
    params: { length: 10, radius: 2 },
    pose: { x: 0, z: -9.5, yaw: snapYaw(0) },
  });
  return doc;
}

function worldOf(resolved: ResolvedBase): CrewWorld {
  return { graph: resolved.graph, env: { keepOut: resolved.keepOut, heightAt: () => 0 } };
}

interface Run {
  crew: CrewState;
  resolved: ResolvedBase;
  world: CrewWorld;
}

function start(doc = base()): Run {
  const resolved = solve(doc, FLAT);
  return { crew: emptyCrew(), resolved, world: worldOf(resolved) };
}

/** Run `ticks` ticks at `hour`, calling `each` after every one. */
function run(
  r: Run,
  from: number,
  ticks: number,
  hour: number,
  each?: (tick: number) => void,
): void {
  for (let t = from; t < from + ticks; t++) {
    stepCrew(r.crew, r.world, 'out', t, hour);
    each?.(t);
  }
}

const outside = (r: Run): number => r.crew.agents.filter((a) => a.outside).length;

describe('airlock cycle', () => {
  it('runs seal, pump, open, idle for up to two riders going the same way', () => {
    const lock = newLock();
    enqueue(lock, 0, 1);
    enqueue(lock, 1, -1);
    enqueue(lock, 2, 1);
    enqueue(lock, 3, 1);
    const released: number[][] = [];
    const phases: LockPhase[] = [];
    let batch: number[] = [];
    for (let t = 0; t < 400; t++) {
      const before = lock.phase;
      stepLock(lock, (i) => batch.push(i));
      if (lock.phase !== before) {
        phases.push(lock.phase);
        if (before === 'pump' && lock.phase === 'open') {
          released.push(batch);
          batch = [];
        }
      }
    }
    // First cycle: the first two who go out (0 and 2); then the one coming in; then the last.
    expect(released).toEqual([[0, 2], [1], [3]]);
    expect(phases.slice(0, 4)).toEqual(['seal', 'pump', 'open', 'idle']);
    for (const r of released) expect(r.length).toBeLessThanOrEqual(LOCK_RIDERS);
    expect(LOCK_SEAL_TICKS + LOCK_PUMP_TICKS + LOCK_OPEN_TICKS).toBeGreaterThan(0);
  });
});

describe('loiter spot', () => {
  const centre: [number, number, number] = [0, 0, 0];
  const foot: [number, number, number] = [0, 0, 4];

  it('lies 4-8 m from the foot, in front of the door, and is stable per slot', () => {
    const env: NavEnv = { keepOut: null, heightAt: () => 1.5 };
    for (let slot = 0; slot < LOITER_CANDIDATES; slot++) {
      const p = loiterSpot(env, centre, foot, slot);
      const d = Math.hypot(p[0] - foot[0], p[2] - foot[2]);
      expect(d).toBeGreaterThanOrEqual(Math.min(...LOITER_DISTANCES) - 1e-6);
      expect(d).toBeLessThanOrEqual(Math.max(...LOITER_DISTANCES) + 1e-6);
      expect(p[2]).toBeGreaterThan(foot[2]);
      expect(p[1]).toBe(1.5);
      expect(loiterSpot(env, centre, foot, slot)).toEqual(p);
    }
    expect(LOITER_ANGLES_DEG.length).toBeGreaterThan(1);
  });

  it('skips keep-out cells, and falls back one metre past the foot when all are blocked', () => {
    const size = 128;
    const mask = new Uint8Array(size * size);
    const env: NavEnv = { keepOut: mask, heightAt: () => 0 };
    const free = loiterSpot(env, centre, foot, 0);
    const cell = (p: readonly number[]): number =>
      (Math.floor((p[2] ?? 0) / GRID) + size / 2) * size +
      Math.floor((p[0] ?? 0) / GRID) +
      size / 2;
    mask[cell(free)] = 1;
    const next = loiterSpot(env, centre, foot, 0);
    expect(next).not.toEqual(free);
    expect(mask[cell(next)]).toBe(0);
    mask.fill(1);
    const stuck = loiterSpot(env, centre, foot, 3);
    expect(Math.hypot(stuck[0] - foot[0], stuck[2] - foot[2])).toBeCloseTo(1, 9);
    expect(stuck.every(Number.isFinite)).toBe(true);
  });
});

describe('outdoor errands', () => {
  it('the airlock is in the graph with an exit, and crew exist', () => {
    const r = start();
    expect(r.resolved.graph.nodes.get('a0')?.exits.size).toBe(1);
    stepCrew(r.crew, r.world, 'out', 0, 9);
    expect(r.crew.agents.length).toBeGreaterThanOrEqual(2);
    expect(r.crew.locks.has('a0')).toBe(true);
  });

  it('puts crew outside in the working day, 4-8 m from the ramp foot, and brings them back', () => {
    const r = start();
    const foot = r.resolved.graph.nodes.get('a0')?.exits.get('exit');
    expect(foot).toBeDefined();
    let seenOutside = 0;
    let standing = 0;
    for (const hour of [8, 9, 10, 11, 12, 13, 14, 15]) {
      run(r, hour * 5000, 1500, hour, () => {
        seenOutside = Math.max(seenOutside, outside(r));
      });
    }
    expect(seenOutside).toBeGreaterThan(0);
    // Check the standing positions on a replay that stops while someone is out there.
    const r2 = start();
    for (let t = 0; t < 12000 && standing === 0; t++) {
      stepCrew(r2.crew, r2.world, 'out', t, 9 + Math.floor(t / 1500));
      for (const a of r2.crew.agents) {
        if (a.outside && a.route.length === 0 && a.dwell > 0 && foot) {
          const p = crewPoints(r2.crew, r2.world);
          const i = a.index * CREW_STRIDE;
          const d = Math.hypot((p[i] ?? 0) - foot[0], (p[i + 2] ?? 0) - foot[2]);
          expect(d).toBeGreaterThanOrEqual(Math.min(...LOITER_DISTANCES) - 1e-3);
          expect(d).toBeLessThanOrEqual(Math.max(...LOITER_DISTANCES) + 1e-3);
          expect(p[i + 6]).toBe(1);
          standing++;
        }
      }
    }
    expect(standing).toBeGreaterThan(0);
  });

  it('has nobody outside by 19:00, and nobody goes out after 18:00', () => {
    const r = start();
    let t = 0;
    for (let hour = 8; hour < 18; hour++) {
      run(r, t, 800, hour);
      t += 800;
    }
    // From 18:00 on, nobody sets off; give those out there a minute of sim time to get in.
    let wentOutAfter = false;
    for (let k = 0; k < 600; k++) {
      const before = outside(r);
      stepCrew(r.crew, r.world, 'out', t++, 18.5);
      if (
        outside(r) > before &&
        r.crew.agents.some(
          (a) =>
            a.outside &&
            a.route.length > 0 &&
            a.route[a.step]?.k === 'out' &&
            (a.route[a.step] as { dir: number }).dir === 1,
        )
      ) {
        wentOutAfter = true;
      }
    }
    expect(wentOutAfter).toBe(false);
    run(r, t, 1500, 19);
    expect(outside(r)).toBe(0);
    for (const a of r.crew.agents) expect(a.waiting && a.route[a.step]?.k === 'node').toBeFalsy();
  });

  it('never lets two ride a cycle in different directions, and never exceeds two riders', () => {
    const r = start();
    for (let hour = 8; hour < 16; hour++) {
      run(r, hour * 3000, 1200, hour, () => {
        const lock = r.crew.locks.get('a0');
        if (!lock) return;
        expect(lock.riders.length).toBeLessThanOrEqual(LOCK_RIDERS);
        const dirs = new Set(
          lock.riders.map((i) => {
            const a = r.crew.agents[i];
            const st = a?.route[a?.step ?? 0];
            return st && st.k === 'node' && st.from !== '@centre' ? -1 : 1;
          }),
        );
        expect(dirs.size).toBeLessThanOrEqual(1);
      });
    }
  });

  it('is byte-identical on replay, including a scrub to the evening', () => {
    const play = (): string => {
      const r = start();
      run(r, 0, 3000, 9);
      run(r, 3000, 2000, 12);
      run(r, 5000, 2000, 20.2);
      return JSON.stringify(r.crew.agents) + Array.from(crewPoints(r.crew, r.world)).join(',');
    };
    expect(play()).toBe(play());
  });

  it('sends everyone home, finite, when the airlock is deleted mid-errand', () => {
    const doc = base();
    const r = start(doc);
    let t = 0;
    let hour = 9;
    // Run until someone is outside, then delete the airlock.
    for (; t < 30000 && outside(r) === 0; t++) {
      stepCrew(r.crew, r.world, 'out', t, hour);
      hour = 9 + Math.floor(t / 2000) * 0 + (t > 4000 ? 1 : 0);
    }
    expect(outside(r)).toBeGreaterThan(0);
    const after = solve(removePart(doc, 'a0'), FLAT);
    const world = worldOf(after);
    for (let k = 0; k < 400; k++) stepCrew(r.crew, world, 'out', t + k, 10);
    expect(outside(r)).toBe(0);
    for (const a of r.crew.agents) {
      expect(after.graph.nodes.has(a.at)).toBe(true);
      expect(a.waiting).toBe(false);
    }
    for (const v of crewPoints(r.crew, world)) expect(Number.isFinite(v)).toBe(true);
  });
});
