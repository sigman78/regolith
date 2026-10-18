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
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  Vector3,
  type Material,
  type Scene,
} from 'three';
import { buildBundle } from '@/geometry/build';
import type { GeometryBundle, MaterialName } from '@/geometry/bundle';
import { FOOT_HEIGHT, LEG_TOP_OVERLAP } from '@/geometry/design-constants';
import type { GeometryRecipe } from '@/grammar/types';
import { emptyBase, type Leg, type ResolvedBase } from '@/grammar/solver';
import {
  CLUNK_SECONDS,
  clunkScale,
  DEFLATE_SECONDS,
  deflateScale,
  extendFraction,
  INFLATE_SECONDS,
  inflateScale,
  TUBE_EXTEND_SECONDS,
} from './inflate';
import { materials } from './materials';

const DEG = Math.PI / 180;

/** A tube extends from its first point along its chord; a part inflates about its base. */
type Motion =
  { kind: 'inflate'; t: number } | { kind: 'deflate'; t: number } | { kind: 'extend'; t: number };

interface Entry {
  root: Group;
  body: Group;
  legs: Group;
  recipeHash: string;
  legsKey: string;
  /** part: its base point; tube: the first point of its centreline */
  pivot: Vector3;
  /** tube only: unit chord from the first to the last point */
  axis: Vector3 | null;
  motion: Motion | null;
  /** seconds into a docking clunk, or -1 when idle */
  clunk: number;
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
  /** tube only: its centreline, world space */
  path?: readonly (readonly [number, number, number])[];
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
  /** Removed entries still shrinking away. */
  private readonly dying = new Set<Entry>();
  private readonly root = new Group();
  /** The first sync loads the document as it is; only later changes animate. */
  private primed = false;

  constructor(
    scene: Scene,
    private readonly opts: SceneSyncOptions = {},
  ) {
    this.root.name = opts.override ? 'ghost' : 'base';
    scene.add(this.root);
  }

  /** Anything still animating (tests, and the frame loop can skip work when false). */
  get animating(): boolean {
    if (this.dying.size > 0) return true;
    for (const e of this.entries.values()) if (e.motion || e.clunk >= 0) return true;
    return false;
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
        path: t.path,
      });
    }

    const tubeParts = new Map<string, string[]>();
    for (const t of base.tubes.values()) tubeParts.set(`tube:${t.id}`, [t.a.part, t.b.part]);
    const animate = this.primed && !this.opts.override;
    const live = new Set(drawables.map((d) => d.id));
    for (const [id, entry] of this.entries) {
      if (live.has(id)) continue;
      this.entries.delete(id);
      if (animate && !entry.axis) {
        entry.motion = { kind: 'deflate', t: 0 };
        this.dying.add(entry);
      } else {
        this.root.remove(entry.root);
      }
    }
    for (const d of drawables) {
      let entry = this.entries.get(d.id);
      if (!entry) {
        entry = this.create(d);
        this.entries.set(d.id, entry);
        if (animate) entry.motion = { kind: entry.axis ? 'extend' : 'inflate', t: 0 };
      }
      const ends = tubeParts.get(d.id);
      if (ends) this.tubeEnds.set(entry, ends);
      this.update(entry, d);
      if (entry.motion) this.applyMotion(entry);
    }
    this.primed = true;
  }

  clear(): void {
    this.sync(emptyBase());
  }

  /** Advance inflation, deflation, tube extension and docking clunks by `dt` seconds. */
  tick(dt: number): void {
    for (const e of this.dying) {
      if (e.motion) e.motion.t += dt / DEFLATE_SECONDS;
      if (!e.motion || e.motion.t >= 1) {
        this.root.remove(e.root);
        this.dying.delete(e);
      } else this.applyMotion(e);
    }
    for (const e of this.entries.values()) {
      if (e.motion) {
        const length =
          e.motion.kind === 'extend'
            ? TUBE_EXTEND_SECONDS
            : e.motion.kind === 'inflate'
              ? INFLATE_SECONDS
              : DEFLATE_SECONDS;
        e.motion.t += dt / length;
        if (e.motion.t >= 1) {
          const wasTube = e.motion.kind === 'extend';
          e.motion = null;
          this.applyMotion(e);
          if (wasTube) this.startClunk(e);
        } else this.applyMotion(e);
      }
      if (e.clunk >= 0) {
        e.clunk += dt;
        if (e.clunk >= CLUNK_SECONDS) e.clunk = -1;
        this.applyMotion(e);
      }
    }
  }

  /** A finished tube nudges the parts it joins. */
  private startClunk(tube: Entry): void {
    const ends = this.tubeEnds.get(tube);
    if (!ends) return;
    for (const id of ends) {
      const part = this.entries.get(`part:${id}`);
      if (part && !part.motion) part.clunk = 0;
    }
  }

  private readonly tubeEnds = new WeakMap<Entry, string[]>();

  private create(d: Drawable): Entry {
    const root = new Group();
    root.name = d.name;
    const body = new Group();
    const legs = new Group();
    root.add(body, legs);
    this.root.add(root);
    const entry: Entry = {
      root,
      body,
      legs,
      recipeHash: '',
      legsKey: '',
      pivot: new Vector3(),
      axis: null,
      motion: null,
      clunk: -1,
    };
    if (d.path) {
      root.matrixAutoUpdate = false;
      this.setChord(entry, d.path);
    }
    return entry;
  }

  /** A tube extends from its first point toward its last. */
  private setChord(entry: Entry, path: NonNullable<Drawable['path']>): void {
    const first = path[0];
    const last = path[path.length - 1];
    if (!first || !last) return;
    entry.pivot.set(first[0], first[1], first[2]);
    const axis = entry.axis ?? new Vector3();
    axis.set(last[0] - first[0], last[1] - first[1], last[2] - first[2]);
    if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
    entry.axis = axis.normalize();
  }

  private update(entry: Entry, d: Drawable): void {
    if (entry.recipeHash !== d.recipeHash) {
      entry.body.clear();
      this.fill(entry.body, buildBundle(d.recipe));
      entry.recipeHash = d.recipeHash;
    }
    if (d.path) this.setChord(entry, d.path);
    if (d.pose) {
      // The root sits at the part's base so inflation grows it from the ground; legs stay in world space.
      entry.pivot.set(d.pose.x, d.pose.y, d.pose.z);
      entry.root.position.copy(entry.pivot);
      entry.legs.position.set(-d.pose.x, -d.pose.y, -d.pose.z);
      entry.body.rotation.y = d.pose.yaw * DEG;
    }

    const key = JSON.stringify(d.legs);
    if (entry.legsKey !== key) {
      entry.legs.clear();
      this.buildLegs(entry.legs, d.legs);
      entry.legsKey = key;
    }
  }

  /** Write the entry's current scale (parts) or stretch along its chord (tubes). */
  private applyMotion(e: Entry): void {
    if (e.axis) {
      const f = e.motion ? Math.max(0.02, extendFraction(e.motion.t)) : 1;
      const a = e.axis;
      const k = f - 1;
      // M = T(p) * (I + (f - 1) a a^T) * T(-p): scale along the chord only, about the first point.
      // prettier-ignore
      const m = new Matrix4().set(
        1 + k * a.x * a.x, k * a.x * a.y, k * a.x * a.z, 0,
        k * a.x * a.y, 1 + k * a.y * a.y, k * a.y * a.z, 0,
        k * a.x * a.z, k * a.y * a.z, 1 + k * a.z * a.z, 0,
        0, 0, 0, 1,
      );
      const p = e.pivot;
      const t = new Matrix4().makeTranslation(p.x, p.y, p.z);
      const ti = new Matrix4().makeTranslation(-p.x, -p.y, -p.z);
      e.root.matrix.copy(t).multiply(m).multiply(ti);
      e.root.matrixWorldNeedsUpdate = true;
      return;
    }
    let s = 1;
    if (e.motion?.kind === 'inflate') s = inflateScale(e.motion.t);
    else if (e.motion?.kind === 'deflate') s = deflateScale(e.motion.t);
    const dip = e.clunk >= 0 ? clunkScale(e.clunk / CLUNK_SECONDS) : 1;
    e.root.scale.set(s, s * dip, s);
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
