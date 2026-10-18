/**
 * A lamp head: a small flat box with its light face toward +y and its base at y = 0. Lamps are
 * drawn as instances (render/lamps.ts) so each can have its own colour; this is their one shape.
 */
import type { BufferGeometry } from 'three';
import { AIRLOCK_LAMP_SIZE } from './design-constants';
import { bevelBox } from './profiles';

export const LAMP_THICK = 0.05;

export function lampGeometry(): BufferGeometry {
  return bevelBox(AIRLOCK_LAMP_SIZE, LAMP_THICK, AIRLOCK_LAMP_SIZE);
}
