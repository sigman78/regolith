/**
 * Solver data. A `Draft` flows through the stages; `solve()` turns the final
 * drafts into a `ResolvedBase`, the only thing render/ and sim/ ever read.
 */
import type { Pose, Vec3 } from '@/core/math';
import type { Link, PartId, PartInstance, PortRef } from '@/world/document';
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

export type Diagnostic =
  | { kind: 'unknown-letter'; part: PartId; letter: string }
  | { kind: 'moved'; part: PartId; dx: number; dz: number }
  | { kind: 'unplaceable'; part: PartId }
  /** A player link could not be built (missing part, port taken, port cannot take a tube). */
  | { kind: 'link-skipped'; link: Link; reason: string }
  /** No clear route: a straight tube was drawn anyway (never reject, P1). */
  | { kind: 'tube-unroutable'; tube: string }
  /** Over the span or kink limit and no room for a node. */
  | { kind: 'tube-too-long'; tube: string };

export interface ResolvedBase {
  parts: Map<PartId, ResolvedPart>;
  /** Docks and tubes by id. */
  tubes: Map<string, ResolvedTube>;
  /** `part/port` of every PRESS port a dock or tube is using. */
  usedPorts: Set<string>;
  /** Never shown to the player as errors; used by tests and the ghost preview. */
  diagnostics: Diagnostic[];
}

export interface SolveOptions {
  /**
   * Part being dragged or previewed. It is placed last so older parts keep
   * their spots and the moving part yields.
   */
  movingId?: PartId;
}
