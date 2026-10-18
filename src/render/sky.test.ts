import { describe, expect, it } from 'vitest';
import { computeSky } from './sky';

const altitudeDeg = (hour: number): number => {
  // computeSky flattens the sun to a small minimum above the horizon; look at the raw altitude
  // through sunAltitude, which is the unflattened, clamped-at-zero value.
  return (Math.asin(computeSky(hour).sunAltitude) * 180) / Math.PI;
};

describe('sun path', () => {
  it('peaks at noon and is symmetric around it', () => {
    expect(altitudeDeg(12)).toBeCloseTo(68, 0);
    expect(altitudeDeg(9)).toBeCloseTo(altitudeDeg(15), 5);
  });

  it('is low and warm, not gone, at dawn and at 18:30', () => {
    expect(altitudeDeg(6)).toBeGreaterThan(8);
    expect(altitudeDeg(6)).toBeLessThan(15);
    expect(altitudeDeg(18.5)).toBeGreaterThan(3);
    expect(altitudeDeg(18.5)).toBeLessThan(9);
    expect(computeSky(18.5).sunIntensity).toBeGreaterThan(0.5);
  });

  it('is below the horizon at night', () => {
    expect(computeSky(21).sunAltitude).toBe(0);
    expect(computeSky(0).sunAltitude).toBe(0);
    expect(computeSky(21).sunIntensity).toBeLessThan(0.3);
  });
});
