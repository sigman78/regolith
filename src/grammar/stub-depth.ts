/**
 * How deep the corridor stub behind a door must reach so its back sits inside the hull. A port
 * keeps its plan position (the apex of an end cap, the flank of a cylinder, the equator of a
 * sphere, the side of a drum) but sits on the floor, and the hull curves away from it there: the
 * stub, a short vestibule in the corridor's section, bridges that and carries the door. Each helper
 * takes the stub section's extreme points against one hull shape and returns the depth that puts
 * every one of them a bevel inside, never less than PORT_STUB_DEPTH. Pure.
 */
import {
  BEVEL,
  CORRIDOR_FLOOR_THICK,
  CORRIDOR_HALF_WIDTH,
  CORRIDOR_HEIGHT,
  PORT_STUB_DEPTH,
  STUB_PROUD,
} from '@/geometry/design-constants';

/** The stub section's reach from its floor line: half-width, up to the crown, down to the underside. */
export const STUB_HALF_WIDTH = CORRIDOR_HALF_WIDTH + STUB_PROUD;
export const STUB_TOP = CORRIDOR_HEIGHT + STUB_PROUD;
export const STUB_BOTTOM = CORRIDOR_FLOOR_THICK + STUB_PROUD;

const settle = (d: number): number => Math.max(PORT_STUB_DEPTH, d + BEVEL);

/** The section's lowest and highest points for a floor at local y `floor` (y measured from the hull axis). */
const heights = (floor: number): [number, number] => [floor - STUB_BOTTOM, floor + STUB_TOP];

/** The farthest section corner from the axis line through the door, in the section plane. */
const corner = (floor: number): number =>
  Math.max(...heights(floor).map((y) => Math.hypot(y, STUB_HALF_WIDTH)));

/** A door on the flank of a horizontal cylinder of radius r (a hab's side ports). */
export function flankStub(r: number, floor: number): number {
  const y = Math.max(...heights(floor).map(Math.abs));
  return settle(r - Math.sqrt(Math.max(0, r * r - y * y)));
}

/** A door at the apex of an end cap `cap` deep on a hull of radius r (a hab's or airlock's ends). */
export function capStub(r: number, cap: number, floor: number): number {
  const q = corner(floor);
  return settle(cap * (1 - Math.sqrt(Math.max(0, 1 - (q / r) ** 2))));
}

/** A door on the equator of a sphere of radius r (a node's side ports). */
export function sphereStub(r: number, floor: number): number {
  const q = corner(floor);
  return settle(r - Math.sqrt(Math.max(0, r * r - q * q)));
}

/**
 * A door on an upright drum of radius r (a tower, a dome's collar), `floor` from its base. With
 * `shellFrom`, the drum ends at that height and a cap goes on from there, `capHeight` tall (a
 * hemisphere when it equals r), which the stub's crown may reach into.
 */
export function drumStub(r: number, floor: number, shellFrom = Infinity, capHeight = r): number {
  let d = r - Math.sqrt(Math.max(0, r * r - STUB_HALF_WIDTH ** 2));
  const top = floor + STUB_TOP;
  if (top > shellFrom) {
    // The cap's radius at that height, then the drum formula against it.
    const rho = r * Math.sqrt(Math.max(0, 1 - ((top - shellFrom) / capHeight) ** 2));
    d = Math.max(d, r - Math.sqrt(Math.max(0, rho * rho - STUB_HALF_WIDTH ** 2)));
  }
  return settle(d);
}
