/**
 * Fixed-rate stepping for the sim: it advances in whole ticks of `1 / TICK_HZ` seconds however
 * irregular the frames are, and the renderer interpolates by `alpha`, the fraction of a tick left
 * over. `alpha` is only ever a render input; it never enters sim state.
 */

export const TICK_HZ = 10;
export const TICK_SECONDS = 1 / TICK_HZ;
/** After a stall (tab hidden, long frame) at most this many ticks run, so the sim never spirals. */
export const MAX_CATCH_UP = 5;

export class FixedStep {
  private acc = 0;
  private count = 0;

  /** Ticks completed so far; the sim's only notion of time besides the sol clock. */
  get tick(): number {
    return this.count;
  }

  /** Fraction of the next tick already elapsed, 0..1. */
  get alpha(): number {
    return this.acc / TICK_SECONDS;
  }

  /** Add `dt` real seconds; returns how many ticks to run now. */
  advance(dt: number): number {
    this.acc += Math.max(0, dt);
    let n = Math.floor(this.acc / TICK_SECONDS + 1e-9);
    if (n > MAX_CATCH_UP) {
      n = MAX_CATCH_UP;
      this.acc = 0;
    } else {
      this.acc -= n * TICK_SECONDS;
    }
    this.count += n;
    return n;
  }
}
