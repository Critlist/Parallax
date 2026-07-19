import { afterEach, describe, expect, it, vi } from "vitest";

// Capture the renderer stub the mocked graph hands back so the test can assert
// on it after dispose() has nulled the graph reference.
const { lastRenderer } = vi.hoisted(() => ({
  lastRenderer: {
    current: null as {
      forceContextLoss: ReturnType<typeof vi.fn>;
      domElement: HTMLElement;
    } | null,
  },
}));

// 3d-force-graph creates a real WebGL renderer, which jsdom can't back. Replace
// the whole factory with a chainable stub that exposes just the surface
// Graph3DVisualization touches.
vi.mock("3d-force-graph", () => {
  const builders = [
    "width",
    "height",
    "backgroundColor",
    "showNavInfo",
    "linkOpacity",
    "linkWidth",
    "linkVisibility",
    "linkDirectionalParticles",
    "linkDirectionalParticleSpeed",
    "linkDirectionalParticleResolution",
    "linkColor",
    "nodeLabel",
    "nodeThreeObject",
    "onNodeClick",
    "onNodeHover",
    "onEngineTick",
    "onEngineStop",
    "forceEngine",
    "warmupTicks",
    "cooldownTicks",
    "cooldownTime",
    "d3AlphaDecay",
  ];
  const makeGraph = () => {
    const domElement = document.createElement("canvas");
    document.body.appendChild(domElement);
    const rendererStub = {
      forceContextLoss: vi.fn(),
      setPixelRatio: vi.fn(),
      domElement,
    };
    lastRenderer.current = rendererStub;
    const graph: Record<string, unknown> = {
      scene: () => ({ add: () => {} }),
      renderer: () => rendererStub,
      _destructor: vi.fn(),
    };
    for (const b of builders) graph[b] = () => graph;
    return graph;
  };
  return { default: () => () => makeGraph() };
});

import { Graph3DVisualization } from "./graph3d";

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe("Graph3DVisualization.dispose", () => {
  it("releases the WebGL context and detaches the canvas", () => {
    const container = document.createElement("div");
    const viz = new Graph3DVisualization(container);
    const renderer = lastRenderer.current!;
    expect(document.body.contains(renderer.domElement)).toBe(true);

    viz.dispose();

    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(document.body.contains(renderer.domElement)).toBe(false);
  });
});
