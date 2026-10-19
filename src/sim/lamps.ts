/**
 * Every lamp the base shows at night: an airlock lamp per airlock (it shows the cycle's phase), a
 * head under each light pole's hood, and the one beacon ball on the tallest part that can carry it.
 * Pure numbers; render/lamps.ts maps a phase to a palette colour and draws
 * the instances.
 */
import { localDirToWorld, localToWorld, type Pose, type Vec3 } from '@/core/math';
import { beaconOwner } from '@/grammar/beacon';
import { airlockLampFrame, poleLampFrame, type LampFrame } from '@/grammar/lamps';
import type { ResolvedBase } from '@/grammar/solver';
import type { Lock, LockPhase } from './airlock';

/** What a lamp shows: an airlock's cycle phase, or 'beacon' for the ball. Poles rest as 'idle'. */
export type LampTone = LockPhase | 'beacon';

export interface LampSlot {
  /** stable per lamp, and per owner for the beacon: the lamp set changed if this list did */
  id: string;
  tone: LampTone;
  /** lamp frame to world, column-major 4 x 4: +y is the light face, facing out */
  matrix: number[];
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A right-handed world basis, so a mirrored part never turns a lamp inside out. */
function frameMatrix(pose: Pose, frame: LampFrame): number[] {
  const y = localDirToWorld(pose, frame.normal);
  const x = localDirToWorld(pose, [1, 0, 0]);
  const z = cross(x, y);
  const p = localToWorld(pose, frame.at);
  // prettier-ignore
  return [
    x[0], x[1], x[2], 0,
    y[0], y[1], y[2], 0,
    z[0], z[1], z[2], 0,
    p[0], p[1], p[2], 1,
  ];
}

/** Every lamp, airlocks and poles in part id order, then the beacon. Reads the committed base. */
export function baseLamps(locks: ReadonlyMap<string, Lock>, base: ResolvedBase): LampSlot[] {
  const out: LampSlot[] = [];
  const parts = [...base.parts.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const part of parts) {
    if (part.letter === 'A') {
      const frame = airlockLampFrame(Number(part.params['radius']));
      const tone = locks.get(part.id)?.phase ?? 'idle';
      out.push({ id: part.id, tone, matrix: frameMatrix(part.pose, frame) });
    } else if (part.letter === 'X') {
      const frame = poleLampFrame(Number(part.params['height']));
      out.push({ id: part.id, tone: 'idle', matrix: frameMatrix(part.pose, frame) });
    }
  }
  const owner = beaconOwner(parts);
  if (owner) {
    const [x, y, z] = owner.world;
    // prettier-ignore
    const matrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ];
    out.push({ id: `beacon:${owner.part}`, tone: 'beacon', matrix });
  }
  return out;
}

/** One string that changes exactly when a lamp appears, goes or changes tone. */
export function lampsKey(lamps: readonly LampSlot[]): string {
  return lamps.map((l) => `${l.id}:${l.tone}`).join('|');
}
