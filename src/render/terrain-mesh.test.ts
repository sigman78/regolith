import { describe, expect, it } from 'vitest';
import { buildFlatField } from '@/world/flatten';
import { generateTerrain, heightAt } from '@/world/terrain';
import { buildTerrainMesh, levelTerrainMesh } from './terrain-mesh';

describe('levelTerrainMesh', () => {
  const hf = generateTerrain({ seed: 'mesh', size: 96 });
  const raw = (x: number, z: number): number => heightAt(hf, x, z);

  it('puts every vertex on the levelled height, and back on the natural one', () => {
    const mesh = buildTerrainMesh(hf);
    const field = buildFlatField(
      raw,
      [{ id: 'a', shape: { kind: 'rect', x: 6, z: -4, yaw: 45, hx: 5, hz: 3 } }],
      { half: 48, cell: 1 },
    );
    levelTerrainMesh(mesh, field.heightAt);
    const pos = mesh.geometry.attributes['position'];
    expect(pos).toBeDefined();
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 7) {
      expect(pos.getY(i)).toBeCloseTo(field.heightAt(pos.getX(i), pos.getZ(i)), 5);
    }
    levelTerrainMesh(mesh, raw);
    for (let i = 0; i < pos.count; i += 7) {
      expect(pos.getY(i)).toBeCloseTo(raw(pos.getX(i), pos.getZ(i)), 5);
    }
  });
});
