/**
 * The BaseDocument: the only persistent truth (ARCHITECTURE §3). Everything
 * visible is derived from it. Documents are immutable values; every function
 * here returns a new document and shares untouched structure with the old one,
 * which is what makes undo a pointer swap and scene diffing cheap.
 */
import type { Yaw } from '@/core/math';
import type { Letter } from './letter';

export type PartId = string;

export type ParamBag = Readonly<Record<string, number | string | boolean>>;

export interface PartPose {
  x: number;
  z: number;
  yaw: Yaw;
  /** Optional elevation override (e.g. hosted on a pad). Absent = solver decides from terrain. */
  y?: number;
  /** Flipped across the part's own length axis. Stored only when true, so older documents are unchanged. */
  mirror?: true;
}

/** A pose at `at` that keeps `from`'s mirror flag (drags, turns and re-commits must not unflip a part). */
export function keepMirror(
  from: PartPose,
  at: { x: number; z: number; yaw: Yaw; y?: number },
): PartPose {
  return from.mirror ? { ...at, mirror: true } : at;
}

export interface PartFlags {
  shielded?: boolean;
  windows?: boolean;
}

export interface PartInstance {
  readonly id: PartId;
  readonly letter: Letter;
  readonly params: ParamBag;
  readonly pose: PartPose;
  readonly flags?: PartFlags;
  /** Stencil number: allocated once from `nextSerial`, never reused within a document's history. */
  readonly serial: number;
}

export interface PortRef {
  part: PartId;
  port: string;
}

export interface Link {
  a: PortRef;
  b: PortRef;
  kind: 'dock' | 'tube';
  /** Parts (nodes) the solver inserted along a tube. Derived, but kept so saves round-trip. */
  via?: PartId[];
}

export interface TerrainStroke {
  tool: 'raise' | 'lower' | 'flatten' | 'smooth';
  x: number;
  z: number;
  radius: number;
  strength: number;
}

export interface BaseDocument {
  readonly version: 1;
  readonly seed: string;
  readonly terrain: {
    readonly size: number;
    readonly cell: number;
    readonly edits: readonly TerrainStroke[];
  };
  readonly parts: Readonly<Record<PartId, PartInstance>>;
  readonly links: readonly Link[];
  readonly nextSerial: number;
  readonly settings: { readonly hour: number; readonly streetLights: boolean };
  readonly camera?: {
    readonly target: readonly [number, number, number];
    readonly yaw: number;
    readonly distance: number;
  };
}

export interface NewPart {
  id: PartId;
  letter: Letter;
  params?: ParamBag;
  pose: PartPose;
  flags?: PartFlags;
}

export function createDocument(opts: { seed: string; size?: number; cell?: number }): BaseDocument {
  return {
    version: 1,
    seed: opts.seed,
    terrain: { size: opts.size ?? 96, cell: opts.cell ?? 1, edits: [] },
    parts: {},
    links: [],
    nextSerial: 1,
    settings: { hour: 12, streetLights: false },
  };
}

export function getPart(doc: BaseDocument, id: PartId): PartInstance | undefined {
  return doc.parts[id];
}

export function partList(doc: BaseDocument): PartInstance[] {
  return Object.values(doc.parts);
}

/** Adds a part and allocates its serial. An existing id is left untouched. */
export function addPart(doc: BaseDocument, part: NewPart): BaseDocument {
  if (doc.parts[part.id]) return doc;
  const instance: PartInstance = {
    id: part.id,
    letter: part.letter,
    params: part.params ?? {},
    pose: part.pose,
    ...(part.flags ? { flags: part.flags } : {}),
    serial: doc.nextSerial,
  };
  return {
    ...doc,
    parts: { ...doc.parts, [part.id]: instance },
    nextSerial: doc.nextSerial + 1,
  };
}

/** Removes a part and every link that touches it. */
export function removePart(doc: BaseDocument, id: PartId): BaseDocument {
  if (!doc.parts[id]) return doc;
  const { [id]: _removed, ...rest } = doc.parts;
  return {
    ...doc,
    parts: rest,
    links: doc.links.filter((l) => l.a.part !== id && l.b.part !== id && !l.via?.includes(id)),
  };
}

function updatePart(
  doc: BaseDocument,
  id: PartId,
  fn: (p: PartInstance) => PartInstance,
): BaseDocument {
  const part = doc.parts[id];
  if (!part) return doc;
  const next = fn(part);
  if (next === part) return doc;
  return { ...doc, parts: { ...doc.parts, [id]: next } };
}

export function setPartParams(doc: BaseDocument, id: PartId, params: ParamBag): BaseDocument {
  return updatePart(doc, id, (p) => (sameBag(p.params, params) ? p : { ...p, params }));
}

export function setPartPose(doc: BaseDocument, id: PartId, pose: PartPose): BaseDocument {
  return updatePart(doc, id, (p) =>
    p.pose.x === pose.x &&
    p.pose.z === pose.z &&
    p.pose.yaw === pose.yaw &&
    p.pose.y === pose.y &&
    !!p.pose.mirror === !!pose.mirror
      ? p
      : { ...p, pose },
  );
}

export function addLink(doc: BaseDocument, link: Link): BaseDocument {
  if (!doc.parts[link.a.part] || !doc.parts[link.b.part]) return doc;
  if (doc.links.some((l) => sameLink(l, link))) return doc;
  return { ...doc, links: [...doc.links, link] };
}

export function removeLink(doc: BaseDocument, link: Link): BaseDocument {
  const links = doc.links.filter((l) => !sameLink(l, link));
  return links.length === doc.links.length ? doc : { ...doc, links };
}

function sameRef(a: PortRef, b: PortRef): boolean {
  return a.part === b.part && a.port === b.port;
}

/** Links are undirected: (a,b) equals (b,a). */
export function sameLink(x: Link, y: Link): boolean {
  return (sameRef(x.a, y.a) && sameRef(x.b, y.b)) || (sameRef(x.a, y.b) && sameRef(x.b, y.a));
}

function sameBag(a: ParamBag, b: ParamBag): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}
