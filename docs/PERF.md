# Performance notes

Budgets live in `ARCHITECTURE.md` §11. This file records what was measured.

## M1

| Measure | Target | Measured | Where |
| --- | --- | --- | --- |
| Full solve, 200 habs/nodes, no links | < 2 ms | ~13–16 ms | `src/grammar/solver/solver.test.ts` (the test asserts a loose 250 ms so slow CI machines do not flake) |

### Why it is over budget

`solve` recomputes everything on every command and every ghost update. The two heavy stages are `overlap` (footprint rasterisation plus the ring search) and `tubes` (A* per link). Both are cheap per part but scale with the whole base.

What already helped (281 ms → ~15 ms): footprint cells are rasterised once per part and moved with `shiftCellKey` instead of re-rasterised per candidate offset; ring offsets are cached; the rotation is inlined in `footprintCells`.

### Next steps

1. Incremental solving: take a dirty set of part ids, re-run `overlap` only for parts near them (spatial hash), reuse unchanged `ResolvedPart`s by reference.
2. Re-route only the tube links whose endpoints or corridor changed.
3. Move `solve` and `buildBundle` into a worker (needed by M2 anyway).
4. The ghost solves a scratch document on every pointer move; throttle it to cell changes.
