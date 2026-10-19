/**
 * A corridor stub: the short vestibule in the corridor's section that every door sits on. It runs
 * from `depth` inside the hull to the port, where its flat face carries the door (graphite frame,
 * accent leaf). It is STUB_PROUD larger than a corridor all round, so a corridor that enters it
 * nests inside with no face shared and its end flange reads as the door's collar; an unconnected
 * port shows the door. Frame: the part's own, the port at `at` on its floor line, facing `normal`.
 */
import { Matrix4, Vector3, type BufferGeometry } from 'three';
import type { Vec3 } from '@/core/math';
import type { BundleBuilder } from './bundle';
import {
  CORRIDOR_FLOOR_THICK,
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
  DOOR_FRAME,
  DOOR_FRAME_PROUD,
  DOOR_H,
  DOOR_LEAF_PROUD,
  DOOR_SILL,
  DOOR_W,
  STUB_PROUD,
  TUBE_SEGMENTS,
} from './design-constants';
import {
  bevelBox,
  corridorSection,
  lateralOf,
  sectionCap,
  sectionSweep,
  type SectionFrame,
} from './profiles';

export interface StubOp {
  /** the port, on the floor line, local frame */
  at: Vec3;
  /** unit, horizontal, pointing out of the hull */
  normal: Vec3;
  /** how far behind the port the stub reaches into the hull */
  depth: number;
}

/** The stub's skin: the corridor section grown by STUB_PROUD all round, built once. */
export const STUB_SECTION = corridorSection(
  CORRIDOR_WIDTH + 2 * STUB_PROUD,
  CORRIDOR_HEIGHT + STUB_PROUD,
  CORRIDOR_FLOOR_THICK + STUB_PROUD,
  TUBE_SEGMENTS / 2,
);

export function buildStub(out: BundleBuilder, op: StubOp): void {
  const n = op.normal;
  const lat = lateralOf(n);
  const back: SectionFrame = {
    at: [op.at[0] - n[0] * op.depth, op.at[1] - n[1] * op.depth, op.at[2] - n[2] * op.depth],
    lat,
    stretch: 1,
  };
  const front: SectionFrame = { at: op.at, lat, stretch: 1 };
  out.add('hull', sectionSweep(STUB_SECTION, [back, front]));
  // Closed at both ends: the back is buried in the hull, the front is the wall the door sits on.
  out.add('hull', sectionCap(STUB_SECTION, back, false));
  out.add('hull', sectionCap(STUB_SECTION, front, true));
  buildDoor(out, op.at, n);
}

/**
 * The door on a flat face: its sill DOOR_SILL over the floor line at `at`, facing `normal`. Two
 * jambs and a lintel in graphite, the leaf in accent, each half sunk into the face so nothing is
 * coplanar with it.
 */
export function buildDoor(out: BundleBuilder, at: Vec3, normal: Vec3): void {
  const lat = lateralOf(normal);
  const frame = new Matrix4()
    .makeBasis(new Vector3(...lat), new Vector3(0, 1, 0), new Vector3(...normal))
    .setPosition(at[0], at[1], at[2]);
  const place = (g: BufferGeometry, x: number, y: number): BufferGeometry => {
    g.translate(x, y, 0);
    g.applyMatrix4(frame);
    return g;
  };
  for (const side of [-1, 1]) {
    const jamb = bevelBox(DOOR_FRAME, DOOR_H + DOOR_FRAME, 2 * DOOR_FRAME_PROUD);
    out.add('graphite', place(jamb, side * (DOOR_W + DOOR_FRAME) * 0.5, DOOR_SILL));
  }
  // The lintel spans between the jambs, so no two frame faces lie in one plane.
  out.add(
    'graphite',
    place(bevelBox(DOOR_W, DOOR_FRAME, 2 * DOOR_FRAME_PROUD), 0, DOOR_SILL + DOOR_H),
  );
  out.add('accent', place(bevelBox(DOOR_W, DOOR_H, 2 * DOOR_LEAF_PROUD), 0, DOOR_SILL));
}
