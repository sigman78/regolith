/**
 * Draws the crew silhouettes (sim/silhouettes.ts): one instanced mesh of a flat graphite figure,
 * one draw call, in the colour pass only (no shadow cast, so a silhouette-only redraw never
 * needs the shadow map). The sim hands over finished matrices; this just copies them in.
 */
import { InstancedMesh, DynamicDrawUsage, Matrix4, type Scene } from 'three';
import { FIGURE_CAPACITY } from '@/geometry/design-constants';
import { figureGeometry } from '@/geometry/figure';
import { materials } from './materials';

/** What the renderer needs of a figure: its matrix (the sim's `Slot` fits). */
export interface FigurePlacement {
  matrix: readonly number[];
}

export class CrewSilhouettes {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();

  constructor(scene: Scene) {
    this.mesh = new InstancedMesh(figureGeometry(), materials.graphite, FIGURE_CAPACITY);
    this.mesh.name = 'crew-silhouettes';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    // Instances roam the whole base; the single bounding sphere would be wrong.
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** Figures drawn now. */
  get count(): number {
    return this.mesh.count;
  }

  set(slots: readonly FigurePlacement[]): void {
    const n = Math.min(slots.length, FIGURE_CAPACITY);
    for (let i = 0; i < n; i++) {
      this.m.fromArray(slots[i]?.matrix ?? []);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
