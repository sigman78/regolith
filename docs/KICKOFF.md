# REGOLITH — Kick-off

*Working title. A cozy Martian outpost-building toy in the spirit of Tiny Glade, with a warm, chunky, hard-ish sci-fi look.*

Last updated: 2026-10-17 · Status: pre-production · Companion docs: [DESIGN_GUIDE.md](DESIGN_GUIDE.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [PLAN.md](PLAN.md)

---

## 1. One sentence

You draw a Martian base with a handful of chunky procedural parts, and the base comes alive around what you drew: crew walk the tubes, panels chase the sun, dust settles on the windward side, and windows glow at dusk.

## 2. Why this game

Tiny Glade proved that a builder needs neither economy nor failure to be compelling. Its joy comes from three things:

1. **Instant, generous response.** Every stroke produces something finished and pretty. The game does the tedious 90%.
2. **Life in the margins.** Sheep, birds, ivy. Things you did not place but that reward what you did.
3. **The photograph.** Time of day, a soft look, and a camera that makes every corner frame-worthy.

Regolith keeps all three and changes the fantasy: not a medieval ruin but a **working outpost on Mars**. That swap buys us things a castle cannot have: machines that move, lights that come on, a sky that turns blue at sunset, vehicles, launches, and a reason for everything to be connected (air, power, people). The outpost is a *system*, and systems animate themselves.

## 3. Pillars

Decisions get tested against these. If a feature does not serve one, it waits.

| # | Pillar | What it means in practice |
|---|--------|---------------------------|
| P1 | **Nothing can go wrong** | No fail state, no resources, no blocking errors. Invalid placements are *resolved*, not rejected. The worst outcome of any click is "that looks different than I expected", and undo is one key away. |
| P2 | **Every stroke finishes the job** | Place a module and it gets legs, hatches, cable runs, a worn path, a stencil number, dust. Connect two modules and the tube routes itself with correct flanges. The player never does detail work. |
| P3 | **The base is alive** | Crew, rovers, drones, panels, airlocks, antennas, and plants all react to what exists and to the time of day. Life is the reward for building. |
| P4 | **One look, zero glitches** | A single material library, a single bevel size, one shape language. No z-fighting, no shadow acne, no intersecting hulls, no popping. Consistency is enforced by the generator, never by the player. |
| P5 | **Worth a screenshot at every zoom** | Readable silhouette from far away, delightful detail up close, lovely at every hour of the sol. |

## 4. The player fantasy

You are the mission architect, but one from a kinder future where everything already works. You sketch; the crew builds and moves in. You are allowed to be a tourist in your own outpost: zoom down to the airlock and watch someone cycle through it, follow a rover out to the pad, wait for the lander, scrub the clock to catch the blue sunset.

## 5. Core loop

```
   place / stretch / connect a part
                 │
                 ▼
   grammar resolves it (snap, legs, tubes, decorators)   ← 1 frame
                 │
                 ▼
   life layer notices (crew re-plan routes, power graph, light)
                 │
                 ▼
   player zooms in, watches, scrubs time, screenshots
                 │
                 ▼
   "what if I add a greenhouse there?" ──────────────────┘
```

There is no "turn", no "end". Session shape is 10 to 60 minutes of building punctuated by watching.

## 6. Fun factor — where the joy comes from

Concrete things, each testable in play:

- **Inflate on place.** Habitats are inflatable. Placing one drops a folded bundle that puffs up in ~0.6 s with a tiny overshoot. Deleting deflates it. This is the game's signature verb.
- **Drag to grow.** Grab a hab end and pull; it gains rib segments one at a time with a soft click. Grab a dome and pull; it grows in radius. Tubes stretch like telescopes.
- **Auto-connect with a wink.** Bring two ports near each other and a ghost tube appears before you commit. Release and it clunks into place with docking lights.
- **Legs that find the ground.** Put a module on a slope and it stands up on stilts of exactly the right length, with a ladder on the downhill side.
- **Worn paths.** Crew walk between airlocks, garages and pads. Paths they use appear in the regolith over time. Build a shortcut and the old path fades.
- **Cables and pipes you never drew.** Power runs on little pylons from arrays to habs along the straightest ground path, hopping over tubes.
- **Sun-chasing arrays.** Solar panels track the sun across the sol. At night they park. Watching 40 of them turn at once is the point.
- **Dusk.** Windows warm up, ground lights fade in, antenna beacons blink, the sky goes blue around the sun and then to a deep plum. The whole base changes mood without a single click.
- **The lander.** Every few minutes a lander comes in on the pad with dust blast and a shake. Crew walk out. If there is no pad, nothing lands, which is the gentlest possible nudge to build one.
- **Dust devils.** Occasional, harmless, lovely. Dust accumulates on the windward side of everything and a cleaning drone occasionally blows it off.
- **Crew with errands.** Each astronaut has a tiny visible agenda: greenhouse shift, airlock cycle, rover check. More habitat volume means more crew. More greenhouses means plants that grow.
- **Photo mode.** Unlock the pitch, hide the UI, pick an hour, add a focal plane, export a PNG. Share link encodes the whole base in the URL.
- **Postcards (soft goals, optional).** "A base with a view of the crater" or "Lights on at three domes". No reward other than a stamp and a pretty frame. Entirely skippable.

## 7. What the game is not

- Not a survival or economy game. No oxygen meters, no budgets, no research tree.
- Not a physics sandbox. Things do not fall over. Structural "rules" exist only to make outcomes look right.
- Not a first-person game. The fixed isometric-like camera is a feature; photo mode is the one exception.
- Not an asset-heavy game. Everything is generated at runtime from parameters. The repository ships no 3D model files and, ideally, no texture files.

## 8. The part alphabet (summary)

The base is written in an alphabet of ~16 parametric parts. Each part has **parameters** (length, radius, rows…), **ports** (typed sockets: pressurized, structural, power, exterior) and **decorator hooks** (where handrails, stencils, lights and dust may attach). A **grammar** decides how letters combine: pressurized ports mate via tubes or direct docking, structural ports need ground or a pad, power ports attract cables. A **solver** enforces the grammar every frame so what the player sees is always valid.

The full alphabet, the composition rules and the invariants live in the [Design Guide §8](DESIGN_GUIDE.md#8-the-part-alphabet).

## 9. The life layer (summary of animation and ambient ideas)

Grouped by what triggers them:

**Triggered by the clock** · sun tracking arrays · window glow · beacon blink · ground lights · radiators glow faint red on cold nights · satellite passing overhead that dishes track · night sky with Phobos streaking · morning frost on shaded sides that burns off.

**Triggered by structure** · crew count from habitat volume · crew routes along the tube graph · airlock cycles with light sequence and a puff of condensation · rovers between garage and pad · drones inspecting the tallest mast · plants in greenhouses growing over minutes · a printer rover 3D-printing regolith shells over modules flagged "shielded" · cables and paths appearing.

**Triggered by editing** · inflate / deflate · telescoping tubes · legs extending · ghost previews · port halos · docking clunk · dust puff on terrain edits · camera nudge toward new things (subtle).

**Ambient** · dust devils · wind socks · flag · drifting fine dust layer · occasional meteor at night · a distant rover headlight line on the horizon.

## 10. Target & scope

- **Platform:** desktop browsers, WebGL2 via three.js. 60 fps at 1080p on a 2020 laptop iGPU is the floor; integrated-GPU first, discrete GPU second.
- **Input:** mouse + keyboard. Touch later.
- **v1 "Outpost":** the full loop with 10 parts, terrain brushes, crew + rovers + arrays + lights, time of day, save/share, photo mode. See [PLAN.md](PLAN.md).
- **Team:** one or two people plus AI agents. Everything procedural so no art pipeline is needed.

## 11. Risks and open questions

| Risk | Mitigation |
|------|------------|
| Procedural geometry looks "programmer art" | Design guide is strict about shape language, one bevel, one palette. Weekly screenshot review against reference board. Milestone M2 is a hard "looks good" gate. |
| Tube routing and hull intersection become a research project | Constrain the problem: ports on a 1 m grid, 8 yaw stops, tubes as arcs/segments with auto-inserted nodes. Solve for "always valid", not "always optimal". |
| Life layer eats the frame budget | Agents are cheap state machines on a precomputed graph; instancing for everything repeated; sim ticks at 10 Hz, rendering interpolates. |
| Scope creep in the alphabet | Alphabet is frozen per milestone. New letters need a new slot in the plan. |
| WebGL vs WebGPU churn in three.js | Start WebGL2 with classic materials. Keep all shader customisation in one place so a later move to node materials is mechanical. |

Open questions for the first playtest: does a soft goal system (postcards) add or subtract? Should crew have names? Is a free-rotate camera better than 8 stops for building (we think no, but test)?

## 12. Document map

| Doc | Purpose |
|-----|---------|
| `docs/KICKOFF.md` | This. Vision, pillars, fun, scope. |
| `docs/DESIGN_GUIDE.md` | Look, feel, palette, materials, lighting, camera, part alphabet, animation rules, consistency rules. |
| `docs/ARCHITECTURE.md` | Code structure, data model, grammar/solver, rendering, sim, editor, persistence, testing. |
| `docs/PLAN.md` | Milestones with exit criteria, first tasks, backlog. |
| `CLAUDE.md` | Working conventions for agents and humans in this repo. |
