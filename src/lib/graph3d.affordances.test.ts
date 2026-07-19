import { describe, expect, it } from "vitest";
import {
  computeHoverHighlight,
  linkParticleCount,
  linkParticleSpeed,
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
