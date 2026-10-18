/**
 * Letter S geometry: rows of tilted panels (graphite frame, blue face, light cell lines) carried by
 * tilted graphite beams on a single line of posts down the middle.
 *
 * Frame matches grammar/parts/S.ts: array centred on the origin, posts' feet at y = 0, panels
 * leaning toward +z. `tracking` does not change the shape yet; it is the resting pose.
 */
import { PlaneGeometry, type BufferGeometry } from 'three';
import type { BundleBuilder } from './bundle';
import {
  SOLAR_BEAM,
  SOLAR_BORDER,
  SOLAR_CELLS_X,
  SOLAR_CELLS_Z,
  SOLAR_CELL_LINE,
  SOLAR_CELL_PROUD,
  SOLAR_CENTRE_Y,
  SOLAR_COL_GAP,
  SOLAR_FACE_PROUD,
  SOLAR_PANEL_D,
  SOLAR_PANEL_THICK,
  SOLAR_PANEL_W,
  SOLAR_POST_RADIUS,
  SOLAR_POST_SEGMENTS,
} from './design-constants';
import { bevelBox, bevelCylinder } from './profiles';
import { SOLAR_TILT, solarPostXs, solarRowPitch, solarWidth } from '@/grammar/solar-layout';

export interface SolarOp {
  rows: number;
  cols: number;
  /** carried for the sim; the resting shape is the same */
  tracking?: boolean;
}

const TILT = SOLAR_TILT;
const rowPitch = solarRowPitch;

function flat(w: number, d: number, y: number): BufferGeometry {
  const g = new PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

export function buildSolar(out: BundleBuilder, op: SolarOp): void {
  const { rows, cols } = op;
  const u = SOLAR_PANEL_W + SOLAR_COL_GAP;
  const w = solarWidth(cols);
  const pitch = rowPitch();
  const half = SOLAR_PANEL_THICK / 2;
  const faceW = SOLAR_PANEL_W - 2 * SOLAR_BORDER;
  const faceD = SOLAR_PANEL_D - 2 * SOLAR_BORDER;

  for (let r = 0; r < rows; r++) {
    const z = (r - (rows - 1) / 2) * pitch;
    // One graphite frame slab carries the whole row; the gaps between the blue faces show it.
    const frame = bevelBox(w, SOLAR_PANEL_THICK, SOLAR_PANEL_D);
    frame.translate(0, -half, 0);
    frame.rotateX(TILT);
    frame.translate(0, SOLAR_CENTRE_Y, z);
    out.add('graphite', frame);
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + SOLAR_PANEL_W / 2 + c * u;
      const place = (g: BufferGeometry): BufferGeometry => {
        g.rotateX(TILT);
        g.translate(x, SOLAR_CENTRE_Y, z);
        return g;
      };
      out.add('solar', place(flat(faceW, faceD, half + SOLAR_FACE_PROUD)));
      // Cell lines: dividers across and along the face.
      const y = half + SOLAR_CELL_PROUD;
      for (let i = 1; i < SOLAR_CELLS_X; i++) {
        const line = flat(SOLAR_CELL_LINE, faceD, y);
        line.translate(-faceW / 2 + (faceW * i) / SOLAR_CELLS_X, 0, 0);
        out.add('solarCell', place(line));
      }
      for (let j = 1; j < SOLAR_CELLS_Z; j++) {
        const line = flat(faceW, SOLAR_CELL_LINE, y);
        line.translate(0, 0, -faceD / 2 + (faceD * j) / SOLAR_CELLS_Z);
        out.add('solarCell', place(line));
      }
    }
  }

  // Beams run down the slope under the panels; a post carries each one at the middle.
  const slopeLength = (rows * pitch) / Math.cos(TILT);
  const beamY = SOLAR_CENTRE_Y - SOLAR_PANEL_THICK - SOLAR_BEAM / 2;
  for (const px of solarPostXs(cols)) {
    const beam = bevelBox(SOLAR_BEAM, SOLAR_BEAM, slopeLength);
    beam.translate(0, -SOLAR_BEAM / 2, 0);
    beam.rotateX(TILT);
    beam.translate(px, beamY, 0);
    out.add('graphite', beam);
    out.add(
      'graphite',
      bevelCylinder(SOLAR_POST_RADIUS, beamY - SOLAR_BEAM, SOLAR_POST_SEGMENTS).translate(px, 0, 0),
    );
  }

  // A small junction box at the -x end, where the POWER port sits.
  const box = bevelBox(0.3, 0.5, 0.4);
  box.translate(-w / 2 - 0.15, 0, 0);
  out.add('graphite', box);
}
