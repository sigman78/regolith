# Regolith — working notes for agents

Cozy Martian base-building toy (Tiny Glade spirit), three.js + TypeScript + Vite. Everything is procedural; no asset files.

## Read first
- `docs/KICKOFF.md` (why), `docs/DESIGN_GUIDE.md` (rules the generator enforces), `docs/ARCHITECTURE.md` (layers), `docs/PLAN.md` (what is next).

## Commands
- `npm run dev` · `npm test` · `npm run typecheck` · `npm run build`

## Non-negotiables
- Layers point down only: `editor → sim → render → geometry → grammar → world → core`. `grammar/` and `world/` never import three scene classes; `render/` is the only place that touches `Scene`, materials, lights.
- Materials come from `src/render/materials.ts` only. Design numbers come from `src/geometry/design-constants.ts` only (create it if missing).
- Every generator is a pure function of (params, seed). Same input, same bytes.
- One bevel size (6 cm), closed palette, no texture files, no outlines.
- Invalid placements are resolved, never rejected (pillar P1). No modal dialogs.
- Visible changes ship with a 12:00 and an 18:30 screenshot under `docs/shots/<milestone>/`.

## Conventions
- kebab-case files, PascalCase types, no `any`, no default exports except Vite entries.
- Tests live next to code as `*.test.ts` (Vitest). Grammar/solver/geometry must be testable headless.
- Commit prefixes: `feat:` `fix:` `art:` `perf:` `docs:` `chore:`.
