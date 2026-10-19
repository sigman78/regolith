import { describe, expect, it } from 'vitest';
import {
  LOCK_DAY_FROM_HOUR,
  LOCK_DAY_TO_HOUR,
  LOCK_OPEN_TICKS,
  LOCK_PUMP_TICKS,
  LOCK_SEAL_TICKS,
} from '@/geometry/design-constants';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument } from '@/world/document';
import { cycleDue, cycleMinute, newLock, startCycle, stepLock, type LockPhase } from './airlock';
import { TICK_SECONDS } from './fixed-step';
import { Sim } from './sim';

describe('airlock cycle', () => {
  it('runs seal, pump and open for their tick counts, then rests idle', () => {
    const lock = newLock();
    startCycle(lock, 9.5);
    const seen: LockPhase[] = [];
    const total = LOCK_SEAL_TICKS + LOCK_PUMP_TICKS + LOCK_OPEN_TICKS;
    for (let i = 0; i < total + 5; i++) {
      seen.push(lock.phase);
      stepLock(lock);
    }
    expect(seen.filter((p) => p === 'seal')).toHaveLength(LOCK_SEAL_TICKS);
    expect(seen.filter((p) => p === 'pump')).toHaveLength(LOCK_PUMP_TICKS);
    expect(seen.filter((p) => p === 'open')).toHaveLength(LOCK_OPEN_TICKS);
    expect(seen.slice(total)).toEqual(['idle', 'idle', 'idle', 'idle', 'idle']);
    expect(lock.cycled).toBe(9);
  });

  it('is due once per day hour, from its own minute on, and never at night', () => {
    const lock = newLock();
    const minute = cycleMinute('olympus-07', 'a0', 10);
    expect(minute).toBeGreaterThanOrEqual(0);
    expect(minute).toBeLessThan(60);
    if (minute > 0)
      expect(cycleDue(lock, 'olympus-07', 'a0', 10 + (minute - 0.5) / 60)).toBe(false);
    expect(cycleDue(lock, 'olympus-07', 'a0', 10 + minute / 60)).toBe(true);
    startCycle(lock, 10 + minute / 60);
    expect(cycleDue(lock, 'olympus-07', 'a0', 10.99)).toBe(false); // busy
    while (lock.phase !== 'idle') stepLock(lock);
    expect(cycleDue(lock, 'olympus-07', 'a0', 10.99)).toBe(false); // done this hour
    expect(cycleDue(lock, 'olympus-07', 'a0', 11.999)).toBe(true); // the next hour, past any minute
    expect(cycleDue(newLock(), 'olympus-07', 'a0', LOCK_DAY_TO_HOUR + 0.999)).toBe(false);
    expect(cycleDue(newLock(), 'olympus-07', 'a0', LOCK_DAY_FROM_HOUR - 0.001)).toBe(false);
  });

  it('spreads the locks of a base over the hour, the same way every time', () => {
    const minutes = new Set<number>();
    for (let i = 0; i < 20; i++) minutes.add(cycleMinute('s', `a${i}`, 12));
    expect(minutes.size).toBeGreaterThan(10);
    expect(cycleMinute('s', 'a0', 12)).toBe(cycleMinute('s', 'a0', 12));
    expect(cycleMinute('s', 'a0', 12)).not.toBe(cycleMinute('s', 'a0', 13));
  });
});

describe('Sim', () => {
  const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };
  const base = (withLock: boolean) => {
    let doc = createDocument({ seed: 'sim' });
    doc = addPart(doc, {
      id: 'h0',
      letter: 'H',
      params: { length: 10, radius: 2 },
      pose: { x: 0, z: 0, yaw: 0 },
    });
    if (withLock) {
      doc = addPart(doc, {
        id: 'a0',
        letter: 'A',
        params: { radius: 2 },
        pose: { x: -2, z: 5, yaw: 0 },
      });
    }
    return solve(doc, FLAT);
  };

  /** One sol-hour of ticks from `hour`, counting the cycles that start. */
  const runHour = (sim: Sim, b: ReturnType<typeof base>, hour: number): number => {
    let cycles = 0;
    let last: LockPhase = 'idle';
    for (let m = 0; m < 60; m++) {
      for (let t = 0; t < 10; t++) {
        sim.update(TICK_SECONDS, b, 'sim', hour + m / 60);
        const p = sim.locks.get('a0')?.phase ?? 'idle';
        if (p === 'seal' && last !== 'seal') cycles++;
        last = p;
      }
    }
    return cycles;
  };

  it('keeps a lock per airlock, cycles it once an hour by day and drops it when the airlock goes', () => {
    const sim = new Sim();
    const b = base(true);
    sim.update(0, b, 'sim', 12);
    expect([...sim.locks.keys()]).toEqual(['a0']);
    expect(runHour(sim, b, 12)).toBe(1);
    expect(runHour(sim, b, 13)).toBe(1);
    expect(runHour(sim, b, 22)).toBe(0);
    sim.update(0, base(false), 'sim', 12);
    expect(sim.locks.size).toBe(0);
  });

  it('runs no tick while the clock is paused', () => {
    const sim = new Sim();
    const b = base(true);
    for (let i = 0; i < 100; i++) sim.update(0, b, 'sim', 12.5);
    expect(sim.steps.tick).toBe(0);
    expect(sim.locks.get('a0')?.phase).toBe('idle');
  });
});
