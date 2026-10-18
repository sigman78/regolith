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
- 2026-10-17 22:07 · 2b7c423 · Letter C launcher (mass driver on a sled, coils, hazard muzzle ring) and mixed-alphabet solver property tests
- 2026-10-17 22:10 · 13dff7a · Art pass: hull/graphite instead of aluminum until the env map, hollow muzzle ring, one-line tray labels
- 2026-10-17 22:10 · 9792cf0 · Screenshot sheet for the new modules (12:00 and 18:30), docs for hosts and limits

## M1 — finish

- 2026-10-17 22:25 · 9b2d64b · Parameter picker for every part, remembered per letter, one undo step per change
- 2026-10-17 22:26 · 05259f9 · Letter D opaque dome with collar PRESS ports
- 2026-10-17 22:27 · 2400d52 · Ghost snap arrow when the solver moves the preview
- 2026-10-17 22:37 · a1b6466 · Router fix: no lead through a neighbouring hull, no node on an earlier tube
- 2026-10-17 22:37 · 371557a · Diagnose stage for the DESIGN_GUIDE §8.4 invariants, with property and mutation tests
- 2026-10-17 22:42 · 7288f7d · Router memoisation and pocket shortcut, throttled ghost; PERF.md numbers (2 ms target still unmet)
- 2026-10-17 22:43 · 48df4fb · M1 exit criteria as headless tests: 20 m tube and node, drag-through, 30 parts and undo all
- 2026-10-17 22:45 · cb3bc9d · Screenshots for the picker, dome and snap arrow; 30-part and connect shots driven by real mouse input
- 2026-10-17 22:46 · 4259f5d · Docs: M1 finished in PLAN and ARCHITECTURE (two honest deviations), gizmos for interactive params listed as not yet
- 2026-10-17 22:48 · e27d59d · Docs: automatic terrain decoration added to the M4 plan
- 2026-10-17 22:53 · 8f901ad · Docs: SCATTER.md design for rocks, formations, tracks and debris, staged into M2, M4 and M5

## M2 — The Look

- 2026-10-17 22:57 · 14fe81c · Golden base, `?golden` / `?shot`, screenshot-sheet script and the baseline sheet (18:30 and 21:00 near black, flat sky, terrain edge as a cliff)
- 2026-10-17 22:59 · 13858dd · Sun path with 14 daylight hours: dawn and 18:30 are low, warm and lit
- 2026-10-17 23:03 · 1de3cb4 · Sky dome with sun disc, blue aureole and stars; terrain fades into the horizon; twilight by altitude; hour-based exposure; terrain tint no longer squared
- 2026-10-17 23:05 · 6d0c91b · Shadow box fitted to the base and texel-snapped, rim light, sky environment per half hour for aluminium and glass
- 2026-10-17 23:07 · 886df99 · Post chain: MSAA, half-res GTAO, bloom, ACES, grade; low / medium / high presets
- 2026-10-17 23:08 · 07619f7 · Window panes on the hab flanks, glowing at night through the glass material
- 2026-10-17 23:11 · 0f1723f · Fix: tower top glass band shared a cylinder with the accent stripe (red hatching in close-ups); 48 tower segments
- 2026-10-17 23:13 · badec13 · Baked vertex tints through `tintUnderside` and `tintDust`; palette rows for both
- 2026-10-17 23:18 · 5e7c85b · Scatter S1: solver keep-out stage, `world/scatter.ts`, instanced rocks, `rock` material and palette rows
- 2026-10-17 23:21 · f47cfe9 · Inflate and deflate, tubes extend from their first port, docking clunk
- 2026-10-17 23:24 · 4d41c4a · Docs: M2 status in PLAN (exit left unticked), worklog, PERF numbers, final 4×4 sheet in `docs/shots/m2/final/`
- 2026-10-17 23:26 · 5191326 · Fix: camera pan inverted vertically and too fast; now grab-the-ground, tested at every yaw stop

## After the M2 review

- 2026-10-17 23:47 · 6159a15 · Perf: render on demand, shadow map only when it changes, no double MSAA, pixel ratio cap, F2 quality; GPU timings per preset in PERF.md
- 2026-10-17 23:52 · 4ab2fde · Perf: every preset through the composer, capture-phase wake-ups, `?stress=200` benchmark base; 200 parts measured at about 3,300 draw calls
- 2026-10-17 23:53 · 4f0bf7a · Docs: M2.5 Workshop (flip, gizmos, suggestions, ground contact, individuality) inserted before Life I, with Fable's task order
- 2026-10-18 00:02 · f2849bc · Flip: mirror a part across its length (F in Select and Place), ports mirrored, links and tubes kept, one body scale, no version bump
- 2026-10-18 00:08 · 0178b6e · Perf: one BatchedMesh per material for the whole base, legs included; 200 parts from about 3,300 draw calls to 18–46, mirrored parts draw a mirrored geometry
- 2026-10-18 00:25 · 35c0068 · Generic drag handles from each part's schema (length, radius, width, depth, floors, height), anchored opposite end, blocked by neighbours, readout while dragging, one undo step per drag
- 2026-10-18 00:44 · c9b5865 · Suggested connections for the placed or selected part, verified by trial solves, ghost tubes with accept pills
- 2026-10-18 01:16 · 798af78 · Slabs level the ground under them: one terrain (flat to 1 cm, 2 m skirt) for legs, tubes, mesh, picking and rocks
- 2026-10-18 01:12 · 79a0a34 · Worn ring around footprints and footpads: a 2-channel wear texture (R ring, G reserved for paths) read by the merged regolith shader patch
- 2026-10-18 01:13 · 1c3ef3f · Merged feat/contact into main and pushed
- 2026-10-18 01:25 · 2cfa39d · Individuality: per-instance hull tint (palette segment) and hab stripe variants derived from serial and seed, nothing stored
- 2026-10-18 01:27 · 9b0e68e · Serial stencil on hab hulls as a decal: wrapped onto the hull, yaw-only so flips never mirror it, no extra draw call
- 2026-10-18 01:29 · 8c23d4a · Merged feat/individuality into main and pushed
- 2026-10-18 01:32 · f627d06 · Frame counter on the debug hook, idle heartbeat 5 s, wake on focus, the preset steps down by itself on a slow machine
- 2026-10-18 01:38 · eed0b28 · Merged feat/m25-exit into main and pushed
- 2026-10-18 01:46 · 1a9f8e6 · Sol clock (pause, 1x/2x/4x, scrub), fixed 10 Hz step, one redraw per sol-minute, HUD time, sim layer lint rules
- 2026-10-18 01:48 · 7e2f9f9 · Press graph stage: the walkable network of PRESS parts, docks and tubes, with volumes, skipped on lean solves
- 2026-10-18 01:53 · 05ac512 · Crew: routes over the press graph, errands per sol-hour, agents as (step, s) not coordinates, Sim handle with clock-scaled fixed step, HUD crew count
- 2026-10-18 02:01 · 1ced0d2 · Window silhouettes: crew show as a flat figure on hab and tower panes, snapped bay to bay, one instanced draw, redraws capped at 4 Hz; shared window-bay layout
- 2026-10-18 02:11 · 074f655 · Merged feat/m3 (clock, press graph, crew, window silhouettes) into main and pushed
- 2026-10-18 02:21 · ef7571a · Letters A, S, X static: airlock (door, ramp, chevrons, lamp, docks to a hab flank), solar array, light pole, solar/solarCell/light materials, tool keys 0 and -, golden base uses them
- 2026-10-18 03:07 · 9672739 · Merged feat/m3-letters (airlock, solar array, light pole) into main and pushed
- 2026-10-18 03:21 · 80ac8db · Airlock exit and cycle: crew walk out 08-18 to a loiter spot 4-8 m from the ramp, lock seal/pump/open with up to two riders, per-instance airlock lamp (orange, yellow, green), suited figure outdoors; paused 2 frames per 10 s, 4x capped at 10 Hz
- 2026-10-18 03:31 · 42d24f3 · Merged feat/m3-exit (airlock exit and cycle, crew outdoors, airlock lamp) into main and pushed
- 2026-10-18 03:44 · a5f07c0 · Night lights: pole heads and the one beacon (tallest part that offers a mount, ties by id) as instanced lamps on one material, baked light material removed; paused 2 frames per 10 s
- 2026-10-18 03:52 · 858bb3b · Merged feat/m3-lights (night lights) into main and pushed
- 2026-10-18 04:45 · 86a25ba · Proposal for M3.5 Human scale (flat-floor corridors, one deck height, floor-level ports, stairs) written into PLAN by Fable, to be built before M3 task 7
- 2026-10-18 04:47 · ed17d08 · Merged docs/human-scale (M3.5 proposal and decisions) into main and pushed
- 2026-10-18 04:54 · 9d865a7 · M3.5 stage 0: floor model (one 1.5 m deck for every part), PartDefinition.floor, doors on the floor, graph without the drop, port-on-floor and corridor-steep diagnostics
- 2026-10-18 04:59 · 0e95393 · M3.5 stage 0 checkpoint fixes: PartDefinition.shellGap and port gap so pipe ends reach the hull, all-pairs route check on the golden base, node numbers corrected, stage 1 notes
- 2026-10-18 14:45 · dd33e29 · merge feat/m35-floors: M3.5 stage 0, one floor rule and ports on the floor
- 2026-10-18 15:00 · c499119 · M3.5 stage 1: corridor profile (D section on the floor line, mitred bends with collars, closed ends, floor slab), TUBE_RADIUS and the pipe lift retired, steep suggestions ranked down
