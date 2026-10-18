/**
 * A stencilled line of text wrapped onto a cylinder, for the serial on a hab hull. Built in the
 * hull's own frame (axis along x, centred at x = 0, text on the +z flank reading toward +x, the
 * top of the letters toward +y), a hair proud of the surface. Solid paint only: flat quads, one
 * per painted run, so a serial is about 200 triangles.
 */
import { BufferAttribute, BufferGeometry } from 'three';
import type { BundleBuilder } from './bundle';
import { STENCIL_ANGLE_DEG, STENCIL_CELL, STENCIL_PROUD } from './design-constants';
import { GLYPH_ROWS, textColumns, textRuns } from './font';

export interface StencilOp {
  text: string;
  /** radius of the cylinder the text sits on, metres */
  radius: number;
}

export function buildStencil(out: BundleBuilder, op: StencilOp): void {
  const runs = textRuns(op.text);
  if (runs.length === 0) return;
  const r = op.radius + STENCIL_PROUD;
  const dAlpha = STENCIL_CELL / op.radius;
  const alpha0 = (STENCIL_ANGLE_DEG * Math.PI) / 180;
  const width = textColumns(op.text) * STENCIL_CELL;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const point = (u: number, alpha: number): [number, number, number] => [
    u,
    r * Math.cos(alpha),
    r * Math.sin(alpha),
  ];

  for (const run of runs) {
    const u0 = -width / 2 + run.col * STENCIL_CELL;
    const u1 = u0 + run.cols * STENCIL_CELL;
    // Row 0 is the top of the letters: nearer the top of the hull, a smaller angle.
    const top = alpha0 + (run.row - GLYPH_ROWS / 2) * dAlpha;
    const bottom = top + dAlpha;
    const mid = (top + bottom) / 2;
    const n: [number, number, number] = [0, Math.cos(mid), Math.sin(mid)];
    const base = positions.length / 3;
    for (const p of [point(u0, top), point(u1, top), point(u1, bottom), point(u0, bottom)]) {
      positions.push(...p);
      normals.push(...n);
    }
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    // Corners a, b, c, d run top-left, top-right, bottom-right, bottom-left; a-d-b and b-d-c face outward.
    indices.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(indices);
  out.add('graphite', g);
}
