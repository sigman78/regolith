/**
 * Draws the crew who are outside (sim/crew.ts points with `exposed = 1`) as suited figures: two
 * instanced meshes (hull white, graphite) sharing one matrix per figure. They cast no shadow, so a
 * walking crew never makes the shadow map redraw.
 */
import { DynamicDrawUsage, InstancedMesh, Matrix4, type Scene } from 'three';
import { buildBundle } from '@/geometry/build';
import { CREW_MAX, SUIT_BOB } from '@/geometry/design-constants';
import { materials } from './materials';
import { geometriesFor } from './scene-sync';

/** Mirrors the sim's point layout (sim/crew.ts CREW_STRIDE and field order). */
const STRIDE = 8;

export class CrewOutdoors {
  private readonly meshes: InstancedMesh[] = [];
  private readonly m = new Matrix4();

  constructor(scene: Scene) {
    const geos = geometriesFor(buildBundle({ ops: [{ kind: 'suit' }] }));
    for (const name of ['hull', 'graphite'] as const) {
      const geo = geos[name];
      if (!geo) continue;
      const mesh = new InstancedMesh(geo, materials[name], CREW_MAX);
      mesh.name = `crew-outdoors-${name}`;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  /** Figures drawn now. */
  get count(): number {
    return this.meshes[0]?.count ?? 0;
  }

  /** Place a figure for every crew point that is outside. */
  set(points: Float32Array): void {
    let n = 0;
    for (let i = 0; i + STRIDE <= points.length && n < CREW_MAX; i += STRIDE) {
      if (points[i + 6] !== 1) continue;
      const bob =
        points[i + 5] === 1 ? SUIT_BOB * Math.abs(Math.sin((points[i + 4] ?? 0) * Math.PI * 2)) : 0;
      this.m.makeRotationY(points[i + 3] ?? 0);
      this.m.setPosition(points[i] ?? 0, (points[i + 1] ?? 0) + bob, points[i + 2] ?? 0);
      for (const mesh of this.meshes) mesh.setMatrixAt(n, this.m);
      n++;
    }
    for (const mesh of this.meshes) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
