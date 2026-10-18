/**
 * The alphabet as shipped. Letters are added here as milestones unlock them
 * (PLAN.md); the alphabet is frozen per milestone.
 */
import { H } from './parts/H';
import { N } from './parts/N';
import type { Letter, PartDefinition } from './types';

const DEFINITIONS: readonly PartDefinition[] = [H, N];

const BY_LETTER: ReadonlyMap<Letter, PartDefinition> = new Map(
  DEFINITIONS.map((d) => [d.letter, d]),
);

export function getPart(letter: Letter): PartDefinition | undefined {
  return BY_LETTER.get(letter);
}

export function allParts(): readonly PartDefinition[] {
  return DEFINITIONS;
}
