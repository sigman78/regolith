/**
 * Appearance curves (DESIGN_GUIDE §10): everything inflates. A new part grows
 * from 10 % to full size in 0.6 s with an ease-out-back that overshoots to
 * 106 %; removal is the reverse in 0.35 s. Tubes do not inflate, they extend
 * from their first port. Pure functions of normalised time, so they are
 * tested without a renderer.
 */
export const INFLATE_SECONDS = 0.6;
export const DEFLATE_SECONDS = 0.35;
export const TUBE_EXTEND_SECONDS = 0.4;
export const INFLATE_FROM = 0.1;
export const INFLATE_OVERSHOOT = 1.06;
/** Docking clunk: the linked parts dip by this fraction, over this long. */
export const CLUNK_DEPTH = 0.012;
export const CLUNK_SECONDS = 0.18;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Ease-out-back with a given overshoot constant: 0 at t = 0, 1 at t = 1. */
function backOut(t: number, c1: number): number {
  const x = t - 1;
  return 1 + (c1 + 1) * x * x * x + c1 * x * x;
}

function peak(c1: number): number {
  let best = 0;
  for (let i = 0; i <= 200; i++) best = Math.max(best, backOut(i / 200, c1));
  return best;
}

/** The back constant that makes the scale peak at INFLATE_OVERSHOOT (found once, by bisection). */
const BACK = ((): number => {
  const target = 1 + (INFLATE_OVERSHOOT - 1) / (1 - INFLATE_FROM);
  let lo = 0;
  let hi = 4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (peak(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** Scale of a part `t` of the way (0..1) through its inflation. */
export function inflateScale(t: number): number {
  return INFLATE_FROM + (1 - INFLATE_FROM) * backOut(clamp01(t), BACK);
}

/** Scale of a part `t` of the way (0..1) through its removal: the inflation, reversed, no overshoot. */
export function deflateScale(t: number): number {
  const u = 1 - clamp01(t);
  return INFLATE_FROM + (1 - INFLATE_FROM) * (u * u * (3 - 2 * u));
}

/** Fraction of a tube's length drawn, `t` of the way through extending. */
export function extendFraction(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

/** Vertical squash of a part while a tube docks with it, `t` of the way (0..1) through the clunk. */
export function clunkScale(t: number): number {
  return 1 - CLUNK_DEPTH * Math.sin(Math.PI * clamp01(t));
}
