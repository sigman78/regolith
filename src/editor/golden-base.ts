/**
 * The "golden base": a fixed, hand-composed base that uses every letter and a
 * handful of tubes. It is what the screenshot sheets (`?golden`, see
 * docs/shots/m2) are taken of, so look changes are judged on the same thing.
 * ARCHITECTURE §11 defines the full golden base with crew, rovers and panels;
 * those arrive in M3/M5, until then this is the stand-in.
 */
import type { Link, NewPart } from '@/world/document';

export interface GoldenBase {
  parts: NewPart[];
  links: Link[];
}

const link = (a: string, pa: string, b: string, pb: string): Link => ({
  a: { part: a, port: pa },
  b: { part: b, port: pb },
  kind: 'tube',
});

export function goldenBase(): GoldenBase {
  const parts: NewPart[] = [
    { id: 'g-dome', letter: 'D', params: { radius: 6 }, pose: { x: 0, z: 0, yaw: 0 } },
    {
      id: 'g-hab-w',
      letter: 'H',
      params: { length: 10, radius: 3 },
      pose: { x: -17, z: 0, yaw: 0 },
    },
    { id: 'g-hab-e', letter: 'H', params: { length: 8, radius: 2 }, pose: { x: 16, z: 0, yaw: 0 } },
    { id: 'g-tower', letter: 'V', params: { floors: 4 }, pose: { x: 0, z: -15, yaw: 0 } },
    { id: 'g-node', letter: 'N', params: { size: 2.5 }, pose: { x: 0, z: 13, yaw: 0 } },
    {
      id: 'g-hab-s',
      letter: 'H',
      params: { length: 8, radius: 2 },
      pose: { x: 0, z: 26, yaw: 90 },
    },
    { id: 'g-slab', letter: 'P', params: { w: 10, d: 8 }, pose: { x: 26, z: -14, yaw: 0 } },
    { id: 'g-power', letter: 'E', params: { radius: 3 }, pose: { x: 26, z: -14, yaw: 0 } },
    {
      id: 'g-mast',
      letter: 'M',
      params: { height: 20, head: 0 },
      pose: { x: -26, z: -14, yaw: 0 },
    },
    {
      id: 'g-launch',
      letter: 'C',
      params: { length: 16, elevation: 20 },
      pose: { x: -22, z: 24, yaw: 0 },
    },
    // The airlock's PRESS end meets g-hab-e's first side port (x = 13, z = 2); its ramp faces -x.
    { id: 'g-lock', letter: 'A', params: { radius: 2 }, pose: { x: 13, z: 5, yaw: 270 } },
    {
      id: 'g-solar',
      letter: 'S',
      params: { rows: 2, cols: 8, tracking: true },
      pose: { x: 30, z: 14, yaw: 0 },
    },
    { id: 'g-pole-e', letter: 'X', params: { height: 4 }, pose: { x: 10, z: 11, yaw: 0 } },
    { id: 'g-pole-w', letter: 'X', params: { height: 6 }, pose: { x: -10, z: 11, yaw: 0 } },
  ];
  const links: Link[] = [
    link('g-dome', 'c-2', 'g-hab-w', 'end+'),
    link('g-dome', 'c-0', 'g-hab-e', 'end-'),
    link('g-dome', 'c-3', 'g-tower', 'g-1'),
    link('g-dome', 'c-1', 'g-node', 'z-'),
    link('g-node', 'z+', 'g-hab-s', 'end+'),
  ];
  return { parts, links };
}
