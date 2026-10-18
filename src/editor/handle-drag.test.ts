import { describe, expect, it } from 'vitest';
import { localToWorld, YAWS, type Vec3 } from '@/core/math';
import { nextParamValue, type HandleSpec } from '@/grammar/handles';
import { allParts, getPart } from '@/grammar/registry';
import { solve, type SolverWorld } from '@/grammar/solver';
import { addPart, createDocument, type BaseDocument, type PartPose } from '@/world/document';
import { resizeByHandle } from './handle-drag';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

function docWith(letter: 'H' | 'C' | 'P' | 'V' | 'M' | 'D' | 'E' | 'N', pose: PartPose) {
  const def = getPart(letter);
  if (!def) throw new Error(`no part ${letter}`);
  return addPart(createDocument({ seed: 't' }), {
    id: 'a',
    letter,
    params: def.resolve({}),
    pose,
  });
}

function anchorWorld(doc: BaseDocument, spec: HandleSpec): Vec3 {
  const part = solve(doc, FLAT).parts.get('a');
  const def = part ? getPart(part.letter) : undefined;
  const at = part && def?.handles?.(part.params).find((h) => h.id === spec.id)?.anchor;
  if (!part || !at) throw new Error('part or grip missing');
  return localToWorld(part.pose, at);
}

describe('resizeByHandle', () => {
  it('pulls a hab end out and leaves the other end where it was, at every yaw and flipped', () => {
    for (const yaw of YAWS) {
      for (const mirror of [false, true]) {
        const pose: PartPose = { x: 8, z: -4, yaw, ...(mirror ? { mirror: true as const } : {}) };
        const doc = docWith('H', pose);
        const part = doc.parts['a'];
        const def = getPart('H');
        const spec = def?.handles?.(def.resolve({})).find((h) => h.id === 'length+');
        if (!part || !spec) throw new Error('setup');
        const before = anchorWorld(doc, spec);
        const out = resizeByHandle(
          doc,
          FLAT,
          'a',
          spec,
          { params: part.params, pose: part.pose },
          2,
        );
        expect(out?.params['length']).toBe(Number(part.params['length']) + 2);
        if (!out) continue;
        const next = addPart(createDocument({ seed: 't' }), {
          id: 'a',
          letter: 'H',
          params: out.params,
          pose: out.pose,
        });
        const after = anchorWorld(next, spec);
        // The fixed end only moves by grid rounding on the diagonals.
        expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeLessThan(
          yaw % 90 === 0 ? 1e-6 : 0.75,
        );
      }
    }
  });

  it('grows the other way from the other grip', () => {
    const doc = docWith('H', { x: 0, z: 0, yaw: 0 });
    const part = doc.parts['a'];
    const def = getPart('H');
    const spec = def?.handles?.(def.resolve({})).find((h) => h.id === 'length-');
    if (!part || !spec) throw new Error('setup');
    const out = resizeByHandle(doc, FLAT, 'a', spec, { params: part.params, pose: part.pose }, 2);
    expect(out?.params['length']).toBe(Number(part.params['length']) + 2);
    expect(out?.pose.x).toBeLessThan(0);
  });

  it('stops at an obstacle instead of shoving the part aside', () => {
    let doc = docWith('H', { x: 0, z: 0, yaw: 0 });
    doc = addPart(doc, {
      id: 'wall',
      letter: 'H',
      params: { length: 8, radius: 2 },
      pose: { x: 14, z: 0, yaw: 0 },
    });
    const part = doc.parts['a'];
    const def = getPart('H');
    const spec = def?.handles?.(def.resolve({})).find((h) => h.id === 'length+');
    if (!part || !spec) throw new Error('setup');
    const free = resizeByHandle(doc, FLAT, 'a', spec, { params: part.params, pose: part.pose }, 2);
    const blocked = resizeByHandle(
      doc,
      FLAT,
      'a',
      spec,
      { params: part.params, pose: part.pose },
      12,
    );
    expect(free).not.toBeNull();
    expect(blocked).toBeNull();
  });

  it('turns a tower grip into floors and a mast grip into the next height', () => {
    const tower = docWith('V', { x: 0, z: 0, yaw: 0 });
    const t = tower.parts['a'];
    const vdef = getPart('V');
    const floors = vdef?.handles?.(vdef.resolve({}))[0];
    if (!t || !floors) throw new Error('setup');
    // One floor's height of travel is one floor.
    const up = resizeByHandle(
      tower,
      FLAT,
      'a',
      floors,
      { params: t.params, pose: t.pose },
      floors.perUnit,
    );
    expect(up?.params['floors']).toBe(Number(t.params['floors']) + 1);

    const mast = docWith('M', { x: 0, z: 0, yaw: 0 });
    const m = mast.parts['a'];
    const mdef = getPart('M');
    const height = mdef?.handles?.(mdef.resolve({}))[0];
    if (!m || !height) throw new Error('setup');
    const taller = resizeByHandle(mast, FLAT, 'a', height, { params: m.params, pose: m.pose }, 20);
    expect(taller?.params['height']).toBe(20);
  });

  it('every part resolves one step of every grip, on open ground, without moving', () => {
    for (const def of allParts()) {
      const doc = docWith(def.letter as never, { x: 0, z: 0, yaw: 0 });
      const part = doc.parts['a'];
      if (!part) throw new Error('setup');
      for (const spec of def.handles?.(def.resolve({})) ?? []) {
        const target = nextParamValue(def, part.params, spec.param, 1);
        const delta = (target - Number(part.params[spec.param])) * spec.perUnit;
        const out = resizeByHandle(
          doc,
          FLAT,
          'a',
          spec,
          { params: part.params, pose: part.pose },
          delta,
        );
        expect(out, `${def.letter} ${spec.id}`).not.toBeNull();
        expect(out?.params[spec.param]).toBe(target);
      }
    }
  });
});
