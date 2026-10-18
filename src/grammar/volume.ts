/**
 * Pressurised volume of a part in cubic metres, from its params. Crew count is
 * `floor(volume / CREW_VOLUME)`; parts that hold no air return 0.
 */
import { AIRLOCK_LENGTH, HAB_CAP_RATIO, TOWER_FLOOR_HEIGHT } from '@/geometry/design-constants';
import type { Letter, ParamValues } from './types';

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);

export function pressVolume(letter: Letter, params: ParamValues): number {
  const r = num(params['radius']);
  switch (letter) {
    case 'H': {
      // A cylinder between two hemispherical caps.
      const length = num(params['length']);
      return Math.PI * r * r * length + (4 / 3) * Math.PI * r * r * r;
    }
    case 'A':
      // Cylinder between two flattened caps (the hab's cap ratio).
      return Math.PI * r * r * AIRLOCK_LENGTH + (4 / 3) * Math.PI * r * r * r * HAB_CAP_RATIO;
    case 'N':
      return (4 / 3) * Math.PI * r * r * r;
    case 'D':
      return (2 / 3) * Math.PI * r * r * r;
    case 'V':
      return Math.PI * r * r * TOWER_FLOOR_HEIGHT * num(params['floors']);
    default:
      return 0;
  }
}
