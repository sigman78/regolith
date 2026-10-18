# Terrain decoration ("scatter")

*How the ground gets rocks, formations, tracks and debris without the player doing anything. Reviewed by a consultant pass against the real code (2026-10-17); the corrections are folded in.*

## 1. Principles

- **Derived, never stored.** Scatter is a pure function of the world seed, the heightfield and a keep-out mask. The only player data is the optional density and clear strokes (§6).
- **Same document, same scatter.** The guarantee is deterministic output for a given document, not that adding a part restores or preserves rocks elsewhere: a new part can reroute a tube or push a neighbour, so the keep-out changes. We do not promise monotone culling.
- **The base stays the hero.** Density is lowest in the build area and under the camera's main view; the ground is quietly textured, never busy. Nothing grimy or noisy (DESIGN_GUIDE): rocks are chunky and soft.
- **P1 holds.** Scatter never rejects a placement. Rocks yield to the base, never the other way round (see formations, §3).
- **Determinism is per engine.** Terrain already uses `Math.exp`/`Math.hypot`, so bytes can differ across JS engines. Within one engine, same input gives same output. Positions are rounded to 1 mm before hashing (as `tube-path.ts` does).

## 2. Layers and data flow

| Piece | Layer | Notes |
| --- | --- | --- |
| `keepOut` | `grammar/solver/keepout.ts` (new solver stage after tubes) | `ResolvedBase.keepOut: Uint8Array(size*size)` on the 1 m grid. Marks every draft's cells **including slab hosts**, plus every tube and dock `path` dilated by `ceil(TUBE_RADIUS + 0.5)`. Today `taken` in `solver/index.ts` is a local that excludes hosts and never holds tube corridors (tubes keep a separate `tubePoints`), so it cannot be reused as is. |
| `candidates(seed, hf)`, `cull(cands, keepOut, size)` | `world/scatter.ts` | Pure, typed arrays, no three, no `ResolvedBase` import (arrows point down). |
| Rock, outcrop block, prop geometry | `geometry/rock.ts`, `outcrop.ts`, `props.ts` | Through the existing recipe → bundle pipeline (`recipeHash`). |
| `ScatterSync` | `render/scatter-sync.ts` | The only code that makes the instanced meshes; one `InstancedMesh` per variant for the whole world. |
| `rock` material | `render/materials.ts` | A new closed-palette entry: `MaterialName` is a compile-time-checked union and DESIGN_GUIDE §3 gets a row first (basalt-tinted regolith trio, roles listed). |

## 3. What gets scattered

**Rocks and boulders.** Candidates come from a hashed jittered grid: jitter, size, variant and tint depend only on `hashInts(i, j, seed)`. Terrain height, slope and crater rims only gate inclusion against a threshold and set `y` and tilt, so a terrain brush stroke (M4) changes only the rocks it touches instead of reshuffling the field. Density is a rockiness fbm field × a slope limit (boulders ≤ 30°) × a boost on crater rims and ejecta rays, damped in the build area. Sizes follow a power law. A rock is sunk at least 30 % into the ground, oriented to the surface normal, never smaller than 0.25 m (smaller reads as shimmer at the camera's FOV and distance, and disappears into the gap between `heightAt` and the mesh's triangles). Geometry: displaced icosphere, about 80 triangles, smooth generator normals, vertex-tinted underside, 2 variants for the first cut and up to 6 later; colour via `instanceColor` from the regolith trio. No LOD1; rocks under 0.4 m fade out beyond 60 m.

**Rock formations and outcrops.** About 12 clusters of 3–7 stacked or leaning strata blocks, each block its own instance, in an outer band and on crater rims. They are placed before the base exists and the keep-out never culls them wholesale: a formation that a part lands on is thinned block by block (blocks inside the keep-out are dropped), which keeps P1 intact without a solver change. Making formations real solver obstacles is a later option and needs its own design; it is not part of M4.

**Debris props.** A few ambient items (crate, cable spool, wheel, panel fragment, tilted dish) on flat ground, at least 15 m apart, built from the existing box and lathe profiles, at most 8 per world. Litter that belongs to a part (crates by a garage, a tool pile at the launcher) is a part-owned decorator, not world scatter. A crashed probe far away is cut for now.

**Wheel tracks.** Not a texture. The wear field already planned for M4 (RG8, about 2 texels/m) is for paths and dust; a 1024² single-channel map would give 9.4 cm texels, so a 30 cm wheel is three texels and the normal is a smear. Tracks are **ribbon decals**: two 0.3 m strips draped on the terrain with `polygonOffset`, a darker regolith tint, merged into one mesh. They are laid by rover agents, so they arrive with rovers in M5 and follow real traffic. If ambient old tracks are still wanted for the screenshot, they are a handful of seeded ribbons added as a separate optional step and judged on the 18:30 shot.

## 4. Performance and look budgets

- Caps: 2500 rocks, 200 boulders (> 0.8 m), 12 outcrop clusters, 8 props. Under 300 k triangles total.
- About 8 draw calls for the whole world (one `InstancedMesh` per variant). Per-chunk meshes would be 180+ draws for no culling gain at a 38° pitch over 96 m, so chunks are **not** instanced separately; the full matrix buffer (2500 × 64 B ≈ 160 KB) is rebuilt on commit, which should stay under 1 ms. Chunk slices only if measured otherwise.
- Shadows: only casters over 0.6 m (under 400). The shadow box is 100 m on 2048 px (about 4.9 cm/texel), so small casters would reproduce the M0 speckle and fail the 06:00 / 18:30 acid test.
- While a part is being dragged (`movingId`), scatter is not recomputed; it updates on commit with a 150 ms per-instance scale fade (decorator pop rule), via one patch in `shader-patches.ts`.
- Generation for the 96 m world under 20 ms; a commit update under 1 ms. Both are measured and written into `PERF.md`.

## 5. Tests (headless)

- Same inputs → identical candidate bytes (hash).
- No instance inside `footprintContains` of any part and none closer to a tube than its dilation (assert on geometry, not on the mask itself).
- Every instance sits on the terrain (within the sink) and boulders respect the slope limit.
- Spacing, size histogram (power-law bounds), and the caps above.
- A terrain edit changes only instances within the edited region.
- Perf guard with a loose bound (like the solver's 250 ms), real numbers in `PERF.md`.

## 6. Player control

Only a density value and "clear" strokes, stored in the document (`scatter: { density: number; clears: ClearStroke[] }`, with a document version bump), undoable like any command. Scatter itself is never stored.

## 7. Staging

1. **S1, M2:** rocks and boulders (2 variants), `rock` material, `keepout.ts`, `world/scatter.ts`, `scatter-sync.ts`, fixed density, no document fields. It is small, depends only on the terrain and the solver, and gives the art gate real depth. Done when 12:00 and 18:30 shots show rocks reading as part of the place with no speckle.
2. **S2, M4:** terrain-edit dirty regions, outcrop clusters, props, density slider and clear brush.
3. **S3, M5:** wheel track ribbons from rovers; optional seeded ambient ribbons.

**Cut for now:** pebble clutter (the camera cannot see it), per-chunk instancing, an R8 track texture, rock LOD dither, the crashed probe. Pebble-scale texture belongs in the regolith micro-normal instead.
