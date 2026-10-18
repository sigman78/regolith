/**
 * Fits the sun's shadow box to the build area, and keeps it from shimmering.
 *
 * A tight box is what makes the shadow map sharp (DESIGN_GUIDE §9: acne and
 * speckle at low sun come from texels that are too big). The box is centred
 * on the base, not the camera, and its centre is snapped to whole shadow
 * texels in light space, so panning and zooming do not make edges crawl.
 */
import { DirectionalLight, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);

/** Snap `center` to the shadow texel grid seen from the light; returns a new vector. */
export function snapToTexels(center: Vector3, lightDir: Vector3, texel: number): Vector3 {
  const right = new Vector3().crossVectors(UP, lightDir).normalize();
  const up = new Vector3().crossVectors(lightDir, right).normalize();
  const cx = center.dot(right);
  const cy = center.dot(up);
  const dx = Math.round(cx / texel) * texel - cx;
  const dy = Math.round(cy / texel) * texel - cy;
  return center.clone().addScaledVector(right, dx).addScaledVector(up, dy);
}

/**
 * Point `light` along `lightDir` at a sphere (`center`, `radius`) and size its
 * orthographic shadow camera to just contain it.
 */
export function fitSunShadow(
  light: DirectionalLight,
  center: Vector3,
  radius: number,
  lightDir: Vector3,
): void {
  const mapSize = light.shadow.mapSize.x;
  const texel = (2 * radius) / mapSize;
  const c = snapToTexels(center, lightDir, texel);
  const distance = radius * 2;
  light.position.copy(c).addScaledVector(lightDir, distance);
  light.target.position.copy(c);
  const cam = light.shadow.camera;
  cam.left = -radius;
  cam.right = radius;
  cam.top = radius;
  cam.bottom = -radius;
  cam.near = 0.5;
  cam.far = distance + radius * 2;
  cam.updateProjectionMatrix();
}
