# REGOLITH — Overview Plan

*Milestones with exit criteria, the first concrete tasks, and the backlog.*

Last updated: 2026-10-18 · See also [KICKOFF.md](KICKOFF.md) · [DESIGN_GUIDE.md](DESIGN_GUIDE.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 0. How to read this

Milestones are ordered by **risk retired**, not by feature count. Each has a one-line goal, deliverables, and an exit gate that is a thing you can do or see. No dates: the team is small and agent-assisted; the gate is the schedule. Letters refer to the part alphabet in the design guide §8.

```
 M0 Bootstrap ─► M1 Alphabet I ─► M2 The Look ─► M2.5 Workshop ─► M3 Life I ─► M3.5 Human scale ─► M4 Terrain & Decor ─► M5 Alphabet II & Life II ─► M6 Ship v1
   (done-ish)      snapping          art gate      tweaks/builder     crew/sun      floors/doors/corridors  brushes/paths         rovers/lander/pad        photo/share

M2.5 was inserted before M3 at the user's request (2026-10-17): richer hand tools and a builder that helps come before anything starts walking around. It is numbered 2.5 so references to M3–M6 elsewhere stay valid.

M3.5 was inserted inside M3 (2026-10-18), between task 6 and task 7, after the user's review of the tube connectors ("not designed for humans"). It is numbered 3.5 for the same reason: DESIGN_GUIDE §8.2 and ARCHITECTURE §4.3 refer to "M3 task 7" and "M3 tasks 8 and later" by number.
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
2. **Crew.** Done (sim only; nothing is drawn until task 3). `sim/nav.ts` routes over the graph (Dijkstra over node-centre, port and edge-end vertices; a route is a list of steps naming nodes and edges, resolved to polylines at use, with each edge capped by its two port points so steps join without a jump). `sim/crew.ts`: count `floor(volume / 60)` up to 24, homes biggest volume first (ties by id), three errand stops per sol-hour from `hashInts(seed, i, solHour, k)` over the nodes reachable from home, then home; 1.4 m/s; `reconcile` sends an agent home when its node, route or ports vanish and re-homes or trims the crew when the graph changes. `sim/sim.ts` ties a `FixedStep` to the crew; the app feeds it clock-scaled time (zero while paused), shows `crew N` in the HUD and exposes `sim` on the debug hook. Output is a `Float32Array`, stride 8 (`x y z heading phase walking exposed index`). Measured: a running sim asks for no extra frames (4x clock: 20 frames in 5 s, one per sol-minute). Tests: count formula, routes and unreachable pairs, never off the graph, speed bound per tick, byte-identical replay, deleting a part re-homes without NaN, errands replan on a new hour.
3. **Window silhouettes.** Done. A flat graphite head-and-shoulders (`geometry/figure.ts`) stands 8 mm off a window pane while a crew member is in that bay; both flanks of a hab, one side of a tower (floor and side from the crew index). Figures **snap** bay to bay rather than slide (sliding needs 10 Hz frames, which the GPU-load fix removed). `grammar/windows.ts` holds the bay layout that `geometry/hab.ts` and `sim/silhouettes.ts` both read, so a figure cannot stand where there is no glass. `sim/silhouettes.ts` is pure and builds right-handed world matrices, so a mirrored hab never turns a figure inside out; `render/crew-silhouettes.ts` is one `InstancedMesh` (48 slots, one draw call, no shadow cast). Redraws are event-driven: the loop wakes when the set of occupied panes changes, at most 4 a second (`FIGURE_MAX_HZ`). Measured: paused 2 frames per 10 s, 1x 18, 4x 63 (15 crew), quality stays high. Tube strips deferred. Shots: `docs/shots/m3/silhouettes-12.png`, `-1830.png`.
4. **Letters A, S, X, static.** Done. Airlock, solar array and light pole: parts, geometry (`geometry/airlock.ts`, `solar.ts`, `pole.ts`; the array layout is `grammar/solar-layout.ts`), the `solar`, `solarCell` and `light` materials, `A` volume for the crew count, the golden base now has one of each. Tool keys run 1-9 then 0 and - (x stays delete). The airlock docks to a hab flank (its end footprint margin is 5 cm); the pole stands on one 10 cm foot because every part must stand on something. The solar blue palette row already existed; the cell-line colour is the same row, so only the materials table gained a line. Shots: `docs/shots/m3/letters-12.png`, `-1830.png`, `airlock-12.png`, `-1830.png`.
5. **Airlock exit and cycle.** Done. `PressNode.exits` maps each EXT port to its ground point; nav gained a third step kind `out` (ramp foot to loiter spot) and `routeToExit`. `sim/loiter.ts` picks a spot 4-8 m from the foot: a fixed ring of 5 distances by 7 angles, scanned from the crew slot, skipping keep-out cells (fallback one metre past the foot, so a placement is resolved, never rejected). `sim/airlock.ts` is a pure state machine per lock: idle, seal 1.5 s, pump 3 s, open 1.5 s, at most two riders and all going the same way, queue in arrival order. Crew go out only for sol hours 08-18 (60% chance for the second stop of an hour), dwell 10-30 s, and anyone outside when the window ends walks back, so nobody is out by 19:00. The lamp is a per-instance-coloured `InstancedMesh` (`render/lamps.ts`; idle window warm, seal orange, pump warning yellow, open plant green, all palette entries) with a shader patch that multiplies the emissive by the instance colour; the crew outdoors are a suited figure in two instanced meshes (`geometry/suit.ts`, `render/crew-outdoors.ts`), no shadow cast. Redraws: an event wake when a lamp changes phase or someone arrives or leaves, plus 10 Hz (`OUTDOOR_REDRAW_HZ`) only while the clock runs and someone walks outside. Measured: paused 2 frames per 10 s, 1x 54, 4x 97 (the 10 Hz cap). Tests: lock cycle and riders, loiter ring and fallback, exits in the graph, outdoor positions, nobody out by 19:00, one direction per cycle, replay with a scrub, airlock deleted mid-errand. The cycle colours are orange, yellow, green rather than red, amber, green: the palette is closed and has no red. Shots: `docs/shots/m3/exit-12.png`, `exit-1830.png`, `lamp-pump-day.png`.
6. **Night lights.** Done. One `Lamps` renderer (`render/lamps.ts`): an `InstancedMesh` of flat plates (airlock lamps and the head under each light pole's hood, capacity 256, `LAMP_CAPACITY`) and one of a ball (the beacon, capacity 1), both on the `lamp` material whose shader patch makes the instance colour the glow. `sim/lamps.ts` `baseLamps` builds the list (right-handed matrices, so a mirrored part never turns a plate inside out); `grammar/lamps.ts` holds the frames (`airlockLampFrame`, `poleLampFrame`, `mastBeacon`, `beaconOn`). The beacon: `PartDefinition.beacon?(params)` gives the ball centre on top of the part (offered by H, N, D, V, E, M; H puts it in the middle of a gap between ribs), and `grammar/beacon.ts` `beaconOwner` picks the highest by world height (ground height included), ties by id. Masts keep a graphite ball and the owner draws a glowing one 1 cm larger over it. The baked `light` material is gone. No colour blend and no blink: the lamp material's emissive intensity is the night ramp, so lamps need no redraw for the sun, and a steady beacon costs nothing. Beacon colour is accent orange (the palette has no red) at half strength. A ghost pole has no lamp (the ghost draws the recipe only). Paused is still 2 frames per 10 s; 1x 55, 4x 99 with crew out. Tests: owner election (tallest, order, slab, tie, empty, parts that cannot carry it), every mount rests on the surface it names, the pole lamp hangs under the hood, lamp set and key, right-handedness on a mirrored part. Shots: `docs/shots/m3/lights-12.png`, `lights-21.png`, `pole-21.png`, `beacon-21.png`. Deferred to M4: the warm pool of light under a pole, as a small uniform array of pole positions in the regolith shader's colour pass (so it follows slopes and the shadow passes never see it).

   **M3.5 Human scale runs here** (its own section below, after the M3 exit): floors, doors and corridors a person can walk come before anything tracks the sun, at the user's request (review of task 6, 2026-10-18). Tasks 7–9 keep their numbers.

7. **Solar tracking and parking**: tilt from the sun direction on the sol-minute step, park when the sun is low, per-panel delay from `hashInts(serial, i)`; no shader patch, so shadows stay right. Measure the shadow pass at `?stress`.
8. **Power stage and cables**: union-find over POWER ports, nearest-network routing with `route.ts`, a `cable` op sampled every 2 m with a pylon each, cables mark `keepOut`, straight fallback.
9. **Exit shot and PERF row** at 19:00, idle frames still 2 per 10 s when paused.

Cut or deferred: tube window strips, per-hab "someone is home" dimming, sim-written wear (it inverts the layers; channel G stays for M4), street-light auto-placement (M6).

**Exit:** place three habs, a tube, an airlock and an array, scrub to 19:00, and watch crew come home as the lights come on and the panels park.

## M3.5 — Human scale: floors, doors, corridors

**Inserted 2026-10-18** after the user's review of M3 task 6, to run before M3 task 7. The review, verbatim: "cylindrical shapes are practical and all, but if you think - those tube connectors are quite inappropriate if there people are walking/moving. Aesthetically its good to use axial tunnel connection but it makes no sense in gravity and regarding where floor is. All and all i say its not designed for humans. In other news i would probably look into 'For All Mankind' tv show's 'Happy Valley' for inspiration". More review may follow; this section is written so each stage can be re-checked from the text alone.

**Goal:** a 1.8 m crew member fits, stands and walks everywhere the graph says they walk, and the base reads as built for people: one deck level, doors at floor level, corridors you walk upright through, windows at eye height. Hulls stay round; it is the connections and the floor that change.

**Decisions (2026-10-18, the user took Fable's recommendations):** corridor 2.0 m wide (the router is untouched); end ports stay on the cap apex, dropped to floor level with a stub (ids and plan positions unchanged, no migration); hab M gets one deck 2.0 m under the axis, with the mezzanine kept as a later option; kinks are mitred with a bend collar; the buried level and berms are out of scope (M4 or backlog); the airlock gets an 8-riser stair on the same 2.6 m run.

**Happy Valley, as far as secondary sources go** (The Conversation, the fan wiki, the collectSPACE set tour): tubular corridors with real hallways linking larger geodesic and half-pipe structures; an arrival hall with rover airlocks, labs, a canteen, quarters; most residents live below ground on sublevels; the sets grew each season. We take three things: hallways you walk, the half-pipe silhouette for corridors, and "living under regolith" as a later stage. Nothing more is claimed.

**The problem, with the numbers as built (checked 2026-10-18):**
- `TUBE_RADIUS = HATCH_DIAMETER / 2 = 0.8 m`: a corridor is a 1.6 m round pipe. The graph stage (`grammar/solver/graph.ts`) lowers every PRESS port and every tube centreline by `PRESS_FLOOR_DROP = 0.8 m`, so crew walk the bottom line of the pipe with 1.6 m of headroom at the centreline and less a shoulder's width to either side. `SUIT_HEIGHT` is 1.8 m. The flanges every 2 m and the hatch ring are the same 1.6 m.
- Every PRESS port sits at hull axis height: hab ends at `[±ext, 0, 0]`, hab flanks at `[x, 0, ±r]`, node ports on the sphere's equator, the airlock's end on its axis. The walking point is 0.8 m below the hatch centre: a person steps down through a porthole.
- Floors do not agree across letters. Port height above the ground (hull belly 0.5 m up, `LEG_MIN_CLEARANCE`): dome 1.3 m, tower ground floor 1.5 m, hab S 2.5 m, node M 3.0 m, hab M 3.5 m. In the golden base the dome-to-hab-M corridor climbs about 2.2 m in about 5 m (a 24° ramp inside a pipe), and nothing docks across letters: the vertical offset counts as lateral in `dockDistance`, and S to M habs differ by 1.0 m > `DOCK_LATERAL` 0.5.
- The tower is only half right: it has floor ribs every 3 m, but its ports sit `TOWER_PORT_Y` = 1.0 m above a floor and the graph lowers them 0.8, so the walking point floats 0.2 m above the rib; its window band is centred 2.2 m above the floor (1.85–2.55 m), over a standing person's eyes (about 1.65 m). Hab panes at 52° from the top are 2.03 m (S) and 2.65 m (M) above the walking line: silhouettes stand in windows nobody could look out of.
- Kinks are balls (`TUBE_KINK_BALL`, a 0.9 m radius sphere), which the design guide never asked for (T row: "bend collars at kinks"). The airlock door is 1.8 m high: crew height, no margin.

**Target dimensions, DESIGN_GUIDE-ready (all in `design-constants.ts`, nothing typed twice):**

| Constant | Value | Why |
|---|---|---|
| `CREW_HEIGHT` | 1.8 m (one name; `SUIT_HEIGHT` becomes an alias or goes) | the person everything is checked against |
| `HEADROOM_MARGIN` | 0.2 m | clear height on every walkable point ≥ 2.0 m |
| `FLOOR_ABOVE_BELLY` | 1.0 m | **the one new rule:** every pressurised part's floor is 1.0 m above its lowest hull point, round (H, N, A: floor at axis − (r − 1)) or flat (D, V: a 1.0 m plinth under the ground floor). With `LEG_MIN_CLEARANCE` 0.5 unchanged, every floor is `DECK_HEIGHT = 1.5 m` above the highest terrain under its part, so on level ground every sill in the base is at one height and the ground stage does not change |
| `DECK_HEIGHT` | 1.5 m, derived (`LEG_MIN_CLEARANCE + FLOOR_ABOVE_BELLY`) | asserted in tests, never retyped |
| `HAB_FLOOR_DROP(r)` | r − 1.0: S 1.0 m, M 2.0 m | S: floor 3.46 m wide, 3.0 m headroom; M: 4.47 m wide, 5.0 m headroom. Nodes the same rule: floors 3.46 / 4.0 / 4.47 m, headroom 3.0 / 4.0 / 5.0 m |
| `CORRIDOR_WIDTH` | 2.0 m | one person plus one passing; half-width 1.0 equals the router's 1 m lattice clearance, so routing is untouched and wall-to-hull stays ≥ the 0.15 m footprint margin (§8.4: never under 10 cm) |
| `CORRIDOR_HEIGHT` | 2.4 m floor to crown | semicircular roof, radius 1.0, on 1.4 m walls: 2.4 m clear at the centre, 2.2 m at 0.6 m off, 2.0 m at 0.8 m off. A 1.8 m figure clears by ≥ 0.2 m across the middle 1.6 m |
| `CORRIDOR_FLOOR_THICK` | 0.2 m | slab under the walkway; underside = floor − 0.2. `TUBE_GROUND_GAP` 0.3 stays, so a free-standing corridor floor is ≥ 0.5 m up, the same as a belly |
| `DOOR_W` × `DOOR_H`, `DOOR_SILL` | 1.0 × 2.0 m, 0.05 m | every PRESS port is a door: graphite frame, orange collar (the hatch ring's colours). The sill is a step up, never a drop. Airlock door grows from 1.8 to 2.0 |
| `PORT_STUB_DEPTH` | 0.6 m, and never less than r − √(r² − drop²) + `BEVEL` (0.33 for S, 0.82 for M, so 0.9 on M hulls) | the short vestibule in corridor profile that carries the door on every tube-capable PRESS port. Its flat face is at the port, where the hatch ring was, so plan positions, footprints, dock distances and port ids do not move; only the port's y drops to the floor |
| `EYE_HEIGHT` | 1.5 m above the floor | window centres. Hab pane angle derived per radius, `acos((EYE_HEIGHT − drop) / r)`: S 75.5° from the top (M lands below the axis at 99.6°, see Decisions). Tower band centre 2.2 → 1.5 m (1.15–1.85 m) |
| `CORRIDOR_MAX_SLOPE` | 0.14 (8°) | steeper corridors are flagged `corridor-steep`, never refused |
| `KINK_COLLAR_THICK` | 0.28 m (= `TUBE_END_THICK`) | the bend collar on a mitred 45° joint |
| Retired | `PRESS_FLOOR_DROP`, `TUBE_RADIUS`, `TUBE_KINK_BALL`, `TUBE_BALL_SEGMENTS`, `HATCH_DIAMETER`, `TOWER_PORT_Y`, `DOME_PORT_Y`, `AIRLOCK_DOOR_W/H`, `HAB_WINDOW_ANGLE_DEG`, `TOWER_WINDOW_Y` | each has a floor-derived replacement; a grep for every name is stage 0's checklist (about ten test files pin these numbers today: `graph.test`, `hab.test`, `tube.test`, `tubes.test`, `host.test`, `node.test`, `scatter-base.test`, `silhouettes.test` among them) |

Headroom against 1.8 + 0.2 m: corridor 2.4 m at the centre; door 2.0 m exactly (nothing in the base is lower); hab S 3.0, M 5.0; node 3.0 / 4.0 / 5.0; tower 2.8 m under a floor rib; dome ≥ 2.8 m one metre in from the collar. Crew walk port → centre → port, so no walking point is nearer a wall than that.

**Port model.** Every PRESS port keeps its id, plan position and normal; its y moves to the part's floor, given by a new `PartDefinition.floor(params): number` (local y of the walking floor; required for every letter with a PRESS port). H: `end±` at `[±ext, −drop, 0]`, `side-i` at `[x, −drop, ±r]`. N: `x±`, `z±` at `[±r, −(r − 1), 0]` and `[0, −(r − 1), ±r]`; `top` stays a vertical hatch, is never tube-capable and leaves the walkable graph. V: `g-i` at the plinth height (1.0), `fk-*` at `1.0 + 3k`. D: `c-i` at the plinth height. A: `end-` at `[−ext, −drop, 0]`; the EXT port at the stair foot is unchanged. Docking keeps `DOCK_RANGE` 1.5 m, 15°, `DOCK_LATERAL` 0.5 m: because every sill sits `DECK_HEIGHT` over its own highest terrain, pairs that could never dock (S to M, anything to a dome or tower) now dock whenever the ground under both is within 0.5 m. A stored link of kind `tube` between two ports that are now in dock range resolves exactly as a dragged-together pair does today: the dock stage claims both ports first and the tube link is skipped (`link-skipped: port already connected`). Resolved, never rejected (P1), but the golden base and the suggest tests must be re-read for which links turn into docks, and the outcome written into `golden-base.test.ts`. **Document version: no bump.** Nothing stored changes meaning (ids, params, poses, links by port id; y is solver-owned unless hosted), and there is no codec or migration module yet (`src/persistence/` does not exist; `version: 1` in `world/document.ts`), so the only "saved documents" today are the golden base, the stress base and the tests' hand-built bases. The M6 URL codec serialises the same fields. The rule stays: bump only when an old reader would misread.

**Geometry, per file.**
- `geometry/profiles.ts`: `corridorSection(width, wallHeight, roofRadius)` (closed 2D section: flat floor with 6 cm bevelled corners, two walls, semicircular crown), `sectionSweep(section, a, b, cutA, cutB)` (one straight piece between two planes, so ends can be mitred), `sectionRing(section, thick, flange)` (the D-shaped flange), `doorFrame(w, h, sill)`.
- `geometry/tube.ts` becomes the corridor builder: pieces mitred at every bend, a bend collar on the bisector plane (the section ring scaled 1 / cos 22.5° in the turn plane, which is the exact mitre ring), D flanges every 2 m and at both ends, no balls. Legs: unchanged count; a trestle pair 1.2 m apart under the slab is optional art.
- `geometry/hab.ts`: a stub and door frame per PRESS port (both ends, each flank port); windows at the derived angle; the stencil re-derived to sit below the window row and still face the default camera; optional graphite deck line along the flank at floor height (4 mm proud) if the shots need the floor to read from outside.
- `geometry/node.ts`: stubs replace the four horizontal collars; the top hatch keeps its ring.
- `geometry/tower.ts`: a 1.0 m plinth band below the ground floor; ribs, windows, stripe and cap shift up by it (height = 1.0 + 3 × floors; `beacon()` follows); a stub per port.
- `geometry/dome.ts`: a 1.0 m plinth band; collar stubs reach into the shell where the door top passes the collar rim (r = 3: 0.35 m proud at the top, inside the 0.6 m stub).
- `geometry/airlock.ts`: door 1.0 × 2.0 from the sill; the ramp becomes a stair, 8 risers of 0.19 m over the same 2.6 m run so the footprint and the EXT port are unchanged; chevrons on the treads; a stub on the PRESS end.
- `geometry/validate.ts`: unchanged rules; the bevel histogram must see the slab corners.

**Graph, nav, silhouettes.** `graph.ts`: `down()` goes; `PressNode.centre = origin + floor()`; port points are the resolved port positions; edge paths are the routed paths, which now are the floor line. `PRESS_FLOOR_DROP` is deleted, not redefined: there is no second meaning of "floor". `tube-path.ts`: ground clearance `CORRIDOR_FLOOR_THICK + TUBE_GROUND_GAP`, legs top at `y − CORRIDOR_FLOOR_THICK`, the slope diagnostic. `sim/nav.ts` and `sim/crew.ts`: unchanged, they read graph points; an agent's y is the floor. `grammar/windows.ts` becomes the single source for pane frames (angle per radius, tower band height, both from `floor()` and `EYE_HEIGHT`); `geometry/hab.ts`, `geometry/tower.ts` and `sim/silhouettes.ts` read it, so a figure's height follows the pane by construction. `grammar/volume.ts`: unchanged, so crew counts and the golden base's crew stay as they are.

**Solver tubes stage, ghost, handles, suggest.** Routing is untouched: lattice, eight headings, turn cost, `TUBE_LEAD`, the 24 m span, the two-kink limit and node insertion. Reads of `TUBE_RADIUS` (`nodeReach` in `tubes.ts`, `keepout.ts`, `editor/pick.ts`, tests) become `CORRIDOR_WIDTH / 2`; at 1.0 the keep-out ring and the node margin grow by 0.2 m. The mitre adds no footprint, so `pointFree` keeps its clearance; only if the mitre is dropped for a kink drum (radius 1.25) do kink lattice points need `pointFree(…, 1)`. The ghost is solver-driven and draws the recipe, stubs included: nothing to do. Handles are unchanged (hab ends and radius are on the axis). Halos (`editor/ui/halos.ts`) project `port.position + [0, DOOR_H / 2, 0]` so the ring sits on the door, not on the sill. `suggest.ts` is unchanged (it filters by `canTakeTube`); its tests are re-read for pairs that now dock. Diagnose gains `port-on-floor` (every horizontal PRESS port within `DOOR_SILL` of its part's floor) and `corridor-steep`. `render/inflate.ts` is unchanged; check that a mitred corridor still extends from its first port.

**Stages, risk first. Each is one commit with tests and 12:00 and 18:30 shots in `docs/shots/m3.5/`:**

0. **Floor model and ports. Done.** (`floors-12.png`, `floors-1830.png`). The constants table, `floor()` on H, N, V, D, A, ports at floor level, graph without the drop, the two diagnose rules, every pinned-height test moved, the golden base re-solved with every link level on flat ground and the links that turn into docks listed in `golden-base.test.ts`. Corridors are still round pipes in this commit, now at floor level: the honest shot is a pipe whose bottom is the hab's floor. Biggest risk, hence first: it changes docking outcomes and tube heights everywhere; the property suites (random mixed bases, flat and rough, with links and flips) must stay green. **Built:** `FLOOR_ABOVE_BELLY`, `DECK_HEIGHT`, `DOOR_SILL`, `CREW_HEIGHT`, `HEADROOM_MARGIN`, `CORRIDOR_MAX_SLOPE` in `design-constants.ts`; `PartDefinition.floor()` (and `floors()` for the tower's decks) on H, N, V, D, A, each door at its floor; `PRESS_FLOOR_DROP`, `TOWER_PORT_Y` and `DOME_PORT_Y` retired; the graph reads horizontal PRESS ports as they are (a node's top hatch leaves the graph) with the centre on the floor; `port-on-floor` (invariant) and `corridor-steep` (a plain diagnostic, since a climb is legal) added. Two honest deviations from the table: the node's floor is `FLOOR_ABOVE_BELLY` over its feet (they sit at 0.8 of the radius, so floors at -0.6 / -1.0 / -1.4 m and headroom 2.6 / 3.5 / 4.4 m) rather than 1.0 over the sphere's bottom, which keeps the single 1.5 m deck; and while corridors are still round pipes the pipe stands on the floor, so its axis is lifted by `PIPE_AXIS_LIFT` (= the pipe radius) and the graph lowers the edge path by the same amount; stage 1 retires both. Result on the golden base: every pipe level at the deck, its one dock unchanged and no link turned into a dock, hab S to hab M docks. Tests: `floors.test.ts` (new), golden base pins, the pinned-height tests moved. Shots: `docs/shots/m3.5/floors-12.png`, `floors-1830.png`, `floors-close-12.png`, `floors-close-1830.png` (pipes meet the hulls low, the hatch rings on the caps are still at the axis until stage 2).
1. **Corridor profile** (`corridor-*.png`). Section, sweep, mitred bends with collars, D flanges, floor slab, legs, dock bridges in the same profile; `TUBE_RADIUS` retired. Tests: every bundle validates; "tubes never cross hulls" with half-width 1.0; bounds crown = floor + 2.4 and underside = floor − 0.2 for a flat and a climbing corridor; the mitre ring covers the outer corner of a 45° bend (no gap in a silhouette sample). **Stage 0 leftovers retired here (Fable's checkpoint):** `PIPE_AXIS_LIFT`, the halo lift and the `tube-free-end` offset; `profileXZ` takes the port y directly; the per-port `gap` embed (`PartDefinition.shellGap`, added after the checkpoint so a pipe end never floats off an M flank or an L node) becomes the stub depth; `corridor-steep` stays a plain diagnostic and `suggest.ts` ranks a steep pairing down instead of filtering it.
2. **Doors and stubs** (`doors-*.png`). Door frame op, stubs on H, N, A, D, V, hatch ring retired, halos lifted, airlock door and stair. Tests: the stub's back face is inside the hull for every letter and radius; door clear height = `DOOR_H` ≥ `CREW_HEIGHT + HEADROOM_MARGIN`; the airlock's EXT foot and footprint unchanged; loiter and exit tests still pass.
3. **Windows at eye height and plinths** (`windows-12.png`, `-1830.png`, `-2100.png` for the glow). Per-radius pane angle, tower band, tower and dome plinths, stencil re-derived, silhouettes from `windows.ts`. Tests: pane centre − floor = `EYE_HEIGHT` ± 0.05 for every radius and tower floor; a figure's matrix translation sits at the pane centre; beacon election unchanged apart from heights; the hab M windows follow the single-deck decision (panes below the axis).
4. **Exit shots, docs, PERF.** The 4-angle golden sheet at 12:00 and 18:30; DESIGN_GUIDE and ARCHITECTURE amended per the list below; a PERF row (triangles per corridor metre before and after; draw calls unchanged, same batches); worklog line.

**Later, deferred (Happy Valley spirit, not in this pass):** a regolith berm over corridors and nodes (M4: a ridge field like `flatten.ts` fed by the corridor keep-out, so the ground rises over the walkway and only the crown shows); a buried level (a stair stub down from a node to a sub-grade room; needs a below-ground floor rule and a cutaway, backlog until interiors); the hab M mezzanine (a second deck at axis + 0.4 m, where today's 52° windows are exactly eye level); tube window strips (cheap now that corridors have straight walls; stays in M4); trestle legs.

**Risks and cuts.**
- Links that become docks change the golden picture and may skip a saved tube link. P1-correct; pinned in stage 0's test so the change is deliberate, never a surprise.
- Mitred sections and D flanges are new sweep code (watertightness, bevel histogram, the collar's exact ring). Cut: a kink drum of radius 1.25 standing on the floor, with a clearance check at kink points.
- Stubs on a curved hull (M flank: 0.76 m proud at the sill, flush at the door top) could read as bolted-on boxes. Cut: deeper embed and bevel; the property test keeps the back inside the hull.
- The M hab floor 2.0 m under the axis leaves 5.0 m of headroom and puts eye-level windows below the axis; decided: one deck (Decisions above). If the mezzanine is chosen later, nothing in this pass has to be undone.
- Router clearance now equals the corridor half-width exactly: a flange (0.08) or a bend collar sits 0.07 m from a footprint edge at worst. If a shot shows one kissing a hull, raise the route clearance to one extra cell (`pointFree` already takes it) at the cost of more `tube-unroutable` fallbacks in dense bases.
- Stage 0 touches about ten test files at once; expect a long first commit and review it as "did every number come from the table".
- A D section with a floor slab is about 1.5× the triangles of a 16-segment cylinder per metre; corridors are a small share of the golden base's triangles. Measured in stage 4, with a cut to 12 roof segments if needed.

**Exit (what a reviewer checks).**
- A 1.8 m figure placed at every sampled point of every graph edge and at every node centre has ≥ 0.2 m clear above it: asserted headless by sampling the resolved geometry per piece (corridor crown − floor, door clear height, hull height over the floor chord) on the golden, stress and random bases.
- No horizontal PRESS port is above its part's floor by more than `DOOR_SILL`; every graph vertex lies on a floor (port y, centre y and edge path y agree with `floor()` and the routed path within 1 mm).
- Every golden-base walk (`route` between every pair of nodes) stays on a floor: on level ground no step changes height, and the dome-to-hab-M corridor is level; on the rough-terrain stress base every climb is under `CORRIDOR_MAX_SLOPE` or flagged.
- Every pane centre is `EYE_HEIGHT` above its deck; silhouettes stand in those panes.
- Shots at 12:00 and 18:30 in `docs/shots/m3.5/`: a corridor is lower than any hab beside it (S crown 1.4 m over the axis, hab top 2.0 m), doors sit low on the hulls, the airlock stair lands on the deck, windows are at head height, no flange or collar inside a hull.

**Design oversight.** Principles the work is held to, stage by stage:
1. *Human scale first.* Every walkable or passable dimension derives from `CREW_HEIGHT + HEADROOM_MARGIN` and `EYE_HEIGHT`; no height is typed as a bare number.
2. *The floor is the truth.* `floor()` is the one source: ports, the graph, doors, windows, stairs, stencils and silhouettes derive from it; `PRESS_FLOOR_DROP` and any second notion of a floor are gone.
3. *Cylinders stay as hulls.* Round hulls, domes and spheres keep their silhouettes; only the connections (corridor profile, stubs, doors) and the floor-derived details change. No new hull shapes, no new colours, one bevel.
4. *No rejected placements.* Every outcome of the port change (links that become docks, steep corridors, stubs on odd hulls) is resolved and flagged in diagnostics, never refused; no modal, no error.
5. *Same input, same bytes.* Every new op is pure and recipe hashes are stable across reloads.

Review checkpoint at the end of each stage, applied to the stage's diff and shots:
- *Constants:* every number in the diff is in the table above or derived from one; nothing typed twice; the retired names are gone from a grep of `src/`; new numbers live only in `design-constants.ts`.
- *Heights agree:* for every letter and radius, `floor()`, the resolved PRESS port y, the graph centre y, the edge path end y, pane centre − floor and the figure matrix y match the table; the tests named for the stage exist and are green.
- *Walkable:* on the golden base a route exists between every node pair that had one before, every step stays on a floor, no step is steeper than the slope limit on flat ground, and the crew count is unchanged.
- *Geometry:* `validate` passes (watertight, outward normals, 6 cm bevel), no coplanar faces (frames and lines proud by ≥ 4 mm, stubs embedded past the hull), hashes stable across two runs.
- *Shots:* 12:00 and 18:30 in `docs/shots/m3.5/` read as human scale by the exit list above; a stage with no visible change still ships its pair, so the sheet is complete.
- *Layers and style:* `grammar/` and `world/` import no three scene classes, materials only from the library, kebab-case, no `any`, one undo step per command.
- *Order:* a stage does not start before the previous checkpoint passes; a failed checkpoint is a fix commit on the same stage, not a note.

**DESIGN_GUIDE amendments (to-do, written in stage 4, not before):**
- §2 Shape language: new rows "Floor" (1.0 m above the lowest hull point; deck 1.5 m over the ground), "Corridor" (2.0 × 2.4 m, flat floor, round crown, D flanges, bend collars at kinks), "Door" (1.0 × 2.0 m, 5 cm sill, on every PRESS port), "Eye height" (1.5 m, window centres); the Proportions row cites `CREW_HEIGHT`.
- §8.1 PRESS row: "1.6 m hatch ring" becomes "a 1.0 × 2.0 m door at floor level in a short corridor stub; graphite frame, orange collar; halo on the door".
- §8.2 rows H (ports at floor level, windows at eye height, stencil below them), V (plinth, ports on each floor's level), N (stubs; the top hatch is not walkable), D (plinth, collar stubs), T (profile, no balls), A (door 2.0 m, stair instead of ramp); the M3 implementation notes paragraph re-read.
- §8.3 rule 1: add "ports are sills; parts dock only when their decks meet"; rule 2: add "corridors are level on level ground; a climb over 8° is flagged".
- §8.4: add "Always: 2.0 m clear height on every walkable point. Always: every PRESS port on its floor."
- §9 Stencils row (angle re-derived under the window row); §11 (crew are 1.8 m and walk on floors).
- ARCHITECTURE: §4.1 `PartDefinition.floor`, §4.2 the graph stage note, §4.3 known limits (ball joints gone, hatch ring gone), §7 crew.

**Exit:** the five reviewer checks above pass on the golden base; the user looks at `docs/shots/m3.5/` and no longer says "not designed for humans".

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
