/**
 * Draws the world scatter (world/scatter.ts) as instanced meshes: one per
 * rock variant and shadow class, so a handful of draw calls for the whole
 * world. Rocks too small to shadow without speckle never cast (SCATTER §4).
 *
 * `update` takes the candidate set and the base's keep-out mask, culls, and
 * rebuilds the matrices. A rock that was not there before scales in over
 * SCATTER_FADE_SECONDS (the decorator pop rule), driven by `tick`.
 */
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
  type Scene,
} from 'three';
import { buildBundle } from '@/geometry/build';
import {
  ROCK_SHADOW_MIN_SIZE,
  ROCK_VARIANTS,
  SCATTER_FADE_SECONDS,
} from '@/geometry/design-constants';
import { cullScatter, SCATTER_STRIDE, type ScatterSet } from '@/world/scatter';
import { materials, PALETTE } from './materials';
import { geometriesFor } from './scene-sync';

interface Batch {
  mesh: InstancedMesh;
  /** index into the culled set for each instance slot */
  slots: number[];
}

const AXIS_Y = new Vector3(0, 1, 0);

export class ScatterSync {
  private readonly root = new Object3D();
  private batches: Batch[] = [];
  private set: ScatterSet = { count: 0, data: new Float32Array(0) };
  /** seconds since each rock id appeared, while it is still fading in */
  private readonly age = new Map<number, number>();
  private known = new Set<number>();
  private readonly dark = new Color(PALETTE.rockDark);
  private readonly light = new Color(PALETTE.rockLight);

  constructor(scene: Scene) {
    this.root.name = 'scatter';
    scene.add(this.root);
  }

  /** Rocks are still fading in. */
  get animating(): boolean {
    return this.age.size > 0;
  }

  /** Instance count over all batches (tests and the HUD). */
  get count(): number {
    return this.set.count;
  }

  update(all: ScatterSet, keepOut: Uint8Array, size: number): void {
    const mask = keepOut.length === size * size ? keepOut : new Uint8Array(size * size);
    this.set = cullScatter(all, mask, size);

    const now = new Set<number>();
    for (let n = 0; n < this.set.count; n++) {
      const id = this.set.data[n * SCATTER_STRIDE + 7] ?? 0;
      now.add(id);
      // Anything new after the first build fades in; the first build appears at once.
      if (this.known.size > 0 && !this.known.has(id)) this.age.set(id, 0);
    }
    for (const id of [...this.age.keys()]) if (!now.has(id)) this.age.delete(id);
    this.known = now;
    this.rebuild();
  }

  /** Advance the fade-in. Cheap when nothing is fading. */
  tick(dt: number): void {
    if (this.age.size === 0) return;
    for (const [id, t] of this.age) {
      const next = t + dt;
      if (next >= SCATTER_FADE_SECONDS) this.age.delete(id);
      else this.age.set(id, next);
    }
    this.writeMatrices();
  }

  private rebuild(): void {
    for (const b of this.batches) {
      this.root.remove(b.mesh);
      b.mesh.dispose();
    }
    this.batches = [];

    const groups = new Map<string, number[]>();
    for (let n = 0; n < this.set.count; n++) {
      const o = n * SCATTER_STRIDE;
      const variant = this.set.data[o + 5] ?? 0;
      const big = (this.set.data[o + 3] ?? 0) > ROCK_SHADOW_MIN_SIZE;
      const key = `${variant}:${big ? 1 : 0}`;
      const list = groups.get(key) ?? [];
      list.push(n);
      groups.set(key, list);
    }

    for (let variant = 0; variant < ROCK_VARIANTS; variant++) {
      const bundle = buildBundle({ ops: [{ kind: 'rock', variant }] });
      const geometry = geometriesFor(bundle)['rock'];
      if (!geometry) continue;
      for (const big of [0, 1]) {
        const slots = groups.get(`${variant}:${big}`) ?? [];
        if (slots.length === 0) continue;
        const mesh = new InstancedMesh(geometry, materials.rock, slots.length);
        mesh.castShadow = big === 1;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const colors = new Float32Array(slots.length * 3);
        const c = new Color();
        slots.forEach((n, k) => {
          c.copy(this.dark).lerp(this.light, this.set.data[n * SCATTER_STRIDE + 6] ?? 0);
          colors.set([c.r, c.g, c.b], k * 3);
        });
        mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
        this.batches.push({ mesh, slots });
        this.root.add(mesh);
      }
    }
    this.writeMatrices();
  }

  private writeMatrices(): void {
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scale = new Vector3();
    for (const { mesh, slots } of this.batches) {
      slots.forEach((n, k) => {
        const o = n * SCATTER_STRIDE;
        const size = this.set.data[o + 3] ?? 1;
        const id = this.set.data[o + 7] ?? 0;
        const born = this.age.get(id);
        const grow = born === undefined ? 1 : easeOut(born / SCATTER_FADE_SECONDS);
        q.setFromAxisAngle(AXIS_Y, this.set.data[o + 4] ?? 0);
        pos.set(this.set.data[o] ?? 0, this.set.data[o + 1] ?? 0, this.set.data[o + 2] ?? 0);
        // The unit rock is squashed in its own geometry, so scale it uniformly.
        scale.setScalar(size * grow);
        m.compose(pos, q, scale);
        mesh.setMatrixAt(k, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const b of this.batches) b.mesh.dispose();
    this.root.removeFromParent();
  }
}

function easeOut(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) * (1 - u);
}
