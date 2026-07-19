import { afterEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  particles: { current: null as ((l: unknown) => number) | null },
  hover: { current: null as ((n: unknown) => void) | null },
  nodeObj: { current: null as ((n: unknown) => unknown) | null },
  nodeLabel: { current: null as ((n: unknown) => string) | null },
  linkColor: { current: null as ((l: unknown) => string) | null },
  linkWidth: { current: null as ((l: unknown) => number) | null },
  particleResolution: vi.fn(),
  pixelRatio: vi.fn(),
  engineTick: { current: null as (() => void) | null },
  sceneAdds: [] as unknown[],
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
    "linkDirectionalParticleResolution",
    "onNodeClick",
    "graphData",
    "cameraPosition",
    "zoomToFit",
    "onEngineStop",
  ];
  const makeGraph = () => {
    const scene = {
      add: (obj: unknown) => {
        captured.sceneAdds.push(obj);
      },
    };
    const graph: Record<string, unknown> = {
      scene: () => scene,
      renderer: () => ({
        setPixelRatio: captured.pixelRatio,
        forceContextLoss: vi.fn(),
        domElement: document.createElement("canvas"),
      }),
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
    graph.linkDirectionalParticleResolution = (value: number) => {
      captured.particleResolution(value);
      return graph;
    };
    graph.nodeThreeObject = (fn: (n: unknown) => unknown) => {
      captured.nodeObj.current = fn;
      return graph;
    };
    graph.nodeLabel = (fn: (n: unknown) => string) => {
      captured.nodeLabel.current = fn;
      return graph;
    };
    graph.onNodeHover = (fn: (n: unknown) => void) => {
      captured.hover.current = fn;
      return graph;
    };
    graph.onEngineTick = (fn: () => void) => {
      captured.engineTick.current = fn;
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
  captured.nodeLabel.current = null;
  captured.linkColor.current = null;
  captured.linkWidth.current = null;
  captured.particleResolution.mockClear();
  captured.pixelRatio.mockClear();
  captured.engineTick.current = null;
  captured.sceneAdds.length = 0;
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

function simulateLibraryDeallocate(obj: THREE.Object3D): void {
  const candidate = obj as THREE.Object3D & {
    geometry?: { dispose?: () => void };
    material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
  };
  candidate.geometry?.dispose?.();
  if (Array.isArray(candidate.material)) {
    candidate.material.forEach((material) => material.dispose?.());
  } else {
    candidate.material?.dispose?.();
  }
  obj.children.forEach(simulateLibraryDeallocate);
}

describe("Graph3DVisualization hover affordance", () => {
  it("disables the library tooltip so only the React tooltip renders", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));

    expect(captured.nodeLabel.current?.({ name: "a", type: "code" })).toBe("");
    viz.dispose();
  });

  it("reports hovered nodes with the last pointer position", () => {
    const container = document.createElement("div");
    const onNodeHovered = vi.fn();
    const viz = new Graph3DVisualization(container, { onNodeHovered });
    const node = { id: "a", name: "a", type: "code" };

    container.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 120, clientY: 80 }),
    );
    captured.hover.current?.(node);
    captured.hover.current?.(null);

    expect(onNodeHovered).toHaveBeenNthCalledWith(1, node, { x: 120, y: 80 });
    expect(onNodeHovered).toHaveBeenNthCalledWith(2, null, { x: 120, y: 80 });
    viz.dispose();
  });

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

  it("reuses one node geometry and scales meshes by node size", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();

    expect(meshes.a.geometry).toBe(meshes.b.geometry);
    expect(meshes.a.scale.x).toBeGreaterThan(1);
    viz.dispose();
  });

  it("reuses resting materials for nodes in the same visual bucket", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();

    expect(meshes.a.material).toBe(meshes.b.material);
    expect(meshes.b.material).toBe(meshes.c.material);
    viz.dispose();
  });

  it("clones only emphasized node materials on hover and restores shared resting materials", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();
    const restingMaterial = meshes.a.material;

    captured.hover.current?.({ id: "a" });

    expect(meshes.a.material).not.toBe(restingMaterial);
    expect(meshes.b.material).toBe(restingMaterial);
    expect(meshes.c.material).not.toBe(restingMaterial);

    captured.hover.current?.(null);

    expect(meshes.a.material).toBe(restingMaterial);
    expect(meshes.b.material).toBe(restingMaterial);
    expect(meshes.c.material).toBe(restingMaterial);
    viz.dispose();
  });

  it("protects shared node resources from the library's per-node deallocator", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();
    const geometryDisposed = vi.fn();
    const materialDisposed = vi.fn();

    meshes.a.geometry.addEventListener("dispose", geometryDisposed);
    (meshes.a.material as THREE.Material).addEventListener(
      "dispose",
      materialDisposed,
    );

    simulateLibraryDeallocate(meshes.a);

    expect(geometryDisposed).not.toHaveBeenCalled();
    expect(materialDisposed).not.toHaveBeenCalled();
    expect(meshes.b.geometry).toBe(meshes.a.geometry);
    expect(meshes.b.material).toBe(meshes.a.material);
    viz.dispose();
  });

  it("disposes owned shared node resources when the visualization is disposed", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();
    const geometryDisposed = vi.fn();
    const materialDisposed = vi.fn();

    meshes.a.geometry.addEventListener("dispose", geometryDisposed);
    (meshes.a.material as THREE.Material).addEventListener(
      "dispose",
      materialDisposed,
    );

    viz.dispose();

    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(materialDisposed).toHaveBeenCalledTimes(1);
  });

  it("styles nodes in place without rebuilding the graph on hover", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    buildMeshes();

    // linkColor/linkWidth are registered once at construction; capture that
    // count so we can prove hover does not re-register them.
    const linkColorFn = captured.linkColor.current;
    const linkWidthFn = captured.linkWidth.current;

    captured.hover.current?.({ id: "a" });

    // refresh() sets _flushObjects=true, which rebuilds every node mesh and
    // link/particle system — discarding in-place material mutations (flash)
    // and locking on large graphs. Re-registering link accessors triggers the
    // link digest, which is shared with linkDirectionalParticles (particle
    // flash). Hover must do neither.
    expect(captured.refresh).not.toHaveBeenCalled();
    expect(captured.linkColor.current).toBe(linkColorFn);
    expect(captured.linkWidth.current).toBe(linkWidthFn);
    viz.dispose();
  });

  it("draws incident links as one owned overlay segment batch", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    const positionedData: GraphData = {
      nodes: data.nodes,
      links: [
        {
          source: { id: "a", x: 1, y: 2, z: 3 },
          target: { id: "b", x: 4, y: 5, z: 6 },
          type: "calls",
        } as never,
      ],
    };
    viz.loadData(positionedData);
    buildMeshes();
    const overlay = captured.sceneAdds.find(
      (obj) => obj instanceof THREE.Group,
    ) as THREE.Group | undefined;

    captured.hover.current?.({ id: "a" });

    expect(overlay).toBeDefined();
    expect(overlay?.children).toHaveLength(1);
    expect(overlay?.children[0]).toBeInstanceOf(THREE.LineSegments);
    viz.dispose();
  });

  it("caps batched hover overlay segments for high-degree hubs", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    const hub = { id: "a", x: 0, y: 0, z: 0 };
    const links = Array.from({ length: 240 }, (_, index) => ({
      source: hub,
      target: { id: `n-${index}`, x: index + 1, y: 1, z: 1 },
      type: index === 0 ? "calls" : "contains",
    })) as never[];

    viz.loadData({
      nodes: data.nodes,
      links,
    });
    buildMeshes();
    captured.hover.current?.({ id: "a" });
    const overlay = captured.sceneAdds.find(
      (obj) => obj instanceof THREE.Group,
    ) as THREE.Group;
    const segments = overlay.children[0] as THREE.LineSegments;
    const positions = segments.geometry.getAttribute("position");

    expect(overlay.children).toHaveLength(1);
    expect(positions.count).toBe(320);
    viz.dispose();
  });

  it("updates owned hover-edge positions on engine ticks", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    const source = { id: "a", x: 1, y: 2, z: 3 };
    const target = { id: "b", x: 4, y: 5, z: 6 };
    viz.loadData({
      nodes: data.nodes,
      links: [{ source, target, type: "calls" } as never],
    });
    buildMeshes();
    captured.hover.current?.({ id: "a" });
    const overlay = captured.sceneAdds.find(
      (obj) => obj instanceof THREE.Group,
    ) as THREE.Group;
    const line = overlay.children[0] as THREE.LineSegments;
    const positions = line.geometry.getAttribute("position");

    source.x = 10;
    source.y = 11;
    source.z = 12;
    captured.engineTick.current?.();

    expect(positions.getX(0)).toBe(10);
    expect(positions.getY(0)).toBe(11);
    expect(positions.getZ(0)).toBe(12);
    viz.dispose();
  });

  it("clears hover edges and hover state when graph data is replaced", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData({
      nodes: data.nodes,
      links: [
        {
          source: { id: "a", x: 1, y: 2, z: 3 },
          target: { id: "b", x: 4, y: 5, z: 6 },
          type: "calls",
        } as never,
      ],
    });
    buildMeshes();
    captured.hover.current?.({ id: "a" });
    const overlay = captured.sceneAdds.find(
      (obj) => obj instanceof THREE.Group,
    ) as THREE.Group;
    expect(overlay.children).toHaveLength(1);

    viz.loadData({ nodes: [{ id: "c", name: "c", type: "code" }], links: [] });

    expect(overlay.children).toHaveLength(0);
    expect(captured.linkColor.current?.({ source: "x", target: "y" })).toBe(
      "#4A90E2",
    );
    viz.dispose();
  });

  it("restores normal opacity when hover ends", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();

    captured.hover.current?.({ id: "a" });
    captured.hover.current?.(null);

    const overlay = captured.sceneAdds.find(
      (obj) => obj instanceof THREE.Group,
    ) as THREE.Group | undefined;
    const mat = meshes.c.material as THREE.MeshLambertMaterial;
    expect(mat.opacity).toBe(0.9);
    expect(
      (meshes.a.material as THREE.MeshLambertMaterial).emissiveIntensity,
    ).toBe(0);
    expect(overlay?.children).toHaveLength(0);
    viz.dispose();
  });

  it("can disable hover highlighting and restore normal node styling", () => {
    const viz = new Graph3DVisualization(document.createElement("div"));
    viz.loadData(data);
    const meshes = buildMeshes();

    captured.hover.current?.({ id: "a" });
    viz.setHoverEnabled(false);
    captured.hover.current?.({ id: "a" });

    expect((meshes.a.material as THREE.MeshLambertMaterial).opacity).toBe(0.9);
    expect(
      (meshes.a.material as THREE.MeshLambertMaterial).emissiveIntensity,
    ).toBe(0);
    expect((meshes.c.material as THREE.MeshLambertMaterial).opacity).toBe(0.9);
    viz.dispose();
  });
});
