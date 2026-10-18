/**
 * The snap arrow: a flat arrow on the ground from where the cursor is to where
 * the solver put the ghost (ARCHITECTURE §4.4). Pure presentation; the caller
 * decides when to show it.
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, Vector3, type Scene } from 'three';
import { SNAP_ARROW_HEAD, SNAP_ARROW_LIFT, SNAP_ARROW_RADIUS } from '@/geometry/design-constants';
import { materials } from './materials';

const UP = new Vector3(0, 1, 0);

export class SnapArrow {
  private readonly group = new Group();
  private readonly shaft = new Mesh(
    new CylinderGeometry(SNAP_ARROW_RADIUS, SNAP_ARROW_RADIUS, 1, 8),
    materials.accent,
  );
  private readonly head = new Mesh(
    new ConeGeometry(SNAP_ARROW_HEAD.radius, SNAP_ARROW_HEAD.length, 12),
    materials.accent,
  );

  constructor(scene: Scene) {
    for (const m of [this.shaft, this.head]) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = 10;
    }
    this.group.add(this.shaft, this.head);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Arrow from (fx, fz) to (tx, tz), on the terrain heights given. */
  show(from: [number, number, number], to: [number, number, number]): void {
    const a = new Vector3(from[0], from[1] + SNAP_ARROW_LIFT, from[2]);
    const b = new Vector3(to[0], to[1] + SNAP_ARROW_LIFT, to[2]);
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-6) {
      this.hide();
      return;
    }
    dir.divideScalar(len);
    const shaftLen = Math.max(0.01, len - SNAP_ARROW_HEAD.length);

    this.shaft.quaternion.setFromUnitVectors(UP, dir);
    this.shaft.scale.set(1, shaftLen, 1);
    this.shaft.position.copy(a).addScaledVector(dir, shaftLen / 2);

    this.head.quaternion.setFromUnitVectors(UP, dir);
    this.head.position.copy(a).addScaledVector(dir, shaftLen + SNAP_ARROW_HEAD.length / 2);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }
}
