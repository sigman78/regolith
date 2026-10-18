import { DirectionalLight, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fitSunShadow, snapToTexels } from './shadow-fit';

const dir = new Vector3(0.5, 0.35, -0.3).normalize();

describe('shadow fit', () => {
  it('snaps the box centre to whole texels, so small pans do not move the shadow', () => {
    const texel = 0.04;
    const a = snapToTexels(new Vector3(10.001, 2, -3.0005), dir, texel);
    const b = snapToTexels(new Vector3(10.004, 2, -3.0008), dir, texel);
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), dir).normalize();
    const up = new Vector3().crossVectors(dir, right).normalize();
    // The depth along the light does not matter to the map; the two in-plane coordinates must agree.
    expect(a.dot(right)).toBeCloseTo(b.dot(right), 9);
    expect(a.dot(up)).toBeCloseTo(b.dot(up), 9);
    const along = a.dot(right) / texel;
    expect(Math.abs(along - Math.round(along))).toBeLessThan(1e-6);
  });

  it('moves by at most half a texel in light space', () => {
    const c = new Vector3(7.3, 1.1, 12.9);
    expect(snapToTexels(c, dir, 0.05).distanceTo(c)).toBeLessThan(0.05);
  });

  it('sizes the shadow camera to the radius and puts the light on the sun side', () => {
    const light = new DirectionalLight();
    light.shadow.mapSize.set(2048, 2048);
    fitSunShadow(light, new Vector3(0, 0, 0), 30, dir);
    const cam = light.shadow.camera;
    expect(cam.right - cam.left).toBe(60);
    expect(light.position.clone().normalize().dot(dir)).toBeGreaterThan(0.99);
    expect(cam.far).toBeGreaterThan(light.position.length());
  });
});
