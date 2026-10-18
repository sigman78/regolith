import { describe, expect, it } from 'vitest';
import { buildWear, WEAR_CHANNELS, WEAR_RING, WEAR_TEXELS_PER_M } from './wear';

const HALF = 48;
const at = (w: ReturnType<typeof buildWear>, x: number, z: number, channel = 0): number => {
  const i = Math.floor((x + HALF) * WEAR_TEXELS_PER_M);
  const j = Math.floor((z + HALF) * WEAR_TEXELS_PER_M);
  return w.data[(j * w.size + i) * WEAR_CHANNELS + channel] ?? 0;
};

describe('buildWear', () => {
  it('is all zero for an empty base, at 2 texels per metre', () => {
    const w = buildWear(HALF, [], []);
    expect(w.size).toBe(2 * HALF * WEAR_TEXELS_PER_M);
    expect(w.data.length).toBe(w.size * w.size * WEAR_CHANNELS);
    expect(w.data.every((v) => v === 0)).toBe(true);
  });

  it('rings a footprint: full under it, falling to nothing past the ring, channel G untouched', () => {
    const w = buildWear(HALF, [{ kind: 'rect', x: 0, z: 0, yaw: 0, hx: 4, hz: 3 }], []);
    expect(at(w, 0, 0)).toBe(255);
    let last = 255;
    for (let d = 0.25; d <= WEAR_RING + 1; d += 0.25) {
      const v = at(w, 4 + d, 0);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
    expect(last).toBe(0);
    expect(at(w, 20, 20)).toBe(0);
    expect(w.data.filter((_, i) => i % WEAR_CHANNELS === 1).every((v) => v === 0)).toBe(true);
  });

  it('marks a footpad softly and keeps the stronger mark where they overlap', () => {
    const w = buildWear(HALF, [], [{ x: 10, z: 10, r: 0.35 }]);
    expect(at(w, 10, 10)).toBeGreaterThan(200);
    expect(at(w, 12, 10)).toBe(0);
    const both = buildWear(
      HALF,
      [{ kind: 'disc', x: 10, z: 10, r: 2 }],
      [{ x: 10, z: 10, r: 0.35 }],
    );
    expect(at(both, 10, 10)).toBe(255);
  });

  it('is the same bytes and key for the same input, and a new key when it changes', () => {
    const shapes = [{ kind: 'disc' as const, x: -5, z: 7, r: 3 }];
    const a = buildWear(HALF, shapes, []);
    const b = buildWear(HALF, shapes, []);
    expect(a.key).toBe(b.key);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    expect(buildWear(HALF, [{ kind: 'disc', x: -4, z: 7, r: 3 }], []).key).not.toBe(a.key);
  });
});
