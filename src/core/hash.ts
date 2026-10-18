/**
 * Stable content hashing for recipes and bundles. Same value, same hash, on
 * every machine: object keys are sorted and numbers use their shortest
 * round-trip form, so insertion order never leaks in.
 */
import { hashString } from './rng';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** 8 hex characters. Not cryptographic; used as a cache and diff key. */
export function hashValue(value: unknown): string {
  return hashString(stableStringify(value)).toString(16).padStart(8, '0');
}
