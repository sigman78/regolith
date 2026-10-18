/**
 * The airlock cycle, as a small pure state machine per airlock: idle, then seal, pump, open, then
 * idle again. Crew queue at a door in arrival order; an idle lock takes up to LOCK_RIDERS who want
 * to go the same way, runs the three phases, and lets them through when it opens.
 *
 * Time is ticks (10 Hz) and nothing here reads a clock, so the cycle is a function of the ticks
 * the sim has run, never of how the frames fell.
 */
import {
  LOCK_OPEN_TICKS,
  LOCK_PUMP_TICKS,
  LOCK_RIDERS,
  LOCK_SEAL_TICKS,
} from '@/geometry/design-constants';

export type LockPhase = 'idle' | 'seal' | 'pump' | 'open';

/** 1 goes out, -1 comes in. */
export type LockDir = 1 | -1;

export interface Lock {
  phase: LockPhase;
  /** ticks left in this phase */
  left: number;
  dir: LockDir;
  /** agent indices carried by this cycle */
  riders: number[];
  /** agent indices waiting, in arrival order */
  queue: { index: number; dir: LockDir }[];
}

export function newLock(): Lock {
  return { phase: 'idle', left: 0, dir: 1, riders: [], queue: [] };
}

export function enqueue(lock: Lock, index: number, dir: LockDir): void {
  if (!lock.queue.some((q) => q.index === index) && !lock.riders.includes(index)) {
    lock.queue.push({ index, dir });
  }
}

/** Drop agents that are no longer waiting (reset, deleted, gone home). */
export function keepWaiting(lock: Lock, waiting: (index: number) => boolean): void {
  lock.queue = lock.queue.filter((q) => waiting(q.index));
  lock.riders = lock.riders.filter(waiting);
}

/** Advance one tick. `release` is called for each rider when the lock opens. */
export function stepLock(lock: Lock, release: (index: number) => void): void {
  if (lock.phase === 'idle') {
    const first = lock.queue[0];
    if (!first) return;
    lock.dir = first.dir;
    lock.riders = [];
    const rest: Lock['queue'] = [];
    for (const q of lock.queue) {
      if (q.dir === lock.dir && lock.riders.length < LOCK_RIDERS) lock.riders.push(q.index);
      else rest.push(q);
    }
    lock.queue = rest;
    lock.phase = 'seal';
    lock.left = LOCK_SEAL_TICKS;
    return;
  }
  lock.left--;
  if (lock.left > 0) return;
  if (lock.phase === 'seal') {
    lock.phase = 'pump';
    lock.left = LOCK_PUMP_TICKS;
  } else if (lock.phase === 'pump') {
    lock.phase = 'open';
    lock.left = LOCK_OPEN_TICKS;
    for (const i of lock.riders) release(i);
  } else {
    lock.phase = 'idle';
    lock.left = 0;
    lock.riders = [];
  }
}
