import { describe, expect, it } from 'vitest';
import type { GeometryBundle } from './bundle';
import { buildBundle } from './build';
import {
  CORRIDOR_FLOOR_THICK,
  CREW_HEIGHT,
  HEADROOM_MARGIN,
  CORRIDOR_HALF_WIDTH,
  CORRIDOR_HEIGHT,
  KINK_COLLAR_THICK,
  TUBE_SEGMENTS,
  TUBE_FLANGE,
} from './design-constants';
import { CORRIDOR_SECTION } from './tube';
import { assertValidBundle } from './validate';

const build = (points: number[]) => buildBundle({ ops: [{ kind: 'tube', points }] });

/** min and max of one axis (0 x, 1 y, 2 z) over a material's vertices. */
function extent(b: GeometryBundle, material: 'hull' | 'graphite', axis: number): [number, number] {
  const p = b.byMaterial[material]?.positions ?? new Float32Array();
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = axis; i < p.length; i += 3) {
    lo = Math.min(lo, p[i] ?? 0);
    hi = Math.max(hi, p[i] ?? 0);
  }
  return [lo, hi];
}

describe('corridor geometry', () => {
  it('builds a valid straight corridor with hull, flanges and nothing else', () => {
    const b = build([0, 3, 0, 10, 3, 0]);
    expect(() => assertValidBundle(b)).not.toThrow();
    expect(Object.keys(b.byMaterial).sort()).toEqual(['graphite', 'hull']);
    expect(b.bounds.min[0]).toBeCloseTo(0, 5);
    expect(b.bounds.max[0]).toBeCloseTo(10, 5);
  });

  it('stands on the floor line: crown at floor + CORRIDOR_HEIGHT, underside at floor - the slab', () => {
    const [lo, hi] = extent(build([0, 3, 0, 10, 3, 0]), 'hull', 1);
    expect(hi).toBeCloseTo(3 + CORRIDOR_HEIGHT, 5);
    expect(lo).toBeCloseTo(3 - CORRIDOR_FLOOR_THICK, 5);
  });

  it('is CORRIDOR_WIDTH wide, and the flanges stand proud of it', () => {
    const b = build([0, 3, 0, 10, 3, 0]);
    const [zlo, zhi] = extent(b, 'hull', 2);
    expect(zlo).toBeCloseTo(-CORRIDOR_HALF_WIDTH, 5);
    expect(zhi).toBeCloseTo(CORRIDOR_HALF_WIDTH, 5);
    const [flo, fhi] = extent(b, 'graphite', 2);
    expect(fhi).toBeCloseTo(CORRIDOR_HALF_WIDTH + TUBE_FLANGE, 5);
    expect(flo).toBeCloseTo(-CORRIDOR_HALF_WIDTH - TUBE_FLANGE, 5);
  });

  it('keeps the crown and the underside a constant distance from the floor on a climb', () => {
    const b = build([0, 2, 0, 5, 2.5, 0, 10, 3, 0]);
    expect(() => assertValidBundle(b)).not.toThrow();
    const [lo, hi] = extent(b, 'hull', 1);
    expect(hi).toBeCloseTo(3 + CORRIDOR_HEIGHT, 5);
    expect(lo).toBeCloseTo(2 - CORRIDOR_FLOOR_THICK, 5);
  });

  it('builds valid bends, slopes and diagonal runs', () => {
    for (const pts of [
      [0, 3, 0, 6, 3, 0, 10, 3, 4], // 45° kink
      [0, 3, 0, 5, 3.5, 0, 10, 4, 0], // gentle slope, collinear-ish
      [0, 3, 0, 0, 3, 8, -6, 3, 8, -6, 3, 0], // two 90° bends
      [0, 3, 0, 4, 3, 4], // diagonal
      [0, 3, 0, 6, 3, 0, 10, 3, 4, 10, 3, 10], // a kink then a turn back
    ]) {
      expect(() => assertValidBundle(build(pts))).not.toThrow();
    }
  });

  it('meets two pieces on a mitre plane: the rings coincide and the outer corner is covered', () => {
    const b = build([0, 3, 0, 6, 3, 0, 10, 3, 4]);
    const p = b.byMaterial.hull?.positions ?? new Float32Array();
    const seen = new Map<string, number>();
    for (let i = 0; i < p.length; i += 3) {
      const key = [p[i], p[i + 1], p[i + 2]].map((v) => (v ?? 0).toFixed(4)).join(',');
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    // The bend ring is the end of one piece and the start of the next: every point of it twice.
    const onMitre = [...seen.entries()].filter(([k, c]) => {
      const [x, , z] = k.split(',').map(Number);
      const along = ((x ?? 0) - 6) * Math.cos(Math.PI / 8) + (z ?? 0) * Math.sin(Math.PI / 8);
      return c === 2 && Math.abs(along) < 1e-3;
    });
    expect(onMitre).toHaveLength(CORRIDOR_SECTION.length);

    // The turn is 45° toward +z, so the outside is -z. The wall line z = -1 of the first piece and
    // the wall line of the second meet at the vertex pushed out by half-width / cos(22.5°).
    const half = Math.PI / 8;
    const corner = [6 + CORRIDOR_HALF_WIDTH * Math.tan(half), -CORRIDOR_HALF_WIDTH];
    const hasCorner = [...seen.keys()].some((k) => {
      const [x, , z] = k.split(',').map(Number);
      return Math.hypot((x ?? 0) - (corner[0] ?? 0), (z ?? 0) - (corner[1] ?? 0)) < 1e-3;
    });
    expect(hasCorner).toBe(true);
  });

  it('wears a collar on the mitre plane, stretched with it and standing a flange proud', () => {
    const b = build([0, 3, 0, 6, 3, 0, 10, 3, 4]);
    const p = b.byMaterial.graphite?.positions ?? new Float32Array();
    const half = Math.PI / 8;
    // The bisector heading of 0° and 45° is 22.5°; the across axis is up x heading.
    const head: [number, number] = [Math.cos(half), Math.sin(half)];
    const lat: [number, number] = [head[1], -head[0]];
    const d = CORRIDOR_HALF_WIDTH / Math.cos(half) + TUBE_FLANGE;
    const wallTop = 3 + CORRIDOR_HEIGHT - CORRIDOR_HALF_WIDTH;
    // In the section plane (across, up) some collar vertex sits at the stretched, proud wall.
    let best = Infinity;
    for (let i = 0; i < p.length; i += 3) {
      const dx = (p[i] ?? 0) - 6;
      const dz = p[i + 2] ?? 0;
      const across = dx * lat[0] + dz * lat[1];
      const along = dx * head[0] + dz * head[1];
      if (Math.abs(along) > KINK_COLLAR_THICK / 2 + 1e-6) continue;
      best = Math.min(best, Math.hypot(across - d, (p[i + 1] ?? 0) - wallTop));
    }
    expect(best).toBeLessThan(1e-3);
  });

  it('leaves a standing figure its headroom across the middle 1.4 m', () => {
    // The roof height of the real section polygon at lateral x: the highest edge crossing x.
    const roof = (x: number): number => {
      let top = -Infinity;
      for (let i = 0; i < CORRIDOR_SECTION.length; i++) {
        const p = CORRIDOR_SECTION[i];
        const q = CORRIDOR_SECTION[(i + 1) % CORRIDOR_SECTION.length];
        if (!p || !q || p.x === q.x || (x - p.x) * (x - q.x) > 0) continue;
        top = Math.max(top, p.y + ((q.y - p.y) * (x - p.x)) / (q.x - p.x));
      }
      return top;
    };
    // The crown is 8 chords: between vertices the polygon sags under the arc by under 2 cm.
    const sag = CORRIDOR_HALF_WIDTH * (1 - Math.cos(Math.PI / TUBE_SEGMENTS));
    // (At the very wall, 0.8 m off, the arc is exactly 2.0 m and the chords leave 1.97 m: still 0.17 clear.)
    for (let x = -0.7; x <= 0.7 + 1e-9; x += 0.05) {
      expect(roof(x)).toBeGreaterThanOrEqual(CREW_HEIGHT + HEADROOM_MARGIN - sag - 1e-9);
    }
    expect(roof(0)).toBeCloseTo(CORRIDOR_HEIGHT, 2);
  });

  it('ignores repeated points and survives degenerate input', () => {
    expect(() => assertValidBundle(build([0, 3, 0, 0, 3, 0, 5, 3, 0]))).not.toThrow();
    expect(build([1, 1, 1]).byMaterial).toEqual({});
  });

  it('is deterministic', () => {
    const a = build([0, 3, 0, 6, 3, 0, 10, 3, 4]);
    const again = buildBundle({ ops: [{ kind: 'tube', points: [0, 3, 0, 6, 3, 0, 10, 3, 4] }] });
    expect(again).toBe(a);
  });
});
