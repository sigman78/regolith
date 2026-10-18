import { describe, expect, it } from 'vitest';
import { buildBundle } from './build';
import { STENCIL_CELL, STENCIL_PROUD } from './design-constants';
import { GLYPH_COLS, GLYPH_ROWS, glyphRows, hasGlyph, textColumns, textRuns } from './font';
import { assertValidBundle } from './validate';

describe('stencil font', () => {
  it('has a 5 by 7 glyph for every character a serial can use', () => {
    for (const ch of 'CDEHMNPV-0123456789') {
      expect(hasGlyph(ch)).toBe(true);
      const rows = glyphRows(ch);
      expect(rows).toHaveLength(GLYPH_ROWS);
      for (const row of rows) expect(row).toMatch(/^[.#]{5}$/);
      expect(rows.join('')).toContain('#');
    }
  });

  it('is plain data: the same text gives the same runs, inside the line', () => {
    expect(textRuns('H-002')).toEqual(textRuns('H-002'));
    const width = textColumns('H-002');
    expect(width).toBe(5 * (GLYPH_COLS + 1) - 1);
    for (const r of textRuns('H-002')) {
      expect(r.col).toBeGreaterThanOrEqual(0);
      expect(r.col + r.cols).toBeLessThanOrEqual(width);
    }
  });
});

describe('stencil geometry', () => {
  const radius = 2;
  const bundle = buildBundle({ ops: [{ kind: 'stencil', text: 'H-002', radius }] });
  const buf = bundle.byMaterial.graphite;

  it('is a small valid bundle in the graphite material only', () => {
    expect(() => assertValidBundle(bundle)).not.toThrow();
    expect(Object.keys(bundle.byMaterial)).toEqual(['graphite']);
    expect((buf?.indices.length ?? 0) / 3).toBeLessThan(400);
  });

  it('sits a hair proud of the cylinder, inside a bay, and faces outward', () => {
    const p = buf?.positions ?? new Float32Array(0);
    const idx = buf?.indices ?? new Uint32Array(0);
    for (let i = 0; i < p.length; i += 3) {
      const r = Math.hypot(p[i + 1] ?? 0, p[i + 2] ?? 0);
      expect(r).toBeCloseTo(radius + STENCIL_PROUD, 5);
      expect(Math.abs(p[i] ?? 0)).toBeLessThan(0.75 * (2 - 0.2));
    }
    // Triangle normals point away from the axis.
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t] ?? 0, idx[t + 1] ?? 0, idx[t + 2] ?? 0];
      const at = (i: number, k: number): number => p[i * 3 + k] ?? 0;
      const u = [0, 1, 2].map((k) => at(b, k) - at(a, k));
      const v = [0, 1, 2].map((k) => at(c, k) - at(a, k));
      const n = [
        (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0),
        (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0),
        (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0),
      ];
      const outward = (n[1] ?? 0) * at(a, 1) + (n[2] ?? 0) * at(a, 2);
      expect(outward).toBeGreaterThan(0);
    }
  });

  it('keeps the glyphs the size the design says', () => {
    const p = buf?.positions ?? new Float32Array(0);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      minX = Math.min(minX, p[i] ?? 0);
      maxX = Math.max(maxX, p[i] ?? 0);
    }
    expect(maxX - minX).toBeCloseTo(textColumns('H-002') * STENCIL_CELL, 5);
  });
});
