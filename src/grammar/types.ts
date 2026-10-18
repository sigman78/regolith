/**
 * The vocabulary of the grammar layer: letters, ports, footprints, param
 * schemas and the PartDefinition contract. Pure data; no three, no DOM.
 *
 * Local frame of every part: origin on the part's axis at the centre, +Y up,
 * long axis along +X. Yaw rotates that frame about +Y (see core/math.ts).
 */
import type { Vec3 } from '@/core/math';
import type { Letter } from '@/world/letter';
import type { HandleSpec } from './handles';

export type { Letter };

export type PortType = 'PRESS' | 'STRUCT' | 'POWER' | 'EXT';

export interface PortSpec {
  /** unique within the part, stable across param changes where the port persists */
  id: string;
  type: PortType;
  /** local space, metres */
  position: Vec3;
  /** local space, unit length, pointing away from the part */
  normal: Vec3;
}

/** Local-space ground footprint, before margin handling by the overlap stage. */
export type Footprint = { kind: 'rect'; hx: number; hz: number } | { kind: 'disc'; r: number };

export type GroundSpec =
  /** STRUCT ports get legs down to the terrain; the hull keeps `minClearance` above it. */
  | {
      mode: 'legs';
      minClearance: number;
      /** Local height of a standable top surface; other parts on this footprint stand on it. */
      hostTop?: number;
    }
  | { mode: 'none' };

// ---- Params -------------------------------------------------------------------

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

/** Display hints shared by every kind; the picker uses them, the solver never does. */
interface ParamLook {
  /** Shown instead of the capitalised key. */
  label?: string;
  /** Appended to numbers: 'm', '°'. */
  unit?: string;
}

export type ParamSpec =
  | (ParamLook & { kind: 'range'; min: number; max: number; step: number; default: number })
  | (ParamLook & {
      kind: 'choice';
      options: readonly number[];
      default: number;
      /** One name per option, instead of the number. */
      labels?: readonly string[];
    })
  | (ParamLook & { kind: 'toggle'; default: boolean });

export type ParamSchema = Readonly<Record<string, ParamSpec>>;

// ---- Geometry recipes -----------------------------------------------------------

/** Declarative description of geometry. Hashable, so builders can memoise. */
export type GeomOp =
  | { kind: 'hab'; length: number; radius: number; variant?: number }
  | { kind: 'node'; radius: number }
  /** Painted serial on a hab hull, in the hull's frame (geometry/stencil.ts). */
  | { kind: 'stencil'; text: string; radius: number }
  | { kind: 'slab'; w: number; d: number }
  | { kind: 'tower'; floors: number; radius: number }
  | { kind: 'airlock'; radius: number; length: number }
  | { kind: 'solar'; rows: number; cols: number; tracking?: boolean }
  | { kind: 'pole'; height: number }
  /** A suited crew member outdoors (hull and graphite), feet at y = 0, facing +x. */
  | { kind: 'suit' }
  | { kind: 'mast'; height: number; head: number }
  | { kind: 'reactor'; radius: number }
  | { kind: 'launcher'; length: number; elevation: number }
  | { kind: 'dome'; radius: number }
  /** Ambient rock, unit size, base at y = 0 (world scatter, not a part). */
  | { kind: 'rock'; variant: number }
  /** World-space centreline, flat x,y,z, already embedded slightly into the hulls at both ends. */
  | { kind: 'tube'; points: number[] }
  /** Unit-height leg strut, base at y = 0. Render scales it in Y to the leg length. */
  | { kind: 'leg-strut' }
  /** Footpad disc, base at y = 0. */
  | { kind: 'leg-foot' };

export interface GeometryRecipe {
  ops: GeomOp[];
}

export interface GeometryCtx {
  seed: string;
  /** individual.ts: a small index a part may fold into its recipe; 0 when absent */
  variant?: number;
}

// ---- The contract ---------------------------------------------------------------

/**
 * Parts are pure: they see their own params and a ctx, never the document.
 * Methods use method syntax on purpose so a `PartDefinition<HabParams>` is
 * assignable to the registry's `PartDefinition<ParamValues>`.
 */
export interface PartDefinition<P extends ParamValues = ParamValues> {
  letter: Letter;
  name: string;
  schema: ParamSchema;
  /** Clamp, snap and fill defaults. Every other method receives resolved params. */
  resolve(raw: Readonly<ParamValues>): P;
  footprint(params: P): Footprint;
  ports(params: P): PortSpec[];
  ground(params: P): GroundSpec;
  geometry(params: P, ctx: GeometryCtx): GeometryRecipe;
  /** Grips for dragging a range or choice param on the selected part; absent = none (the picker still edits it). */
  handles?(params: P): HandleSpec[];
  /** Short size note for the selection tooltip, e.g. '8 m'. */
  summary?(params: P): string;
}
