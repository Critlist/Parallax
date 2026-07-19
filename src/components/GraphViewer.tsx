"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Graph3DVisualization, GraphData, GraphNode } from "@/lib/graph3d";
import {
  fromGraphifyExport,
  isGraphifyExport,
  statsFor,
  validateGraphReferences,
  GraphifyStats,
} from "@/lib/graphifyAdapter";
import { FilterPanel } from "./graph-viewer/FilterPanel";
import { GraphToolbar } from "./graph-viewer/GraphToolbar";
import { Legend } from "./graph-viewer/Legend";
import { LoadPanel } from "./graph-viewer/LoadPanel";
import { NodeInspector } from "./graph-viewer/NodeInspector";
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
  disabledTypes: Set<string>,
): GraphData | null {
  if (!graphData) return null;
  const nodes = graphData.nodes
    .filter((node) => !disabledTypes.has(node.type))
    .map((node) => ({ ...node }));
  const visibleIds = new Set(nodes.map((node) => node.id));
  const links = graphData.links
    .filter(
      (link) =>
        visibleIds.has(endpointId(link.source)) &&
        visibleIds.has(endpointId(link.target)),
    )
    .map((link) => ({ ...link }));
  return { nodes, links };
}

function nodeMatchesSearch(node: GraphNode, term: string): boolean {
  const haystack = [node.id, node.name, node.type, node.filePath]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export default function GraphViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<Graph3DVisualization | null>(null);
  const [sourceGraph, setSourceGraph] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<GraphifyStats | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disabledTypes, setDisabledTypes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const visibleGraph = useMemo(
    () => deriveVisibleGraph(sourceGraph, disabledTypes),
    [sourceGraph, disabledTypes],
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

  function loadRaw(raw: unknown) {
    if (!isGraphifyExport(raw)) {
      setError("Not a recognized graph export (expected {nodes, links}).");
      return;
    }
    const refError = validateGraphReferences(raw);
    if (refError) {
      setError(refError);
      return;
    }
    setError(null);
    const data = fromGraphifyExport(raw);
    setStats(statsFor(raw));
    setSelected(null);
    setSearchTerm("");
    setDisabledTypes(new Set());
    setSourceGraph(data);
  }

  async function loadSample() {
    setLoading(true);
    try {
      const res = await fetch(SAMPLE_URL);
      const raw = await res.json();
      loadRaw(raw);
    } catch {
      setError("Failed to load sample graph.");
    } finally {
      setLoading(false);
    }
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        loadRaw(raw);
      } catch {
        setError("Could not parse that file as JSON.");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Could not read that file.");
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
    }
    setDisabledTypes(next);
  }

  function focusNode(node: GraphNode) {
    setSelected(node);
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
          onToggleType={toggleType}
          onClearFilters={() => setDisabledTypes(new Set())}
        />
      </div>

      <GraphToolbar
        hasGraph={Boolean(sourceGraph)}
        hasSelected={Boolean(selected)}
        searchTerm={searchTerm}
        searchResults={searchResults}
        onSearchTermChange={setSearchTerm}
        onSelectSearchResult={focusNode}
        onResetView={() => vizRef.current?.resetView()}
        onFocusSelected={() => {
          if (selected) vizRef.current?.focusNode(selected.id);
        }}
      />
      <Legend hasGraph={Boolean(sourceGraph)} />

      {selected && (
        <NodeInspector
          node={selected}
          graphData={sourceGraph}
          onFocus={() => vizRef.current?.focusNode(selected.id)}
          onClear={() => setSelected(null)}
        />
      )}
    </div>
  );
}
