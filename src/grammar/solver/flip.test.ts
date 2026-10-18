import { describe, expect, it } from 'vitest';
import {
  localDirToWorld,
  localToWorld,
  mirrorZ,
  worldDirToLocal,
  worldToLocal,
  YAWS,
  type Vec3,
} from '@/core/math';
import { allParts } from '@/grammar/registry';
import { addLink, addPart, createDocument, type PartPose } from '@/world/document';
import { solve, type SolverWorld } from './index';

const FLAT: SolverWorld = { halfSize: 48, heightAt: () => 0 };

const close = (a: Vec3, b: Vec3, digits = 6): void => {
  for (let i = 0; i < 3; i++) expect(a[i] ?? 0).toBeCloseTo(b[i] ?? 0, digits);
};

describe('mirror in the pose maths', () => {
  it('worldToLocal inverts localToWorld, flipped or not, at every yaw stop', () => {
    const v: Vec3 = [1.5, 2, -0.75];
    for (const yaw of YAWS) {
      for (const mirror of [false, true]) {
        const pose = { x: 7, y: 0.5, z: -3, yaw, mirror };
        close(worldToLocal(pose, localToWorld(pose, v)), v);
        close(worldDirToLocal(pose, localDirToWorld(pose, v)), v);
      }
    }
  });

  it('a flip negates local z and nothing else', () => {
    const pose = { x: 0, y: 0, z: 0, yaw: 0 };
    close(
      localToWorld({ ...pose, mirror: true }, [1, 2, 3]),
      localToWorld(pose, mirrorZ([1, 2, 3])),
    );
    close(localToWorld({ ...pose, mirror: true }, [1, 2, 3]), [1, 2, -3]);
  });
});

describe('a flipped part', () => {
  for (const def of allParts()) {
    it(`${def.letter}: keeps its footprint cells and ports, and mirrors the ports across its axis`, () => {
      const make = (mirror: boolean) => {
        const pose: PartPose = {
          x: 10,
          z: -6,
          yaw: 90,
          ...(mirror ? { mirror: true as const } : {}),
        };
        const doc = addPart(createDocument({ seed: 't' }), {
          id: 'p',
          letter: def.letter,
          params: def.resolve({}),
          pose,
        });
        const part = solve(doc, FLAT).parts.get('p');
        if (!part) throw new Error('part not resolved');
        return part;
      };
      const plain = make(false);
      const flipped = make(true);

      expect(flipped.pose.mirror).toBe(true);
      expect(plain.pose.mirror).toBeUndefined();
      expect(flipped.pose.x).toBe(plain.pose.x);
      expect(flipped.pose.z).toBe(plain.pose.z);
      expect(flipped.pose.y).toBe(plain.pose.y);
      expect(flipped.ports.map((p) => p.id)).toEqual(plain.ports.map((p) => p.id));

      for (const p of plain.ports) {
        const q = flipped.ports.find((x) => x.id === p.id);
        if (!q) throw new Error(`port ${p.id} vanished`);
        // Read both in the unflipped frame: the flipped port is the plain one with z negated.
        const turned = { x: plain.pose.x, y: plain.pose.y, z: plain.pose.z, yaw: plain.pose.yaw };
        close(worldToLocal(turned, q.position), mirrorZ(worldToLocal(turned, p.position)), 5);
        // Height is untouched by a flip.
        expect(q.position[1]).toBeCloseTo(p.position[1], 6);
      }
    });
  }

  it('moves an asymmetric port to the other flank (hab hatches)', () => {
    const H = allParts().find((d) => d.letter === 'H');
    if (!H) throw new Error('no H');
    const side = (mirror: boolean): Vec3 => {
      const doc = addPart(createDocument({ seed: 't' }), {
        id: 'h',
        letter: 'H',
        params: H.resolve({ length: 8 }),
        pose: { x: 0, z: 0, yaw: 0, ...(mirror ? { mirror: true as const } : {}) },
      });
      return (
        solve(doc, FLAT)
          .parts.get('h')
          ?.ports.find((p) => p.id === 'side-0')?.position ?? [0, 0, 0]
      );
    };
    const a = side(false);
    const b = side(true);
    expect(a[2]).not.toBeCloseTo(0, 3);
    expect(b[2]).toBeCloseTo(-a[2], 6);
    expect(b[0]).toBeCloseTo(a[0], 6);
  });

  it('keeps its tube: a link survives a flip and the base still diagnoses clean', () => {
    const build = (mirrorB: boolean) => {
      let doc = createDocument({ seed: 't' });
      doc = addPart(doc, {
        id: 'a',
        letter: 'H',
        params: { length: 8, radius: 2 },
        pose: { x: 0, z: 0, yaw: 0 },
      });
      doc = addPart(doc, {
        id: 'b',
        letter: 'H',
        params: { length: 8, radius: 2 },
        pose: { x: 20, z: 12, yaw: 90, ...(mirrorB ? { mirror: true as const } : {}) },
      });
      doc = addLink(doc, {
        a: { part: 'a', port: 'end+' },
        b: { part: 'b', port: 'end-' },
        kind: 'tube',
      });
      return solve(doc, FLAT, { diagnose: true });
    };
    for (const mirrorB of [false, true]) {
      const base = build(mirrorB);
      expect([...base.tubes.values()].some((t) => t.kind === 'tube')).toBe(true);
      expect(
        base.diagnostics.filter((d) => d.kind === 'invariant' || d.kind === 'link-skipped'),
      ).toEqual([]);
    }
  });
});
