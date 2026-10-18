import { Box3, Matrix4, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument, removePart, setPartPose, type NewPart } from '@/world/document';
import { mirrored } from './batch';
import { DEFLATE_SECONDS } from './inflate';
import { SceneSync, geometriesFor } from './scene-sync';
import { buildBundle } from '@/geometry/build';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function hab(id: string, x: number, mirror = false): NewPart {
  return {
    id,
    letter: 'H',
    params: { length: 8, radius: 2 },
    pose: { x, z: 0, yaw: 0, ...(mirror ? { mirror: true as const } : {}) },
  };
}

/** 200 small habs on a 6 m grid: the benchmark's shape (render/ may not import the editor's stress base). */
function stressDoc() {
  let doc = createDocument({ seed: 't' });
  for (let k = 0; k < 200; k++) {
    doc = addPart(doc, {
      ...hab(`s${k}`, (k % 15) * 6 - 42),
      pose: { x: (k % 15) * 6 - 42, z: Math.floor(k / 15) * 6 - 42, yaw: 0 },
    });
  }
  return doc;
}

function instances(sync: SceneSync): number {
  return sync.batchMeshes.reduce((n, m) => n + m.instanceCount, 0);
}

/** World-space bounds of every instance in the batch of a scene. */
function bounds(sync: SceneSync): Box3 {
  const box = new Box3();
  const m = new Matrix4();
  const b = new Box3();
  for (const mesh of sync.batchMeshes) {
    for (let i = 0; i < mesh.instanceCount; i++) {
      mesh.getMatrixAt(i, m);
      mesh.getBoundingBoxAt(mesh.getGeometryIdAt(i), b)?.applyMatrix4(m);
      box.union(b);
    }
  }
  return box;
}

describe('batched drawing', () => {
  it('draws a whole base in a few meshes, one per material', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    sync.sync(solve(stressDoc(), FLAT));
    const meshes = sync.batchMeshes;
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes.length).toBeLessThanOrEqual(7);
    expect(instances(sync)).toBeGreaterThan(200);
    // No plain Mesh is left for the base.
    let plain = 0;
    scene.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh && !(o as { isBatchedMesh?: boolean }).isBatchedMesh)
        plain++;
    });
    expect(plain).toBe(0);
  });

  it('shares one geometry between identical parts', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    let doc = createDocument({ seed: 't' });
    doc = addPart(doc, hab('a', 0));
    doc = addPart(doc, hab('b', 20));
    sync.sync(solve(doc, FLAT));
    const hull = sync.batchMeshes.find((m) => m.instanceCount === 2);
    expect(hull).toBeDefined();
    expect(hull?.getGeometryIdAt(0)).toBe(hull?.getGeometryIdAt(1));
  });

  it('places an instance where the part stands', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    const doc = addPart(createDocument({ seed: 't' }), hab('a', 20));
    sync.sync(solve(doc, FLAT));
    const c = bounds(sync).getCenter(new Vector3());
    expect(c.x).toBeCloseTo(20, 0);
  });

  it('removes instances once a deleted part has shrunk away', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    let doc = createDocument({ seed: 't' });
    doc = addPart(doc, hab('a', 0));
    doc = addPart(doc, hab('b', 20));
    sync.sync(solve(doc, FLAT));
    const both = instances(sync);
    sync.sync(solve(removePart(doc, 'b'), FLAT));
    expect(instances(sync)).toBe(both); // still shrinking
    sync.tick(DEFLATE_SECONDS + 0.01);
    expect(instances(sync)).toBeLessThan(both);
    sync.sync(solve(createDocument({ seed: 't' }), FLAT));
    sync.tick(DEFLATE_SECONDS + 0.01);
    expect(instances(sync)).toBe(0);
  });

  it('grows its buffers past the first allocation', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    let doc = createDocument({ seed: 't' });
    // Distinct lengths make distinct geometries, so vertex space has to grow.
    for (let k = 0; k < 24; k++) {
      doc = addPart(doc, {
        id: `p${k}`,
        letter: 'H',
        params: { length: 4 + (k % 12) * 2, radius: 2 },
        pose: { x: (k % 6) * 14 - 40, z: Math.floor(k / 6) * 14 - 20, yaw: 0 },
      });
    }
    expect(() => sync.sync(solve(doc, FLAT))).not.toThrow();
    expect(instances(sync)).toBeGreaterThan(24);
  });

  it('draws a flipped part on the other flank with outward winding', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    let doc = addPart(createDocument({ seed: 't' }), hab('h', 0));
    sync.sync(solve(doc, FLAT));
    const before = instances(sync);
    doc = setPartPose(doc, 'h', { x: 0, z: 0, yaw: 0, mirror: true });
    sync.sync(solve(doc, FLAT));
    expect(instances(sync)).toBe(before);
    // No instance matrix is a reflection: three cannot flip the winding per instance.
    const m = new Matrix4();
    for (const mesh of sync.batchMeshes) {
      for (let i = 0; i < mesh.instanceCount; i++) {
        expect(mesh.getMatrixAt(i, m).determinant()).toBeGreaterThan(0);
      }
    }
  });
});

describe('mirrored geometry', () => {
  const g = geometriesFor(buildBundle(solveHab())).hull;

  function solveHab() {
    const doc = addPart(createDocument({ seed: 't' }), hab('h', 0));
    const part = solve(doc, FLAT).parts.get('h');
    if (!part) throw new Error('no part');
    return part.recipe;
  }

  it('negates z and keeps faces pointing outward', () => {
    if (!g) throw new Error('no hull');
    const mg = mirrored(g);
    expect(mirrored(g)).toBe(mg);
    const p = g.getAttribute('position');
    const q = mg.getAttribute('position');
    expect(q.getZ(5)).toBeCloseTo(-p.getZ(5), 6);
    expect(q.getX(5)).toBeCloseTo(p.getX(5), 6);
    // Count the faces whose winding agrees with the vertex normals: mirroring must not lose any.
    const agree = (geo: typeof g): number => {
      const pos = geo.getAttribute('position');
      const nor = geo.getAttribute('normal');
      const idx = geo.getIndex();
      if (!idx) throw new Error('no index');
      const v = (i: number) => new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      let n = 0;
      for (let t = 0; t + 2 < idx.count; t += 3) {
        const [i0, i1, i2] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
        const face = v(i1)
          .sub(v(i0))
          .cross(v(i2).sub(v(i0)));
        if (face.dot(new Vector3(nor.getX(i0), nor.getY(i0), nor.getZ(i0))) > 0) n++;
      }
      return n;
    };
    expect(agree(mg)).toBe(agree(g));
    expect(agree(mg)).toBeGreaterThan(100);
  });
});
