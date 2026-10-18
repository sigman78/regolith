/**
 * Tiny pure vector helpers. The simulation and the solver run in Node tests
 * without a GPU, so they cannot lean on three's classes.
 */
export type Vec3 = readonly [number, number, number];

/** The eight yaw stops, degrees. */
export const YAWS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export type Yaw = (typeof YAWS)[number];

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** degrees, same handedness as three's `rotation.y` */
  yaw: number;
}

const DEG = Math.PI / 180;

/** Rotate about +Y by `yawDeg`, matching `Matrix4.makeRotationY`. */
export function rotateY(v: Vec3, yawDeg: number): Vec3 {
  const c = Math.cos(yawDeg * DEG);
  const s = Math.sin(yawDeg * DEG);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

export function localToWorld(pose: Pose, v: Vec3): Vec3 {
  const r = rotateY(v, pose.yaw);
  return [r[0] + pose.x, r[1] + pose.y, r[2] + pose.z];
}

/** Direction only: rotate, do not translate. */
export function localDirToWorld(pose: Pose, v: Vec3): Vec3 {
  return rotateY(v, pose.yaw);
}

/** Nearest of the eight yaw stops. */
export function snapYaw(deg: number): Yaw {
  const n = ((Math.round(deg / 45) % 8) + 8) % 8;
  return YAWS[n] ?? 0;
}

export function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export function dist2(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
