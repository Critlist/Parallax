# Known issues

From a full-repo review pass after the initial commit (4cb5cbc). Ranked by severity.

## Bugs

1. **WebGL context leak in `dispose()`** — `src/lib/graph3d.ts` (`dispose()`/`_destructor`)
   `_destructor()` calls `renderer.dispose()` but never `forceContextLoss()` and never
   releases the canvas. React StrictMode double-mounts and dev hot-reloads will orphan
   a GL context each cycle; browsers cap concurrent contexts (~16), so enough
   remounts turns the viewer black with no error.

2. **NaN camera position on origin-node click** — `src/lib/graph3d.ts` (`handleNodeClick`)
   `Math.hypot(node.x, node.y, node.z)` is 0 when a node sits at the origin
   (trivial with a single-node graph, or any node the force sim hasn't moved yet),
   giving `distRatio = Infinity` and NaN camera coordinates.

3. **Weak Graphify input validation + misleading error message** — `src/lib/graphifyAdapter.ts`
   (`isGraphifyExport`) / `src/components/GraphViewer.tsx` (`loadRaw`)
   `isGraphifyExport` only checks `nodes`/`links` are arrays, not that their elements
   are well-formed. Malformed elements do throw inside `fromGraphifyExport` and are
   caught, but under the wrong message ("Could not parse that file as JSON" for a file
   that parsed fine but has bad shape). Link `source`/`target` aren't validated against
   real node ids either.

## Smaller cleanup

4. `FileReader.onerror` unhandled in `onFilePicked` (`GraphViewer.tsx`) — a failed file
   read leaves the "Loading…" button stuck permanently.
5. `node-selected` window-level `CustomEvent` bus (`graph3d.ts`) — works at this scale,
   but is a smell if more UI needs to react to selection later.
6. `DirectionalLight` added with no position set (`graph3d.ts`, `initializeGraph`) —
   currently contributes nothing to the scene.
7. Adapter computes `confidence_score` into `link.value` with a comment claiming it
   "drives opacity" — it doesn't; `linkOpacity` is a hardcoded constant. Stale comment
   describing an unwired feature.

## Cleared (checked, not issues)

- Repeated `loadSample()`/file-load calls do **not** leak node geometry/materials —
  verified against `three-forcegraph` internals, which correctly deallocates removed
  custom objects on `graphData()` replacement.
- No duplicate-`three`-instance footgun — single `three` version resolves everywhere.
- The file-level `eslint-disable @typescript-eslint/no-explicit-any` in `graph3d.ts`
  is legitimately scoped to the untyped `3d-force-graph` library boundary.

## Not yet decided

- Styling approach: currently all inline `style` objects / `React.CSSProperties`,
  no CSS framework or component library. Worth revisiting before building out more UI
  (focus-mode breadcrumbs, etc.) — see conversation notes, not yet resolved.
- No tests, no CI. Fine for a same-day MVP; will need addressing if this keeps growing.
