import { describe, expect, it } from 'vitest';
import { parseQuality, QUALITIES } from './post';

describe('quality presets', () => {
  it('parses the three presets and falls back to high', () => {
    for (const q of QUALITIES) expect(parseQuality(q)).toBe(q);
    expect(parseQuality(null)).toBe('high');
    expect(parseQuality('ultra')).toBe('high');
  });
});
