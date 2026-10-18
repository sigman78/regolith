/**
 * Every design number in the game lives here and nowhere else (CLAUDE.md,
 * DESIGN_GUIDE §9 "Scale drift"). This module has zero imports on purpose:
 * grammar/ and world/ may read it even though they sit below geometry/.
 */

// ---- Shape language ---------------------------------------------------------

/** The one bevel size, metres (6 cm). */
export const BEVEL = 0.06;
/** Rounding steps on a beveled box edge. */
export const BEVEL_SEGMENTS = 2;
/** Rib flange height as a fraction of hull radius. */
export const FLANGE_RATIO = 0.1;
/** Rib every N metres along a hab. */
export const RIB_SPACING = 2;
/** Cylinder radii for hab S / M, metres. */
export const HAB_RADII = [2, 3] as const;
/** Dome radii, metres. */
export const DOME_RADII = [3, 4.5, 6, 8] as const;

// ---- Grid -------------------------------------------------------------------

/** Placement grid, metres. Ports and footprints live on this grid. */
export const GRID = 1;

// ---- Hab (letter H) ---------------------------------------------------------

export const HAB_LENGTH = { min: 4, max: 16, step: 2, default: 8 } as const;
/** Dome end-cap depth as a fraction of radius. */
export const HAB_CAP_RATIO = 0.35;
/** Segments around the hull axis. */
export const HAB_SEGMENTS = 32;
/** Steps along each end-cap quarter arc. */
export const HAB_CAP_STEPS = 6;
/** Rib thickness at the hull ends / between them, metres. */
export const HAB_RIB_THICK_END = 0.28;
export const HAB_RIB_THICK_MID = 0.18;
/** Ribs start this far inside the hull so no gap shows at the seam. */
export const HAB_RIB_INSET = 0.01;
/** Accent stripe: half-width along the axis, offset proud of the hull, distance from the +X end. */
export const HAB_STRIPE_HALF = 0.5;
export const HAB_STRIPE_PROUD = 0.012;
export const HAB_STRIPE_FROM_END = 1.4;
/** A side PRESS port every N metres along the hull, alternating sides. */
export const HAB_SIDE_PORT_SPACING = 4;
/** STRUCT ports sit this far in from each end rib. */
export const HAB_STRUCT_INSET = 1.2;
/** Hatch ring diameter on every PRESS port, metres. */
export const HATCH_DIAMETER = 1.6;
/** Footprint margin around a hull, metres per side (room for legs and flanges). */
export const HAB_FOOTPRINT_MARGIN = 0.15;

// ---- Ground and legs --------------------------------------------------------

/** Lowest hull point stays at least this far above the highest terrain under it. */
export const LEG_MIN_CLEARANCE = 0.5;
/** Footpads are sunk into the terrain by this much so nothing hovers. */
export const FOOT_SINK = 0.05;
export const LEG_RADIUS = 0.12;
export const FOOT_RADIUS = 0.35;
export const FOOT_HEIGHT = 0.1;
export const LEG_SEGMENTS = 12;
/** The strut runs this far up into the hull so no seam shows where it meets the belly. */
export const LEG_TOP_OVERLAP = 0.1;

// ---- Node (letter N) --------------------------------------------------------

/** Sphere radii for node S / M / L, metres. */
export const NODE_RADII = [2, 2.5, 3] as const;
export const NODE_FOOTPRINT_MARGIN = 0.15;
/** Directions of a node's PRESS ports in its local frame: ±X, ±Z and up. Shared by grammar and geometry. */
export const NODE_PRESS_DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
] as const;
export const NODE_SEGMENTS = 24;
/** Steps along the pole-to-pole arc. */
export const NODE_ARC_STEPS = 12;
/** Tripod feet: radial distance from the axis as a fraction of the sphere radius. */
export const NODE_FOOT_RADIAL = 0.6;
/** Hatch collar band around every PRESS port. */
export const NODE_COLLAR_THICK = 0.3;
export const NODE_COLLAR_FLANGE = 0.12;
/** The collar sits this far inside the shell so no gap shows at its rim. */
export const NODE_COLLAR_EMBED = 0.06;

// ---- Tubes and docks --------------------------------------------------------

export const TUBE_RADIUS = HATCH_DIAMETER / 2;
export const TUBE_SEGMENTS = 16;
/** Flange every N metres along a tube. */
export const TUBE_RIB_SPACING = 2;
export const TUBE_RIB_THICK = 0.18;
export const TUBE_END_THICK = 0.28;
export const TUBE_FLANGE = 0.08;
/** Ball joint at a bend, as a multiple of the tube radius. */
export const TUBE_KINK_BALL = 1.12;
export const TUBE_BALL_SEGMENTS = 16;
/** The tube starts this far inside the hull so no gap shows around its rim. */
export const TUBE_PORT_EMBED = 0.3;
/** Straight run out of a port before the router may turn, metres. */
export const TUBE_LEAD = 1;
/** Beyond this span, or this many kinks, the solver inserts a node. */
export const TUBE_MAX_SPAN = 24;
export const TUBE_MAX_KINKS = 2;
/** Gap between the tube underside and the terrain wherever the tube is free-standing. */
export const TUBE_GROUND_GAP = 0.3;
/** Support leg every N metres of tube. */
export const TUBE_LEG_SPACING = 6;
/** Tube sampling step for the height profile and the sweep, metres. */
export const TUBE_SAMPLE = 2;
/** Router cost of a 45° turn, in metres of extra path. */
export const TUBE_TURN_COST = 1.5;

/** Two PRESS ports dock directly when this close, this well aligned and this little offset. */
export const DOCK_RANGE = 1.5;
export const DOCK_ANGLE_DEG = 15;
export const DOCK_LATERAL = 0.5;

// ---- Slab (letter P) --------------------------------------------------------

export const SLAB_SIZE = { min: 2, max: 12, step: 2, default: 8 } as const;
/** Deck thickness; its top is the surface other parts stand on. */
export const SLAB_THICK = 0.5;
export const SLAB_FOOTPRINT_MARGIN = 0.1;
/** Pylon feet sit this far in from the slab edge. */
export const SLAB_FOOT_INSET = 0.6;
/** Pylons along a slab edge are at most this far apart. */
export const SLAB_FOOT_SPACING = 4;
/** Hazard band along the slab top: width, inset from the edge, height proud of the deck. */
export const SLAB_BAND_WIDTH = 0.2;
export const SLAB_BAND_INSET = 0.2;
export const SLAB_BAND_PROUD = 0.02;
