# Regolith

A cozy Martian outpost-building toy in the spirit of Tiny Glade: draw habitats from a small alphabet of chunky procedural parts and watch the base come alive. Three.js, PBR, time of day, no assets, no fail state.

**Status:** pre-production scaffold. Read the docs first:

- [docs/KICKOFF.md](docs/KICKOFF.md) — vision, pillars, what makes it fun
- [docs/DESIGN_GUIDE.md](docs/DESIGN_GUIDE.md) — look, palette, materials, lighting, the part alphabet, animation rules
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, data model, grammar/solver, rendering, sim, editor
- [docs/PLAN.md](docs/PLAN.md) — milestones and the first tasks

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test
npm run build
```

Controls in the scaffold: drag to orbit (snaps to 45°), right-drag to pan, wheel to zoom, `[` / `]` to scrub time of day, `Q` / `E` to rotate.
