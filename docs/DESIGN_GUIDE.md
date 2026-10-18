# REGOLITH — Design Guide

*How it looks, how it moves, how it is allowed to be built. This is the contract the generator enforces.*

Last updated: 2026-10-17 · See also [KICKOFF.md](KICKOFF.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 1. Visual identity in one paragraph

A NASA brochure from a kinder future, drawn by someone who loves toys. Hard-science silhouettes (inflatable habs, regolith-printed shells, trusses, radiators, dishes) rendered **chunky, rounded and friendly**. Physically based shading, but with a palette turned up, shadows lifted and warm, and detail concentrated where it reads: ribs, flanges, hatches, stencils. Everything is a little thicker than real life. Nothing is thin, sharp, noisy or grimy.

Reference moods (not to copy, to calibrate): Tiny Glade's softness and generosity · the chunky proportions of 1970s space-station concept art · Alto's Odyssey skies · the clean decals of Kerbal parts · Moebius' colour confidence without his line work.

## 2. Shape language

Rules the generators follow. Deviations need a reason written in the part's source.

| Rule | Value / guidance |
|------|------------------|
| World unit | 1 unit = 1 metre. Grid cell = 1 m. Part footprints snap to the grid; heights are free. |
| Hab radius | 2.0 m (S) and 3.0 m (M). Only two radii of pressurized hull exist. Domes are 3, 4.5, 6, 8 m. |
| Bevel | **One bevel size: 6 cm.** Every hard edge on every part. This single rule does more for consistency than anything else. |
| Flange / rib | Thickness 10% of hull radius, protrudes 10% of hull radius. Ribs every 2 m along a hab. End ribs are 1.5x thick. |
| Thinness floor | Nothing thinner than 8 cm. Handrails 8 cm, cables 10 cm on 20 cm pylons, truss members 12 cm. |
| Rounding | Capsule ends on cylinders, chamfered box corners, fillets on hatches. Dome bases have a 30 cm toroidal collar. |
| Detail density | Large: silhouette. Medium: ribs, hatches, panels, legs. Small: stencils, handrails, lights, bolts. Each part has at most 3 small-detail kinds. |
| Proportions | Crew are 1.8 m tall but with 1.3x helmet and hands. Rovers are 1.2x their real-world width. Everything is slightly toy-scaled against terrain. |
| Symmetry | Parts are symmetric about their axis unless a port or ladder breaks it. Decorators are placed on fixed sides (ladders downhill, stencils on the sun-facing side at noon). |

## 3. Colour

The palette is a closed set. New colours are added here first, with a role.

| Role | Hex | Notes |
|------|-----|-------|
| Regolith base | `#B5582F` | Mid ochre. Vertex-tinted ±12% by height and noise. |
| Regolith dark | `#7A3A1E` | Crater bowls, shadows under modules. |
| Regolith light | `#D98C5A` | Crater rims, dune crests, worn paths. |
| Rock base | `#6E4A3C` | Ambient rocks and boulders: basalt-tinted regolith. Per instance, tinted between rock dark and rock light. |
| Rock dark | `#4D3329` | Darkest rocks. |
| Rock light | `#94705C` | Lightest rocks; never lighter than the regolith around them. |
| Hull white | `#E8E4DC` | Warm off-white. All pressurized skins. |
| Hull shaded | `#CFC8BB` | Underside tint baked into vertex colour on habs. |
| Underside shade | `#9A9088` (multiplier) | Vertex tint on down-facing surfaces and the lowest 0.8 m of any part (`tintUnderside`). Multiplies the material colour; never a paint colour. |
| Dust tint | `#D9B38C` (multiplier) | Vertex tint on the lowest 1.4 m of a part, thickest to windward (`tintDust`, wind from 215°). Not applied to glass. |
| Accent orange | `#FF6A2A` | One stripe per module, hatch rings, rover body, flags. The brand colour. |
| Graphite | `#2B2F36` | Ribs, flanges, trusses, legs, cables, rubber. Never pure black. |
| Aluminium | `#B9BCC2` | Tanks, radiator backs, dish. Metal 1.0. |
| Glass teal | `#7FE3D6` | Domes, windows, visors. Day colour. |
| Window warm | `#FFD9A0` | Emissive for glass at night. |
| Warning yellow | `#F2C230` | Hazard chevrons at airlocks and pad edge. Used sparingly. |
| Solar blue | `#1E3550` | Panel face, with `#4A79B8` cell lines. |
| Plant green | `#5FBF6A` | Greenhouse interiors only. Nothing else on Mars is green. |
| UI ink | `#E8E4DC` on `rgba(20,18,24,.62)` | Panels are dark glass on the warm scene. |

Colour rules: at most **three hues per part** (white, graphite, one accent). Green is a reward colour. Blue belongs to the sky at dusk and to solar faces. Yellow means "a door or an edge".

## 4. Materials (PBR)

One library in `src/render/materials.ts`. Parts reference entries by name; they never construct materials.

| Material | Base colour | Roughness | Metalness | Extras |
|----------|-------------|-----------|-----------|--------|
| `regolith` | regolith base | 0.95 | 0 | vertex colours; macro normal from heightfield; micro detail normal tiling 2 m; dust tint mask. |
| `rock` | white (colour per instance from the rock trio) | 0.95 | 0 | instanced; underside shade from vertex colour; shadows only from rocks over 0.6 m. |
| `hull` | hull white | 0.55 | 0 | panel-seam normal map from procedural trim sheet; AO baked into vertex colour on undersides; dust mask in vertex alpha. |
| `accent` | accent orange | 0.50 | 0 | same seams as hull. |
| `graphite` | graphite | 0.70 | 0.2 | subtle anisotropy not needed; keep flat. |
| `aluminium` | aluminium | 0.35 | 1.0 | env map from the sky; the only "shiny" material. |
| `glass` | glass teal | 0.15 | 0 | opacity 0.55 day; emissive `window warm` ramps 0 → 1.6 across dusk. No transmission (cost). |
| `solar` | solar blue | 0.25 | 0.3 | cell-line emissive 0 (day), tiny specular glint. |
| `light` | white | 0.3 | 0 | emissive driven per instance (beacons, ground lights). |
| `plant` | plant green | 0.8 | 0 | subsurface fake via wrapped diffuse in a small shader patch. |

Until the sky environment map lands (M2), no part uses `aluminium`: a fully metallic surface renders black without an environment to reflect. Parts use `hull` and `graphite` instead.

Texture policy: **no texture files in the repo.** Trim sheets (seams, stencils, hazard stripes, cell lines) are rendered at startup to canvas/offscreen textures from deterministic code. Everything stays coherent because it comes from the same pixel-space rules (e.g., seam width always 1.5 cm equivalent).

## 5. Lighting and time of day

A sol is scrubbed 0 → 24 h. Default start 15:30 (long warm shadows).

| Hour | Sun | Sky zenith → horizon | Ambient | Mood |
|------|-----|-----------------------|---------|------|
| 06:00 | rising, `#FFB070`, int 0.8 | `#5A3F55` → `#6F8FC9` (blue halo) | cool | Dawn: long blue shadows, frost on shaded hull. |
| 09:00 | `#FFE6C8`, int 2.4 | `#B98C62` → `#E2BC92` | warm | Working morning. |
| 12:00 | `#FFF1DC`, int 2.8 | `#C99A6B` → `#E8C39A` | butterscotch | Noon: short shadows, brightest. |
| 15:30 | `#FFEBD0`, int 2.6 | as noon | warm | **Default.** |
| 18:30 | setting, `#FFB070` | `#5A3F55` → `#6F8FC9` | cool | The blue sunset. Windows start to warm. |
| 21:00 | none | `#0B0D16` → `#1A1B2A` | 0.25 | Night: lights, beacons, Phobos, stars. |

**Sun path (as built in M2).** The sun is above the horizon for 14 of the 24 hours: 11° up at 06:00, 68° at noon, 5° up at 18:30, gone by 21:00. Twilight colours (blue halo, cool ambient) follow the sun's altitude, not the clock. The light never comes in lower than about 9° (the sun *disc* still sets), so low sun lights the ground with long shadows instead of grazing black. Exposure rises a little at twilight and more at night so the base stays readable. The terrain fades into the horizon colour over its outer 20 m, so the edge of the world is haze, not a cliff.

Rules:

- **Shadows are lifted and warm.** Hemisphere ambient with a ground colour of warm regolith bounce. Never a black shadow.
- **One directional light** with a tight shadow frustum that follows the camera target. 2048 shadow map, PCF soft, `normalBias 0.03`. Cascades only if the map grows beyond 160 m.
- **Sky is a gradient dome shader**, two colours plus a sun disc with a blue aureole at low altitude. The same gradient is PMREM-ed once per hour step for environment reflections (aluminium and glass only need it).
- **Height fog** in sky-horizon colour, starting beyond the build area so the map edge dissolves.
- **Night** is not dark. Ambient 0.25, plus emissives and a cool fill from the "sky glow". The base should be readable at 21:00 without squinting.
- **Rim light** fake: a weak back directional light opposite the sun, no shadows, sky colour, intensity 0.3. Separates white hull from pale sky.

## 6. Camera

| Property | Value |
|----------|-------|
| Projection | Perspective, FOV 22°. Low FOV gives the isometric reading without the flatness of orthographic. |
| Pitch | Fixed 38° in build mode. Photo mode unlocks 10° to 80°. |
| Yaw | Free while dragging, **snaps to 8 stops (45°)** on release with critically damped easing (~250 ms). Q/E step. |
| Distance | 12 m to 90 m, exponential wheel zoom. |
| Pan | Right drag or middle drag; WASD; edge pan off by default. |
| Focus | Double click a part: camera glides target to it. |
| Near/far | 0.5 / 400. |

The camera never clips through parts: a probe moves the camera in if terrain or a dome blocks the target.

## 7. Post-processing

In order: SSAO/GTAO (half res, radius 0.8 m, strong in creases, feathered) → bloom (threshold 1.0, only emissives cross it) → tone map (ACES filmic, exposure 1.0) → colour grade (slight saturation +10%, lifted blacks, warm highlights) → FXAA or MSAA 4x if the budget allows. **No outlines, no vignette, no chromatic aberration, no film grain.** Soft is good; dirty is not.

## 8. The part alphabet

The base is written in letters. Each letter is a parametric generator with ports and decorator hooks. Letters combine under a grammar enforced every frame by the solver (see [ARCHITECTURE.md §4](ARCHITECTURE.md#4-grammar-and-solver)).

### 8.1 Port types

| Port | Mates with | Visual |
|------|-----------|--------|
| `PRESS` | `PRESS` (via tube or direct dock) | 1.6 m hatch ring in graphite with an orange collar; halo when hovered. |
| `STRUCT` | ground, `PAD`, or a `STRUCT` host | Flat foot; generates legs to terrain. |
| `POWER` | `POWER` (via auto cable) | Small junction box with a green dot. |
| `EXT` | nothing (a door to outside) | Hazard chevrons on the ground, ramp or stair. |

### 8.2 Letters

| L | Part | Parameters | Ports | Auto decorators |
|---|------|-----------|-------|-----------------|
| **H** | Hab (horizontal cylinder, inflatable) | length 4–16 m step 2, radius S/M, windows on/off | `PRESS` ×2 ends, `PRESS` side every 4 m (alternating sides), `STRUCT` ×2 bottom | legs to ground, ladder downhill, one accent stripe, stencil number, dust on windward quarter, handrail along top if a `STRUCT` host is above |
| **V** | Vertical hab (tower) | floors 2–5, radius M | `PRESS` ×4 at ground floor, `PRESS` ×2 per upper floor, `STRUCT` base | external stair spiral, beacon on top if tallest |
| **N** | Node (junction) | size S/M/L, shape hex/sphere | `PRESS` ×6 (hex) or ×4 + top | docking lights per used port, blanking plate per unused port |
| **D** | Dome | radius 3/4.5/6/8, kind opaque / greenhouse / observatory | `PRESS` ×4 at base collar, `STRUCT` ring | greenhouse: plants that grow, warm glow; observatory: telescope slit that opens at night; opaque: regolith-printed shell with printer texture |
| **T** | Tube (corridor) | *derived*: from two `PRESS` ports; max span 24 m | — | flanges every 2 m, bend collars at kinks, support legs every 6 m, window strip if both ends have windows |
| **A** | Airlock | size S/M | `PRESS` in, `EXT` out | ramp or 3-step stair to terrain, hazard chevrons, light that cycles green/red, footprint path origin |
| **G** | Garage | bays 1–3 | `EXT` ×bays (roller doors), `PRESS` back | one rover per bay, tyre tracks out of the door, tool wall visible through the open door |
| **L** | Landing pad | radius 8/12 | — | edge lights, hazard ring, scorch mark that grows per landing, windsock, blast berm |
| **S** | Solar array | rows 1–4 × cols 2–12, tracking on/off | `POWER` at the end post | sun tracking, parked at night, cable to nearest `POWER`, dust that a drone cleans |
| **E** | Power core (compact reactor) | size S/M | `POWER` ×3, `STRUCT` | radiator fins that glow at night, keep-out hazard ring, hum when zoomed close |
| **K** | Tank | radius 1.5/2.5, length 3–8, horizontal/vertical | `STRUCT` | cradle legs, frost band at the bottom third, stencil (O2 / H2O / CH4), pipe to nearest hab |
| **R** | Radiator | panels 2–8, deployed angle | `STRUCT` | slow deploy animation on place, faint red emissive at night |
| **M** | Mast | height 6/12/20, head: dish / whip / relay | `STRUCT`, `POWER` | guy wires on 20 m, dish tracks a satellite, red beacon, drone inspection target |
| **B** | Berm (regolith wall) | spline, height 1–3 | — | drawn with the terrain brush; soft ridge with a crest path |
| **X** | Light pole | height 4 | `POWER` | warm pool of light at night; auto-placed along paths if the player enables "street lights" |
| **P** | Pad (foundation slab) | w × d 2–12 m | `STRUCT` top (anything placed on it inherits the pad as ground) | levelled regolith apron, chamfered edge, drain grooves |
| **C** | Launcher (electromagnetic mass driver) | length 8–20 m step 4, elevation 10/20/30° | `STRUCT` ×4 under the sled, `POWER` at the breech | coil rings along the barrel, hazard band at the muzzle, trestle posts; fires a cargo capsule on a lander-less schedule (M5). Not a weapon: the fantasy is a kinder future (KICKOFF). |

**M1 implementation notes (static, no sim yet).** P is a raised deck: a graphite slab on short pylons rather than a levelled apron (terrain flattening needs terrain edits flowing back into the mesh, M4). Parts whose footprint lands on a slab stand on its top; slabs only resolve overlap against other slabs. `POWER` ports exist but nothing connects to them yet. Beacons, dish tracking, hazard rings and guy wires arrive with the life layer.

Alphabet is **frozen per milestone**; see PLAN.md for which letters ship when.

### 8.3 Grammar (composition rules)

1. `PRESS` ports mate only with `PRESS`. If two are within 0.5 m and aligned within 15°, they **dock directly** (one collar). Otherwise, if the player drags between them, a **tube** is generated.
2. A tube is a polyline on the grid of at most 3 segments with 45° kinks. Spans over 24 m or with more than 2 kinks auto-insert a **node** at the best grid point. Tubes never pass through hulls; if they must, a node is inserted to route around.
3. Every part with a `STRUCT` port must be grounded: on terrain (legs generated to the sampled height), on a pad, or on a host part. Nothing floats, ever.
4. Pressurized hulls **never intersect**. When the player moves a part into another, the solver resolves by: (a) snapping to the nearest non-intersecting grid pose, or (b) if a `PRESS` port is in range, docking. The ghost preview shows the resolved pose before commit, so the player is never surprised.
5. `POWER` ports connect automatically to the nearest reachable power network via ground cables routed on the grid around footprints. Unpowered habs still work (P1), they just show no cable and a dim porch light. Power is purely cosmetic.
6. `EXT` ports spawn a path origin. Paths grow between origins proportional to crew traffic. Paths avoid hull footprints and climb berms via cut steps.
7. Decorators are **derived state**. They are recomputed from the structure, never stored, so they can never be stale or orphaned.
8. The tallest part owns the beacon. Exactly one beacon per base.

### 8.4 Invariants ("always / never")

- Always: watertight geometry, outward normals, consistent winding, UVs on the trim sheet, a 6 cm bevel on every hard edge.
- Always: parts stand on something. Always: a stencil number per pressurized part, unique and stable across edits.
- Never: a visible coplanar overlap. Decals sit 4 mm proud; decal materials use `polygonOffset`.
- Never: a hull face closer than 10 cm to another hull face without a collar.
- Never: a tube with a free end. Never: a port halo on a port that cannot be used.

## 9. Consistency and glitch-free rules (technical)

| Problem | Rule |
|---------|------|
| Z-fighting | No coplanar faces. Stripes, decals and stencils are offset 4–12 mm along the normal and use `polygonOffset(-1,-1)`. Terrain under pads is cut (vertices pulled down 5 cm), not covered. |
| Shadow acne / peter-panning | `normalBias 0.03`, `bias -0.0005`, shadow frustum fitted to the visible build area, all casters double-sided for the shadow pass only. Re-verify at 06:00 and 18:30 every milestone (low sun is the acid test). |
| Popping | LOD transitions via screen-door dither over 200 ms. Decorators fade in with scale 0 → 1 over 150 ms. Tubes extend, never appear. |
| Terrain conformity | Legs are generated per `STRUCT` port against the bilinear height, with a 5 cm footpad sunk into terrain. Pads flatten terrain under them with a 1 m blended skirt. |
| Normal seams | Lathe and sweep generators share one profile library with explicit hard/soft edge flags; normals are computed by the generator, never by `computeVertexNormals` on merged geometry. |
| Scale drift | Every generator takes metres and the design constants from a single `design-constants.ts` (bevel, flange ratio, rib spacing). No magic numbers in part files. |
| Determinism | Every generator is a pure function of (params, seed). Geometry cache keyed by hash. Same base, same bytes. |
| Colour drift | Materials only from the library. Vertex tints only through two helpers: `tintUnderside` and `tintDust`. |

## 10. Animation principles

- **Everything inflates.** Default appearance for any new part is scale from 0.1 with a 0.6 s ease-out-back (overshoot 1.06). Removal is the reverse, 0.35 s, with a small dust puff at the footprint.
- **Mechanical things move like mechanical things.** Doors, panels, dishes use ease-in-out with a tiny settle; durations 0.8–2.5 s. Tracking arrays move continuously, not in steps.
- **Living things are a little bouncy.** Crew walk cycle 1.6 Hz with 3 cm bob and helmet lag. Rovers have suspension: 2° body roll on turns.
- **Nothing twitches.** Idle loops are long (10–30 s) and offset per instance by hash so no two things sync.
- **Edits feel physical.** Drag-to-grow ticks per segment with a 1-frame scale pulse on the new rib. Docking has a 60 ms "clunk" scale pulse on both collars.
- **Time of day is continuous.** Scrubbing the clock interpolates everything; there are no discrete light switches. Windows ramp over 40 minutes of sol time.
- **Budget:** 1,000 animated instances at once (panels, lights, crew). All idle animation is done in vertex shaders or instance attributes; the CPU only moves agents (≤ 60) and the camera.

## 11. Simulation flavour (life layer) — rules of thumb

- Crew count = floor(pressurized volume / 60 m³), max 24. Each crewmember has a home hab and a 3-stop errand list rebuilt every sol-hour.
- Crew path only through the `PRESS` graph; they exit only through airlocks and garages. Outside, they walk on worn paths and avoid the pad when a lander is due.
- Rovers exist per garage bay, make one trip every 2–4 minutes to the pad, a tank or a random crater rim, and park facing out.
- Drones: one per mast, one per 20 solar panels. They inspect, clean dust, and hover 1.5 m off surfaces.
- The lander arrives every 6 minutes if a pad exists, visible from 300 m out, 25 s descent, 90 s on the ground, 15 s ascent.
- Dust devils spawn off-map every 3–7 minutes, cross at 2 m/s, never cross the pad while the lander is down.

## 12. Editor UX

- **Tray** along the bottom with the alphabet as monochrome glyph icons; hover shows name and parameters. **Rail** on the left: select, move, terrain raise/lower/flatten/smooth, path paint, delete, photo.
- **Place:** click the ground. The part appears in ghost form following the cursor with its resolved pose (legs, snaps). Scroll rotates in 45° steps, shift-scroll changes the primary parameter.
- **Grow:** selected parts show handles at their variable ends. Drag changes the parameter. Handles are 24 px orange discs with a 3 px white ring.
- **Connect:** drag from a port halo to another. Ghost tube previews, including inserted nodes.
- **Terrain brushes:** 2–12 m radius, soft falloff, dust puff feedback; parts above re-ground instantly.
- **Undo/redo:** every command, including terrain strokes, coalesced per drag.
- **Cursor states:** default, place-valid (orange ring), place-resolved (orange ring with a tiny arrow pointing where it will snap), grab, rotate.
- No modal dialogs, ever. Confirmations are inline and undoable.

Typography: a geometric sans (Space Grotesk or Inter) at 11–13 px for HUD, uppercase tracking for titles. UI never covers the centre 60% of the screen.

## 13. Sound direction (brief)

Soft, airy, mechanical. Inflating hab: a cloth puff with a low thump. Docking: a padded clunk. Tubes: a telescoping "zip". Arrays tracking: nothing unless zoomed close (a faint servo). Night: a low wind bed. Lander: distant roar that rises, then a filtered thud. UI: wooden ticks. Music: sparse, warm synth pads that change with the hour; never a loop shorter than 4 minutes.

## 14. Photo mode

Hide UI, unlock pitch, free yaw, choose hour with a dial, optional depth of field with a focus pick, optional "postcard" frame. Export 1x, 2x, 4x PNG. The share link is the same as a save (URL-encoded base + hour + camera).
