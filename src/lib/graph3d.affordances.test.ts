import { describe, expect, it } from "vitest";
import {
  assignParticleBudget,
  buildHoverHighlightIndex,
  computeHoverHighlight,
  linkParticleCount,
  linkParticleSpeed,
  nodeEmphasis,
  selectHoverOverlayLinks,
  type GraphData,
} from "./graph3d";

describe("linkParticleCount", () => {
  it("gives calls links the strongest flow", () => {
    expect(linkParticleCount({ type: "calls" })).toBe(3);
  });

  it("gives high-confidence (EXTRACTED) links visible flow", () => {
    expect(linkParticleCount({ confidence: "EXTRACTED" })).toBe(2);
  });

  it("gives inferred/ambiguous/unknown links subtle flow, never zero", () => {
    expect(linkParticleCount({ confidence: "INFERRED" })).toBe(1);
    expect(linkParticleCount({ confidence: "AMBIGUOUS" })).toBe(1);
    expect(linkParticleCount({})).toBe(1);
  });

  it("prefers the calls rule over confidence", () => {
    expect(linkParticleCount({ type: "calls", confidence: "INFERRED" })).toBe(
      3,
    );
  });

  it("uses the assigned render budget when present", () => {
    const links = [
      { type: "calls" },
      { type: "references" },
      { confidence: "EXTRACTED" },
    ];

    assignParticleBudget(links, 2);

    expect(links.map(linkParticleCount).reduce((a, b) => a + b, 0)).toBe(2);
    expect(linkParticleCount(links[0])).toBeGreaterThanOrEqual(
      linkParticleCount(links[1]),
    );
  });
});

describe("linkParticleSpeed", () => {
  it("moves calls-link particles faster than the rest", () => {
    expect(linkParticleSpeed({ type: "calls" })).toBeGreaterThan(
      linkParticleSpeed({}),
    );
  });
});

const graph: GraphData = {
  nodes: [
    { id: "a", name: "a", type: "code" },
    { id: "b", name: "b", type: "code" },
    { id: "c", name: "c", type: "code" },
    { id: "d", name: "d", type: "code" }, // isolated
  ],
  links: [
    { source: "a", target: "b", type: "calls" },
    { source: "a", target: "c", type: "imports" },
  ],
};

describe("computeHoverHighlight", () => {
  it("returns empty sets when nothing is hovered", () => {
    const h = computeHoverHighlight(graph, null);
    expect(h.nodeIds.size).toBe(0);
    expect(h.linkKeys.size).toBe(0);
  });

  it("returns empty sets for an unknown node id", () => {
    const h = computeHoverHighlight(graph, "zzz");
    expect(h.nodeIds.size).toBe(0);
  });

  it("highlights a hub node with all neighbors and incident links", () => {
    const h = computeHoverHighlight(graph, "a");
    expect([...h.nodeIds].sort()).toEqual(["a", "b", "c"]);
    expect(h.linkKeys.has("a->b")).toBe(true);
    expect(h.linkKeys.has("a->c")).toBe(true);
  });

  it("highlights a leaf node with just its one neighbor and link", () => {
    const h = computeHoverHighlight(graph, "b");
    expect([...h.nodeIds].sort()).toEqual(["a", "b"]);
    expect(h.linkKeys.has("a->b")).toBe(true);
    expect(h.linkKeys.has("a->c")).toBe(false);
  });

  it("highlights only itself for an isolated node", () => {
    const h = computeHoverHighlight(graph, "d");
    expect([...h.nodeIds]).toEqual(["d"]);
    expect(h.linkKeys.size).toBe(0);
  });

  it("matches links whose endpoints are node objects, not id strings", () => {
    const simGraph: GraphData = {
      nodes: graph.nodes,
      links: [{ source: { id: "a" }, target: { id: "b" } } as never],
    };
    const h = computeHoverHighlight(simGraph, "a");
    expect(h.nodeIds.has("b")).toBe(true);
    expect(h.linkKeys.has("a->b")).toBe(true);
  });
});

describe("buildHoverHighlightIndex", () => {
  it("precomputes each node neighborhood and incident links", () => {
    const index = buildHoverHighlightIndex(graph);

    const a = index.get("a");
    expect([...(a?.nodeIds ?? [])].sort()).toEqual(["a", "b", "c"]);
    expect(a?.links).toHaveLength(2);

    const d = index.get("d");
    expect([...(d?.nodeIds ?? [])]).toEqual(["d"]);
    expect(d?.links).toHaveLength(0);
  });
});

describe("selectHoverOverlayLinks", () => {
  it("caps high-degree hover overlays and prioritizes semantically stronger links", () => {
    const links = [
      { source: "a", target: "low-1", type: "contains" },
      { source: "a", target: "call-1", type: "calls" },
      { source: "a", target: "ref-1", type: "references" },
      { source: "a", target: "extracted-1", confidence: "EXTRACTED" },
      { source: "a", target: "low-2", type: "contains" },
    ];

    const selected = selectHoverOverlayLinks(links, 3);

    expect(selected).toHaveLength(3);
    expect(selected).toEqual([links[1], links[3], links[2]]);
  });

  it("keeps all links when the neighborhood is under the cap", () => {
    const links = [
      { source: "a", target: "b", type: "contains" },
      { source: "a", target: "c", type: "contains" },
    ];

    expect(selectHoverOverlayLinks(links, 3)).toEqual(links);
  });
});

describe("nodeEmphasis", () => {
  const highlight = computeHoverHighlight(graph, "a"); // { a, b, c }, a hovered

  it("lights the hovered node (full opacity + glow)", () => {
    const e = nodeEmphasis("a", "a", highlight);
    expect(e.opacity).toBe(1);
    expect(e.emissiveIntensity).toBeGreaterThan(0);
  });

  it("keeps neighbors at normal opacity with no glow", () => {
    const e = nodeEmphasis("b", "a", highlight);
    expect(e.opacity).toBe(0.9);
    expect(e.emissiveIntensity).toBe(0);
  });

  it("dims non-neighbors while a node is hovered", () => {
    const e = nodeEmphasis("d", "a", highlight);
    expect(e.opacity).toBeLessThan(0.9);
    expect(e.emissiveIntensity).toBe(0);
  });

  it("is normal for everyone when nothing is hovered", () => {
    const empty = computeHoverHighlight(graph, null);
    expect(nodeEmphasis("a", null, empty)).toEqual({
      opacity: 0.9,
      emissiveIntensity: 0,
      variant: "normal",
    });
  });
});
