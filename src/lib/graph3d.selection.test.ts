import { afterEach, describe, expect, it, vi } from "vitest";

const { clickHandler } = vi.hoisted(() => ({
  clickHandler: {
    current: null as ((node: unknown) => void) | null,
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
  ];
  const makeGraph = () => {
    const graph: Record<string, unknown> = {
      scene: () => ({ add: () => {} }),
      cameraPosition: vi.fn(),
      graphData: vi.fn(),
      _destructor: vi.fn(),
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
});
