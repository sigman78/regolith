/**
 * Deterministic random: everything procedural in Regolith derives from a seed,
 * so the same base always looks the same and generation is cacheable.
 */
export function hashString(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashInts(...xs: number[]): number {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h ^= (x | 0) + 0x7f4a7c15 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  }
  return (h ^ (h >>> 15)) >>> 0;
}

/** mulberry32: tiny, fast, good enough for visuals. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    const v = arr[Math.floor(this.next() * arr.length)];
    if (v === undefined) throw new Error('pick from empty array');
    return v;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
