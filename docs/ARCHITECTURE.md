# REGOLITH — Architecture

*Code structure, data model, and the rules that keep the layers honest.*

Last updated: 2026-10-17 · See also [KICKOFF.md](KICKOFF.md) · [DESIGN_GUIDE.md](DESIGN_GUIDE.md) · [PLAN.md](PLAN.md)

---

## 1. Stack and key decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Language | TypeScript, strict, `noUncheckedIndexedAccess` | Procedural code is index-heavy; the compiler catches a class of off-by-one bugs for free. |
| Bundler / dev | Vite 7 | Fast HMR for a shader-and-geometry iteration loop. |
| 3D | three.js (r186+), `WebGLRenderer` for v1 | Broadest support today. All shader tweaks are isolated (see §6.4) so a move to `WebGPURenderer` + node materials is a mechanical port, not a rewrite. |
| Post | pmndrs `postprocessing` (N8AO + bloom + grade) or three's own passes; decide at M2 | Both are WebGL. Keep the pass list in one file. |
| UI | Plain DOM + CSS, a tiny signal store (`src/core/signal.ts`) | The UI is a tray and a rail. No framework needed; no framework to fight. |
| Tests | Vitest | Grammar, solver and geometry are pure and fast to test headlessly. |
| Workers | Geometry generation in a Web Worker with transferable buffers | Keep 60 fps while dragging a 16 m hab. |
| State | Immutable document + command pattern | Undo/redo, deterministic re-derivation, cheap diffing for scene sync. |
| Assets | None. All geometry and textures generated at runtime | Pillar P4; also zero pipeline. |

## 2. Layers and dependency rules

```
 ┌────────────────────────────────────────────────────────────────┐
 │ editor/      tools, input, UI, commands           (DOM + three) │
 ├────────────────────────────────────────────────────────────────┤
 │ sim/         clock, agents, events                 (pure + math)│
 ├────────────────────────────────────────────────────────────────┤
 │ render/      SceneSync, materials, sky, post, LOD      (three)  │
 ├────────────────────────────────────────────────────────────────┤
 │ geometry/    mesh builders: profiles, lathe, sweep, trim UVs    │
 │              (three BufferGeometry math only, no scene objects) │
 ├────────────────────────────────────────────────────────────────┤
 │ grammar/     part definitions, ports, rules, solver   (pure)    │
 ├────────────────────────────────────────────────────────────────┤
 │ world/       BaseDocument, terrain heightfield        (pure)    │
 ├────────────────────────────────────────────────────────────────┤
 │ core/        math, rng, noise, hash, events, signal   (pure)    │
 └────────────────────────────────────────────────────────────────┘
```

Rules:

- Arrows point **down only**. `grammar/` may import `world/` and `core/`, never `render/` or `three` scene classes. `world/` and `grammar/` are testable in Node without a GPU.
- `geometry/` may use three's math and `BufferGeometry` but never `Mesh`, `Scene` or materials. It returns `GeometryBundle`s (see §5).
- `render/` is the **only** layer that touches `Scene`, materials, lights, textures.
- `sim/` reads the resolved base (graph, poses) and writes **sim state** (agent positions, animation phases); it never mutates the document.
- `editor/` is the only layer that creates commands and mutates the document through them.
- Cross-layer communication is via the typed event bus in `core/events.ts` or explicit function calls downwards. No globals except the app shell.

Enforced by an ESLint `no-restricted-imports` rule per folder (`eslint.config.js`). It bans both the `@/layer/**` alias and relative imports.

**One deliberate exception:** `geometry/design-constants.ts` has no imports and is importable from `world/` and `grammar/`. Parts need the same numbers the geometry uses (radii, port spacing, margins), and moving them into `core/` would break CLAUDE.md's rule that design numbers live in that one file. Nothing else under `geometry/` may be imported from below.

`Letter` lives in `world/letter.ts` (not `grammar/`) because the document stores it.

## 3. Data model: the BaseDocument

The document is the only persistent truth. Everything visible is derived from it.

```ts
interface BaseDocument {
  version: 1;
  seed: string;                 // terrain + decorator seed
  terrain: {
    size: number;               // cells
    cell: number;               // metres
    edits: TerrainStroke[];     // brush strokes replayed on the seeded base
  };
  parts: Record<PartId, PartInstance>;
  links: Link[];                // explicit player-made connections
  settings: { hour: number; streetLights: boolean; };
  camera?: { target: [number, number, number]; yaw: number; distance: number };
}

interface PartInstance {
  id: PartId;                   // stable, nanoid
  letter: Letter;               // 'H' | 'D' | 'N' | ...
  params: Record<string, number | string | boolean>;
  pose: { x: number; z: number; yaw: 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315; y?: number; mirror?: true };
  flags?: { shielded?: boolean; windows?: boolean };
  serial: number;               // stencil number, allocated once, never reused
}
// BaseDocument also carries `nextSerial: number`; addPart takes serial = nextSerial++,
// so serials survive deletes and undo/redo restores them with the snapshot.

interface Link { a: PortRef; b: PortRef; kind: 'dock' | 'tube'; via?: PartId[] }
interface PortRef { part: PartId; port: string }
```

Derived (never stored, recomputed by the solver):

```ts
interface ResolvedBase {
  parts: Map<PartId, ResolvedPart>;   // final pose incl. y, legs, port world transforms
  tubes: ResolvedTube[];              // polylines with flange positions, inserted nodes
  cables: Polyline[];
  paths: PathField;                   // 2D traffic/wear field over the grid
  graph: PressGraph;                  // nodes = PRESS parts, edges = tubes/docks, with walk lengths
  power: PowerGraph;
  decorators: DecoratorInstance[];    // handrails, stencils, lights, ladders, chevrons...
  beaconOwner?: PartId;
  diagnostics: Diagnostic[];          // never shown as errors; used by tests and the ghost preview
}
```

Terrain is stored as the seed plus the list of brush strokes, replayed deterministically. This keeps saves tiny (URL-shareable) and makes undo of terrain edits trivial.

## 4. Grammar and solver

### 4.1 Part definition

Each letter is a module in `src/grammar/parts/<letter>.ts` exporting a `PartDefinition`:

```ts
interface PartDefinition<P extends ParamSchema> {
  letter: Letter;
  name: string;
  params: P;                                  // schema with min/max/step/default, drives UI handles
  footprint(params: P): Footprint;            // grid cells occupied, used for snapping/overlap
  ports(params: P): PortSpec[];               // local-space ports: id, type, position, normal
  ground(params: P): GroundSpec;              // which STRUCT ports need legs, pad behaviour
  decorators(params: P, ctx: DecoratorCtx): DecoratorSpec[];
  geometry(params: P, ctx: GeometryCtx): GeometryRecipe;   // see §5, pure description
  lods?: number[];                            // screen-size thresholds
}
```

Parts are **pure**. They receive a `ctx` carrying the seed, terrain sampler and neighbour information; they never reach into the document.

### 4.2 Solver pipeline

Runs after every command and on every ghost preview update. Target: < 2 ms for 200 parts (measured in tests).

```
document
  │
  ├─ 1. place      : clamp to grid, snap yaw to 45°; `mirror` copied through (a flip: local z → -z before the yaw)
  ├─ 2. overlap    : footprint grid test; push to nearest free pose (expanding ring search);
  │                   the part being edited (`movingId`) is placed last and yields
  ├─ 3. ground     : pose.y from terrain, legs per STRUCT port (runs before dock: ports need final heights)
  ├─ 4. dock       : opposing PRESS ports within 1.5 m, ±15°, lateral ≤ 0.5 m → a short tube bridge
  ├─ 5. tubes      : for each player link of kind 'tube': route on a 1 m lattice (A*, 8 headings,
  │                   turn penalty, hull footprints blocked); insert nodes on >24 m or >2 kinks;
  │                   derived nodes are grounded here
  ├─ 5b. keep-out  : `keepOut` mask of the 1 m grid for ambient decoration (parts incl. slab hosts, tube corridors); see SCATTER.md
  ├─ 6. power      : union-find networks; cable routes (A* on grid, tubes passable via pylon hop)
  ├─ 7. paths      : EXT ports → origins; wear field advanced by sim traffic (sim writes, solver reads)
  ├─ 8. decorators : stencils (serial), handrails, lights, chevrons, dust side (wind dir from seed)
  ├─ 9. beacon     : tallest part
  └─ 10. diagnose  : invariants (§8.4 of design guide) → diagnostics, asserted in tests
```

Each stage is a pure function `(ResolvedBase, Document) → ResolvedBase` in its own file under `src/grammar/solver/`. Incremental: stages take a dirty set of part ids and only recompute affected regions (tube routing is bounded by a bbox query against a spatial hash).

### 4.3 State of the solver (M1) and known limits

Implemented: place, overlap, ground, dock, tubes (with node insertion and a wider-clearance retry that rolls back cleanly) and diagnose. Not yet: power, paths, decorators, beacon. The `Diagnostic` kinds in use are `unknown-letter`, `moved`, `unplaceable`, `link-skipped`, `tube-unroutable`, `tube-too-long` and `invariant`; a link with no route keeps its place in the document and is flagged, but gets no corridor (a mesh through a hull is never drawn), never an error (P1). The router turns by at most 45° per lattice step and runs straight into a skewed lead, so no corridor bends by more than 45° at one vertex, the most the D-section mitre can take on a 1 m piece.

Letters in the registry: H, N, D (opaque dome), V (tower), P (slab), M (mast), E (power plant), C (launcher).

**Diagnose** (`solver/diagnose.ts`) is opt-in (`SolveOptions.diagnose`), never on the hot path. It checks the DESIGN_GUIDE §8.4 list that a resolved base can answer: every leg ends on terrain or a slab top (`stands-on-something`), serials are unique, solid hulls never overlap by exact footprint gap (`hull-gap`), a tube starts and ends at a real, used, tube-capable port (`tube-free-end`, `halo-usable`), and a routed tube never passes through a hull it is not attached to (`tube-crosses-hull`, sampled every 0.25 m; links already flagged `tube-unroutable`/`tube-too-long` are exempt). Property tests run it on random mixed bases with links over flat and rough terrain and while dragging; mutation tests prove each rule fires. Mesh rules (watertight, outward normals, 6 cm bevel) stay in `geometry/validate`. It found two router bugs: a port facing a hull within reach walked its lead out through that hull (now `tube-unroutable`), and a node could be placed on an earlier tube.

**Editor additions.** The parameter picker (`editor/ui/params-panel.ts`) edits the selected part, or the Place tool's remembered params per letter, from the `ParamSpec` schema (labels, units); a change is one undo step. Suggested connections (`grammar/suggest.ts`, shown by `editor/ui/suggestions.ts`) are derived on demand for the focus part (just placed, or selected) from trial solves of candidate links and are never stored. The ghost solves only when the snapped pose, letter, params or document changes, and shows a snap arrow (`render/snap-arrow.ts`) when the solver moved it more than 0.25 m.

**Individuality.** `grammar/individual.ts: individualOf(letter, serial, seed)` gives each part a hull tint (an instance colour in the hull batch, a point on the Hull white to Hull shaded segment) and a small variant folded into the hab recipe (stripe end and material); `grammar/decals.ts` adds the serial stencil as a `Decal` (a `stencil` recipe cached by text, plus a world matrix from yaw alone). All of it is derived in `toResolved`, nothing stored. Measured at `?stress=200`: draw calls unchanged (18 / 32 / 46), triangles +1.2%.

**Ground.** The `flatten` stage (after `overlap`, before `ground`) builds `world/flatten.ts`'s field from the committed slabs and hands the levelled `heightAt` to `ground`, `dock`, `tubes` and `diagnose`; `ResolvedBase.terrain` carries it out for the terrain mesh (`levelTerrainMesh`, redone only when the field's key changes), picking and rock resettling. A dragged or previewed part is skipped, so it floats on the natural terrain and the ground settles on commit. Cost: about 1.5 ms for six slabs per solve, 0 with none, and 2.4 ms to re-seat the 9,409 mesh vertices.

**Hosts.** A part whose `ground()` has `hostTop` (the slab) is grounded on bare terrain first. Every other part, and the dock and tube stages, then see a `surface`: the terrain, or a host's top wherever one is underfoot. Hosts only resolve overlap against other hosts and do not block tube routing; tubes and their legs clear a slab top instead.

Known limits:

- `ResolvedBase.graph` (nodes = PRESS parts, edges = docks and tubes, floor-level points) exists; `cables`, `paths`, `power` and `decorators` in the sketch above are still to come (M3 tasks 8 and later, M4).

- Slabs level the ground under them (a derived field, never stored); parts on legs keep the natural terrain and get a wear ring (`world/wear.ts`, a 2-channel texture the regolith shader reads; channel G is for M4's paths). Painted terrain edits still wait for M4.
- Handles cover the range and choice params that are a length (H length and radius, C length, P width and depth, V floors, M height, D, E and N radius). Toggles, the mast head and the launcher's elevation are edited through the picker only.
- `POWER` ports exist (M, E, C) but nothing connects to them until the power stage; beacons, dish tracking and fin glow are static.
- `aluminium` is unused until the sky environment map lands (M2).

- Tubes leave horizontal-normal PRESS ports only; the node's `top` port cannot take a tube yet.
- Growing a hab on a 45° yaw can drift the fixed end by a grid step (poses snap to 1 m).
- The terrain edge is visible when zoomed out far.
- Solving 200 parts takes ~16 ms against the 2 ms target; it needs incremental solving (`docs/PERF.md`).
- The geometry worker and trim-sheet UVs are not built; both are M2 (the trim sheet needs the art pass, the worker needs the LOD pipeline).
- A clean span of up to 24 m between two ports is one plain tube; a node appears from about 26 m, or when the route has to bend around something.

### 4.4 Snapping and the ghost

The ghost preview runs the same solver on a scratch document with the proposed part, so what the player sees is exactly what they get. The ghost renders with the `ghost` material override (hull colour at 50%, no shadows) plus an arrow decorator when the resolved pose differs from the cursor by more than 0.25 m.

## 5. Geometry pipeline

Geometry never comes from files. Builders in `src/geometry/` turn a `GeometryRecipe` into a `GeometryBundle`:

```ts
interface GeometryRecipe {           // declarative, emitted by grammar; hashable
  ops: GeomOp[];                     // lathe | sweep | box | shell | instanceRef ...
}
interface GeometryBundle {
  byMaterial: Record<MaterialName, { positions: Float32Array; normals: Float32Array; uvs: Float32Array; colors?: Float32Array; indices: Uint32Array }>;
  instances: Record<DecoratorKind, Float32Array>;   // 4x4 transforms for instanced decorators
  bounds: AABB;
  hash: string;
}
```

Principles:

- **Profile library** (`geometry/profiles.ts`): the hull profile, rib profile, collar, hatch ring, truss member, panel. Every part is composed from these so bevels and proportions match automatically. Design constants come from `geometry/design-constants.ts` only.
- **Hard/soft edge flags** on profiles; normals are generated by the lathe/sweep, never recomputed by averaging later.
- **Trim-sheet UVs**: a 1024² procedural atlas with rows for seams, stencils, hazard stripes, cell lines, rubber. Builders map edges to rows; nothing is UV-unwrapped.
- **Vertex colours (as built in M2)**: `colors` is an rgb multiplier of the material colour, three floats per vertex, baked by `geometry/tint.ts` (`tintUnderside` for down-facing surfaces and the lowest 0.8 m, `tintDust` for the lowest 1.4 m, thickest windward). Glass is never tinted; rocks get the underside shade only. Dust sits in the part's local frame, so it does not follow part yaw, and the wind is a fixed prevailing direction (`WIND_FROM_DEG`), not seeded. There is no alpha / AO channel.
- **Merging**: one draw per material per part; decorators are instanced across the whole base (one `InstancedMesh` per decorator kind per LOD).
- **Workers**: `geometry/worker.ts` runs the builders. Main thread sends recipes, receives bundles with transferred buffers. A memoising cache keyed by `recipe.hash` lives on both sides.
- **Validation** (`geometry/validate.ts`): in tests and dev builds, every bundle is checked for NaNs, degenerate triangles, outward normals (signed volume) and bounds; failures throw in dev and are logged in prod.

## 6. Rendering

### 6.1 SceneSync

`render/scene-sync.ts` diffs the previous `ResolvedBase` against the new one and applies minimal scene changes: added/removed/changed parts (by hash), tubes, cables, decorator instance buffers, terrain patch updates. It owns the mapping `PartId → Object3D`. No other code adds to the scene.

### 6.2 Terrain

Automatic ground decoration (rocks, formations, tracks, debris) is specified in [SCATTER.md](SCATTER.md).


Heightfield mesh in 32×32-cell chunks so brush edits re-upload a small patch. Path wear and dust are a 2-channel data texture sampled in the regolith shader, not geometry. Pads cut terrain by pulling vertices (keeps the mesh single-surface).

### 6.3 Lighting, sky, time

`render/sky.ts` computes sun direction and palette from the hour. `render/lighting.ts` owns the directional light, rim light, hemisphere light, fog and the shadow frustum fitter. The sky dome is a shader on a sphere; its PMREM is regenerated when the hour crosses a 30-minute boundary.

### 6.4 Materials and shader patches

One library. Shader customisation only via `onBeforeCompile` patches collected in `render/shader-patches.ts` (dust tint, wrapped diffuse for plants, dither fade for LOD). Keeping them in one file is what makes the future WebGPU/node-material port mechanical.

### 6.5 Instancing and LOD

Decorators and repeated parts (solar panels, lights, crew) are `InstancedMesh` with per-instance attributes for animation phase, emissive and dust. LOD: 3 levels per letter (full, medium, silhouette) switched by projected size with a dither crossfade.

### 6.6 Post

`render/post.ts` builds the pass chain from the design guide §7. Quality presets: iGPU (half-res AO, FXAA), discrete (full-res AO, MSAA 4x).

### 6.7 State of the look (M2)

- `sky.ts`: sun path (14 daylight hours, 68° noon altitude), twilight by altitude, exposure by hour. `sky-dome.ts`: gradient, disc, blue aureole, stars. `sky-env.ts`: PMREM per half hour on aluminium and glass only.
- `lighting.ts`: sun with a texel-snapped shadow box fitted to the base (`shadow-fit.ts`), rim light, hemisphere, fog. `shader-patches.ts`: terrain edge fade.
- `post.ts`: low = direct render; medium = MSAA 4 + bloom + ACES + grade; high adds half-res GTAO.
- `scene-sync.ts`: parts inflate about their base and deflate on removal, tubes extend from their first port, and the parts a tube joins dip by 1.2 % (`inflate.ts`). The first sync loads without animation and the ghost never animates. `scatter-sync.ts`: rocks as at most four instanced meshes (2 variants × casters / non-casters), a 150 ms fade-in per new rock.
- Not built: LOD levels and dither, the geometry worker, the trim sheet (see PLAN M2 status).

## 7. Simulation (life layer)

- **Clock:** `sim/clock.ts` owns sol time. Real time 1 s = 1 sol-minute by default; the player can pause, scrub, or speed to 4x. It is advanced from wall-clock timestamps (frames do not matter) and light and shadows follow `visualHour`, which only changes once per sol-minute, so a running clock costs one redraw per sol-minute. The loop asks for a frame when the sun moved, something is animating, input arrived, or the 5 s heartbeat is due.
- **Tick:** sim runs at a fixed 10 Hz; render interpolates. Sim never touches three objects; it writes to typed arrays the renderer reads (positions, headings, phases).
- **Crew:** `sim/crew.ts` + `sim/nav.ts`. An agent is a route (steps that name graph nodes and edges) and a distance along the current step, never a coordinate, so a dragged part carries its crew and a deleted one sends them home. `sim/sim.ts` is the editor's handle: fixed step plus crew, fed clock-scaled time.
- **Silhouettes:** `sim/silhouettes.ts` maps crew to window panes (pure, matrices out); `render/crew-silhouettes.ts` draws them as one instanced mesh. The editor redraws only when the set of occupied panes changes, at most `FIGURE_MAX_HZ` times a second, on top of the sol-minute redraw.
- **Outdoors:** `PressNode.exits` gives each airlock its ramp foot; `sim/loiter.ts` picks where a crew member stands (a fixed candidate ring over the keep-out mask, so nothing random and nothing in a hull). `sim/airlock.ts` is the per-lock state machine (seal, pump, open, queue, two riders, one direction). `sim/lamps.ts` turns locks into lamp slots; `render/lamps.ts` and `render/crew-outdoors.ts` draw them as instanced meshes. The editor wakes a frame on a lamp phase change or an arrival, and at `OUTDOOR_REDRAW_HZ` only while the clock runs and someone walks outside.
- **Lamps:** `sim/lamps.ts` lists every lamp (airlocks with their cycle phase, pole heads, the one beacon on the tallest part that offers a `beacon` mount, elected in `grammar/beacon.ts`); `render/lamps.ts` draws plates and the ball as two instanced meshes on one material. Whether they glow is the material's night ramp, so only a phase change or a base edit wakes a frame.
- **Agents:** `sim/agents/*` are small state machines (Crew, Rover, Drone, Lander, DustDevil). Navigation uses `ResolvedBase.graph` indoors and a grid flow field outdoors (recomputed lazily when the base changes).
- **Systems:** `sim/systems/*` are stateless per-frame updaters: `solarTracking`, `nightLights`, `airlockCycles`, `plantGrowth`, `pathWear`, `dustAccumulation`, `beacon`. Each reads clock + base, writes instance attributes.
- **Events:** the sim emits typed events (`landerArrived`, `airlockCycled`) for sound and for optional postcards.

## 8. Editor

- **App shell** (`editor/app.ts`): creates renderer, document store, solver, sim, tools; runs the frame loop.
- **Document store** (`editor/store.ts`): holds the current document, applies `Command`s, keeps undo/redo stacks. Commands are pure `(doc) → doc`; undo is **snapshot-based** (the document is immutable, so a history entry is just the previous document, 200 deep). `beginGesture`/`endGesture` coalesce a drag into one entry. Undo/redo keys are Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y (Q/E/`[`/`]` belong to the camera and clock).
- **Tools** (`editor/tools/*`): a state machine with one active tool: `Select`, `Place(letter)`, `Grow`, `Connect`, `Terrain(brush)`, `PathPaint`, `Delete`, `Photo`. Tools receive normalised pointer events with a terrain hit and a part hit (raycast against footprint proxies, not render meshes).
- **Ghost** (`editor/ghost.ts`): scratch document + solver + override materials.
- **UI** (`editor/ui/*`): tray, rail, parameter handles (DOM elements positioned by projecting 3D anchors), hour dial, toast. State via signals.
- **Input** (`editor/input.ts`): pointer capture, key chords, wheel normalisation. Camera rig lives in `render/camera-rig.ts` and is driven by the input layer.

## 9. Persistence and sharing

- `persistence/codec.ts`: document ↔ compact binary (MessagePack-like custom) ↔ base64url. A 200-part base fits in ~2 KB, so the **URL is the save file**.
- `persistence/local.ts`: autosave to IndexedDB every 10 s and on blur; a "recent bases" list with thumbnails.
- `persistence/export.ts`: PNG export at 1x/2x/4x (offscreen render), optional GLTF export of the resolved base for people who want to print it.
- Versioned schema with migrations in `persistence/migrate.ts`.

## 10. Testing strategy

| Layer | What | How |
|-------|------|-----|
| `core/` | rng determinism, noise ranges, hash stability | unit |
| `world/` | terrain determinism, bilinear sampling, stroke replay | unit (exists) |
| `grammar/` | every letter: ports inside footprint, port normals unit length, params schema sane | property tests over param ranges |
| `grammar/solver` | invariants from design guide §8.4 on 50 random bases per seed set; tube routing never crosses hulls; nothing floats | property tests, golden JSON for a few hand-built bases |
| `geometry/` | no NaNs, outward normals, bounds, bevel presence (edge angle histogram), hash stability | unit + snapshot of hashes |
| `render/` | sky palette monotonic with sun altitude; no NaN colours | unit |
| `sim/` | agents never leave the graph; lander schedule | unit with fake clock |
| Visual | screenshot suite at 06:00 / 12:00 / 18:30 / 21:00 from 3 camera angles on a golden base | Playwright, compared with a tolerance; run on demand, not on every commit |
| Perf | solver < 2 ms for 200 parts; geometry worker < 16 ms per hab; frame < 16 ms on the golden base | benchmark script, numbers tracked in `docs/PERF.md` (created at M1) |

## 11. Performance budgets (golden base: 200 parts, 24 crew, 6 rovers, 300 panels)

| Budget | Target |
|--------|--------|
| Frame (iGPU, 1080p) | ≤ 16 ms total, render ≤ 11 ms, sim ≤ 2 ms, solver ≤ 2 ms amortised |
| Draw calls | ≤ 400 |
| Triangles | ≤ 1.5 M on screen |
| Shadow pass | one 2048 map |
| Memory | ≤ 300 MB JS heap + GPU |
| Load | interactive in < 2 s on a cold cache (three is ~135 KB gzipped) |

## 12. Folder layout

```
regolith/
├─ docs/                  KICKOFF, DESIGN_GUIDE, ARCHITECTURE, PLAN, PERF (later)
├─ public/                favicon only
├─ src/
│  ├─ core/               rng, noise, math, events, signal
│  ├─ world/              document types, terrain, strokes
│  ├─ grammar/
│  │  ├─ parts/           H.ts, D.ts, N.ts, ... one file per letter
│  │  ├─ solver/          place, overlap, dock, tubes, ground, power, paths, decorators, beacon, diagnose
│  │  ├─ ports.ts  rules.ts  types.ts
│  ├─ geometry/           design-constants, profiles, lathe, sweep, trim, builders, validate, worker
│  ├─ render/             renderer, scene-sync, materials, shader-patches, sky, lighting, camera-rig, post, lod, terrain-mesh
│  ├─ sim/                clock, agents/, systems/, nav
│  ├─ editor/             app, store, commands, tools/, ghost, input, ui/
│  ├─ persistence/        codec, local, export, migrate
│  └─ main.ts             boots editor/app
├─ index.html
├─ package.json  tsconfig.json  vite.config.ts
└─ CLAUDE.md
```

## 13. Conventions

- Files are kebab-case; types PascalCase; one letter per part file named by its letter.
- No `any`. No default exports except Vite entry points.
- Design constants live in `geometry/design-constants.ts` and nowhere else.
- Every part and solver stage has a doc comment stating its invariants.
- Commits: conventional prefixes (`feat:`, `fix:`, `art:`, `perf:`, `docs:`). `art:` is for look changes with before/after screenshots in the PR.
- Screenshots for visual review go in `docs/shots/<milestone>/`, never in `src/`.
