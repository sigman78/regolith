/**
 * Sol time. One real second is one sol-minute at speed 1, so a sol (24 h) takes 24 real minutes.
 * The clock lives outside the document (it must not spam undo) and outside the frame loop: it is
 * advanced from wall-clock timestamps, so a throttled tab or an idle heartbeat does not slow it.
 *
 * Sun, shadows and everything that follows the sun read `visualHour`, which only changes once per
 * sol-minute (a quarter of a degree at speed 1: invisible), so a running clock costs one redraw per
 * sol-minute rather than one per display frame.
 */

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

const SOL_HOURS = 24;

const wrap = (h: number): number => ((h % SOL_HOURS) + SOL_HOURS) % SOL_HOURS;

export class SolClock {
  private h: number;
  private run: boolean;
  private rate: Speed = 1;
  private last: number | null = null;

  constructor(startHour: number, running: boolean) {
    this.h = wrap(Number.isFinite(startHour) ? startHour : 12);
    this.run = running;
  }

  /** Exact sol hour in [0, 24). */
  get hour(): number {
    return this.h;
  }

  /** The hour truncated to a sol-minute: what light, shadows and panels follow. */
  get visualHour(): number {
    return Math.floor(this.h * 60 + 1e-9) / 60;
  }

  get running(): boolean {
    return this.run;
  }

  get speed(): Speed {
    return this.rate;
  }

  /** Advance to the wall-clock time `nowMs`. The first call (and any call after a pause) only anchors. */
  update(nowMs: number): void {
    if (this.last !== null && this.run) {
      // A hidden tab can hand back minutes at once; cap it so the sun does not leap through a sol.
      const dt = Math.min((nowMs - this.last) / 1000, 5);
      this.h = wrap(this.h + (dt * this.rate) / 60);
    }
    this.last = nowMs;
  }

  /** Toggle pause; returns whether the clock is running now. */
  togglePause(): boolean {
    this.run = !this.run;
    return this.run;
  }

  pause(): void {
    this.run = false;
  }

  /** Jump by `hours` (scrubbing is a clock input, not a reset of anything else). */
  scrub(hours: number): void {
    this.h = wrap(this.h + hours);
  }

  set(hour: number): void {
    if (Number.isFinite(hour)) this.h = wrap(hour);
  }

  /** 1x, 2x, 4x, back to 1x. */
  cycleSpeed(): Speed {
    const i = SPEEDS.indexOf(this.rate);
    this.rate = SPEEDS[(i + 1) % SPEEDS.length] ?? 1;
    return this.rate;
  }

  /** "15:30" for the HUD. */
  label(): string {
    const m = Math.floor(this.h * 60 + 1e-9);
    const hh = Math.floor(m / 60) % SOL_HOURS;
    return `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
}
