/**
 * How far a door on the floor stands in front of the hull behind it. A port keeps its plan position
 * (the apex of an end cap, the flank of a cylinder, the equator of a sphere) but drops to the floor,
 * and the shell curves away from it there. Tubes embed by this much on top of TUBE_PORT_EMBED so a
 * pipe end never floats off the hull; stage 2's stub retires the need. Pure.
 */

/** A round flank or sphere of radius r, seen at height y from the axis: r - sqrt(r^2 - y^2). */
export function roundGap(r: number, y: number): number {
  return r - Math.sqrt(Math.max(0, r * r - y * y));
}

/** The end cap of a hull of radius r whose cap is `cap` deep, at height y: cap (1 - sqrt(1 - (y/r)^2)). */
export function capGap(r: number, cap: number, y: number): number {
  return cap * (1 - Math.sqrt(Math.max(0, 1 - (y / r) ** 2)));
}
