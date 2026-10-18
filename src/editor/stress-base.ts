/**
 * A crowded base for render and solver benchmarks (`?stress=200`): small habs
 * and nodes on a loose grid, no links. Deterministic, like the
 * golden base. It exists to measure the 200-part case that bases will reach
 * (docs/PERF.md), not to look good.
 */
import type { NewPart } from '@/world/document';

const SPACING = 6;
const ORIGIN = -42;
const PER_ROW = 15;

export function stressBase(count: number): NewPart[] {
  const parts: NewPart[] = [];
  for (let n = 0; n < Math.min(count, PER_ROW * PER_ROW); n++) {
    const x = ORIGIN + (n % PER_ROW) * SPACING;
    const z = ORIGIN + Math.floor(n / PER_ROW) * SPACING;
    const pose = { x, z, yaw: 0 } as const;
    parts.push(
      n % 2 === 0
        ? { id: `s-${n}`, letter: 'H', params: { length: 4, radius: 2 }, pose }
        : { id: `s-${n}`, letter: 'N', params: { size: 2.5 }, pose },
    );
  }
  return parts;
}
