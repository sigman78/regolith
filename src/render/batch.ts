/**
 * MaterialBatch: every instance of one material in one `BatchedMesh`, so a whole base is a handful
 * of draw calls instead of one per part per material (docs/PERF.md).
 *
 * Geometries are shared by key and reference-counted. A geometry nobody uses any more stays in the
 * buffers until space runs out, so undoing a resize does not upload it again; then the unused ones
 * are dropped, the buffers repacked and, only if that is not enough, grown.
 *
 * Instance matrices must not have a negative determinant (three does not flip the winding per
 * instance). A mirrored part therefore registers a mirrored copy of the geometry (`mirrored`).
 */
import { BatchedMesh, BufferGeometry, type Material, type Matrix4, type Object3D } from 'three';

const MIN_VERTICES = 4096;
const MIN_INSTANCES = 64;

interface Slot {
  id: number;
  refs: number;
  vertices: number;
  indices: number;
}

const mirroredCache = new WeakMap<BufferGeometry, BufferGeometry>();

/** The geometry reflected across local z, with the winding turned back outward. */
export function mirrored(geometry: BufferGeometry): BufferGeometry {
  const hit = mirroredCache.get(geometry);
  if (hit) return hit;
  const out = geometry.clone();
  for (const name of ['position', 'normal']) {
    const a = out.getAttribute(name);
    for (let i = 0; i < a.count; i++) a.setZ(i, -a.getZ(i));
  }
  const index = out.getIndex();
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const b = index.getY(i);
      index.setY(i, index.getZ(i));
      index.setZ(i, b);
    }
  }
  out.computeBoundingSphere();
  mirroredCache.set(geometry, out);
  return out;
}

export class MaterialBatch {
  /** Created with the first geometry, which sizes the buffers. */
  mesh: BatchedMesh | null = null;
  private readonly slots = new Map<string, Slot>();
  private maxVertices = 0;
  private maxIndices = 0;
  /** Where the next geometry goes; only repacking brings it back down. */
  private cursorVertices = 0;
  private cursorIndices = 0;

  constructor(
    private readonly parent: Object3D,
    private readonly material: Material,
    private readonly sorted: boolean,
  ) {}

  /** Instances drawn right now (tests, HUD). */
  get count(): number {
    return this.mesh?.instanceCount ?? 0;
  }

  /** A new instance of the geometry stored under `key`; `make` builds it on first use. */
  add(key: string, make: () => BufferGeometry): number {
    let slot = this.slots.get(key);
    if (!slot) {
      const geometry = make();
      const mesh = this.reserve(geometry);
      slot = {
        id: mesh.addGeometry(geometry),
        refs: 0,
        vertices: geometry.getAttribute('position').count,
        indices: geometry.getIndex()?.count ?? 0,
      };
      this.cursorVertices += slot.vertices;
      this.cursorIndices += slot.indices;
      this.slots.set(key, slot);
    }
    const mesh = this.mesh;
    if (!mesh) throw new Error('batch has no mesh');
    if (mesh.instanceCount >= mesh.maxInstanceCount) {
      mesh.setInstanceCount(Math.max(MIN_INSTANCES, mesh.maxInstanceCount * 2));
    }
    slot.refs++;
    return mesh.addInstance(slot.id);
  }

  remove(key: string, instance: number): void {
    const slot = this.slots.get(key);
    if (!slot || !this.mesh) return;
    this.mesh.deleteInstance(instance);
    slot.refs--;
  }

  setMatrix(instance: number, matrix: Matrix4): void {
    this.mesh?.setMatrixAt(instance, matrix);
  }

  /** The batch with room for `geometry`, created, repacked or grown as needed. */
  private reserve(geometry: BufferGeometry): BatchedMesh {
    const v = geometry.getAttribute('position').count;
    const i = geometry.getIndex()?.count ?? 0;
    if (!this.mesh) {
      this.maxVertices = Math.max(MIN_VERTICES, v * 2);
      this.maxIndices = Math.max(MIN_VERTICES * 2, i * 2);
      const mesh = new BatchedMesh(MIN_INSTANCES, this.maxVertices, this.maxIndices, this.material);
      mesh.sortObjects = this.sorted;
      // Per-instance culling does the work; the batch's own sphere would be stale.
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.parent.add(mesh);
      this.mesh = mesh;
      return mesh;
    }
    if (this.cursorVertices + v > this.maxVertices || this.cursorIndices + i > this.maxIndices) {
      this.repack(this.mesh);
    }
    if (this.cursorVertices + v > this.maxVertices || this.cursorIndices + i > this.maxIndices) {
      this.maxVertices = Math.max(this.maxVertices * 2, this.cursorVertices + v);
      this.maxIndices = Math.max(this.maxIndices * 2, this.cursorIndices + i);
      this.mesh.setGeometrySize(this.maxVertices, this.maxIndices);
    }
    return this.mesh;
  }

  /** Drop unused geometries and close the gaps they leave. */
  private repack(mesh: BatchedMesh): void {
    for (const [key, slot] of this.slots) {
      if (slot.refs > 0) continue;
      mesh.deleteGeometry(slot.id);
      this.slots.delete(key);
    }
    mesh.optimize();
    this.cursorVertices = 0;
    this.cursorIndices = 0;
    for (const slot of this.slots.values()) {
      this.cursorVertices += slot.vertices;
      this.cursorIndices += slot.indices;
    }
  }

  dispose(): void {
    if (!this.mesh) return;
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = null;
    this.slots.clear();
  }
}
