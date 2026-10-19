/**
 * The airlock cycle, a small pure state machine per airlock: idle, then seal, pump, open, then idle
 * again. Nobody rides it (crew figures were cut, 2026-10-18): a lock cycles on its own, once per
 * sol-hour in the day window, at a minute hashed from the seed and its id, so the lamp sequence is
 * a fact of the base, never of how the frames fell.
 *
 * Time is ticks (10 Hz) for the phases and the sol hour for the schedule; nothing here reads a
 * clock or the renderer.
 */
import { hashInts, hashString } from '@/core/rng';
import {
  LOCK_DAY_FROM_HOUR,
  LOCK_DAY_TO_HOUR,
  LOCK_OPEN_TICKS,
  LOCK_PUMP_TICKS,
  LOCK_SEAL_TICKS,
} from '@/geometry/design-constants';

export type LockPhase = 'idle' | 'seal' | 'pump' | 'open';

export interface Lock {
  phase: LockPhase;
  /** ticks left in this phase */
  left: number;
  /** the sol hour whose cycle has started, so each hour cycles once (-1: none yet) */
  cycled: number;
}

export function newLock(): Lock {
  return { phase: 'idle', left: 0, cycled: -1 };
}

/** The sol-minute (0..59) of each day hour at which this lock cycles. */
export function cycleMinute(seed: string, id: string, solHour: number): number {
  return hashInts(hashString(seed), hashString(id), Math.floor(solHour)) % 60;
}

/** Is a cycle due: an idle lock, a day hour it has not cycled in, and that hour's minute reached. */
export function cycleDue(lock: Lock, seed: string, id: string, solHour: number): boolean {
  const hour = Math.floor(solHour);
  if (lock.phase !== 'idle' || lock.cycled === hour) return false;
  if (hour < LOCK_DAY_FROM_HOUR || hour >= LOCK_DAY_TO_HOUR) return false;
  // A hair of tolerance: 10 + m / 60 - 10 does not always come back as exactly m sixtieths.
  return (solHour - hour) * 60 + 1e-9 >= cycleMinute(seed, id, solHour);
}

export function startCycle(lock: Lock, solHour: number): void {
  lock.phase = 'seal';
  lock.left = LOCK_SEAL_TICKS;
  lock.cycled = Math.floor(solHour);
}

/** Advance one tick. */
export function stepLock(lock: Lock): void {
  if (lock.phase === 'idle') return;
  lock.left--;
  if (lock.left > 0) return;
  if (lock.phase === 'seal') {
    lock.phase = 'pump';
    lock.left = LOCK_PUMP_TICKS;
  } else if (lock.phase === 'pump') {
    lock.phase = 'open';
    lock.left = LOCK_OPEN_TICKS;
  } else {
    lock.phase = 'idle';
    lock.left = 0;
  }
}
