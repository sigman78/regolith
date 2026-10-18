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
/** Stripe variants: accent at the +x end, accent at the -x end, graphite at the +x end. */
export const HAB_STRIPE_VARIANTS = 3;
/** Most a hull may lean from Hull white toward Hull shaded per instance (about 5% darker, a touch warmer). */
export const INDIVIDUAL_TINT_MAX = 0.35;
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

// ---- Tower (letter V) -------------------------------------------------------

export const TOWER_FLOORS = { min: 2, max: 5, step: 1, default: 3 } as const;
/** Hull radius of the tower, metres (hab size M). */
export const TOWER_RADIUS = 3;
export const TOWER_FLOOR_HEIGHT = 3;
/** Dome cap depth as a fraction of radius. */
export const TOWER_CAP_RATIO = 0.3;
export const TOWER_CAP_STEPS = 6;
export const TOWER_SEGMENTS = 48;
export const TOWER_FOOTPRINT_MARGIN = 0.15;
/** PRESS ports sit this far above their floor level. */
export const TOWER_PORT_Y = 1;
/** Four feet on the flat underside, radial distance as a fraction of the radius. */
export const TOWER_FOOT_RADIAL = 0.7;
/** Window band per floor: centre height above floor level, half height, proud of the hull. */
export const TOWER_WINDOW_Y = 2.2;
export const TOWER_WINDOW_HALF = 0.35;
export const TOWER_WINDOW_PROUD = 0.012;
/** Accent stripe under the cap: half width and distance below the top rim. */
export const TOWER_STRIPE_HALF = 0.25;
export const TOWER_STRIPE_BELOW_TOP = 0.6;
/** Rib thickness between floors and at the top rim. */
export const TOWER_RIB_THICK = 0.2;

// ---- Mast (letter M) --------------------------------------------------------

/** Lattice height options, metres. */
export const MAST_HEIGHTS = [6, 12, 20] as const;
/** Head kinds as numbers (params are numeric): 0 dish, 1 whip, 2 relay. */
export const MAST_HEADS = [0, 1, 2] as const;
export const MAST_HEAD_DISH = 0;
export const MAST_HEAD_WHIP = 1;
export const MAST_HEAD_RELAY = 2;
export const MAST_BASE_RADIUS = 1.1;
export const MAST_BASE_THICK = 0.18;
export const MAST_FOOTPRINT_MARGIN = 0.15;
/** Feet sit this fraction of the base radius out from the axis. */
export const MAST_FOOT_RADIAL = 0.8;
/** Circumradius of the three-leg lattice at the base and at the top, metres. */
export const MAST_LATTICE_R0 = 0.8;
export const MAST_LATTICE_R1 = 0.35;
export const MAST_LEG_RADIUS = 0.06;
export const MAST_BRACE_RADIUS = 0.035;
/** Target lattice section height, metres. */
export const MAST_SECTION = 2;
export const MAST_ROD_SEGMENTS = 6;
export const MAST_BASE_SEGMENTS = 24;
export const MAST_DISH_RADIUS = 1.1;
/** Dish depth as a fraction of its radius, shell thickness, and tilt away from vertical. */
export const MAST_DISH_DEPTH = 0.3;
export const MAST_DISH_THICK = 0.05;
export const MAST_DISH_TILT_DEG = 35;
export const MAST_DISH_STEPS = 8;
export const MAST_DISH_LIFT = 0.8;
export const MAST_FEED_LENGTH = 1;
export const MAST_WHIP_LENGTH = 3;
export const MAST_WHIP_RADIUS = 0.035;
export const MAST_RELAY_BOX = { w: 0.9, h: 0.7, d: 0.9 } as const;
export const MAST_RELAY_LIFT = 0.6;
/** Beacon ball on every head. */
export const MAST_BEACON_RADIUS = 0.15;
export const MAST_BEACON_SEGMENTS = 12;

// ---- Power plant (letter E) -------------------------------------------------

/** Drum radius for size S / M, metres. */
export const REACTOR_RADII = [2, 3] as const;
/** Drum height as a multiple of its radius, and dome cap depth as a fraction of it. */
export const REACTOR_HEIGHT_RATIO = 1.4;
export const REACTOR_CAP_RATIO = 0.35;
export const REACTOR_CAP_STEPS = 6;
export const REACTOR_SEGMENTS = 32;
export const REACTOR_FOOTPRINT_MARGIN = 0.15;
/** Four feet on the flat underside, radial distance as a fraction of the radius. */
export const REACTOR_FOOT_RADIAL = 0.7;
/** Radiator fins: count, reach beyond the hull as a fraction of the radius, thickness, and the fraction of the drum height they span (from the top down). */
export const REACTOR_FIN_COUNT = 8;
export const REACTOR_FIN_REACH = 0.3;
export const REACTOR_FIN_THICK = 0.08;
export const REACTOR_FIN_SPAN = 0.55;
/** Fins start this far inside the hull so no gap shows. */
export const REACTOR_FIN_EMBED = 0.1;
/** Hazard band: centre height as a fraction of the drum height, and half width. */
export const REACTOR_BAND_AT = 0.3;
export const REACTOR_BAND_HALF = 0.22;
export const REACTOR_BAND_PROUD = 0.012;
/** Rib thickness at the base and top rim. */
export const REACTOR_RIB_THICK = 0.22;
/** POWER ports: height above the base, and the junction box that marks each one. */
export const REACTOR_PORT_Y = 0.9;
export const REACTOR_PORT_COUNT = 3;
export const REACTOR_JUNCTION = { radial: 0.3, h: 0.5, tangent: 0.5 } as const;

// ---- Launcher (letter C) ----------------------------------------------------

export const LAUNCHER_LENGTH = { min: 8, max: 20, step: 4, default: 12 } as const;
/** Barrel elevation options, degrees above horizontal. */
export const LAUNCHER_ELEVATIONS = [10, 20, 30] as const;
export const LAUNCHER_SLED_HEIGHT = 0.4;
export const LAUNCHER_SLED_WIDTH = 2.4;
export const LAUNCHER_FOOTPRINT_MARGIN = 0.15;
/** Four feet under the sled: distance in from each end, and half the spacing across. */
export const LAUNCHER_FOOT_INSET = 1;
export const LAUNCHER_FOOT_HALF_Z = 0.8;
/** The barrel hinges this far in from the rear end, and this high above the sled top. */
export const LAUNCHER_HINGE_INSET = 0.8;
export const LAUNCHER_HINGE_HEIGHT = 0.9;
/** The barrel ends this far short of the front end (in plan). */
export const LAUNCHER_MUZZLE_INSET = 0.8;
export const LAUNCHER_BARREL_RADIUS = 0.45;
export const LAUNCHER_COIL_RADIUS = 0.8;
export const LAUNCHER_COIL_THICK = 0.3;
export const LAUNCHER_COIL_SPACING = 1.2;
/** First coil this far along the barrel from the hinge; last coil this far before the muzzle. */
export const LAUNCHER_COIL_START = 1.4;
export const LAUNCHER_COIL_END = 1.2;
export const LAUNCHER_MUZZLE_BAND = 0.35;
export const LAUNCHER_MUZZLE_BAND_RADIUS = 0.68;
/** Breech block behind and around the hinge. */
export const LAUNCHER_BREECH = { w: 1.2, d: 1.4, extra: 0.8 } as const;
/** Trestle posts under the barrel at these fractions of its length; post footprint in plan. */
export const LAUNCHER_POSTS = [0.35, 0.7] as const;
export const LAUNCHER_POST_WIDTH = 0.35;
export const LAUNCHER_POST_DEPTH = 0.9;
export const LAUNCHER_SEGMENTS = 20;

// ---- Dome (letter D, opaque only in M1) -------------------------------------

export const DOME_COLLAR_HEIGHT = 1.6;
export const DOME_SEGMENTS = 40;
/** Steps along the quarter arc from the collar rim to the pole. */
export const DOME_ARC_STEPS = 14;
export const DOME_FOOTPRINT_MARGIN = 0.15;
/** PRESS ports on the collar, height above the floor. */
export const DOME_PORT_Y = 0.8;
/** Four feet on the flat underside, radial distance as a fraction of the radius. */
export const DOME_FOOT_RADIAL = 0.85;
/** Latitude ribs, degrees of elevation above the collar rim, and their thickness. */
export const DOME_RIB_ELEVATIONS = [30, 60] as const;
export const DOME_RIB_THICK = 0.2;
/** Accent stripe on the collar: centre height and half width. */
export const DOME_STRIPE_Y = 1.25;
export const DOME_STRIPE_HALF = 0.18;
export const DOME_STRIPE_PROUD = 0.012;

// ---- Editor cues ------------------------------------------------------------

/** The ghost shows a snap arrow once the solver moves it this far from the cursor, metres. */
export const SNAP_ARROW_MIN = 0.25;
export const SNAP_ARROW_RADIUS = 0.07;
export const SNAP_ARROW_HEAD = { radius: 0.24, length: 0.5 } as const;
/** Lift above the terrain so the arrow does not z-fight with it, metres. */
export const SNAP_ARROW_LIFT = 0.15;

// ---- Hab windows ---------------------------------------------------------------------
/** Window panes on the upper flanks of a hab, one per rib bay and side. */
export const HAB_WINDOW_LENGTH = 0.9;
export const HAB_WINDOW_ARC = 0.55;
export const HAB_WINDOW_THICK = 0.05;
/** The pane's outer face stands this far proud of the hull (no coplanar faces). */
export const HAB_WINDOW_PROUD = 0.02;
/** Angle of the window rows from the top of the hull, degrees. */
export const HAB_WINDOW_ANGLE_DEG = 52;

// ---- Vertex tints (DESIGN_GUIDE §3, §9) -------------------------------------------
/** Colour multipliers, as hex: they scale the material colour, they never replace it. */
export const TINT_UNDERSIDE = '#9a9088';
export const TINT_DUST = '#d9b38c';
/** Surfaces facing straight down get the full underside shade; it fades out by this normal.y. */
export const UNDERSIDE_FADE_TOP = 0.15;
export const UNDERSIDE_FADE_BOTTOM = -0.85;
/** Contact shading: the lowest metre of a part is a little darker (ambient occlusion stand-in). */
export const CONTACT_HEIGHT = 0.8;
export const CONTACT_STRENGTH = 0.2;
/** Dust is kicked up from the ground: it covers the lowest part of a module, thickest to windward. */
export const DUST_HEIGHT = 1.4;
export const DUST_MAX = 0.6;
/** Direction the prevailing wind blows from, degrees in the plan (x toward z). */
export const WIND_FROM_DEG = 215;

// ---- Rocks and scatter (docs/SCATTER.md) ------------------------------------------
export const ROCK_VARIANTS = 2;
/** Radial lump of a rock vertex, fraction of the radius. */
export const ROCK_LUMP = 0.22;
/** Rocks are squashed to this height ratio. */
export const ROCK_FLATTEN = 0.7;
/** Candidate grid for ambient rocks, metres. */
export const SCATTER_CELL = 2;
/** Smallest rock; smaller reads as shimmer at the camera's distance. */
export const ROCK_MIN_SIZE = 0.25;
export const ROCK_MAX_SIZE = 1.7;
/** Power-law exponent of the size distribution (higher = more small rocks). */
export const ROCK_SIZE_EXPONENT = 2.2;
/** Rocks bigger than this are boulders: capped, and kept off slopes. */
export const BOULDER_MIN_SIZE = 0.8;
export const BOULDER_MAX_SLOPE_DEG = 30;
export const ROCK_CAP = 2500;
export const BOULDER_CAP = 200;
/** Only rocks bigger than this cast shadows (smaller ones would speckle at 06:00 / 18:30). */
export const ROCK_SHADOW_MIN_SIZE = 0.6;
/** A rock sinks this fraction of its height into the ground. */
export const ROCK_SINK = 0.3;
/** Rocks yield to the base: the keep-out around hulls and tubes, in whole cells. */
export const KEEPOUT_PART_MARGIN = 1;
/** Extra clearance around a tube or dock path on top of its radius, metres. */
export const KEEPOUT_TUBE_MARGIN = 0.5;
/** Rock density drops to this factor at the world centre, where the base is built. */
export const SCATTER_CENTRE_DAMPING = 0.35;
export const SCATTER_CENTRE_RADIUS = 18;
export const SCATTER_FADE_RADIUS = 45;
/** Scale-in time of a rock that appears after a commit, seconds. */
export const SCATTER_FADE_SECONDS = 0.15;
