/** Tiny in-place transforms for builders; each mutates and returns its geometry. */
import type { BufferGeometry } from 'three';

export function translated<G extends BufferGeometry>(g: G, x: number, y: number, z: number): G {
  g.translate(x, y, z);
  return g;
}

export function turnedY<G extends BufferGeometry>(g: G, radians: number): G {
  g.rotateY(radians);
  return g;
}
