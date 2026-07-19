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

import { Graph3DVisualization, type GraphData } from "./graph3d";
import * as THREE from "three";

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

const data: GraphData = {
  nodes: [
    { id: "a", name: "a", type: "code" },
    { id: "b", name: "b", type: "code" },
    { id: "c", name: "c", type: "code" }, // not connected to a
  ],
  links: [{ source: "a", target: "b", type: "calls" }],
};

function buildMeshes() {
  // simulate 3d-force-graph asking for each node's three object
  const meshes: Record<string, THREE.Mesh> = {};
  for (const n of data.nodes) {
    meshes[n.id] = captured.nodeObj.current?.(n) as THREE.Mesh;
  }
  return meshes;
}

describe("Graph3DVisualization hover affordance", () => {
  it("lights the hovered node and dims non-neighbors", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();

    captured.hover.current?.({ id: "a" });

    const litMat = meshes.a.material as THREE.MeshLambertMaterial;
    const dimMat = meshes.c.material as THREE.MeshLambertMaterial;
    expect(litMat.opacity).toBe(1);
    expect(litMat.emissiveIntensity).toBeGreaterThan(0);
    expect(dimMat.opacity).toBeLessThan(0.9);
    viz.dispose();
  });

  it("fades links not incident to the hovered node", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    buildMeshes();

    captured.hover.current?.({ id: "a" });

    // incident link keeps a real color; a non-incident link fades to grey
    expect(captured.linkColor.current?.({ source: "a", target: "b" })).not.toBe(
      "#222222",
    );
    expect(captured.linkColor.current?.({ source: "b", target: "c" })).toBe(
      "#222222",
    );
    viz.dispose();
  });

  it("restores normal opacity when hover ends", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();

    captured.hover.current?.({ id: "a" });
    captured.hover.current?.(null);

    const mat = meshes.c.material as THREE.MeshLambertMaterial;
    expect(mat.opacity).toBe(0.9);
    expect(
      (meshes.a.material as THREE.MeshLambertMaterial).emissiveIntensity,
    ).toBe(0);
    viz.dispose();
  });
});
