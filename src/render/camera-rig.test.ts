import { describe, expect, it } from 'vitest';
import { CameraRig } from './camera-rig';

function rig(): CameraRig {
  const el = { addEventListener: () => undefined, clientHeight: 800 } as unknown as HTMLElement;
  const r = new CameraRig(el);
  r.resize(1280, 800);
  r.update(0);
  return r;
}

describe('camera pan', () => {
  it('keeps the grabbed ground point under the cursor, in every direction and at every yaw stop', () => {
    for (let stop = 0; stop < 8; stop++) {
      const r = rig();
      for (let k = 0; k < stop; k++) r.rotateStep(1);
      r.update(10); // let the yaw ease finish
      for (const [dx, dy] of [
        [60, 0],
        [-60, 0],
        [0, 40],
        [0, -40],
        [35, -25],
      ] as const) {
        const grabbed = r.target.clone();
        r.panBy(dx, dy);
        r.update(0);
        const p = grabbed.clone().project(r.camera);
        // Where the grabbed point lands on screen is how far the cursor moved. Across the tilted
        // ground plane the vertical match is first-order (perspective foreshortening), so 5 %.
        expect(Math.abs((p.x * 1280) / 2 - dx)).toBeLessThanOrEqual(Math.abs(dx) * 0.05 + 0.5);
        expect(Math.abs((-p.y * 800) / 2 - dy)).toBeLessThanOrEqual(Math.abs(dy) * 0.05 + 0.5);
        r.target.copy(grabbed); // next case starts from the same view
        r.update(0);
      }
    }
  });
});

describe('camera rig change reporting (render on demand)', () => {
  it('reports a moving view until the easing has settled, then nothing', () => {
    const r = rig();
    r.update(0);
    expect(r.update(0.016)).toBe(false); // nothing asked for: idle
    r.rotateStep(1);
    expect(r.update(0.016)).toBe(true);
    let frames = 0;
    while (r.update(0.016) && frames < 600) frames++;
    expect(frames).toBeLessThan(600); // it ends instead of creeping toward the goal forever
    expect(r.update(0.016)).toBe(false);
  });

  it('reports a pan and a zoom as changes', () => {
    const r = rig();
    r.update(0);
    r.panBy(10, 10);
    expect(r.update(0.016)).toBe(true);
    expect(r.update(0.016)).toBe(false);
    r.setDistance(40);
    expect(r.update(0.016)).toBe(true);
    expect(r.update(0.016)).toBe(false);
  });
});
