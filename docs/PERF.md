# Performance notes

Budgets live in `ARCHITECTURE.md` §11. This file records what was measured.

## M1

Node 22 on the dev laptop, release-mode timings from a throwaway Vitest profile (mean of 10–20 runs after 3 warm-ups). "Links" are random PRESS-port pairs, which is a worse case than a player's neighbour-to-neighbour tubes: many of them are unroutable and make the router flood its window.

| Measure | Target | Measured | Where |
| --- | --- | --- | --- |
| Full solve, 200 habs/nodes, no links | < 2 ms | ~16 ms (box **unticked**) | `src/grammar/solver/solver.test.ts` asserts a loose 250 ms so slow CI machines do not flake |
| Full solve, 30 mixed parts, no links | < 2 ms | 2.3 ms | place 0.2, overlap 0.8, ground 0.7 |
| Full solve, 30 mixed parts, 6 links in a tight cluster | – | 40 → 10 ms | tubes 37 → 6 ms |
| Full solve, 30 mixed parts, 10 random far links | – | 123 → 40 ms | tubes 120 → 38 ms (15 links: 453 → ~100 ms) |
| Full solve, 200 mixed parts crammed into 96 m, no links | – | 103 ms | overlap 86 ms: the ring search for parts pushed out of a packed field |
| `diagnose` on top of a solve | tests / debug only | +0.3–5 ms | O(parts²) hull gaps plus tube sampling |

The 2 ms target for 200 parts is **not met**; the target stays as it is.

### What was done in M1

- Footprint cells are rasterised once per part and moved with `shiftCellKey` instead of re-rasterised per candidate offset; ring offsets are cached; the rotation is inlined in `footprintCells` (281 ms → ~15 ms for 200 habs).
- Router: `free()` answers are memoised per lattice point (A* asked once per heading and neighbour, ~8×8 times per point) — 3.5–4.5× on link-heavy bases. Output is unchanged (`route.test.ts` asserts each point is asked once).
- Router: a start or goal walled into a pocket of ≤ 400 points returns `null` before the heading-state flood. Exact: headings only remove moves.
- Ghost: the preview solves only when the snapped pose, the letter, its params or the document changes, instead of on every pointer move (`ghost.test.ts`). Moving the cursor inside one grid cell now costs nothing.

### Where the time still goes

1. `tubes`: a failing A* query floods the whole 100×100×8 window, and a link tries up to three clearances with two queries each. Pockets are cheap now; a big open region that is cut off from the goal still floods.
2. `overlap`: scales with how crowded the field is, not with part count alone.
3. `solve` recomputes everything on every command; nothing is cached between solves.

### Next steps

1. Incremental solving: take a dirty set of part ids, re-run `overlap` only for parts near them (spatial hash), reuse unchanged `ResolvedPart`s by reference. If this lands, add the equality property: across random edit sequences (including `movingId`) the cached result deep-equals a fresh full solve.
2. Re-route only the tube links whose endpoints or corridor changed.
3. Move `solve` and `buildBundle` into a worker (needed by M2 anyway).

## M2 — scatter (rocks)

Measured with `vite-node` on the dev machine (Node, warm), 96 m world, seed `olympus-07`.

| What | Target (SCATTER §4) | Measured |
| --- | --- | --- |
| `scatterCandidates` (generate every rock) | < 20 ms | 2.0 ms, 618 rocks |
| `cullScatter` against the keep-out | < 1 ms | 0.17 ms |
| `keepOut` solver stage, golden base | – | inside the full solve; not separated yet |

Draw calls for rocks: at most 4 (2 variants × shadow casters / non-casters). Only rocks over 0.6 m cast shadows.

## M2 — render and geometry cost

Measured on the dev machine; **none of this is the reference iGPU laptop, so the 60 fps exit line is unverified.**

| What | Result |
| --- | --- |
| Golden base (10 parts, 5 tubes) | 37.7 k triangles, 42 meshes (about 3.8 k triangles and 4 meshes per part) |
| Extrapolated to 200 parts | about 0.75 M triangles and 800+ draw calls before any instancing or LOD: the likely first cost on an iGPU |
| Uncached `buildBundle`, default params | H 3.9 ms, E 4.8 ms, C 2.3 ms, P 2.0 ms, M 1.5 ms, V 0.8 ms, D 0.8 ms, N 0.6 ms; cached by recipe hash |
| Frame time, golden base, 1280×800, low / medium / high | 6.1 / 6.1 / 6.1 ms in headless Chrome. This is the browser's refresh interval, not GPU cost: it cannot tell the presets apart. |

Why the geometry worker is not in this pass: the slowest uncached build is under 5 ms and bundles are cached by recipe hash, so a resize drag costs at most one build per step, inside a frame. A worker would add async plumbing for no measured gain today.

Why LOD dither is not in this pass: it needs second geometry levels for H, N, V and D that do not exist yet, and its payoff is the 200-part case above, which cannot be measured here. It is the first thing to do once a number from the reference laptop says draws or triangles are the problem. Merging parts of one material into fewer draws is the cheaper first step.

## Render load (after the M2 review)

Measured with `EXT_disjoint_timer_query_webgl2` in Chrome (the `__regolith` debug hook exposes `renderer` and `post`), golden base, 1280×800, pixel ratio 1, dev-machine GPU. This is a strong GPU: read the ratios, not the milliseconds.

| Preset | GPU ms per frame | of which shadow map |
| --- | --- | --- |
| low (direct) | 0.7 | 0.55 |
| medium (MSAA + bloom + grade) | 1.2 | 0.5 |
| high (adds half-res GTAO) | 4.3 | – (swamped by the AO pass) |

What the user saw ("GPU goes brr"): the loop drew at the display's refresh rate forever, with the shadow map redrawn every frame, MSAA on the canvas and in the composer, pixel ratio up to 2 and high as the default.

Done: render on demand (draw only while input, camera easing, an edit, the hour or an animation is active; 60 fps cap; 2 fps heartbeat idle), shadow map refreshed only when the hour, an edit or an animation changes it, no canvas MSAA when the composer resolves its own, pixel ratio capped at 1.5, F2 toggles medium / high. Measured idle: about 2 renders a second instead of 60+; panning leaves the shadow map alone; an edit refreshes it for the length of the animation only.

Not done: dynamic resolution, merging draws per material (the 200-part case), caster culling for the shadow pass.
