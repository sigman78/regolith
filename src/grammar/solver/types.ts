/**
 * Solver data. A `Draft` flows through the stages; `solve()` turns the final
 * drafts into a `ResolvedBase`, the only thing render/ and sim/ ever read.
 */
import type { Pose, Vec3 } from '@/core/math';
import type { FlatField } from '@/world/flatten';
import type { Link, PartId, PartInstance, PortRef } from '@/world/document';
import type { Decal } from '../decals';
import type {
  Footprint,
  GeometryRecipe,
  Letter,
  ParamValues,
  PartDefinition,
  PortType,
} from '../types';

/** What the solver needs to know about the ground. */
export interface SolverWorld {
  /** Half the playable extent in metres; part centres are clamped inside it. */
  halfSize: number;
  heightAt(x: number, z: number): number;
}

export interface Draft {
  instance: PartInstance;
  def: PartDefinition;
  params: ParamValues;
  footprint: Footprint;
  /** pose as stored in the document, for ghost "snapped" arrows and diagnostics */
  requested: { x: number; z: number; yaw: number };
  /** working pose; `y` is filled in by the ground stage */
  pose: Pose;
  /** grid cells covered at the working pose */
  cells: number[];
}

export interface ResolvedPort {
  id: string;
  type: PortType;
  /** world space */
  position: Vec3;
  normal: Vec3;
}

export interface Leg {
  portId: string;
  /** where the leg meets the hull (world) */
  top: Vec3;
  /** footpad base, already sunk into the terrain (world) */
  bottom: Vec3;
}

export interface ResolvedPart {
  id: PartId;
  letter: Letter;
  serial: number;
  params: ParamValues;
  pose: Pose;
  requested: { x: number; z: number; yaw: number };
  footprint: Footprint;
  ports: ResolvedPort[];
  legs: Leg[];
  recipe: GeometryRecipe;
  /** individual.ts: 0..INDIVIDUAL_TINT_MAX, how far the hull leans to Hull shaded (per instance, not in the recipe) */
  tint: number;
  /** Paint on the hull (the serial stencil), world-space matrices; not part of the body recipe. */
  decals: Decal[];
  /** stable hash of the recipe; the scene cache key for the body mesh */
  recipeHash: string;
  /** Inserted by the solver (a node on a long tube); not in the document. */
  derived?: true;
}

/** A dock bridge or a routed player tube, in world space. */
export interface ResolvedTube {
  id: string;
  kind: 'dock' | 'tube';
  a: PortRef;
  b: PortRef;
  /** Centreline, embedded slightly into the hulls at both ends. */
  path: Vec3[];
  /** Support legs, same shape as part legs. */
  legs: Leg[];
  recipe: GeometryRecipe;
  recipeHash: string;
}

export type InvariantRule =
  | 'stands-on-something'
  | 'unique-serial'
  | 'hull-gap'
  | 'tube-free-end'
  | 'tube-crosses-hull'
  | 'halo-usable'
  | 'port-on-floor';

export type Diagnostic =
  | { kind: 'unknown-letter'; part: PartId; letter: string }
  | { kind: 'moved'; part: PartId; dx: number; dz: number }
  | { kind: 'unplaceable'; part: PartId }
  /** A player link could not be built (missing part, port taken, port cannot take a tube). */
  | { kind: 'link-skipped'; link: Link; reason: string }
  /** No clear route: a straight tube was drawn anyway (never reject, P1). */
  | { kind: 'tube-unroutable'; tube: string }
  /** Over the span or kink limit and no room for a node. */
  | { kind: 'tube-too-long'; tube: string }
  /** A corridor climbs more than CORRIDOR_MAX_SLOPE: drawn anyway, never refused (P1). */
  | { kind: 'corridor-steep'; tube: string }
  /** A DESIGN_GUIDE §8.4 rule is broken. Only produced when `SolveOptions.diagnose` is set. */
  | { kind: 'invariant'; rule: InvariantRule; subject: string; detail: string };

/** A part you can walk in: one floor-level point per PRESS port, plus a centre. */
export interface PressNode {
  id: PartId;
  letter: Letter;
  /** inserted by the solver (a node on a long tube) */
  derived: boolean;
  centre: Vec3;
  /** port id -> floor point, world space */
  ports: Map<string, Vec3>;
  /** EXT port id -> ground point (the foot of a ramp), world space; where crew step outside */
  exits: Map<string, Vec3>;
  /** pressurised cubic metres */
  volume: number;
}

/** A dock or tube between two PRESS ports, as a floor-level walkway. */
export interface PressEdge {
  id: string;
  kind: 'dock' | 'tube';
  a: PortRef;
  b: PortRef;
  path: Vec3[];
  /** walking length in metres */
  length: number;
}

/** The walkable network of a base (solver stage `graph`). Empty on a `lean` solve. */
export interface PressGraph {
  nodes: Map<PartId, PressNode>;
  edges: PressEdge[];
}

export interface ResolvedBase {
  parts: Map<PartId, ResolvedPart>;
  /** Docks and tubes by id. */
  tubes: Map<string, ResolvedTube>;
  /** `part/port` of every PRESS port a dock or tube is using. */
  usedPorts: Set<string>;
  /**
   * Cells (1 m grid, `j * size + i`, see keepout.ts) that ambient decoration must stay out of:
   * parts including slab hosts, and tube corridors.
   */
  keepOut: Uint8Array;
  /**
   * The terrain levelled under the parts (heights the legs and tubes were grounded on), or null
   * when nothing is levelled. Anything that draws or samples the ground reads this, not the raw terrain.
   */
  terrain: FlatField | null;
  /** Where crew can walk: PRESS parts and the docks and tubes between them. */
  graph: PressGraph;
  /** Never shown to the player as errors; used by tests and the ghost preview. */
  diagnostics: Diagnostic[];
}

export interface SolveOptions {
  /**
   * Part being dragged or previewed. It is placed last so older parts keep
   * their spots and the moving part yields.
   */
  movingId?: PartId;
  /** Also run the invariant checks (O(n²) in parts): tests and debug builds, not the hot path. */
  diagnose?: boolean;
  /** Skip stages only the live base needs (the graph): ghost previews and trial solves. */
  lean?: boolean;
}
