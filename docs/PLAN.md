# REGOLITH — Overview Plan

*Milestones with exit criteria, the first concrete tasks, and the backlog.*

Last updated: 2026-10-17 · See also [KICKOFF.md](KICKOFF.md) · [DESIGN_GUIDE.md](DESIGN_GUIDE.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 0. How to read this

Milestones are ordered by **risk retired**, not by feature count. Each has a one-line goal, deliverables, and an exit gate that is a thing you can do or see. No dates: the team is small and agent-assisted; the gate is the schedule. Letters refer to the part alphabet in the design guide §8.

```
 M0 Bootstrap ─► M1 Alphabet I ─► M2 The Look ─► M2.5 Workshop ─► M3 Life I ─► M4 Terrain & Decor ─► M5 Alphabet II & Life II ─► M6 Ship v1
   (done-ish)      snapping          art gate      tweaks/builder     crew/sun      brushes/paths         rovers/lander/pad        photo/share

M2.5 was inserted before M3 at the user's request (2026-10-17): richer hand tools and a builder that helps come before anything starts walking around. It is numbered 2.5 so references to M3–M6 elsewhere stay valid.
```

## M0 — Bootstrap  ✅ mostly done (this commit)

**Goal:** a repo anyone can clone, run, and see Mars.

Delivered: Vite + TS + three.js; seeded RNG and noise; terrain heightfield with craters; sky/time-of-day model; snapping camera rig; material library; first procedural hab (lathe profile with ribs and stripe); one unit test; docs.

Known scaffold issues (see `docs/shots/m0/`): dusk (18:00) and night (21:00) are far darker than the design guide wants, terrain reads near-black once the sun is low, and there is faint shadow speckling on hab end caps where the rib profile meets the hull. All three are M2 work (sky dome, lifted ambient, emissives, shadow fitter), not M0 blockers.

Remaining for M0:
- [x] ESLint with per-folder `no-restricted-imports` enforcing the layer rules.
- [x] Prettier config.
- [x] GitHub Actions: typecheck + lint + format + test + build on push (`.github/workflows/ci.yml`).
- [x] `src/geometry/design-constants.ts` and move the bevel/flange numbers there.

**Exit:** `npm run dev` shows terrain, three habs, shadows; `[`/`]` scrub the sol; CI green.

## M1 — Alphabet I: place, grow, connect

**Goal:** retire the biggest technical risk, the grammar and solver, with a minimal alphabet.

Letters: **H** (hab), **N** (node), **T** (tube), **D** (dome, opaque only), **P** (pad).

Deliverables:
- `BaseDocument` + command store with undo/redo.
- `PartDefinition` interface, ports, footprints; the five letters as pure definitions.
- Solver stages: place, overlap, dock, tubes, ground, diagnose. Spatial hash.
- Geometry pipeline: profile library, lathe + sweep builders, trim UVs, `GeometryBundle`, validation. Worker optional here, required by M2.
- `SceneSync` diffing the resolved base into the scene.
- Editor: Select, Place, Grow (handles), Connect (drag port to port), Delete. Ghost preview using the real solver.
- Property tests: nothing floats, hulls never intersect, tubes never cross hulls, all bundles valid.

**Pulled forward at the user's request (2026-10-17):** more module variety in M1 instead of waiting for M5 — **V** (tower), **P** (slab, as a raised deck), **M** (radio mast), **E** (power plant) and a new letter **C** (electromagnetic launcher, DESIGN_GUIDE §8.2). Static geometry, ports and grounding only; their animation and power links stay in M3/M5. Letters **D**, **L** and the rest remain where they were.

**Exit:** build a 30-part base in under 3 minutes with no visible glitch; drag a hab through another and watch it resolve; connect two habs 20 m apart and get a routed tube with a node; undo everything.

**Status: done, with two honest deviations (2026-10-17).**
- [x] Document, commands, undo; part definitions and the alphabet H N D V P M E C; solver place → overlap → ground → dock → tubes → diagnose; `SceneSync`; Select, Place, Grow, Connect, Delete; parameter picker; ghost with snap arrow.
- [x] Property tests: nothing floats, hulls never overlap, tubes never cross hulls (diagnose on random mixed bases with links), all bundles valid.
- [x] Exit criteria, checked headless in `src/editor/m1-exit.test.ts` and by real mouse and key input in the browser (30 parts placed by hotkey and click, a hab dragged over another, two habs connected by dragging halo to halo, Ctrl+Z; shots `build30`, `connect`, `picker`, `dome`, `snap-arrow` in `docs/shots/m1/`).
- **Deviation — the node.** Two habs ~20 m apart with a clear way get **one plain tube and no node**: the span limit is 24 m (`TUBE_MAX_SPAN`), and a node appears from about 26 m or when the route must bend around a part. Both are tested (20 m with a hab in the way → a node on the detour; 26 m clear → a node). The constants were not tuned to fit the sentence.
- **Deviation — performance.** The 2 ms solve target for 200 parts is **not met** (~16 ms; see `docs/PERF.md`). Router memoisation, a walled-in-pocket shortcut and a throttled ghost help; incremental solving is the next step and is scheduled with M2's worker.
- **Moved to M2:** trim-sheet UVs (they only matter with the procedural trim sheet) and the geometry worker (needed by LOD). The brief said "worker optional here, required by M2".
- **Gizmos** on the selected part for tweaking parameters interactively in the scene (drag a handle for length, radius, floors, mast height): done in M2.5 task 2, as a generic handle set declared by each part.
- Not built because it never belonged to M1: letter **L** (landing pad, M5).

## M2 — The Look (art gate)

**Goal:** screenshots that make someone say "oh". This is a hard gate; nothing from M3 starts until it passes.

Deliverables:
- Procedural trim sheet (seams, stencils, hazard, cell lines) rendered to texture at startup.
- Hull vertex tints: underside darkening, dust mask (windward from seed).
- Sky dome shader with sun disc and blue aureole; PMREM per half hour; height fog.
- Rim light, lifted warm ambient, shadow frustum fitter; acid test at 06:00 and 18:30.
- Post chain: AO, bloom, ACES, grade. Quality presets.
- LOD with dither fade for H/N/T/D.
- Inflate/deflate on place/delete; telescoping tubes; docking clunk.
- Windows on H; glass with night emissive.
- Geometry worker.
- Ambient rocks and boulders, scatter stage S1 ([SCATTER.md](SCATTER.md)): keep-out solver stage, `world/scatter.ts`, instanced rocks.

**Exit:** a 4-angle × 4-hour screenshot sheet of the golden base reviewed against the design guide; 60 fps on the reference iGPU laptop; zero z-fighting or acne in the sheet.

**Status (M2, waiting for review):** the sheet is in `docs/shots/m2/final/` and the exit is **not ticked**: it needs your eyes, and the 60 fps line needs the reference laptop.

Done: sky dome, sun path, fog, rim light, shadow fitter and per-half-hour sky environment; post chain with presets; windows with night glow; baked vertex tints (underside, contact, windward dust); scatter S1 (rocks); inflate / deflate, telescoping tubes, docking clunk; a z-fight and acne pass on close-ups at 06:00 and 18:30 (one real fault found and fixed: the tower's top glass band shared a cylinder with the accent stripe).

Not done, with the reason (see `docs/PERF.md`):
- **Procedural trim sheet and trim UVs.** A seam texture needs metric UVs on every lathe, because a hab and a dome do not share an arc length per texture repeat. The seams are carried by ribs for now. Decide whether the sheet matters for the gate before spending the time.
- **LOD with dither fade.** There are no second geometry levels yet and the need only shows at about 200 parts (about 0.75 M triangles by extrapolation), which cannot be measured here.
- **Geometry worker.** The slowest uncached bundle is under 5 ms and bundles are cached, so there is no measured gain.
- **Incremental solving.** Still owed from M1; moved to M3, with the cached-equals-fresh property test as its condition.
- **Scatter fade on delete** is not needed: rocks only fade in. The per-instance fade-in is done.

## M2.5 — Workshop: tweaks, suggestions, character

**Goal:** building feels good and every base looks like *someone's* base. No crew, no airlock cycles yet.

Advice folded in from a Fable review (2026-10-17). Open question for the user: "flip" is read as **mirroring** a non-symmetric part (turning by 90° already exists: R). Say if you meant something else.

Tasks, in order (risk first; each is a commit with tests, 12:00 and 18:30 shots where visible):

0. **Render budget.** Done: render on demand, shadow map only when it changes, no double MSAA, pixel ratio cap, F2 quality, `?stress=200`, measured draw calls (`docs/PERF.md`). Done: one `BatchedMesh` per material for the whole base, legs included (`render/batch.ts`); 200 parts went from about 3,300 draw calls to 18–46 (`docs/PERF.md`), and per-instance attributes for task 5 can ride on the same batches. Done: a frame counter on the debug hook (`__regolith.frames()`), and `render/quality-governor.ts`, which steps the preset down (high, medium, low; never back up) when the median gap between back-to-back frames stays above 22 ms over 45 frames, unless `?quality=` or F2 chose one. Idle is one frame every 5 s (the heartbeat) and the loop also wakes on tab visibility and focus.
1. **Flip (mirror). Done.** `Pose.mirror?: boolean`, `PartPose.mirror?`: mirror across the part's local Z before yaw. Footprints are symmetric, so cells and gaps are untouched. Ports negate their local z and normal.z and keep their ids, so links survive a flip and the tube re-routes. Geometry is not mirrored: SceneSync sets `body.scale.z = -1` (three flips winding), so recipe hashes and caches are shared. Decorators are placed in world space so stencils never read mirrored. Key `F` in Select and Place. Optional field, so no document version bump (rule: bump only when an old reader would misread). Tests: mirrored ports are the mirror of the originals; cells identical; every diagnose rule holds on random bases with random flips. Hazard: every `rotateY(-yaw)` call site must learn about the mirror (grep them).
2. **Generic gizmos from the schema.** Done. `PartDefinition.handles?(params): HandleSpec[]` with `{ id, param, at, axis, perUnit, anchor }` in the part's local frame (`grammar/handles.ts`); a pure `applyHandleDelta` turns a drag distance into the next schema value and the shift that keeps the anchor (the opposite end) fixed; `editor/handle-drag.ts` adds the solver block ("if the solver would move it, do not apply"); `rayClosestOnLine` reads the pointer as a distance along the grip axis, so one drag works for a hab end, a tower top and a slab edge. Replaces the H-only grow handles; one undo step per drag. Length, radius, width, depth, floors and mast height are handles; toggles, the mast head and the launcher elevation stay in the picker. Tests: for every letter and handle, one step up or down lands on the next schema value, the anchor stays put and the grip travels `perUnit` as promised; a hab end grown at every yaw and flipped keeps its far end; growth is blocked by a neighbour.
3. **Auto-suggest connections.** Done. Derived, never stored. `grammar/suggest.ts: suggestLinks(doc, base, part, world) → Suggestion[]` (`{ link, target, length, kinks, nodes, joinsComponents, anchor, tubes, parts }`): free tube-capable PRESS ports on other parts within the span limit that roughly face each other, nearest pairing per target part, each verified by a trial solve (the real router: no `link-skipped`, `tube-unroutable` or `tube-too-long`), detours (longer than 1.7 × the straight distance + 5 m) dropped, and a second path between parts that are already joined only if it needs no node. Ranked joining-separate-groups first, then length + 3 m per bend + 6 m per node, at most 3, one per target part. The trial solve already holds the tubes and nodes, so the preview needs no second solve. `editor/ui/suggestions.ts` shows them as translucent ghost tubes with a "Connect to H-002" pill for the selected or just-placed part, once the current event has finished and never while a part is dragged or in the Connect and Delete tools; accepting is `cmd.addLink`, so P1 holds and the next request offers what is left. Tests: a hab pair is offered end to end; used ports are not; a separate group beats a second path; nothing out of reach; and over random bases on flat and rough ground every suggestion, once accepted, adds no broken link, no invariant violation and uses its ports. Cost: a trial solve per candidate, about 5–10 ms on a normal base and 50–100 ms at 200 parts, hence deferred and capped (six targets, stop at three results).
4. **Ground around contact.** Done. Two derived layers, nothing stored. (a) Heights, done for slabs: `world/flatten.ts: buildFlatField(raw, shapes, grid)` levels the terrain under each slab to the mean natural height under its footprint and eases back to the natural ground over a 2 m skirt. The field lives on the 1 m terrain lattice and reads with the same bilinear rule as the natural terrain, so the mesh and every `heightAt` agree; nodes within √2 m of a footprint take the target exactly (flat under the slab and a fringe beyond), further out they blend `(raw + Σ K·target)/(1 + Σ K)` with `K = ((S−d)/(d·S))²`, which is order-free and continuous between close slabs. It runs as the `flatten` stage after `overlap` and before `ground`, so pylons, docks and tubes see the levelled ground (`ResolvedBase.terrain`); the part being dragged and the ghost are skipped and settle on commit. `render/terrain-mesh.ts: levelTerrainMesh` re-seats the vertices when the field's key changes (vertex colours stay on the natural height), picking reads `resolved.terrain`, and rocks the skirt reaches resettle in `cullScatter`. Parts on legs keep the natural terrain, as the DESIGN_GUIDE says, and get (b) instead. (b) Wear: `world/wear.ts: buildWear(half, footprints, footpads)` rasterises a 2-channel byte map at 2 texels per metre (192 × 192): channel R is a disturbed-regolith ring (2.2 m past every footprint, 0.9 m past each footpad, smoothstep, strongest wins), channel G is reserved for M4's paths. `grammar/solver/wear.ts: wearOf(base, half)` gathers the sources; `render/shader-patches.ts` uploads the bytes as an RG8 linear-filtered texture and the one merged regolith patch mixes `regolithDark` toward 0.9 of the ring by world XZ, in the colour pass only so shadow and GTAO passes never see it. It is rebuilt when its key changes, including while a part is dragged. No new colours. Tests: terrain under a slab flat to 1 cm, skirt monotone, continuous between two close slabs, order independent, the moving slab and legged parts skipped, pylons on the levelled ground, mesh vertices on the field, rocks resettle. Wear: empty base is all zero, ring monotone and zero past its reach, footpads, same bytes for the same input.
5. **Individuality.** Done for habs: hull tint per instance (`BatchedMesh.setColorAt`, palette segment only), a stripe variant, and the serial stencil (`grammar/decals.ts` makes a `Decal` of a small `stencil` recipe, shared by text, plus a yaw-only world matrix; `SceneSync` draws it as extra graphite-batch pieces in the legs group, so no new draw call, none on the ghost path). Not yet: stencils on towers, tint on the other letters' extras. Fable's order and cuts: stencil as a separate small op drawn as extra graphite-batch pieces, never in the hab recipe (200 unique bundles would cost about 40 MB); chevrons, patches, dust amount and pad numbers cut. Everything derived from `hashInts(serial, seedHash, slot)` in a solver decorator stage, nothing stored. Three mechanisms by resolution: per-instance attributes (tint shift, dust amount) read by one shader patch (needs task 0's batching); curved decals as thin lathe strips like the accent stripe (hazard chevron bands, patches); flat decals (stencil serial number, hatch marks) as one `InstancedMesh` per decorator kind, 4 mm proud with `polygonOffset`, glyphs no wider than 0.25 m so they do not sag off a hull. The glyph atlas is canvas-drawn at startup from a hand-coded 5×7 rectangle font, never `fillText` (OS rasterisation breaks "same input, same bytes"). Needs DESIGN_GUIDE rows for each decal and any new colour first. Test: two same-param habs differ, and hashes are stable across reloads.

**Cut for now:** scuffs and wheel tracks (M5 with rovers, per SCATTER.md), flags, per-instance geometry, deforming terrain under legged parts (the wear ring only), dynamic resolution, a depth pre-pass, VSM shadows.

**Exit:** ten seconds idle renders at most the 5 s heartbeat (2 frames, measured 2) and a drag renders every display frame (Playwright frame counter); 200 parts under 100 draw calls; every letter is adjustable by handles with one undo step per drag; `F` moves a hab's side hatch to the other flank and its tube re-routes; two habs placed 10 m apart offer a suggestion within a frame of commit; terrain is flat under a slab; two same-param habs differ visibly; 12:00 and 18:30 shots in `docs/shots/m2.5/`.

## M3 — Life I: crew, sun, lights

**Started 2026-10-18**, after M2.5 (the user asked for it; the M2.5 exit box is for the user to tick).

**Goal:** the base moves on its own.

Letters added: **A** (airlock), **S** (solar array), **X** (light pole).

Deliverables:
- Sim clock, 10 Hz tick, interpolation.
- `PressGraph` from the resolved base; crew agents walk it (visible through windows and tubes' window strips), exit via airlocks, idle outside on paths.
- Airlock cycle animation + light sequence.
- Solar tracking and night parking; instanced panels with per-instance phase.
- Night lights: windows, porch lights at airlocks, light poles, beacon on the tallest part.
- Power graph with auto cables on pylons.
- Crew count from volume; errand lists.

Tasks, in order (risk first; each a commit with tests, 12:00 and 18:30 shots where visible). Order and cuts from a Fable review (2026-10-18):

0. **Sim clock, render cadence, HUD.** Done. `sim/clock.ts` (`SolClock`: 1 real second = 1 sol-minute, pause, 1x/2x/4x, scrub, wall-clock driven so frames do not matter) and `sim/fixed-step.ts` (10 Hz ticks, `alpha` for interpolation, capped catch-up). The clock lives outside the document. Light and shadows follow `visualHour`, which changes once per sol-minute, so a running clock costs one redraw per sol-minute (measured 10 frames in 10 s; paused 2). Runs by default; `?hour=`, `?shot` and `?pause` freeze it for scripts. Keys: Space pause, `.` speed, `[ ]` scrub half an hour. HUD shows `hh:mm` and the state. The `sim/` layer is pure (no three).
1. **`graph` solver stage.** Done. `grammar/solver/graph.ts` builds `ResolvedBase.graph`: a node per part with a PRESS port (a floor-level point per port, 0.8 m below it, plus a centre, and the part's pressurised volume from `grammar/volume.ts`), an edge per dock or tube (its centreline lowered to the floor, with its walking length). Walking through a node is port → centre → port (`crossLength`); `graphComponents` groups nodes over the edges. Solver-made nodes are nodes like any other. `SolveOptions.lean` skips the stage for the ghost, handle drags and `suggest.ts` trial solves. Cost about 1 ms at 200 parts. Tests: empty and lean, floor level, edge ends are real ports, crossing symmetry, docked habs share a component, derived nodes keep a long tube in one piece, grouping equals the tube topology on random bases, same graph on a re-solve, volume and crew. Before the letters, because the agent-on-a-changing-graph risk is the biggest unknown.
2. **Crew** (`sim/agents/crew.ts`, `sim/nav.ts`): count `floor(volume / 60)` up to 24, homes by serial, 3-stop errands from `hashInts(seed, i, solHour)`, an agent is `(edge, s)`, never xyz, so a dragged part carries its crew. Rendered as pieces in the existing batches, no shadows. Tests: never off the graph, byte-identical replay, deleting a part re-homes without NaN.
3. **Window silhouettes**: a flat graphite figure slid along the hull at the window angle, shown while a crew member is in that bay. Tube strips deferred.
4. **Letters A, S, X, static** (airlock, solar array, light pole): parts, geometry, `solar` and `light` materials, DESIGN_GUIDE rows first for the solar colours.
5. **Airlock exit and cycle**: a loiter spot 4–8 m from the ramp foot, outdoor errands only 08:00–18:00 so everyone is home by 19:00, a 3-state cycle (seal, pump, open) with the lamp going red, amber, green. No flow field (M4).
6. **Night lights**: one `InstancedMesh` of lamp heads (porch, pole, airlock, beacon on the tallest part) with a shader patch so the instance colour drives emissive; window glow stays `setNightGlow`. Everything lights up (P1): H and A have no POWER port, so power is cables only and the DESIGN_GUIDE "dim porch light when unpowered" row is amended.
7. **Solar tracking and parking**: tilt from the sun direction on the sol-minute step, park when the sun is low, per-panel delay from `hashInts(serial, i)`; no shader patch, so shadows stay right. Measure the shadow pass at `?stress`.
8. **Power stage and cables**: union-find over POWER ports, nearest-network routing with `route.ts`, a `cable` op sampled every 2 m with a pylon each, cables mark `keepOut`, straight fallback.
9. **Exit shot and PERF row** at 19:00, idle frames still 2 per 10 s when paused.

Cut or deferred: tube window strips, per-hab "someone is home" dimming, sim-written wear (it inverts the layers; channel G stays for M4), street-light auto-placement (M6).

**Exit:** place three habs, a tube, an airlock and an array, scrub to 19:00, and watch crew come home as the lights come on and the panels park.

## M4 — Terrain & decorators

**Goal:** the ground participates.

Letters added: **B** (berm), **K** (tank).

Deliverables:
- Terrain brushes (raise, lower, flatten, smooth) as replayable strokes; chunked re-upload; parts re-ground live.
- Pads flatten terrain with skirts.
- Worn path field driven by crew traffic; rendered in the regolith shader.
- Dust accumulation on windward faces over time; drone cleaning for arrays (drone agent).
- Decorators: handrails, ladders, stencil serials, chevrons, pipe from tank to nearest hab.
- Dust devils (ambient), windsock.
- **Automatic terrain decoration, stage S2** (design in [SCATTER.md](SCATTER.md)): terrain-edit dirty regions, rock-formation clusters, ambient props, density slider and clear brush. Wheel-track ribbons follow with rovers in M5; stage S1 (rocks) lands in M2.

**Exit:** carve a crater rim berm around a cluster, watch paths form between airlocks over two sols, see dust gather on one side and get cleaned.

## M5 — Alphabet II & Life II

**Goal:** vehicles and events; the alphabet reaches v1 size.

Letters added: **G** (garage), **L** (landing pad), **M** (mast), **R** (radiator), **E** (power core), **V** (vertical hab), **D** greenhouse and observatory kinds.

Deliverables:
- Rover agents: garage ↔ pad/tank/crater trips with tracks; suspension.
- Lander event with approach, dust blast, scorch growth, crew disembark.
- Mast with dish tracking an orbital pass; drone inspection.
- Greenhouse plant growth; observatory slit at night.
- Radiator deploy animation and night glow; power core hazard ring.
- Satellite and Phobos in the night sky; occasional meteor.
- Sound pass (SFX bed per design guide §13; music optional).

**Exit:** the golden base runs for 10 minutes unattended and something interesting is always happening on screen.

## M6 — Ship v1 "Outpost"

**Goal:** people can play it and share it.

Deliverables:
- Photo mode: pitch unlock, hour dial, DOF, frame, PNG export 1x/2x/4x.
- Save: URL codec, IndexedDB autosave, recent list with thumbnails, migrations.
- Onboarding: a 60-second guided first base (place, grow, connect, scrub time), skippable.
- Settings: quality preset, street lights toggle, sim speed.
- Optional postcards (soft goals) behind a flag; decide after playtest.
- Accessibility: keyboard-only building, colour-blind-safe port halos, reduced motion toggle.
- Deploy to static hosting (Cloudflare Pages or GitHub Pages).

**Exit:** five outside players build a base, share a link, and the link opens the same base on another machine.

## First ten tasks for the next agent (M0 tail → M1 start)

**Status: all ten done**, and M1 is finished (see the M1 status above): D, the picker and diagnose are in. What is still owed is incremental solving (`docs/PERF.md`), the worker and trim UVs (M2), and the known limits listed in ARCHITECTURE §4.3.

1. Add ESLint + Prettier with the layer import rule from ARCHITECTURE §2; fix any findings.
2. Create `src/geometry/design-constants.ts` (BEVEL 0.06, FLANGE_RATIO 0.10, RIB_SPACING 2, HAB_RADII [2, 3], DOME_RADII [3, 4.5, 6, 8]) and use it in `hab.ts`.
3. Define `src/world/document.ts` (`BaseDocument`, `PartInstance`, `Link`) and `src/editor/store.ts` with commands, undo, redo, plus tests.
4. Define `src/grammar/types.ts` (`PartDefinition`, `PortSpec`, `Footprint`) and `src/grammar/registry.ts`.
5. Write letter **H** as a `PartDefinition` (params, footprint, ports, ground) using the current `hab.ts` geometry; test port positions.
6. Solver stages `place` and `ground` with terrain sampling; legs generation; test "nothing floats".
7. `SceneSync` v1: add/remove/update parts by hash; replace the hard-coded habs in `main.ts`.
8. `Place` tool with ghost preview and 45° rotation; `Delete` tool; keyboard undo/redo.
9. Letter **N** and solver stage `dock`; then letter **T** with grid A* routing and node insertion; tests for "tubes never cross hulls".
10. `Grow` handles for H length and the first screenshot sheet in `docs/shots/m1/`.

## Backlog (not scheduled)

- Parameter gizmos on the selected part (drag handles instead of the picker panel); see the M1 status.
- Touch and gamepad input.
- WebGPU renderer + node materials port.
- Interiors visible through a cutaway when zoomed close.
- Weather: global dust storm day that dims everything, then clears.
- A second biome: polar site with ice and a different sky.
- Scenario seeds ("crater floor", "canyon edge", "plateau").
- Mod-ish: user-defined palettes within the design rules.
- Multiplayer "visit": read-only live view of a friend's base.
- Procedural crew names and tiny bios on hover.
- Printer rover that shells modules flagged as shielded (listed in kickoff; needs its own milestone slot).

## Definition of done (per feature)

- Pure parts have tests; invariants from the design guide are asserted.
- A screenshot at 12:00 and 18:30 is attached to the PR for anything visible.
- No new magic numbers outside `design-constants.ts`.
- Frame budget unchanged on the golden base, or the PR says by how much and why.
- Docs updated if a rule, letter, or budget changed.
