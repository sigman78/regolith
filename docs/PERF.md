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
