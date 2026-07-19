<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Parallax — agent harness

Parallax is a **local, offline 3D viewer** for Graphify-style semantic code-graph exports. There is no backend, no upload path, no repo parsing, and no LLM calls. It adapts a `graph.json` export into a canonical model and renders it with three.js via `3d-force-graph`.

Pipeline: `Graphify export → graphifyAdapter → GraphData → Graph3DVisualization → three / 3d-force-graph`

## Non-negotiables

- **TDD, always.** Write the failing test first, run it and watch it fail, then implement the minimum to pass. Red → green → commit. No implementation code before a failing test exists.
- **Bun is the toolchain.** Use `bun` / `bun run` — never `npm`, `yarn`, or `pnpm`. The lockfile is `bun.lock`; `packageManager` is pinned in `package.json`.
- **This is a modified Next.js 16.** APIs and conventions differ from your training data — read `node_modules/next/dist/docs/` before writing framework code (see the block above).
- **No AI attribution in commits.** No `Co-Authored-By`, no "Generated with…" trailers, no agent names.
- **Branch off `main`.** Never commit feature work directly on `main`. One commit per green task.

## Commands

| Task                     | Command                                 |
| ------------------------ | --------------------------------------- |
| Install                  | `bun install`                           |
| Dev server               | `bun run dev` → <http://localhost:3000> |
| Run all tests (one-shot) | `bun run test`                          |
| Run one test file        | `bun run test <path>`                   |
| Watch tests              | `bun run test:watch`                    |
| Typecheck                | `bun run typecheck`                     |
| Lint                     | `bun run lint`                          |
| Format (write)           | `bun run format`                        |
| Production build         | `bun run build`                         |

Run `bun run format` before every commit. Before declaring a task done, confirm `bun run test && bun run typecheck && bun run lint` are all green — evidence before assertions.

## Architecture & where things live

- `src/lib/graphifyAdapter.ts` — validates and maps Graphify / networkx `node_link_data` exports into the canonical `GraphData`. Pure; no three.js. **All input validation belongs here.**
- `src/lib/graph3d.ts` — the **renderer boundary**. Owns force-graph setup, three.js node meshes, camera movement, hover/selection, resize handling, and disposal. This is the only module that imports `3d-force-graph` / `three`.
- `src/components/GraphViewer.tsx` — the single stateful UI shell. Holds the `Graph3DVisualization` ref, derives the visible graph from filters, and owns all React state.
- `src/components/graph-viewer/*` — presentational panels (`LoadPanel`, `FilterPanel`, `GraphToolbar`, `Legend`, `NodeInspector`) and `GraphViewer.module.css`.
- `src/app/page.tsx` — dynamically imports the viewer with SSR disabled (`3d-force-graph` touches `window` at import time and cannot be server-rendered).

Import alias: `@/` → `src/` (e.g. `import { GraphData } from "@/lib/graph3d"`).

## Core pattern: pure decisions + thin effects

`graph3d.ts` deliberately separates **decisions** (pure, exported, unit-tested) from **effects** (three.js mutation, tested through a mocked graph). When adding renderer behavior, put the logic in a pure function first, then wire it in.

- Pure examples to imitate: `computeCameraPosition`, `linkParticleCount`, `computeHoverHighlight`, `nodeEmphasis`.
- The class consumes those in the fluent `3d-force-graph` builder and mutates meshes.

## Testing conventions

- **Framework:** Vitest + jsdom. Global setup is `vitest.setup.ts` (registers `@testing-library/jest-dom` matchers and stubs `ResizeObserver`, which jsdom lacks and the renderer constructs unconditionally).
- **Colocate** tests with their source. Name renderer tests by aspect: `graph3d.<aspect>.test.ts` (existing: `.camera`, `.selection`, `.hover`, `.affordances`, `.dispose`).
- **Pure functions** — import and assert directly. Reference: `src/lib/graph3d.affordances.test.ts`.
- **Renderer/class wiring** — mock `3d-force-graph` with a fluent-builder stub via `vi.hoisted` + `vi.mock`, capturing the handlers/accessors you need to assert on. Reference: `src/lib/graph3d.selection.test.ts`, `src/lib/graph3d.hover.test.ts`. Copy that structure and extend the builder list with any accessor your change registers.
- **React components** — `@testing-library/react`. Reference: `src/components/GraphViewer.test.tsx`.

## ⚠️ The 3d-force-graph landmine (read before touching the renderer)

`3d-force-graph` runs a **continuous render loop** (`requestAnimationFrame`). Two consequences that are easy to get wrong:

1. **To restyle an existing object, mutate its material directly** — e.g. `mesh.material.opacity = …`. The render loop reflects it on the next frame. This is cheap and correct.
2. **Never call `graph.refresh()` or re-register a node/link accessor** (`.nodeColor(fn)`, `.linkColor(fn)`, `.linkWidth(fn)`, `.linkDirectionalParticles(fn)`, …) on hover, selection, or any per-frame path. Both set `_flushObjects` / trigger a digest that **rebuilds every node mesh and every link + particle system** — an expensive per-event rebuild that also discards direct material mutations. The visible result is flashing and lock-ups. (We hit exactly this bug; the fix was to mutate node meshes in place and touch nothing that triggers a digest. To _read_ metrics, `renderer.info` counters are safe.)

Related facts:

- Node meshes are custom `nodeThreeObject`s, so the library's `nodeColor` / `nodeOpacity` accessors do **not** drive them. Keep an `id → mesh` map and mutate the materials directly.
- Link line-materials are **cached and shared by color**, so they can't be safely mutated in place — restyling links live is a rebuild (flash). Prefer node-side signals, or an overlay layer of objects you own.
- **`renderer.info` does not track materials** — it exposes `render.{calls, triangles, points, lines}` and `memory.{geometries, textures}` only. Derive material counts by traversing the scene for unique instances.
- Force-engine state is observable via `onEngineTick` / `onEngineStop`; the renderer is reachable via `renderer()`, the scene via `scene()`.

## Gotchas

- **WebGL context leak:** `dispose()` must `forceContextLoss()` and detach the canvas. Browsers cap concurrent GL contexts (~16) and React StrictMode double-mounts; without this, remounts silently break rendering. Do not remove that teardown.
- **DirectionalLight** needs a non-origin position or it lights nothing (it emits along position→target).
- **Camera math** must guard the origin / undefined case — a node at the origin has no direction vector to scale toward (`computeCameraPosition` handles this; keep it).
- **Stay local:** never add network calls, uploads, analytics, or telemetry. User-selected files must stay in the browser session.

## Local working notes

Design specs and implementation plans may exist under `docs/superpowers/`. These are **gitignored local notes**, not part of the repo. If an implementation plan is present there, treat it as the source of truth for the task in progress and execute it task-by-task.
