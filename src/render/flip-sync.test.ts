import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument, setPartPose } from '@/world/document';
import { SceneSync } from './scene-sync';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

describe('flipped parts in the scene', () => {
  it('mirror the body with a negative z scale and unflip again', () => {
    const scene = new Scene();
    const sync = new SceneSync(scene);
    let doc = addPart(createDocument({ seed: 't' }), {
      id: 'h',
      letter: 'H',
      params: { length: 8, radius: 2 },
      pose: { x: 0, z: 0, yaw: 0 },
    });
    sync.sync(solve(doc, FLAT));
    const root = scene.getObjectByName('H-1');
    const body = root?.children[0];
    expect(body?.scale.z).toBe(1);

    doc = setPartPose(doc, 'h', { x: 0, z: 0, yaw: 0, mirror: true });
    sync.sync(solve(doc, FLAT));
    expect(body?.scale.z).toBe(-1);

    doc = setPartPose(doc, 'h', { x: 0, z: 0, yaw: 0 });
    sync.sync(solve(doc, FLAT));
    expect(body?.scale.z).toBe(1);
  });
});
