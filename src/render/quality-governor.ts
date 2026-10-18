/**
 * Steps the post-processing preset down when the machine cannot keep up, once per level and never
 * back up (flapping would be worse than a steady lower preset). It watches the gap between
 * consecutive rendered frames while the scene is being driven continuously, so an idle heartbeat
 * or a pause never counts. Pure: the caller feeds it gaps and applies what it returns.
 */
import type { Quality } from './post';

/** A median gap above this (about 45 fps) means the preset is too heavy. */
export const SLOW_GAP_MS = 22;
/** Gaps over this are a pause or a tab switch, not load. */
const PAUSE_GAP_MS = 120;
/** Frames judged together, and frames ignored after a change (shader compiles, target rebuilds). */
export const WINDOW = 45;
export const SETTLE = 30;

const DOWN: Readonly<Record<Quality, Quality | null>> = {
  high: 'medium',
  medium: 'low',
  low: null,
};

export class QualityGovernor {
  private gaps: number[] = [];
  private skip = SETTLE;

  /** `enabled` false (the player chose a preset) makes it inert. */
  constructor(public enabled: boolean) {}

  /** Feed the gap since the previous rendered frame; returns a lower preset to switch to, or null. */
  observe(gapMs: number, current: Quality): Quality | null {
    if (!this.enabled) return null;
    if (gapMs > PAUSE_GAP_MS) {
      this.gaps = [];
      return null;
    }
    if (this.skip > 0) {
      this.skip--;
      return null;
    }
    this.gaps.push(gapMs);
    if (this.gaps.length < WINDOW) return null;
    const sorted = [...this.gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    this.gaps = [];
    if (median <= SLOW_GAP_MS) return null;
    const next = DOWN[current];
    if (next) this.skip = SETTLE;
    return next;
  }
}
