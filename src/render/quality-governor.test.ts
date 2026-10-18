import { describe, expect, it } from 'vitest';
import { QualityGovernor, SETTLE, SLOW_GAP_MS, WINDOW } from './quality-governor';

const feed = (g: QualityGovernor, gap: number, n: number, q: 'high' | 'medium' | 'low') => {
  let out: ReturnType<QualityGovernor['observe']> = null;
  for (let i = 0; i < n; i++) out = g.observe(gap, q) ?? out;
  return out;
};

describe('QualityGovernor', () => {
  it('leaves a machine that holds 60 fps alone', () => {
    expect(feed(new QualityGovernor(true), 16.7, 500, 'high')).toBeNull();
  });

  it('steps high to medium after a slow window, then medium to low, never up', () => {
    const g = new QualityGovernor(true);
    expect(feed(g, SLOW_GAP_MS + 8, SETTLE + WINDOW, 'high')).toBe('medium');
    expect(feed(g, SLOW_GAP_MS + 8, SETTLE + WINDOW, 'medium')).toBe('low');
    expect(feed(g, SLOW_GAP_MS + 8, 400, 'low')).toBeNull();
    expect(feed(g, 10, 400, 'low')).toBeNull();
  });

  it('ignores the frames right after the start or a change', () => {
    const g = new QualityGovernor(true);
    expect(feed(g, 60, SETTLE, 'high')).toBeNull();
  });

  it('does not count pauses and idle heartbeats', () => {
    const g = new QualityGovernor(true);
    expect(feed(g, 500, 300, 'high')).toBeNull();
  });

  it('is inert once the player picked a preset', () => {
    expect(feed(new QualityGovernor(false), 80, 400, 'high')).toBeNull();
  });
});
