"use client";

import { useEffect, useRef, useState } from "react";
import { Graph3DVisualization, GraphNode } from "@/lib/graph3d";
import {
  fromGraphifyExport,
  isGraphifyExport,
  statsFor,
  validateGraphReferences,
  GraphifyStats,
} from "@/lib/graphifyAdapter";

const SAMPLE_URL = "/sample/graph.json";

export default function GraphViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<Graph3DVisualization | null>(null);
  const [stats, setStats] = useState<GraphifyStats | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    vizRef.current?.loadData(data);
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
      // Without this, a failed read never resolves the loading state and
      // the button stays stuck on "Loading…" forever.
      setError("Could not read that file.");
      setLoading(false);
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <div style={panelStyle}>
        <strong style={{ fontSize: 14 }}>Parallax</strong>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Renders Graphify (or any node_link_data) exports in 3D.
        </div>
        <button onClick={loadSample} disabled={loading} style={buttonStyle}>
          {loading ? "Loading…" : "Load restoHack sample"}
        </button>
        <label
          style={{
            ...buttonStyle,
            display: "inline-block",
            textAlign: "center",
          }}
        >
          Load graph.json…
          <input
            type="file"
            accept=".json,application/json"
            onChange={onFilePicked}
            style={{ display: "none" }}
          />
        </label>
        {error && <div style={{ color: "#ff6b6b", fontSize: 12 }}>{error}</div>}
        {stats && (
          <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
            <div>
              {stats.nodeCount} nodes · {stats.linkCount} edges
            </div>
            <div>
              {stats.communityCount} communities · {stats.hyperedgeCount}{" "}
              hyperedges
            </div>
            {Object.entries(stats.fileTypeBreakdown).map(([type, count]) => (
              <div key={type} style={{ opacity: 0.75 }}>
                {type}: {count}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        // bottom-left is occupied by 3d-force-graph's own controls widget
        <div
          style={{
            ...panelStyle,
            top: "auto",
            left: "auto",
            bottom: 16,
            right: 16,
          }}
        >
          <strong style={{ fontSize: 13 }}>{String(selected.name)}</strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            type: {String(selected.type)}
          </div>
          {typeof selected.group === "number" ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              community: {selected.group}
            </div>
          ) : null}
          {selected.filePath ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {String(selected.filePath)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  background: "rgba(10,10,10,0.85)",
  color: "#eee",
  padding: "12px 14px",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxWidth: 260,
  fontFamily: "system-ui, sans-serif",
  border: "1px solid rgba(255,255,255,0.1)",
};

const buttonStyle: React.CSSProperties = {
  background: "#4A90E2",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};
