/**
 * SceneSync: diffs a ResolvedBase into the scene. The only code that turns
 * solver output into meshes (ARCHITECTURE §6.1).
 *
 * Parts: one `body` group (meshes per material, built from the recipe's
 * bundle and shared by recipe hash) posed by the resolved pose, plus a `legs`
 * group in world space. Tubes and docks: world-space bodies plus legs. Entries
 * are added, removed and updated by id; a body is only rebuilt when its recipe
 * hash changes, legs only when their numbers do.
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, type Material, type Scene } from 'three';
import { buildBundle } from '@/geometry/build';
import type { GeometryBundle, MaterialName } from '@/geometry/bundle';
import { FOOT_HEIGHT, LEG_TOP_OVERLAP } from '@/geometry/design-constants';
import type { GeometryRecipe } from '@/grammar/types';
import { emptyBase, type Leg, type ResolvedBase } from '@/grammar/solver';
import { materials } from './materials';

const DEG = Math.PI / 180;

interface Entry {
  root: Group;
  body: Group;
  legs: Group;
  recipeHash: string;
  legsKey: string;
}

/** What SceneSync needs from a part or a tube. */
interface Drawable {
  id: string;
  name: string;
  recipe: GeometryRecipe;
  recipeHash: string;
  legs: Leg[];
  /** body transform; tubes are authored in world space and have none */
  pose?: { x: number; y: number; z: number; yaw: number };
}

export interface SceneSyncOptions {
  /** Draw everything with this material and cast no shadows (ghost preview). */
  override?: Material;
}

const geometryCache = new Map<string, Partial<Record<MaterialName, BufferGeometry>>>();

export function geometriesFor(
  bundle: GeometryBundle,
): Partial<Record<MaterialName, BufferGeometry>> {
  const hit = geometryCache.get(bundle.hash);
  if (hit) return hit;
  const out: Partial<Record<MaterialName, BufferGeometry>> = {};
  for (const [name, b] of Object.entries(bundle.byMaterial) as [
    MaterialName,
    NonNullable<GeometryBundle['byMaterial'][MaterialName]>,
  ][]) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(b.positions, 3));
    g.setAttribute('normal', new BufferAttribute(b.normals, 3));
    g.setAttribute('uv', new BufferAttribute(b.uvs, 2));
    g.setAttribute('color', new BufferAttribute(b.colors, 3));
    g.setIndex(new BufferAttribute(b.indices, 1));
    g.computeBoundingSphere();
    out[name] = g;
  }
  geometryCache.set(bundle.hash, out);
  return out;
}

export class SceneSync {
  private readonly entries = new Map<string, Entry>();
  private readonly root = new Group();

  constructor(
    scene: Scene,
    private readonly opts: SceneSyncOptions = {},
  ) {
    this.root.name = opts.override ? 'ghost' : 'base';
    scene.add(this.root);
  }

  sync(base: ResolvedBase): void {
    const drawables: Drawable[] = [];
    for (const p of base.parts.values()) {
      drawables.push({
        id: `part:${p.id}`,
        name: `${p.letter}-${p.serial}`,
        recipe: p.recipe,
        recipeHash: p.recipeHash,
        legs: p.legs,
        pose: p.pose,
      });
    }
    for (const t of base.tubes.values()) {
      drawables.push({
        id: `tube:${t.id}`,
        name: t.id,
        recipe: t.recipe,
        recipeHash: t.recipeHash,
        legs: t.legs,
      });
    }

    const live = new Set(drawables.map((d) => d.id));
    for (const [id, entry] of this.entries) {
      if (!live.has(id)) {
        this.root.remove(entry.root);
        this.entries.delete(id);
      }
    }
    for (const d of drawables) {
      let entry = this.entries.get(d.id);
      if (!entry) {
        entry = this.create(d);
        this.entries.set(d.id, entry);
      }
      this.update(entry, d);
    }
  }

  clear(): void {
    this.sync(emptyBase());
  }

  private create(d: Drawable): Entry {
    const root = new Group();
    root.name = d.name;
    const body = new Group();
    const legs = new Group();
    root.add(body, legs);
    this.root.add(root);
    return { root, body, legs, recipeHash: '', legsKey: '' };
  }

  private update(entry: Entry, d: Drawable): void {
    if (entry.recipeHash !== d.recipeHash) {
      entry.body.clear();
      this.fill(entry.body, buildBundle(d.recipe));
      entry.recipeHash = d.recipeHash;
    }
    if (d.pose) {
      entry.body.position.set(d.pose.x, d.pose.y, d.pose.z);
      entry.body.rotation.y = d.pose.yaw * DEG;
    }

    const key = JSON.stringify(d.legs);
    if (entry.legsKey !== key) {
      entry.legs.clear();
      this.buildLegs(entry.legs, d.legs);
      entry.legsKey = key;
    }
  }

  private fill(group: Group, bundle: GeometryBundle): void {
    const geos = geometriesFor(bundle);
    for (const [name, geo] of Object.entries(geos) as [MaterialName, BufferGeometry][]) {
      group.add(this.mesh(geo, name));
    }
  }

  private mesh(geo: BufferGeometry, name: MaterialName): Mesh {
    const ghost = this.opts.override;
    const m = new Mesh(geo, ghost ?? materials[name]);
    m.castShadow = !ghost;
    m.receiveShadow = !ghost;
    return m;
  }

  private buildLegs(group: Group, legs: Leg[]): void {
    const strut = geometriesFor(buildBundle({ ops: [{ kind: 'leg-strut' }] })).graphite;
    const foot = geometriesFor(buildBundle({ ops: [{ kind: 'leg-foot' }] })).graphite;
    if (!strut || !foot) return;
    for (const leg of legs) {
      const f = this.mesh(foot, 'graphite');
      f.position.set(leg.bottom[0], leg.bottom[1], leg.bottom[2]);
      const s = this.mesh(strut, 'graphite');
      s.position.set(leg.bottom[0], leg.bottom[1] + FOOT_HEIGHT, leg.bottom[2]);
      s.scale.y = leg.top[1] + LEG_TOP_OVERLAP - (leg.bottom[1] + FOOT_HEIGHT);
      group.add(f, s);
    }
  }
}
