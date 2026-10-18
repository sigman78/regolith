/**
 * Turns a Heightfield into a shaded mesh with vertex colours: lighter on
 * crater rims and dune crests, darker in bowls. Real texturing comes later.
 */
import { BufferAttribute, Color, Mesh, PlaneGeometry } from 'three';
import type { Heightfield } from '@/world/terrain';
import { fbm2 } from '@/core/noise';
import { materials, PALETTE } from './materials';

export function buildTerrainMesh(hf: Heightfield): Mesh {
  const n = hf.size + 1;
  const extent = hf.size * hf.cell;
  const geo = new PlaneGeometry(extent, extent, hf.size, hf.size);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes['position'];
  if (!pos) throw new Error('terrain geometry has no position attribute');
  const colors = new Float32Array(pos.count * 3);
  const light = new Color(PALETTE.regolithLight);
  const base = new Color(PALETTE.regolith);
  const dark = new Color(PALETTE.regolithDark);
  const c = new Color();

  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < hf.heights.length; i++) {
    const h = hf.heights[i] ?? 0;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const idx = j * n + i;
      const h = hf.heights[idx] ?? 0;
      pos.setY(idx, h);
      const t = (h - minH) / Math.max(1e-6, maxH - minH);
      const x = pos.getX(idx);
      const z = pos.getZ(idx);
      const grain = fbm2(x * 0.35, z * 0.35, { octaves: 2, seed: 99 }) * 0.5 + 0.5;
      c.copy(dark)
        .lerp(base, Math.min(1, t * 1.6))
        .lerp(light, Math.max(0, t - 0.6) * 1.5);
      c.lerp(light, grain * 0.12);
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
    }
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new Mesh(geo, materials.regolith);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}
