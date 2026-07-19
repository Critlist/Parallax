# UI/UX Graph Explorer Plan

Parallax should stay canvas-first: the 3D graph is the product, and UI should
help people orient, search, filter, and inspect without burying the scene.

## Research Notes

- Keep the 3D graph as the first-screen overview. The dominant interaction
  model should follow Shneiderman's information-seeking flow: overview first,
  zoom/filter, then details on demand.
- Prefer lightweight overlays over a full dashboard shell: a compact loader
  panel, a selected-node inspector, and transient toolbars/drawers should leave
  the canvas visually dominant.
- Add search/filter before adding more visual decoration. Useful first filters:
  node type, community, relation/confidence, degree/size, and selected-node
  neighborhood depth.
- Add details on demand through a node inspector rather than always-visible
  metadata. Show label, type, community, file path/source location, degree, and
  connected relation counts.
- Add a small legend/encoding control when visual encodings grow beyond the
  current color/size/link-color mapping. Users need to know what color, size,
  particles, and link colors mean.
- Preserve orientation. Favor reset-view, focus-selected, fit-to-graph, and
  maybe a minimap/compass before adding complex panel systems.
- For larger graphs, prioritize readability techniques over raw density:
  filtering, clustering/grouping, collapsing motifs/neighborhoods, and labels
  only on hover/selection.
- Styling recommendation: move shared panel/button/type styles out of inline
  objects into CSS modules or a tiny local component layer. Avoid introducing a
  broad component library until there are enough controls to justify it.

## Sources

- Shneiderman, "The Eyes Have It" / visual information-seeking mantra:
  https://scispace.com/papers/the-eyes-have-it-a-task-by-data-type-taxonomy-for-1u82t2ua1m
- User-centered graph visualization assessment:
  https://www.sciencedirect.com/science/article/pii/S1045926X1830051X
- Interactive network readability via filtering, clustering, grouping, and
  simplification:
  https://www.researchgate.net/publication/262241820_Interactive_Network_Exploration_to_Derive_Insights_Filtering_Clustering_Grouping_and_Simplification
- Gephi's graph-exploration model for layout, filtering, metrics, and
  appearance:
  https://gephi.org/desktop/
- Knotviz as a browser-local graph explorer reference for local files, search,
  filtering, and property-driven styling:
  https://knotviz.com/
- Oracle Graph Explorer UI reference for graph canvas, toolbar, search, legend,
  settings, and details patterns:
  https://docs.oracle.com/en/database/oracle/property-graph/26.2/spgdg/graph-explorer-user-interface.html
- Kubiya Graph Explorer page structure reference for filters, toolbar, canvas,
  and node details:
  https://docs.kubiya.ai/core-concepts/graph-explorer
- GraphXR workspace reference for combined search/query, legend, export, and
  panel tools:
  https://helpcenter.kineviz.com/user-guides/v3/g-user/graphxr-start/project-ui.html
- React "Thinking in React" guidance for component hierarchy and state ownership:
  https://react.dev/learn/thinking-in-react

## Implementation Plan

1. **Separate UI structure from renderer state.** Done.
   - Keep `GraphViewer` as the state owner for loaded graph, stats, selected
     node, filters, and search.
   - Extract small presentational components before adding more controls:
     `LoadPanel`, `StatsSummary`, `NodeInspector`, `GraphToolbar`, `Legend`,
     and `FilterPanel`.
   - Move shared styles from inline objects to `GraphViewer.module.css` or one
     tiny local component/style layer. Do not add a broad UI library yet.

   Acceptance criteria:
   - `GraphViewer.tsx` reads as orchestration, not a pile of inline styles.
   - Existing load/sample/select behavior is unchanged.
   - Tests cover file loading and selected-node display after extraction.

2. **Add graph search and focus.** Done for node search.
   - Add a search box for node label/id/file path.
   - Show a compact result list with type/community/file hints.
   - Selecting a result should select the node and focus the camera on it.
   - Add a renderer method such as `focusNode(id)` or `focusNode(node)` so
     React does not reach into `3d-force-graph` internals.

   Acceptance criteria:
   - Searching "pline" or a known fixture node returns matching nodes.
   - Clicking a search result opens the inspector and moves the camera.
   - No global event bus is reintroduced.

3. **Add filter controls with live counts.** Partially done.
   - Start with checkboxes/segmented controls for node `type` and community.
   - Add relation/confidence filters for links once node filtering is stable.
   - Apply filters by deriving visible `GraphData` in React and calling
     `viz.loadData(visibleData)`.
   - Show visible/total counts so filtering does not feel like data loss.

   Acceptance criteria:
   - Filters are reversible and can be cleared in one click.
   - Stats distinguish loaded graph totals from currently visible graph.
   - Filtering preserves selection when the selected node remains visible and
     clears it when it is filtered out.

   Remaining:
   - Community filters.
   - Relation/confidence filters.
   - More compact controls once filter count grows.

4. **Improve details on demand.** Partially done.
   - Expand the selected-node inspector to show label, id, type, community,
     file path, source location, degree, and connected relation counts.
   - Add neighbor actions: "show neighbors", "focus", and "clear selection".
   - Keep the inspector as a right/bottom overlay, not a permanent dashboard
     column.

   Acceptance criteria:
   - Inspector content is useful for the Graphify sample without requiring a
     separate report file.
   - Long paths wrap cleanly and do not resize the canvas.

   Remaining:
   - "Show neighbors" action.
   - Better connected-node summaries.

5. **Add visual encoding legend and view controls.** Partially done.
   - Add a collapsible legend explaining node color, node size, link color, and
     directional particles.
   - Add reset view, fit graph, and focus selected controls.
   - Keep controls as compact overlays around the canvas edges.

   Acceptance criteria:
   - A first-time user can tell what color/size/link styling means without
     reading source code.
   - Reset/focus controls work after loading a sample and after filtering.

   Remaining:
   - Fit graph control.
   - Better legend values once relation/confidence filters and encodings grow.

6. **Only then consider larger interaction features.**
   - Neighborhood-depth expansion/collapse.
   - Community isolate mode.
   - Saved view presets.
   - Screenshot/export current view.
   - Performance work for larger-than-sample graphs.

   Acceptance criteria:
   - These do not land before search/filter/inspector/legend are stable.
   - Any new renderer API is tested at the React boundary or with a graph mock,
     not only manually.
