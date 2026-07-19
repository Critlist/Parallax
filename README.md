# Parallax

Parallax is a small local Next.js app for viewing semantic code graphs in 3D.
It revives the 3D renderer from Omnigraph, an older Tauri/Rust desktop
code-visualization experiment, and points it at
[Graphify](https://github.com/Graphify-Labs/graphify)-style `graph.json`
exports.

Graphify is the first supported input format. It is not part of this renderer:
Parallax does not parse repositories, call LLMs, build communities, or produce
graph exports. It adapts an existing graph export into a canonical graph model
and renders that model with Three.js through `3d-force-graph`.

## Current Status

This is a shareable prototype, not a finished product. It exists because the
Omnigraph renderer was visually useful, and Graphify is now a better engine for
producing the semantic graph data that renderer needs.

The app can load the included sample or a local compatible JSON file in the
browser. There is no backend and no upload path; selected files stay local to
the browser session.

Licensed under MIT. See `LICENSE`.

## Screenshots

![Dense large Graphify export rendered in Parallax](public/screenshots/parallax-large-dense.png)

![Zoomed-out large Graphify export fit in the Parallax viewport](public/screenshots/parallax-large-fit.png)

## Architecture

```text
Graphify export -> adapter -> canonical graph model -> Graph3DVisualization -> Three.js / 3d-force-graph
```

- Omnigraph supplied the original 3D renderer idea and interaction model.
- `src/lib/graphifyAdapter.ts` validates and maps Graphify/networkx
  `node_link_data` style exports into the renderer's `GraphData` shape.
- `src/lib/graph3d.ts` owns the 3D renderer boundary: force graph setup,
  Three.js node objects, camera movement, resize handling, and disposal.
- `src/components/GraphViewer.tsx` owns the UI shell: loading the bundled
  sample, reading a user-selected JSON file, showing stats, and showing the
  selected node.
- `src/app/page.tsx` dynamically loads the viewer because `3d-force-graph`
  touches `window` at import time and cannot be server-rendered.

## Requirements

- Bun 1.3.x
- Node.js 20.9 or newer, per the bundled Next.js 16 docs
- A modern WebGL-capable browser

The repository uses `bun.lock` as the lockfile and declares
`"packageManager": "bun@1.3.14"` in `package.json`.

## Setup

```bash
bun install
bun run dev
```

Open http://localhost:3000.

## Loading Graphs

Use **Load restoHack sample** to load the bundled sample at
`public/sample/graph.json`.

Use **Load graph.json...** to choose your own local JSON export. The expected
shape is Graphify's `graph.json` format, which is compatible with networkx
`node_link_data`: a top-level object with `nodes` and `links` arrays, node
`id` values, and link `source`/`target` values that refer to existing node ids.

The checked-in source fixture lives in `fixtures/graphify-restohack/`. The
runtime copy in `public/sample/graph.json` is what the sample button fetches.

## Commands

```bash
bun install
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Other useful commands:

```bash
bun run dev       # local development server
bun run start     # serve a production build after bun run build
bun run format    # rewrite files with Prettier
bun run test:watch
```

## Project Layout

```text
src/app/                 Next.js App Router entry points
src/components/          React UI for the graph viewer
src/lib/graphifyAdapter.ts
src/lib/graph3d.ts
fixtures/graphify-restohack/
public/sample/graph.json
```

## Limitations

- Graphify is the first supported input format; other graph shapes need an
  adapter before they should be considered supported.
- Hyperedges are counted in stats but not rendered as first-class visual
  objects.
- Link confidence is carried through the canonical model but only the
  confidence label currently affects link color.
- Node selection is passed from the renderer to React through an explicit
  callback, keeping selection state local to the viewer component.
- CI runs formatting, linting, typechecking, tests, and a production build on
  GitHub Actions.
