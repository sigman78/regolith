/**
 * Where an array's panels and posts are. Pure numbers shared by the part definition (footprint,
 * ports) and the geometry builder (geometry/solar.ts), so the legs always meet the posts.
 */
import {
  SOLAR_COL_GAP,
  SOLAR_PANEL_D,
  SOLAR_PANEL_W,
  SOLAR_ROW_GAP,
  SOLAR_TILT_DEG,
} from '@/geometry/design-constants';

export const SOLAR_TILT = (SOLAR_TILT_DEG * Math.PI) / 180;

/** Spacing of panel rows in plan (z). */
export function solarRowPitch(): number {
  return SOLAR_PANEL_D * Math.cos(SOLAR_TILT) + SOLAR_ROW_GAP;
}

/** Overall width of the array (x). */
export function solarWidth(cols: number): number {
  return cols * (SOLAR_PANEL_W + SOLAR_COL_GAP) - SOLAR_COL_GAP;
}

/** Overall plan depth of the array (z), with the panels at their resting tilt. */
export function solarDepth(rows: number): number {
  return rows * solarRowPitch() - SOLAR_ROW_GAP;
}

/** x of the posts: one under every second column boundary, the ends pulled inside the panels. */
export function solarPostXs(cols: number): number[] {
  const w = solarWidth(cols);
  const unit = SOLAR_PANEL_W + SOLAR_COL_GAP;
  const out: number[] = [];
  const n = Math.max(1, Math.round(cols / 2));
  for (let k = 0; k <= n; k++) {
    if (k === 0) out.push(-w / 2 + 0.25);
    else if (k === n) out.push(w / 2 - 0.25);
    else out.push(-w / 2 + 2 * k * unit - SOLAR_COL_GAP / 2);
  }
  return out;
}
