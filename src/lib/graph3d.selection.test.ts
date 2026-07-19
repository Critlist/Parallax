import { afterEach, describe, expect, it, vi } from "vitest";

const { clickHandler, lastGraph } = vi.hoisted(() => ({
  clickHandler: {
    current: null as ((node: unknown) => void) | null,
  },
  lastGraph: {
    current: null as {
      cameraPosition: ReturnType<typeof vi.fn>;
      graphData: ReturnType<typeof vi.fn>;
      zoomToFit: ReturnType<typeof vi.fn>;
    } | null,
  },
}));

vi.mock("3d-force-graph", () => {
  const builders = [
    "width",
    "height",
    "backgroundColor",
    "showNavInfo",
    "linkOpacity",
    "linkWidth",
    "linkDirectionalParticles",
    "linkDirectionalParticleSpeed",
    "linkColor",
    "nodeLabel",
    "nodeThreeObject",
    "onNodeHover",
    "onEngineTick",
    "onEngineStop",
  ];
  const makeGraph = () => {
    const graph: Record<string, unknown> = {
      scene: () => ({ add: () => {} }),
      cameraPosition: vi.fn(),
      graphData: vi.fn(),
      zoomToFit: vi.fn(),
      _destructor: vi.fn(),
    };
    lastGraph.current = graph as {
      cameraPosition: ReturnType<typeof vi.fn>;
      graphData: ReturnType<typeof vi.fn>;
      zoomToFit: ReturnType<typeof vi.fn>;
    };
    for (const b of builders) graph[b] = () => graph;
    graph.onNodeClick = (handler: (node: unknown) => void) => {
      clickHandler.current = handler;
      return graph;
    };
    return graph;
  };
  return { default: () => () => makeGraph() };
});

import { Graph3DVisualization, type GraphNode } from "./graph3d";

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
  clickHandler.current = null;
  lastGraph.current = null;
});

describe("Graph3DVisualization node selection", () => {
  it("reports selected nodes through the constructor callback without a window event bus", () => {
    const container = document.createElement("div");
    const onNodeSelected = vi.fn();
    const eventListener = vi.fn();
    window.addEventListener("node-selected", eventListener);

    const viz = new Graph3DVisualization(container, { onNodeSelected });
    const node: GraphNode & { x: number; y: number; z: number } = {
      id: "node-1",
      name: "main()",
      type: "code",
      x: 1,
      y: 2,
      z: 3,
    };

    clickHandler.current?.(node);

    expect(onNodeSelected).toHaveBeenCalledWith(node);
    expect(eventListener).not.toHaveBeenCalled();
    window.removeEventListener("node-selected", eventListener);
    viz.dispose();
  });

  it("focuses a loaded node by id through the public renderer API", () => {
    const container = document.createElement("div");
    const viz = new Graph3DVisualization(container);
    const node: GraphNode & { x: number; y: number; z: number } = {
      id: "node-1",
      name: "main()",
      type: "code",
      x: 1,
      y: 2,
      z: 3,
    };

    viz.loadData({ nodes: [node], links: [] });
    viz.focusNode("node-1");

    expect(lastGraph.current?.cameraPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
      }),
      node,
      1000,
    );
    viz.dispose();
  });

  it("fits the current graph through the public renderer API", () => {
    const container = document.createElement("div");
    const viz = new Graph3DVisualization(container);

    viz.fitGraph();

    expect(lastGraph.current?.zoomToFit).toHaveBeenCalledWith(1000, 80);
    viz.dispose();
  });
});
