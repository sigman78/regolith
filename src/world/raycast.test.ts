import { describe, expect, it } from 'vitest';
import { rayClosestOnLine, raycastTerrain } from './raycast';

const norm = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

describe('raycastTerrain', () => {
  it('hits flat ground where geometry says', () => {
    const hit = raycastTerrain({ origin: [0, 10, 0], dir: norm([1, -1, 0]) }, () => 0);
    expect(hit?.[0]).toBeCloseTo(10, 2);
    expect(hit?.[1]).toBeCloseTo(0, 6);
  });

  it('hits a slope', () => {
    const h = (x: number) => x * 0.5;
    const hit = raycastTerrain({ origin: [0, 20, 0], dir: [0, -1, 0] }, h);
    expect(hit?.[1]).toBeCloseTo(0, 6);
    const side = raycastTerrain({ origin: [0, 20, 0], dir: norm([1, -1, 0]) }, h);
    // 20 - t/sqrt2 = 0.5 * t/sqrt2  =>  x = 20 / 1.5
    expect(side?.[0]).toBeCloseTo(20 / 1.5, 1);
  });

  it('misses when looking up or starting underground', () => {
    expect(raycastTerrain({ origin: [0, 5, 0], dir: [0, 1, 0] }, () => 0)).toBeNull();
    expect(raycastTerrain({ origin: [0, -1, 0], dir: [0, -1, 0] }, () => 0)).toBeNull();
  });
});

describe('rayClosestOnLine', () => {
  it('reads the distance along a horizontal line from a ray looking down at it', () => {
    const s = rayClosestOnLine({ origin: [7, 10, 3], dir: [0, -1, 0] }, [0, 0, 3], [1, 0, 0]);
    expect(s).toBeCloseTo(7, 9);
  });

  it('reads the height along a vertical line from a slanted ray', () => {
    // A ray from (10, 0, 0) toward (0, 5, 0) crosses the vertical line x=0 at y=5.
    const s = rayClosestOnLine(
      { origin: [10, 0, 0], dir: norm([-10, 5, 0]) },
      [0, 0, 0],
      [0, 1, 0],
    );
    expect(s).toBeCloseTo(5, 9);
  });

  it('is offset by where the line starts', () => {
    const s = rayClosestOnLine({ origin: [7, 10, 3], dir: [0, -1, 0] }, [2, 0, 3], [1, 0, 0]);
    expect(s).toBeCloseTo(5, 9);
  });

  it('has no answer for a ray parallel to the line', () => {
    expect(
      rayClosestOnLine({ origin: [0, 1, 0], dir: [1, 0, 0] }, [0, 0, 0], [1, 0, 0]),
    ).toBeNull();
  });
});
