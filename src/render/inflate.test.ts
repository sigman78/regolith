import { MeshStandardMaterial, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addLink, addPart, createDocument } from '@/world/document';
import {
  CLUNK_DEPTH,
  CLUNK_SECONDS,
  clunkScale,
  DEFLATE_SECONDS,
  deflateScale,
  extendFraction,
  INFLATE_FROM,
  INFLATE_OVERSHOOT,
  INFLATE_SECONDS,
  inflateScale,
  TUBE_EXTEND_SECONDS,
} from './inflate';
import { SceneSync } from './scene-sync';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

describe('appearance curves', () => {
  it('inflate runs 10 % to 100 %, overshooting to about 106 %', () => {
    expect(inflateScale(0)).toBeCloseTo(INFLATE_FROM, 6);
    expect(inflateScale(1)).toBeCloseTo(1, 6);
    let peak = 0;
    for (let i = 0; i <= 400; i++) peak = Math.max(peak, inflateScale(i / 400));
    expect(peak).toBeGreaterThan(1.04);
    expect(peak).toBeLessThan(INFLATE_OVERSHOOT + 0.005);
  });

  it('deflate is the reverse without overshoot and never grows', () => {
    expect(deflateScale(0)).toBeCloseTo(1, 6);
    expect(deflateScale(1)).toBeCloseTo(INFLATE_FROM, 6);
    let prev = 2;
    for (let i = 0; i <= 50; i++) {
      const v = deflateScale(i / 50);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });

  it('a tube extends monotonically from nothing to its full length', () => {
    expect(extendFraction(0)).toBe(0);
    expect(extendFraction(1)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= 50; i++) {
      const v = extendFraction(i / 50);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('the clunk dips a little and comes back', () => {
    expect(clunkScale(0)).toBeCloseTo(1, 9);
    expect(clunkScale(1)).toBeCloseTo(1, 9);
    expect(clunkScale(0.5)).toBeCloseTo(1 - CLUNK_DEPTH, 9);
  });
});

function docWith(...ids: string[]) {
  let doc = createDocument({ seed: 't' });
  ids.forEach((id, k) => {
    doc = addPart(doc, {
      id,
      letter: 'H',
      params: { length: 8, radius: 2 },
      pose: { x: k * 20, z: 0, yaw: 0 },
    });
  });
  return doc;
}

function find(scene: Scene, name: string) {
  const found = scene.getObjectByName(name);
  if (!found) throw new Error(`no object ${name}`);
  return found;
}

describe('SceneSync motion', () => {
  it('loads the first document as it is, then inflates parts added later about their base', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    sync.sync(solve(docWith('a'), FLAT));
    expect(find(scene, 'H-1').scale.x).toBe(1);
    expect(sync.animating).toBe(false);

    sync.sync(solve(docWith('a', 'b'), FLAT));
    const b = find(scene, 'H-2');
    expect(b.scale.x).toBeCloseTo(INFLATE_FROM, 6);
    expect(find(scene, 'H-1').scale.x).toBe(1);
    expect(b.position.x).toBeCloseTo(20, 6); // pivot at the part's base, not the origin
    expect(sync.animating).toBe(true);

    sync.tick(INFLATE_SECONDS * 0.5);
    expect(b.scale.x).toBeGreaterThan(INFLATE_FROM);
    sync.tick(INFLATE_SECONDS);
    expect(b.scale.x).toBe(1);
    expect(sync.animating).toBe(false);
  });

  it('shrinks a deleted part away before it leaves the scene', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    sync.sync(solve(docWith('a', 'b'), FLAT));
    sync.sync(solve(docWith('a'), FLAT));
    const b = find(scene, 'H-2');
    expect(b.scale.x).toBeCloseTo(1, 6);
    sync.tick(DEFLATE_SECONDS * 0.5);
    expect(b.scale.x).toBeLessThan(1);
    expect(b.scale.x).toBeGreaterThan(INFLATE_FROM);
    sync.tick(DEFLATE_SECONDS);
    expect(scene.getObjectByName('H-2')).toBeUndefined();
  });

  it('extends a new tube from its first end, then clunks the parts it joins', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    const parts = docWith('a', 'b');
    sync.sync(solve(parts, FLAT));
    const linked = addLink(parts, {
      a: { part: 'a', port: 'end+' },
      b: { part: 'b', port: 'end-' },
      kind: 'tube',
    });
    const base = solve(linked, FLAT);
    const tube = [...base.tubes.values()][0];
    if (!tube) throw new Error('no tube');
    sync.sync(base);

    const root = find(scene, tube.id);
    const [p0 = [0, 0, 0], p1 = [0, 0, 0]] = [tube.path[0], tube.path[tube.path.length - 1]];
    const first = new Vector3(...p0);
    const last = new Vector3(...p1);
    // The first point stays put and the far end starts folded back onto it.
    expect(first.clone().applyMatrix4(root.matrix).distanceTo(first)).toBeLessThan(1e-6);
    const folded = last.clone().applyMatrix4(root.matrix);
    expect(folded.distanceTo(first)).toBeLessThan(0.05 * first.distanceTo(last) + 0.05);

    sync.tick(TUBE_EXTEND_SECONDS + 0.01);
    expect(last.clone().applyMatrix4(root.matrix).distanceTo(last)).toBeLessThan(1e-6);

    // The clunk starts as the tube finishes: the joined hab dips, then settles.
    const hab = find(scene, 'H-1');
    sync.tick(CLUNK_SECONDS * 0.5);
    expect(hab.scale.y).toBeLessThan(1);
    sync.tick(CLUNK_SECONDS);
    expect(hab.scale.y).toBe(1);
    expect(sync.animating).toBe(false);
  });

  it('never animates the ghost preview', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene, { override: new MeshStandardMaterial() });
    sync.sync(solve(docWith('a'), FLAT));
    sync.sync(solve(docWith('a', 'b'), FLAT));
    expect(find(scene, 'H-2').scale.x).toBe(1);
    expect(sync.animating).toBe(false);
  });
});
