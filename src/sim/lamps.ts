/**
 * Airlock lamps: one per airlock, placed on the hull above the door and showing the cycle's phase.
 * Pure numbers, like silhouettes.ts; render/lamps.ts maps a phase to a palette colour and draws
 * the instances.
 */
import { localDirToWorld, localToWorld, type Vec3 } from '@/core/math';
import type { PartId } from '@/world/document';
import { airlockLampFrame } from '@/grammar/lamps';
import type { ResolvedBase } from '@/grammar/solver';
import type { LockPhase } from './airlock';
import type { CrewState } from './crew';

export interface LampSlot {
  part: PartId;
  phase: LockPhase;
  /** lamp frame to world, column-major 4 x 4: +y is the light face, facing out */
  matrix: number[];
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Every airlock lamp, in part id order. Reads the committed base and the crew's locks. */
export function airlockLamps(crew: CrewState, base: ResolvedBase): LampSlot[] {
  const out: LampSlot[] = [];
  for (const part of [...base.parts.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (part.letter !== 'A') continue;
    const frame = airlockLampFrame(Number(part.params['radius']));
    const y = localDirToWorld(part.pose, frame.normal);
    const x = localDirToWorld(part.pose, [1, 0, 0]);
    // A right-handed basis in world space, so a mirrored part never turns the lamp inside out.
    const z = cross(x, y);
    const p = localToWorld(part.pose, frame.at);
    // prettier-ignore
    const matrix = [
      x[0], x[1], x[2], 0,
      y[0], y[1], y[2], 0,
      z[0], z[1], z[2], 0,
      p[0], p[1], p[2], 1,
    ];
    out.push({ part: part.id, phase: crew.locks.get(part.id)?.phase ?? 'idle', matrix });
  }
  return out;
}

/** One string that changes exactly when a lamp appears, goes or changes phase. */
export function lampsKey(lamps: readonly LampSlot[]): string {
  return lamps.map((l) => `${l.part}:${l.phase}`).join('|');
}
