/**
 * The alphabet as shipped. Letters are added here as milestones unlock them
 * (PLAN.md); the alphabet is frozen per milestone.
 */
import { C } from './parts/C';
import { D } from './parts/D';
import { E } from './parts/E';
import { H } from './parts/H';
import { M } from './parts/M';
import { N } from './parts/N';
import { P } from './parts/P';
import { V } from './parts/V';
import type { Letter, PartDefinition } from './types';

const DEFINITIONS: readonly PartDefinition[] = [H, N, D, V, P, M, E, C];

const BY_LETTER: ReadonlyMap<Letter, PartDefinition> = new Map(
  DEFINITIONS.map((d) => [d.letter, d]),
);

export function getPart(letter: Letter): PartDefinition | undefined {
  return BY_LETTER.get(letter);
}

export function allParts(): readonly PartDefinition[] {
  return DEFINITIONS;
}
