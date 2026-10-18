/**
 * The starting scene: the three habs the scaffold always showed, now as real
 * document parts so everything on screen can be selected, grown and undone.
 */
import type { NewPart } from '@/world/document';

export function demoParts(): NewPart[] {
  return [
    { id: 'demo-a', letter: 'H', params: { length: 8, radius: 2 }, pose: { x: 0, z: 0, yaw: 0 } },
    { id: 'demo-b', letter: 'H', params: { length: 6, radius: 2 }, pose: { x: 9, z: -1, yaw: 90 } },
    { id: 'demo-c', letter: 'H', params: { length: 4, radius: 2 }, pose: { x: -10, z: 2, yaw: 0 } },
  ];
}
