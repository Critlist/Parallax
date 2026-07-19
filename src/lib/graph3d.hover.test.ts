import { afterEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  particles: { current: null as ((l: unknown) => number) | null },
  hover: { current: null as ((n: unknown) => void) | null },
  nodeObj: { current: null as ((n: unknown) => unknown) | null },
  linkColor: { current: null as ((l: unknown) => string) | null },
  linkWidth: { current: null as ((l: unknown) => number) | null },
  refresh: vi.fn(),
}));

vi.mock("3d-force-graph", () => {
  const passthrough = [
    "width",
    "height",
    "backgroundColor",
    "showNavInfo",
    "linkOpacity",
    "linkDirectionalParticleSpeed",
    "nodeLabel",
    "onNodeClick",
    "graphData",
    "cameraPosition",
    "zoomToFit",
  ];
  const makeGraph = () => {
    const graph: Record<string, unknown> = {
      scene: () => ({ add: () => {} }),
      _destructor: vi.fn(),
      refresh: captured.refresh,
    };
    for (const b of passthrough) graph[b] = () => graph;
    graph.linkDirectionalParticles = (fn: (l: unknown) => number) => {
      captured.particles.current = fn;
      return graph;
    };
    graph.linkColor = (fn: (l: unknown) => string) => {
      captured.linkColor.current = fn;
      return graph;
    };
    graph.linkWidth = (fn: (l: unknown) => number) => {
      captured.linkWidth.current = fn;
      return graph;
    };
    graph.nodeThreeObject = (fn: (n: unknown) => unknown) => {
      captured.nodeObj.current = fn;
      return graph;
    };
    graph.onNodeHover = (fn: (n: unknown) => void) => {
      captured.hover.current = fn;
      return graph;
    };
    return graph;
  };
  return { default: () => () => makeGraph() };
});

import { Graph3DVisualization } from "./graph3d";

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
  captured.particles.current = null;
  captured.hover.current = null;
  captured.nodeObj.current = null;
  captured.linkColor.current = null;
  captured.linkWidth.current = null;
});

describe("Graph3DVisualization link flow", () => {
  it("drives directional particles from linkParticleCount", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    expect(captured.particles.current?.({ type: "calls" })).toBe(3);
    expect(captured.particles.current?.({ confidence: "EXTRACTED" })).toBe(2);
    expect(captured.particles.current?.({})).toBe(1);
    viz.dispose();
  });
});
