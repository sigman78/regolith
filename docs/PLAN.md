# REGOLITH — Overview Plan

*Milestones with exit criteria, the first concrete tasks, and the backlog.*

Last updated: 2026-10-17 · See also [KICKOFF.md](KICKOFF.md) · [DESIGN_GUIDE.md](DESIGN_GUIDE.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 0. How to read this

Milestones are ordered by **risk retired**, not by feature count. Each has a one-line goal, deliverables, and an exit gate that is a thing you can do or see. No dates: the team is small and agent-assisted; the gate is the schedule. Letters refer to the part alphabet in the design guide §8.

```
 M0 Bootstrap ─► M1 Alphabet I ─► M2 The Look ─► M3 Life I ─► M4 Terrain & Decor ─► M5 Alphabet II & Life II ─► M6 Ship v1
   (done-ish)      snapping          art gate      crew/sun      brushes/paths         rovers/lander/pad        photo/share
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
- **Not yet:** gizmos on the selected part for tweaking parameters interactively in the scene (drag a handle for length, radius, floors, mast height) — today only H has grow handles and every other letter uses the picker panel. Scheduled after the M2 art gate, as a generic handle set driven by the `ParamSpec` schema (one undo step per drag, like the picker).
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

**Exit:** a 4-angle × 4-hour screenshot sheet of the golden base reviewed against the design guide; 60 fps on the reference iGPU laptop; zero z-fighting or acne in the sheet.

## M3 — Life I: crew, sun, lights

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
