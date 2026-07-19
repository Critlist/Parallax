# Parallax

A lightweight, local-first 3D viewer for code/knowledge graph exports —
originally built to render [Graphify](https://github.com/Graphify-Labs/graphify)'s
`graph.json` output, but works with any [networkx `node_link_data`](https://networkx.org/documentation/stable/reference/readwrite/generated/networkx.readwrite.json_graph.node_link_data.html)-shaped
graph (`{nodes, links}` with `id`/`source`/`target`).

No backend, no account, nothing leaves the browser — point it at a `graph.json`
and it renders. Runs as a static Next.js app.

## Why this exists

Graphify does the hard part — tree-sitter parsing, LLM-assisted relationship
extraction, community detection — and exports a rich `graph.json`. Its own
default viewer (`graph.html`) renders that with `vis-network`, a 2D-ish
physics graph. This project is a focused alternative: take that same export
and render it as a real WebGL 3D scene (`3d-force-graph` / Three.js), with
node coloring by detected community and edge styling by extraction
confidence.

It intentionally does none of the parsing/extraction work itself.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then either:

- click **Load restoHack sample** to load the bundled fixture
  (`public/sample/graph.json`, copied from `fixtures/graphify-restohack/`), or
- click **Load graph.json…** and pick your own Graphify (or compatible) export

## How it works

- `src/lib/graph3d.ts` — thin wrapper around `3d-force-graph`/Three.js:
  scene setup, node sizing/coloring, camera fly-to-node on click, resize
  handling
- `src/lib/graphifyAdapter.ts` — converts a Graphify `graph.json` export into
  the `{nodes, links}` shape the viewer expects (`isGraphifyExport` guards
  against unrecognized input; `fromGraphifyExport` does the mapping)
- `src/components/GraphViewer.tsx` — the page: file loader, stats panel,
  selected-node panel

## Fixtures

`fixtures/graphify-restohack/` holds a real Graphify export from the
[restoHack](https://github.com/Critlist/restoHack) codebase for reference/testing — 984 nodes,
2930 edges, 84 communities. `graph.json` is the data the viewer consumes;
`graph.html`/`GRAPH_REPORT.md`/`manifest.json`/`cost.json` are Graphify's own
output kept for comparison.
