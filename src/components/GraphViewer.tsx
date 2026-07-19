"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFpsMeter,
  Graph3DVisualization,
  GraphData,
  GraphNode,
  type PerfSnapshot,
} from "@/lib/graph3d";
import {
  fromGraphifyExport,
  isGraphifyExport,
  statsFor,
  validateGraphReferences,
  GraphifyStats,
} from "@/lib/graphifyAdapter";
import { FilterPanel } from "./graph-viewer/FilterPanel";
import { DebugOverlay } from "./graph-viewer/DebugOverlay";
import { GraphToolbar } from "./graph-viewer/GraphToolbar";
import { Legend } from "./graph-viewer/Legend";
import { LoadPanel } from "./graph-viewer/LoadPanel";
import { NodeInspector } from "./graph-viewer/NodeInspector";
import { SettingsMenu } from "./graph-viewer/SettingsMenu";
import styles from "./graph-viewer/GraphViewer.module.css";

const SAMPLE_URL = "/sample/graph.json";
const MAX_SEARCH_RESULTS = 12;

function endpointId(endpoint: unknown): string {
  if (typeof endpoint === "string") return endpoint;
  if (endpoint && typeof endpoint === "object" && "id" in endpoint) {
    return String(endpoint.id);
  }
  return String(endpoint);
}

function deriveVisibleGraph(
  graphData: GraphData | null,
  filters: {
    disabledTypes: Set<string>;
    disabledCommunities: Set<number>;
    disabledRelations: Set<string>;
    disabledConfidences: Set<string>;
    neighborhoodRootId: string | null;
  },
): GraphData | null {
  if (!graphData) return null;
  const filteredNodes = graphData.nodes
    .filter(
      (node) =>
        !filters.disabledTypes.has(node.type) &&
        !(
          typeof node.group === "number" &&
          filters.disabledCommunities.has(node.group)
        ),
    )
    .map((node) => ({ ...node }));
  const filteredIds = new Set(filteredNodes.map((node) => node.id));
  const filteredLinks = graphData.links
    .filter(
      (link) =>
        filteredIds.has(endpointId(link.source)) &&
        filteredIds.has(endpointId(link.target)) &&
        !filters.disabledRelations.has(link.type ?? "related") &&
        !filters.disabledConfidences.has(String(link.confidence ?? "UNKNOWN")),
    )
    .map((link) => ({ ...link }));

  if (!filters.neighborhoodRootId) {
    return { nodes: filteredNodes, links: filteredLinks };
  }

  const neighborhoodIds = new Set([filters.neighborhoodRootId]);
  const neighborhoodLinks = filteredLinks.filter((link) => {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    const touchesRoot =
      source === filters.neighborhoodRootId ||
      target === filters.neighborhoodRootId;
    if (!touchesRoot) return false;
    neighborhoodIds.add(source);
    neighborhoodIds.add(target);
    return true;
  });
  const nodes = filteredNodes.filter((node) => neighborhoodIds.has(node.id));
  const links = neighborhoodLinks.map((link) => ({ ...link }));
  return { nodes, links };
}

function nodeMatchesSearch(node: GraphNode, term: string): boolean {
  const haystack = [node.id, node.name, node.type, node.filePath]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export default function GraphViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<Graph3DVisualization | null>(null);
  const loadStartRef = useRef<number | null>(null);
  const [sourceGraph, setSourceGraph] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<GraphifyStats | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disabledTypes, setDisabledTypes] = useState<Set<string>>(new Set());
  const [disabledCommunities, setDisabledCommunities] = useState<Set<number>>(
    new Set(),
  );
  const [disabledRelations, setDisabledRelations] = useState<Set<string>>(
    new Set(),
  );
  const [disabledConfidences, setDisabledConfidences] = useState<Set<string>>(
    new Set(),
  );
  const [neighborhoodRootId, setNeighborhoodRootId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debugVisible, setDebugVisible] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [perf, setPerf] = useState<{
    snapshot: PerfSnapshot | null;
    fps: number;
    frameMs: number;
  }>({ snapshot: null, fps: 0, frameMs: 0 });
  const [loadMs, setLoadMs] = useState<number | null>(null);

  const visibleGraph = useMemo(
    () =>
      deriveVisibleGraph(sourceGraph, {
        disabledTypes,
        disabledCommunities,
        disabledRelations,
        disabledConfidences,
        neighborhoodRootId,
      }),
    [
      sourceGraph,
      disabledTypes,
      disabledCommunities,
      disabledRelations,
      disabledConfidences,
      neighborhoodRootId,
    ],
  );

  const visibleStats = visibleGraph
    ? {
        nodeCount: visibleGraph.nodes.length,
        linkCount: visibleGraph.links.length,
      }
    : null;

  const typeCounts = useMemo<Array<[string, number]>>(
    () =>
      stats
        ? Object.entries(stats.fileTypeBreakdown).sort(([a], [b]) =>
            a.localeCompare(b),
          )
        : [],
    [stats],
  );

  const communityCounts = useMemo<Array<[number, number]>>(() => {
    if (!sourceGraph) return [];
    const counts = new Map<number, number>();
    for (const node of sourceGraph.nodes) {
      if (typeof node.group === "number") {
        counts.set(node.group, (counts.get(node.group) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort(([a], [b]) => a - b);
  }, [sourceGraph]);

  const relationCounts = useMemo<Array<[string, number]>>(() => {
    if (!sourceGraph) return [];
    const counts = new Map<string, number>();
    for (const link of sourceGraph.links) {
      const type = link.type ?? "related";
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sourceGraph]);

  const confidenceCounts = useMemo<Array<[string, number]>>(() => {
    if (!sourceGraph) return [];
    const counts = new Map<string, number>();
    for (const link of sourceGraph.links) {
      const confidence = String(link.confidence ?? "UNKNOWN");
      counts.set(confidence, (counts.get(confidence) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sourceGraph]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim();
    if (!term || !visibleGraph) return [];
    return visibleGraph.nodes
      .filter((node) => nodeMatchesSearch(node, term))
      .slice(0, MAX_SEARCH_RESULTS);
  }, [searchTerm, visibleGraph]);

  useEffect(() => {
    if (!containerRef.current) return;
    vizRef.current = new Graph3DVisualization(containerRef.current, {
      onNodeSelected: setSelected,
    });

    return () => {
      vizRef.current?.dispose();
      vizRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!visibleGraph) return;
    vizRef.current?.loadData(visibleGraph);
  }, [visibleGraph]);

  useEffect(() => {
    vizRef.current?.setHoverEnabled(hoverEnabled);
  }, [hoverEnabled]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableKeyTarget(e.target)) return;
      if (e.key === "`") {
        e.preventDefault();
        setDebugVisible((visible) => !visible);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!debugVisible) return;
    const meter = createFpsMeter();
    const requestFrame =
      window.requestAnimationFrame ??
      ((cb: FrameRequestCallback) =>
        window.setTimeout(() => cb(performance.now()), 16));
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    let raf = 0;
    const sampleFrame = (now: number) => {
      meter.sample(now);
      raf = requestFrame(sampleFrame);
    };
    raf = requestFrame(sampleFrame);
    const update = () => {
      setPerf({
        snapshot: vizRef.current?.getPerfSnapshot() ?? null,
        fps: meter.fps,
        frameMs: meter.frameMs,
      });
    };
    update();
    const interval = window.setInterval(update, 500);
    return () => {
      cancelFrame(raf);
      window.clearInterval(interval);
    };
  }, [debugVisible]);

  function clearLoadTiming() {
    loadStartRef.current = null;
    setLoadMs(null);
  }

  function loadRaw(raw: unknown) {
    if (!isGraphifyExport(raw)) {
      setError("Not a recognized graph export (expected {nodes, links}).");
      clearLoadTiming();
      return;
    }
    const refError = validateGraphReferences(raw);
    if (refError) {
      setError(refError);
      clearLoadTiming();
      return;
    }
    setError(null);
    const data = fromGraphifyExport(raw);
    setStats(statsFor(raw));
    setSelected(null);
    setSearchTerm("");
    setDisabledTypes(new Set());
    setDisabledCommunities(new Set());
    setDisabledRelations(new Set());
    setDisabledConfidences(new Set());
    setNeighborhoodRootId(null);
    setSourceGraph(data);
    if (loadStartRef.current !== null) {
      setLoadMs(performance.now() - loadStartRef.current);
      loadStartRef.current = null;
    }
  }

  async function loadSample() {
    setLoading(true);
    loadStartRef.current = performance.now();
    setLoadMs(null);
    try {
      const res = await fetch(SAMPLE_URL);
      const raw = await res.json();
      loadRaw(raw);
    } catch {
      setError("Failed to load sample graph.");
      clearLoadTiming();
    } finally {
      setLoading(false);
    }
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    loadStartRef.current = performance.now();
    setLoadMs(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        loadRaw(raw);
      } catch {
        setError("Could not parse that file as JSON.");
        clearLoadTiming();
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Could not read that file.");
      clearLoadTiming();
      setLoading(false);
    };
    reader.readAsText(file);
  }

  function toggleType(type: string) {
    const next = new Set(disabledTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    if (selected && next.has(selected.type)) {
      setSelected(null);
      setNeighborhoodRootId(null);
    }
    setDisabledTypes(next);
  }

  function toggleCommunity(community: number) {
    const next = new Set(disabledCommunities);
    if (next.has(community)) {
      next.delete(community);
    } else {
      next.add(community);
    }
    if (selected?.group === community && next.has(community)) {
      setSelected(null);
      setNeighborhoodRootId(null);
    }
    setDisabledCommunities(next);
  }

  function toggleRelation(relation: string) {
    const next = new Set(disabledRelations);
    if (next.has(relation)) {
      next.delete(relation);
    } else {
      next.add(relation);
    }
    setDisabledRelations(next);
  }

  function toggleConfidence(confidence: string) {
    const next = new Set(disabledConfidences);
    if (next.has(confidence)) {
      next.delete(confidence);
    } else {
      next.add(confidence);
    }
    setDisabledConfidences(next);
  }

  function clearFilters() {
    setDisabledTypes(new Set());
    setDisabledCommunities(new Set());
    setDisabledRelations(new Set());
    setDisabledConfidences(new Set());
    setNeighborhoodRootId(null);
  }

  function focusNode(node: GraphNode) {
    setSelected(node);
    setNeighborhoodRootId(null);
    vizRef.current?.focusNode(node.id);
  }

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.canvas} />

      <div className={styles.leftStack}>
        <LoadPanel
          loading={loading}
          error={error}
          stats={stats}
          visibleStats={visibleStats}
          onLoadSample={loadSample}
          onFilePicked={onFilePicked}
        />
        <FilterPanel
          typeCounts={typeCounts}
          disabledTypes={disabledTypes}
          communityCounts={communityCounts}
          disabledCommunities={disabledCommunities}
          relationCounts={relationCounts}
          disabledRelations={disabledRelations}
          confidenceCounts={confidenceCounts}
          disabledConfidences={disabledConfidences}
          onToggleType={toggleType}
          onToggleCommunity={toggleCommunity}
          onToggleRelation={toggleRelation}
          onToggleConfidence={toggleConfidence}
          onClearFilters={clearFilters}
        />
      </div>

      <GraphToolbar
        hasGraph={Boolean(sourceGraph)}
        hasSelected={Boolean(selected)}
        searchTerm={searchTerm}
        searchResults={searchResults}
        debugVisible={debugVisible}
        onSearchTermChange={setSearchTerm}
        onSelectSearchResult={focusNode}
        onResetView={() => vizRef.current?.resetView()}
        onFitGraph={() => vizRef.current?.fitGraph()}
        onFocusSelected={() => {
          if (selected) vizRef.current?.focusNode(selected.id);
        }}
        onToggleDebug={() => setDebugVisible((visible) => !visible)}
      />
      <div className={styles.rightStack}>
        <DebugOverlay
          visible={debugVisible}
          snapshot={perf.snapshot}
          fps={perf.fps}
          frameMs={perf.frameMs}
          loadMs={loadMs}
        />
        {sourceGraph && (
          <SettingsMenu
            debugVisible={debugVisible}
            hoverEnabled={hoverEnabled}
            onToggleDebug={() => setDebugVisible((visible) => !visible)}
            onToggleHover={() => setHoverEnabled((enabled) => !enabled)}
          />
        )}
        <Legend hasGraph={Boolean(sourceGraph)} />
      </div>

      {selected && (
        <NodeInspector
          node={selected}
          graphData={sourceGraph}
          isShowingNeighbors={neighborhoodRootId === selected.id}
          onFocus={() => vizRef.current?.focusNode(selected.id)}
          onShowNeighbors={() => setNeighborhoodRootId(selected.id)}
          onClearNeighbors={() => setNeighborhoodRootId(null)}
          onClear={() => {
            setSelected(null);
            setNeighborhoodRootId(null);
          }}
        />
      )}
    </div>
  );
}
