/**
 * The crew silhouette: a flat head-and-shoulders cut-out in the XY plane facing +z, centred on the
 * origin. Pure geometry; render/crew-silhouettes.ts instances it on the window panes.
 */
import { ExtrudeGeometry, Shape, type BufferGeometry } from 'three';
import { FIGURE_HEIGHT, FIGURE_WIDTH } from './design-constants';

export function figureGeometry(): BufferGeometry {
  const w = FIGURE_WIDTH / 2;
  const h = FIGURE_HEIGHT / 2;
  const headR = FIGURE_WIDTH * 0.2;
  const neck = h - headR * 2 - 0.02;
  const s = new Shape();
  // Shoulders up to the neck, then a round head.
  s.moveTo(-w, -h);
  s.lineTo(w, -h);
  s.lineTo(w, -h + 0.14);
  s.quadraticCurveTo(w, neck - 0.05, headR * 0.5, neck - 0.03);
  s.lineTo(headR * 0.5, neck);
  s.absarc(0, neck + headR, headR, -Math.PI / 2 + 0.5, -Math.PI / 2 - 0.5 + Math.PI * 2, false);
  s.lineTo(-headR * 0.5, neck - 0.03);
  s.quadraticCurveTo(-w, neck - 0.05, -w, -h + 0.14);
  s.lineTo(-w, -h);
  const g = new ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -0.004);
  return g;
}
