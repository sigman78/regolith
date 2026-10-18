# Worklog

One line per task accomplished, oldest first. Append a line when a task lands; never edit old lines.

Format: `YYYY-MM-DD HH:MM · commit · what` (local time, UTC-7). Times are when the work on that task started (creation time of its first source file); `git log` has the exact commit times.

## M1 — first ten tasks (branch `feat/m1-alphabet-1`)

- 2026-10-17 21:21 · c79c82b · ESLint with per-folder layer import rules, Prettier, CI workflow (task 1)
- 2026-10-17 21:22 · af3f66b · `design-constants.ts`, `GeometryBundle`, profile library, hab builder and bundle validation (task 2)
- 2026-10-17 21:23 · eb4c646 · Letter H as a `PartDefinition`, with property tests that ports lie on the hull (task 5)
- 2026-10-17 21:24 · 229d8b8 · Grammar types, params, footprints and the part registry (task 4)
- 2026-10-17 21:24 · 7428f00 · `BaseDocument`, commands, snapshot undo/redo store (task 3)
- 2026-10-17 21:26 · 988bc0f · Solver place, overlap and ground stages with legs; "nothing floats" tests (task 6)
- 2026-10-17 21:30 · 9389ae1 · `SceneSync` v1 draws parts, tubes and legs from geometry bundles; lighting split out of `main.ts` (task 7)
- 2026-10-17 21:31 · dc661e7 · Select, Place and Delete tools, solver-driven ghost, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (task 8)
- 2026-10-17 21:31 · cd9b4ee · Grow handles for hab length; first screenshot sheet in `docs/shots/m1/` (task 10)
- 2026-10-17 21:36 · 733840e · Letter N (sphere node) and the dock stage (task 9a)
- 2026-10-17 21:40 · 4c5b013 · Grid A* tube routing, node insertion, Connect tool, "tubes never cross hulls" tests (task 9b)
- 2026-10-17 21:49 · a9073aa · Docs: ARCHITECTURE solver order, snapshot undo and design-constants exception; PERF.md; PLAN ticks; this worklog

## M1 — module variety (pulled forward from M5)

- 2026-10-17 21:58 · 6c15313 · Plan and design guide: tower V, slab P, mast M, power plant E pulled into M1; new letter C (launcher)
- 2026-10-17 21:59 · f4e469e · Shared plumbing: `warning` material, bevel box/cylinder/rod helpers, part summaries, tray and hotkeys built from the registry
- 2026-10-17 22:01 · cdc1539 · Letter P slab as a raised deck; solver stands parts on slab tops, slabs only collide with slabs, tubes clear slab tops
- 2026-10-17 22:03 · b390d1c · Letter V tower: 2–5 floors, ground and upper-floor PRESS ports, tube from an upper port tested
- 2026-10-17 22:04 · 3e92332 · Letter M radio mast: 6/12/20 m lattice with dish, whip or relay head, accent beacon, inert POWER port
- 2026-10-17 22:05 · a66f61d · Letter E power plant: 2/3 m drum, radiator fins, hazard band, three inert POWER ports
