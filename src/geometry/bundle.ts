/**
 * GeometryBundle: what builders return and what crosses into render/ (and,
 * later, back from the geometry worker as transferred buffers). Plain typed
 * arrays, grouped by material name, so nothing here knows about scenes.
 */
import { BufferGeometry } from 'three';
import type { Vec3 } from '@/core/math';

/** Names in render/materials.ts. render/ asserts it has exactly these. */
export type MaterialName = 'hull' | 'accent' | 'graphite' | 'aluminum' | 'glass' | 'warning';

export interface MaterialBuffers {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export interface GeometryBundle {
  byMaterial: Partial<Record<MaterialName, MaterialBuffers>>;
  bounds: Aabb;
  /** hash of the recipe that produced this bundle */
  hash: string;
}

/** Collects BufferGeometries per material, then flattens them to one buffer set each. */
export class BundleBuilder {
  private readonly parts = new Map<MaterialName, BufferGeometry[]>();

  add(material: MaterialName, geometry: BufferGeometry): void {
    const list = this.parts.get(material) ?? [];
    list.push(geometry);
    this.parts.set(material, list);
  }

  build(hash: string): GeometryBundle {
    const byMaterial: Partial<Record<MaterialName, MaterialBuffers>> = {};
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

    for (const [name, geos] of this.parts) {
      const buffers = merge(geos);
      byMaterial[name] = buffers;
      const p = buffers.positions;
      for (let i = 0; i < p.length; i += 3) {
        for (let a = 0; a < 3; a++) {
          const v = p[i + a] ?? 0;
          if (v < (min[a] ?? 0)) min[a] = v;
          if (v > (max[a] ?? 0)) max[a] = v;
        }
      }
      for (const g of geos) g.dispose();
    }
    if (this.parts.size === 0)
      return { byMaterial, bounds: { min: [0, 0, 0], max: [0, 0, 0] }, hash };
    return { byMaterial, bounds: { min, max }, hash };
  }
}

function merge(geos: BufferGeometry[]): MaterialBuffers {
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of geos) {
    vertexCount += g.getAttribute('position').count;
    indexCount += g.getIndex()?.count ?? g.getAttribute('position').count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(indexCount);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of geos) {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      positions[(vOffset + i) * 3] = pos.getX(i);
      positions[(vOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vOffset + i) * 3 + 2] = pos.getZ(i);
      normals[(vOffset + i) * 3] = nor.getX(i);
      normals[(vOffset + i) * 3 + 1] = nor.getY(i);
      normals[(vOffset + i) * 3 + 2] = nor.getZ(i);
      uvs[(vOffset + i) * 2] = uv.getX(i);
      uvs[(vOffset + i) * 2 + 1] = uv.getY(i);
    }
    const index = g.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) indices[iOffset + i] = vOffset + index.getX(i);
      iOffset += index.count;
    } else {
      for (let i = 0; i < pos.count; i++) indices[iOffset + i] = vOffset + i;
      iOffset += pos.count;
    }
    vOffset += pos.count;
  }
  return { positions, normals, uvs, indices };
}
