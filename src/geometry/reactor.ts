/**
 * Letter E geometry: a squat containment drum with a domed top, a hazard band,
 * a ring of radiator fins and a junction box at each POWER port.
 *
 * Frame matches grammar/parts/E.ts: axis along +Y, flat base at y = 0.
 */
import { Vector2 } from 'three';
import type { BundleBuilder } from './bundle';
import {
  BEVEL,
  FLANGE_RATIO,
  REACTOR_BAND_AT,
  REACTOR_BAND_PROUD,
  REACTOR_BAND_HALF,
  REACTOR_CAP_RATIO,
  REACTOR_CAP_STEPS,
  REACTOR_FIN_COUNT,
  REACTOR_FIN_EMBED,
  REACTOR_FIN_REACH,
  REACTOR_FIN_SPAN,
  REACTOR_FIN_THICK,
  REACTOR_HEIGHT_RATIO,
  REACTOR_JUNCTION,
  REACTOR_PORT_Y,
  REACTOR_RIB_THICK,
  REACTOR_SEGMENTS,
  REACTOR_PORT_COUNT,
} from './design-constants';
import { bevelBox, lathe, ribProfile } from './profiles';
import { translated, turnedY } from './transform';

export interface ReactorOp {
  radius: number;
}

export function reactorHeight(radius: number): number {
  return radius * REACTOR_HEIGHT_RATIO;
}

/** Angles (radians, in the XZ plane from +X towards +Z) of the POWER ports. */
const PORT_ANGLES = Array.from(
  { length: REACTOR_PORT_COUNT },
  (_, k) => (k * Math.PI * 2) / REACTOR_PORT_COUNT,
);

export function buildReactor(out: BundleBuilder, op: ReactorOp): void {
  const r = op.radius;
  const h = reactorHeight(r);
  const cap = r * REACTOR_CAP_RATIO;

  const hull = [
    new Vector2(0, 0),
    new Vector2(r - BEVEL, 0),
    new Vector2(r, BEVEL),
    new Vector2(r, h),
  ];
  for (let i = 1; i <= REACTOR_CAP_STEPS; i++) {
    const a = (i / REACTOR_CAP_STEPS) * (Math.PI / 2);
    hull.push(new Vector2(Math.cos(a) * r, h + Math.sin(a) * cap));
  }
  out.add('hull', lathe(hull, REACTOR_SEGMENTS));

  for (const y of [REACTOR_RIB_THICK, h]) {
    out.add(
      'graphite',
      lathe(ribProfile(r, y, REACTOR_RIB_THICK, r * FLANGE_RATIO), REACTOR_SEGMENTS),
    );
  }

  const by = h * REACTOR_BAND_AT;
  const br = r + REACTOR_BAND_PROUD;
  out.add(
    'warning',
    lathe(
      [new Vector2(br, by - REACTOR_BAND_HALF), new Vector2(br, by + REACTOR_BAND_HALF)],
      REACTOR_SEGMENTS,
    ),
  );

  // Radiator fins around the upper drum.
  const reach = r * REACTOR_FIN_REACH;
  const finH = h * REACTOR_FIN_SPAN;
  for (let k = 0; k < REACTOR_FIN_COUNT; k++) {
    const angle = (k * Math.PI * 2) / REACTOR_FIN_COUNT;
    const fin = bevelBox(reach + REACTOR_FIN_EMBED, finH, REACTOR_FIN_THICK);
    out.add(
      'aluminum',
      turnedY(
        translated(fin, r + (reach - REACTOR_FIN_EMBED) / 2, h - finH - cap * 0.2, 0),
        -angle,
      ),
    );
  }

  // A junction box at every POWER port.
  const j = REACTOR_JUNCTION;
  for (const angle of PORT_ANGLES) {
    const box = bevelBox(j.radial, j.h, j.tangent);
    out.add(
      'graphite',
      turnedY(translated(box, r + j.radial / 2 - 0.05, REACTOR_PORT_Y - j.h / 2, 0), -angle),
    );
  }
}
