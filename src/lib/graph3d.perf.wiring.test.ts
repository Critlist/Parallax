import { afterEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  engineTick: { current: null as (() => void) | null },
  engineStop: { current: null as (() => void) | null },
  particleResolution: vi.fn(),
  pixelRatio: vi.fn(),
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
    "linkDirectionalParticleResolution",
    "linkColor",
    "nodeLabel",
    "nodeThreeObject",
    "onNodeClick",
    "onNodeHover",
    "cameraPosition",
    "zoomToFit",
    "refresh",
  ];
  const makeGraph = () => {
    let stored: unknown = { nodes: [], links: [] };
    const material = { id: "material" };
    const graph: Record<string, unknown> = {
      scene: () => ({
        add: () => {},
        traverse: (cb: (obj: unknown) => void) => {
          cb({ material });
          cb({ material: [{ id: "second-material" }, material] });
        },
      }),
      renderer: () => ({
        setPixelRatio: captured.pixelRatio,
        forceContextLoss: vi.fn(),
        domElement: document.createElement("canvas"),
        info: {
          render: { calls: 7, triangles: 42 },
          memory: { geometries: 5, textures: 1 },
        },
      }),
      graphData: (data?: unknown) => {
        if (data === undefined) return stored;
        stored = data;
        return graph;
      },
      _destructor: vi.fn(),
    };
    for (const b of builders) graph[b] = () => graph;
    graph.linkDirectionalParticleResolution = (value: number) => {
      captured.particleResolution(value);
      return graph;
    };
    graph.onEngineTick = (handler: () => void) => {
      captured.engineTick.current = handler;
      return graph;
    };
    graph.onEngineStop = (handler: () => void) => {
      captured.engineStop.current = handler;
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
  captured.engineTick.current = null;
  captured.engineStop.current = null;
  captured.particleResolution.mockClear();
  captured.pixelRatio.mockClear();
});

describe("Graph3DVisualization engine state", () => {
  it("is running after loadData and stopped after the engine stops", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData({ nodes: [{ id: "a", name: "a", type: "code" }], links: [] });
    expect(viz.getPerfSnapshot()?.engineRunning).toBe(true);

    captured.engineStop.current?.();
    expect(viz.getPerfSnapshot()?.engineRunning).toBe(false);
    viz.dispose();
  });

  it("records a non-negative settle time when the engine stops", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData({ nodes: [{ id: "a", name: "a", type: "code" }], links: [] });
    captured.engineStop.current?.();
    const settle = viz.getPerfSnapshot()?.settleMs;
    expect(settle).not.toBeNull();
    expect(settle as number).toBeGreaterThanOrEqual(0);
    viz.dispose();
  });
});

describe("getPerfSnapshot", () => {
  it("caps renderer pixel ratio and lowers particle geometry resolution", () => {
    const originalRatio = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
    const viz = new Graph3DVisualization(document.createElement("div"));

    expect(captured.pixelRatio).toHaveBeenCalledWith(1.25);
    expect(captured.particleResolution).toHaveBeenCalledWith(2);

    viz.dispose();
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: originalRatio,
    });
  });

  it("reports renderer.info counters, counts, and particle total", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData({
      nodes: [
        { id: "a", name: "a", type: "code" },
        { id: "b", name: "b", type: "code" },
      ],
      links: [
        { source: "a", target: "b", type: "calls" },
        { source: "a", target: "b", confidence: "INFERRED" },
      ],
    });

    const snap = viz.getPerfSnapshot()!;
    expect(snap.nodeCount).toBe(2);
    expect(snap.visibleEdgeCount).toBe(2);
    expect(snap.particleCount).toBe(4);
    expect(snap.drawCalls).toBe(7);
    expect(snap.triangles).toBe(42);
    expect(snap.geometries).toBe(5);
    expect(snap.textures).toBe(1);
    expect(snap.materials).toBeGreaterThanOrEqual(1);
    viz.dispose();
  });

  it("returns null after dispose", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.dispose();
    expect(viz.getPerfSnapshot()).toBeNull();
  });
});
