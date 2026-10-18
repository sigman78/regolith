/**
 * Recipe -> GeometryBundle. A pure function of the recipe; results are
 * memoised by recipe hash, so identical parts share one bundle.
 */
import { hashValue } from '@/core/hash';
import type { GeometryRecipe } from '@/grammar/types';
import { BundleBuilder, type GeometryBundle } from './bundle';
import { buildHab } from './hab';
import { buildLegFoot, buildLegStrut } from './leg';
import { buildNode } from './node';
import { buildSlab } from './slab';
import { buildTower } from './tower';
import { buildTube } from './tube';

const cache = new Map<string, GeometryBundle>();

export function recipeHash(recipe: GeometryRecipe): string {
  return hashValue(recipe);
}

export function buildBundle(recipe: GeometryRecipe): GeometryBundle {
  const hash = recipeHash(recipe);
  const hit = cache.get(hash);
  if (hit) return hit;

  const out = new BundleBuilder();
  for (const op of recipe.ops) {
    switch (op.kind) {
      case 'hab':
        buildHab(out, op);
        break;
      case 'node':
        buildNode(out, op);
        break;
      case 'slab':
        buildSlab(out, op);
        break;
      case 'tower':
        buildTower(out, op);
        break;
      case 'tube':
        buildTube(out, op);
        break;
      case 'leg-strut':
        buildLegStrut(out);
        break;
      case 'leg-foot':
        buildLegFoot(out);
        break;
    }
  }
  const bundle = out.build(hash);
  cache.set(hash, bundle);
  return bundle;
}

/** Test hook: forget memoised bundles. */
export function clearBundleCache(): void {
  cache.clear();
}
