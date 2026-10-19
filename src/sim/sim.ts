/**
 * The sim as the editor sees it: a fixed-rate stepper plus the airlocks. The caller feeds it scaled
 * wall time (zero while the clock is paused), the resolved base, the seed and the sol hour; nothing
 * here reads the clock or the renderer. The base's life is mechanical (crew figures were cut,
 * 2026-10-18): lamps, locks, and later panels and cables.
 */
import type { ResolvedBase } from '@/grammar/solver';
import type { PartId } from '@/world/document';
import { cycleDue, newLock, startCycle, stepLock, type Lock } from './airlock';
import { FixedStep } from './fixed-step';

export class Sim {
  readonly steps = new FixedStep();
  /** one per airlock in the base, by part id */
  readonly locks = new Map<PartId, Lock>();
  private base: ResolvedBase | null = null;

  /** Advance by `dt` sim seconds; returns the ticks run. */
  update(dt: number, base: ResolvedBase, seed: string, solHour: number): number {
    if (base !== this.base) this.reconcile(base);
    const n = this.steps.advance(dt);
    for (let i = 0; i < n; i++) {
      for (const [id, lock] of this.locks) {
        if (cycleDue(lock, seed, id, solHour)) startCycle(lock, solHour);
        stepLock(lock);
      }
    }
    return n;
  }

  /** A lock per airlock: new ones start idle, gone ones are dropped, the rest keep their phase. */
  private reconcile(base: ResolvedBase): void {
    this.base = base;
    for (const part of base.parts.values()) {
      if (part.letter === 'A' && !this.locks.has(part.id)) this.locks.set(part.id, newLock());
    }
    for (const id of [...this.locks.keys()]) {
      if (base.parts.get(id)?.letter !== 'A') this.locks.delete(id);
    }
  }
}
