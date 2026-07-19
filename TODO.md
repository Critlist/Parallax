# Known Issues

This file preserves review findings that are not product features. Items marked
resolved are kept for context from the first cleanup pass; unresolved items are
still open.

## Unresolved

1. **Selection event bus** - `src/lib/graph3d.ts` dispatches a window-level
   `node-selected` `CustomEvent`. This works for the current single-viewer UI,
   but it is a coupling smell if more UI needs to react to selection later.

2. **Styling approach** - the UI currently uses inline `React.CSSProperties`
   objects, with no CSS framework or component library. This is acceptable for
   the small viewer, but should be revisited before building out more panels or
   workflows.

3. **No CI** - local lint, format check, typecheck, tests, and production build
   exist, but there is no GitHub Actions or other CI workflow yet. This is a
   nice-to-have before collaborative development, not a blocker for sharing the
   current prototype.

## Resolved In Current Tree

1. **WebGL context leak in `dispose()`** - `Graph3DVisualization.dispose()`
   now calls `forceContextLoss()` and removes the renderer canvas. Covered by
   `src/lib/graph3d.dispose.test.ts`.

2. **NaN camera position on origin-node click** - camera positioning now falls
   back to a fixed +z offset when the node has no finite direction vector.
   Covered by `src/lib/graph3d.camera.test.ts`.

3. **Weak Graphify input validation and misleading error message** -
   `isGraphifyExport()` now validates per-element node/link identity fields,
   `validateGraphReferences()` catches dangling links, and the UI reports shape
   errors separately from JSON parse errors. Covered by
   `src/lib/graphifyAdapter.test.ts` and `src/components/GraphViewer.test.tsx`.

4. **Unhandled `FileReader.onerror`** - file read failures now clear loading
   state and show an error. Covered by `src/components/GraphViewer.test.tsx`.

5. **Directional light at origin** - the directional light now has a position,
   so it contributes to scene shading.

6. **Misleading confidence comment** - link `value` is now documented as carried
   through but not yet wired to a visual channel.

7. **License undecided** - the project now has an MIT license in `LICENSE`.

## Checked, Not Issues

- Repeated sample/file loads do not leak node geometry/materials based on the
  current `three-forcegraph` replacement path.
- The dependency tree resolves a single `three` version.
- The file-level `eslint-disable @typescript-eslint/no-explicit-any` in
  `src/lib/graph3d.ts` is scoped to the untyped `3d-force-graph` boundary.
