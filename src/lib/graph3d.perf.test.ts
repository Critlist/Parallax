import { describe, expect, it } from "vitest";
import {
  assignLinkRenderBudget,
  graphRenderPreset,
  linkRenderVisible,
  countSceneMaterials,
  createFpsMeter,
  sumParticleCount,
  type GraphData,
} from "./graph3d";

function graphOf(nodeCount: number, linkCount: number): GraphData {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `n-${index}`,
    name: `n-${index}`,
    type: "code",
    group: index % 4,
  }));
  const links = Array.from({ length: linkCount }, (_, index) => ({
    source: `n-${index % nodeCount}`,
    target: `n-${(index + 1) % nodeCount}`,
    type: "contains",
    confidence: "EXTRACTED",
  }));
  return { nodes, links };
}

describe("graphRenderPreset", () => {
  it("uses the standard preset for smaller graphs", () => {
    expect(graphRenderPreset(graphOf(1000, 2000)).mode).toBe("standard");
  });

  it("uses the stress preset for very large node or edge counts", () => {
    expect(graphRenderPreset(graphOf(20001, 100)).mode).toBe("stress");
    expect(graphRenderPreset(graphOf(1000, 50001)).mode).toBe("stress");
  });

  it("turns off ambient particles and shortens simulation in stress mode", () => {
    const preset = graphRenderPreset(graphOf(35952, 95434));

    expect(preset.particleBudget).toBe(0);
    expect(preset.linkBudget).toBeLessThan(95434);
    expect(preset.linkOpacity).toBeLessThan(0.4);
    expect(preset.cooldownTime).toBeLessThan(15000);
    expect(preset.cooldownTicks).toBeLessThan(Number.POSITIVE_INFINITY);
  });
});

describe("assignLinkRenderBudget", () => {
  it("keeps all links visible when under budget", () => {
    const graph = graphOf(10, 3);
    assignLinkRenderBudget(graph, {
      ...graphRenderPreset(graph),
      linkBudget: 10,
    });

    expect(graph.links.every(linkRenderVisible)).toBe(true);
  });

  it("caps rendered links and prioritizes calls, extracted links, and bridges", () => {
    const graph: GraphData = {
      nodes: [
        { id: "a", name: "a", type: "code", group: 1 },
        { id: "b", name: "b", type: "code", group: 1 },
        { id: "c", name: "c", type: "code", group: 2 },
        { id: "d", name: "d", type: "code", group: 2 },
      ],
      links: [
        { source: "a", target: "b", type: "contains" },
        { source: "a", target: "b", type: "references" },
        { source: "a", target: "c", type: "contains" },
        { source: "b", target: "d", type: "calls" },
      ],
    };

    assignLinkRenderBudget(graph, {
      ...graphRenderPreset(graph),
      linkBudget: 2,
    });

    expect(graph.links.map(linkRenderVisible)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});

describe("sumParticleCount", () => {
  it("sums linkParticleCount across links", () => {
    expect(
      sumParticleCount([
        { type: "calls" },
        { confidence: "EXTRACTED" },
        { confidence: "INFERRED" },
      ]),
    ).toBe(6);
  });

  it("is zero for no links", () => {
    expect(sumParticleCount([])).toBe(0);
  });
});

function fakeScene(objects: Array<{ material?: unknown }>) {
  return { traverse: (cb: (o: unknown) => void) => objects.forEach(cb) };
}

describe("countSceneMaterials", () => {
  it("counts unique materials, treating shared instances as one", () => {
    const shared = { id: "m1" };
    const scene = fakeScene([
      { material: shared },
      { material: shared },
      { material: { id: "m2" } },
      {},
    ]);
    expect(countSceneMaterials(scene)).toBe(2);
  });

  it("handles multi-material objects (array)", () => {
    const scene = fakeScene([{ material: [{ id: "a" }, { id: "b" }] }]);
    expect(countSceneMaterials(scene)).toBe(2);
  });
});

describe("createFpsMeter", () => {
  it("reports 0 until it has two samples", () => {
    const m = createFpsMeter();
    expect(m.fps).toBe(0);
    expect(m.frameMs).toBe(0);
    m.sample(0);
    expect(m.fps).toBe(0);
  });

  it("computes frame time and fps from steady 16ms frames", () => {
    const m = createFpsMeter();
    [0, 16, 32, 48, 64].forEach((t) => m.sample(t));
    expect(m.frameMs).toBe(16);
    expect(m.fps).toBe(63);
  });

  it("only averages the last windowSize deltas", () => {
    const m = createFpsMeter(2);
    [0, 100, 200, 210, 220].forEach((t) => m.sample(t));
    expect(m.frameMs).toBe(10);
    expect(m.fps).toBe(100);
  });
});
