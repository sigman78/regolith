import { describe, expect, it } from 'vitest';
import { SolClock } from './clock';
import { FixedStep, MAX_CATCH_UP, TICK_SECONDS } from './fixed-step';

/** Poll the clock the way a frame loop would, every `stepMs`, from `from` to `to`. */
function run(c: SolClock, from: number, to: number, stepMs = 100): void {
  for (let t = from; t <= to; t += stepMs) c.update(t);
}

describe('SolClock', () => {
  it('runs a sol-minute per real second at 1x and ignores time while paused', () => {
    const c = new SolClock(12, true);
    run(c, 0, 60_000);
    expect(c.hour).toBeCloseTo(13, 6);
    c.pause();
    run(c, 60_000, 120_000);
    expect(c.hour).toBeCloseTo(13, 6);
    c.togglePause();
    run(c, 120_000, 180_000);
    expect(c.hour).toBeCloseTo(14, 6);
  });

  it('does not depend on how often it is polled', () => {
    const a = new SolClock(6, true);
    const b = new SolClock(6, true);
    run(a, 0, 20_000, 16);
    run(b, 0, 20_000, 250);
    expect(a.hour).toBeCloseTo(6 + 20 / 60, 6);
    expect(b.hour).toBeCloseTo(6 + 20 / 60, 6);
  });

  it('speeds up by cycling 1x, 2x, 4x', () => {
    const c = new SolClock(0, true);
    expect(c.cycleSpeed()).toBe(2);
    expect(c.cycleSpeed()).toBe(4);
    run(c, 0, 30_000);
    expect(c.hour).toBeCloseTo(2, 6);
    expect(c.cycleSpeed()).toBe(1);
  });

  it('wraps at midnight, scrubs both ways and caps a long stall', () => {
    const c = new SolClock(23.5, false);
    c.scrub(1);
    expect(c.hour).toBeCloseTo(0.5, 9);
    c.scrub(-1);
    expect(c.hour).toBeCloseTo(23.5, 9);
    const r = new SolClock(10, true);
    r.update(0);
    r.update(3_600_000); // an hour hidden: capped at 5 s
    expect(r.hour).toBeCloseTo(10 + 5 / 60, 9);
  });

  it('shows light and shadows a whole sol-minute at a time', () => {
    const c = new SolClock(15.5, false);
    c.set(15.5 + 0.4 / 60);
    expect(c.visualHour).toBeCloseTo(15.5, 9);
    c.set(15.5 + 1.2 / 60);
    expect(c.visualHour).toBeCloseTo(15.5 + 1 / 60, 9);
    expect(c.label()).toBe('15:31');
  });

  it('labels midnight and rejects non-finite input', () => {
    expect(new SolClock(0, false).label()).toBe('00:00');
    const c = new SolClock(Number.NaN, false);
    expect(Number.isFinite(c.hour)).toBe(true);
    c.set(Number.NaN);
    expect(Number.isFinite(c.hour)).toBe(true);
  });
});

describe('FixedStep', () => {
  it('runs whole ticks and keeps the remainder as alpha', () => {
    const s = new FixedStep();
    expect(s.advance(0.25)).toBe(2);
    expect(s.tick).toBe(2);
    expect(s.alpha).toBeCloseTo(0.5, 6);
    expect(s.advance(0.05)).toBe(1);
    expect(s.alpha).toBeCloseTo(0, 6);
  });

  it('counts steady frames exactly and caps a stall', () => {
    const a = new FixedStep();
    const b = new FixedStep();
    for (let i = 0; i < 600; i++) a.advance(1 / 60);
    b.advance(10);
    expect(a.tick).toBe(100);
    expect(b.tick).toBe(MAX_CATCH_UP);
  });

  it('never lets a stall spiral', () => {
    const s = new FixedStep();
    expect(s.advance(60)).toBe(MAX_CATCH_UP);
    expect(s.alpha).toBe(0);
    expect(s.advance(TICK_SECONDS)).toBe(1);
  });
});
