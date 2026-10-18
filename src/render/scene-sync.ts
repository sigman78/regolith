/**
 * SceneSync: diffs a ResolvedBase into the scene. The only code that turns
 * solver output into meshes (ARCHITECTURE §6.1).
 *
 * Parts: one `body` group posed by the resolved pose, plus a `legs` group in
 * world space. Tubes and docks: world-space bodies plus legs. Entries are
 * added, removed and updated by id; a body is only rebuilt when its recipe hash
 * changes, legs only when their numbers do.
 *
 * The groups only carry transforms (inflate, yaw, flip, tube stretch). What is
 * drawn are instances in one `BatchedMesh` per material (batch.ts), whose
 * matrices are written from the groups' world matrices once a frame, for the
 * entries that moved. The ghost preview keeps plain meshes: it needs the
 * override material and is a handful of objects.
 */
import {
  type BatchedMesh,
  BufferAttribute,
  BufferGeometry,
  Color,
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
import type { Decal } from '@/grammar/decals';
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
import { MaterialBatch, mirrored } from './batch';
import { materials, PALETTE } from './materials';

const DEG = Math.PI / 180;
/** Undoes the body's own flip: a mirrored part draws a mirrored geometry under a proper rotation. */
const UNFLIP = new Matrix4().makeScale(1, 1, -1);
const scratch = new Matrix4();

const HULL_WHITE = new Color(PALETTE.hullWhite);
const HULL_SHADOWED = new Color(PALETTE.hullShadowed);

/**
 * The colour multiplier that leans the hull `k` of the way from Hull white to Hull shaded, so a
 * tinted hull is always a point on a palette segment.
 */
export function hullTint(k: number, out: Color = new Color()): Color {
  return out.setRGB(
    1 + k * (HULL_SHADOWED.r / HULL_WHITE.r - 1),
    1 + k * (HULL_SHADOWED.g / HULL_WHITE.g - 1),
    1 + k * (HULL_SHADOWED.b / HULL_WHITE.b - 1),
  );
}

/** A tube extends from its first point along its chord; a part inflates about its base. */
type Motion =
  { kind: 'inflate'; t: number } | { kind: 'deflate'; t: number } | { kind: 'extend'; t: number };

/** One drawn piece of an entry: an instance in the batch of its material. */
interface Piece {
  batch: MaterialBatch;
  key: string;
  id: number;
  /** relative to the entry's legs group; body pieces sit at the body's origin */
  local: Matrix4 | null;
  /** body pieces of a flipped part use the mirrored geometry */
  flip: boolean;
}

interface Entry {
  root: Group;
  body: Group;
  legs: Group;
  bodyPieces: Piece[];
  legPieces: Piece[];
  mirror: boolean;
  tint: number;
  recipeHash: string;
  legsKey: string;
  decalPieces: Piece[];
  decalsKey: string;
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
  /** individual.ts tint (hull only); 0 for tubes */
  tint?: number;
  /** painted-on decals, world-space matrices (batched only) */
  decals?: readonly Decal[];
  legs: Leg[];
  /** body transform; tubes are authored in world space and have none */
  pose?: { x: number; y: number; z: number; yaw: number; mirror?: boolean };
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
  private readonly batched: boolean;
  private readonly batches = new Map<MaterialName, MaterialBatch>();
  /** Entries whose matrices must be written to their batches. */
  private readonly dirty = new Set<Entry>();
  /** The first sync loads the document as it is; only later changes animate. */
  private primed = false;

  constructor(
    scene: Scene,
    private readonly opts: SceneSyncOptions = {},
  ) {
    this.batched = !opts.override;
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
        tint: p.tint,
        decals: p.decals,
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
        this.dispose(entry);
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
    this.flush();
  }

  /** The batched meshes in the scene (tests, and the HUD's draw-call estimate). */
  get batchMeshes(): BatchedMesh[] {
    const out: BatchedMesh[] = [];
    for (const b of this.batches.values()) if (b.mesh) out.push(b.mesh);
    return out;
  }

  clear(): void {
    this.sync(emptyBase());
  }

  /** Advance inflation, deflation, tube extension and docking clunks by `dt` seconds. */
  tick(dt: number): void {
    for (const e of this.dying) {
      if (e.motion) e.motion.t += dt / DEFLATE_SECONDS;
      if (!e.motion || e.motion.t >= 1) {
        this.dispose(e);
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
    this.flush();
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
      bodyPieces: [],
      legPieces: [],
      mirror: false,
      tint: 0,
      recipeHash: '',
      legsKey: '',
      decalPieces: [],
      decalsKey: '',
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
    const mirror = !!d.pose?.mirror;
    const tint = d.tint ?? 0;
    if (
      entry.recipeHash !== d.recipeHash ||
      (this.batched && (entry.mirror !== mirror || entry.tint !== tint))
    ) {
      this.clearPieces(entry.bodyPieces);
      entry.body.clear();
      this.fill(entry, buildBundle(d.recipe), mirror, tint);
      entry.recipeHash = d.recipeHash;
      entry.mirror = mirror;
      entry.tint = tint;
    }
    if (d.path) this.setChord(entry, d.path);
    if (d.pose) {
      // The root sits at the part's base so inflation grows it from the ground; legs stay in world space.
      entry.pivot.set(d.pose.x, d.pose.y, d.pose.z);
      entry.root.position.copy(entry.pivot);
      entry.legs.position.set(-d.pose.x, -d.pose.y, -d.pose.z);
      entry.body.rotation.y = d.pose.yaw * DEG;
      // A flip is a negative scale: three flips the winding for it, so the mirrored part shares its geometry.
      entry.body.scale.z = d.pose.mirror ? -1 : 1;
    }

    const key = JSON.stringify(d.legs);
    if (entry.legsKey !== key) {
      this.clearPieces(entry.legPieces);
      entry.legs.clear();
      this.buildLegs(entry, d.legs);
      entry.legsKey = key;
    }
    if (this.batched) {
      const decalsKey = (d.decals ?? [])
        .map((x) => `${x.recipeHash}@${x.matrix.join(',')}`)
        .join('|');
      if (entry.decalsKey !== decalsKey) {
        this.clearPieces(entry.decalPieces);
        for (const decal of d.decals ?? []) {
          const bundle = buildBundle(decal.recipe);
          for (const [name, geo] of Object.entries(geometriesFor(bundle)) as [
            MaterialName,
            BufferGeometry,
          ][]) {
            entry.decalPieces.push(
              this.piece(name, bundle.hash, geo, new Matrix4().fromArray([...decal.matrix]), false),
            );
          }
        }
        entry.decalsKey = decalsKey;
      }
    }
    this.dirty.add(entry);
  }

  /** Write the entry's current scale (parts) or stretch along its chord (tubes). */
  private applyMotion(e: Entry): void {
    this.dirty.add(e);
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

  private fill(entry: Entry, bundle: GeometryBundle, mirror: boolean, tint: number): void {
    const geos = geometriesFor(bundle);
    for (const [name, geo] of Object.entries(geos) as [MaterialName, BufferGeometry][]) {
      if (this.batched) {
        const key = mirror ? `${bundle.hash}|m` : bundle.hash;
        const piece = this.piece(name, key, geo, null, mirror);
        if (name === 'hull' && tint > 0) piece.batch.setColor(piece.id, hullTint(tint));
        entry.bodyPieces.push(piece);
      } else entry.body.add(this.mesh(geo, name));
    }
  }

  private mesh(geo: BufferGeometry, name: MaterialName): Mesh {
    const ghost = this.opts.override;
    const m = new Mesh(geo, ghost ?? materials[name]);
    m.castShadow = !ghost;
    m.receiveShadow = !ghost;
    return m;
  }

  private piece(
    name: MaterialName,
    key: string,
    geo: BufferGeometry,
    local: Matrix4 | null,
    flip: boolean,
  ): Piece {
    let batch = this.batches.get(name);
    if (!batch) {
      // Glass blends, so its instances are depth-sorted; opaque ones never need it.
      batch = new MaterialBatch(this.root, materials[name], name === 'glass');
      this.batches.set(name, batch);
    }
    const id = batch.add(key, () => (flip ? mirrored(geo) : geo));
    return { batch, key, id, local, flip };
  }

  private clearPieces(pieces: Piece[]): void {
    for (const p of pieces) p.batch.remove(p.key, p.id);
    pieces.length = 0;
  }

  private buildLegs(entry: Entry, legs: Leg[]): void {
    const strutBundle = buildBundle({ ops: [{ kind: 'leg-strut' }] });
    const footBundle = buildBundle({ ops: [{ kind: 'leg-foot' }] });
    const strut = geometriesFor(strutBundle).graphite;
    const foot = geometriesFor(footBundle).graphite;
    if (!strut || !foot) return;
    for (const leg of legs) {
      const footAt: [number, number, number] = [leg.bottom[0], leg.bottom[1], leg.bottom[2]];
      const strutAt: [number, number, number] = [
        leg.bottom[0],
        leg.bottom[1] + FOOT_HEIGHT,
        leg.bottom[2],
      ];
      const height = leg.top[1] + LEG_TOP_OVERLAP - strutAt[1];
      if (this.batched) {
        const footM = new Matrix4().makeTranslation(...footAt);
        const strutM = new Matrix4().makeTranslation(...strutAt).scale(new Vector3(1, height, 1));
        entry.legPieces.push(
          this.piece('graphite', footBundle.hash, foot, footM, false),
          this.piece('graphite', strutBundle.hash, strut, strutM, false),
        );
        continue;
      }
      const f = this.mesh(foot, 'graphite');
      f.position.set(...footAt);
      const s = this.mesh(strut, 'graphite');
      s.position.set(...strutAt);
      s.scale.y = height;
      entry.legs.add(f, s);
    }
  }

  /** Write the moved entries' world matrices into their batches. */
  private flush(): void {
    for (const e of this.dirty) {
      e.root.updateMatrixWorld(true);
      for (const p of e.bodyPieces) {
        const m = p.flip
          ? scratch.multiplyMatrices(e.body.matrixWorld, UNFLIP)
          : e.body.matrixWorld;
        p.batch.setMatrix(p.id, m);
      }
      for (const p of [...e.legPieces, ...e.decalPieces]) {
        if (p.local) p.batch.setMatrix(p.id, scratch.multiplyMatrices(e.legs.matrixWorld, p.local));
      }
    }
    this.dirty.clear();
  }

  private dispose(e: Entry): void {
    this.clearPieces(e.bodyPieces);
    this.clearPieces(e.legPieces);
    this.clearPieces(e.decalPieces);
    this.dirty.delete(e);
    this.root.remove(e.root);
  }
}
