import { describe, expect, it } from "vitest";
import {
  fromGraphifyExport,
  isGraphifyExport,
  statsFor,
  validateGraphReferences,
  type GraphifyExport,
} from "./graphifyAdapter";

const validExport: GraphifyExport = {
  directed: true,
  multigraph: false,
  nodes: [
    { id: "a", label: "A", file_type: "code", community: 0 },
    { id: "b", label: "B", file_type: "concept", community: 1 },
  ],
  links: [
    { source: "a", target: "b", relation: "calls", confidence_score: 0.5 },
  ],
};

describe("isGraphifyExport", () => {
  it("accepts a well-formed export", () => {
    expect(isGraphifyExport(validExport)).toBe(true);
  });

  it("rejects non-objects and null", () => {
    expect(isGraphifyExport(null)).toBe(false);
    expect(isGraphifyExport("nope")).toBe(false);
    expect(isGraphifyExport(42)).toBe(false);
  });

  it("rejects when nodes or links are not arrays", () => {
    expect(isGraphifyExport({ nodes: {}, links: [] })).toBe(false);
    expect(isGraphifyExport({ nodes: [], links: null })).toBe(false);
  });

  it("rejects a node element without a string id", () => {
    const bad = { nodes: [{ label: "no id" }], links: [] };
    expect(isGraphifyExport(bad)).toBe(false);
  });

  it("rejects a null node element (would otherwise throw in the mapper)", () => {
    const bad = { nodes: [null], links: [] };
    expect(isGraphifyExport(bad)).toBe(false);
  });

  it("rejects a link element missing source or target", () => {
    expect(
      isGraphifyExport({ nodes: [{ id: "a" }], links: [{ source: "a" }] }),
    ).toBe(false);
    expect(
      isGraphifyExport({ nodes: [{ id: "a" }], links: [{ target: "a" }] }),
    ).toBe(false);
  });
});

describe("validateGraphReferences", () => {
  it("returns null when every link endpoint references a real node id", () => {
    expect(validateGraphReferences(validExport)).toBeNull();
  });

  it("reports a link whose source or target is not a known node id", () => {
    const dangling: GraphifyExport = {
      ...validExport,
      links: [{ source: "a", target: "ghost", relation: "calls" }],
    };
    const err = validateGraphReferences(dangling);
    expect(err).toBeTypeOf("string");
    expect(err).toContain("ghost");
  });
});

describe("fromGraphifyExport", () => {
  it("maps fields and derives node size from degree", () => {
    const data = fromGraphifyExport(validExport);
    expect(data.nodes).toHaveLength(2);
    expect(data.nodes[0]).toMatchObject({
      id: "a",
      name: "A",
      type: "code",
      group: 0,
      size: 1,
    });
    expect(data.links[0]).toMatchObject({
      source: "a",
      target: "b",
      type: "calls",
      value: 0.5,
    });
  });
});

describe("statsFor", () => {
  it("counts nodes, links, communities and file types", () => {
    const stats = statsFor(validExport);
    expect(stats).toMatchObject({
      nodeCount: 2,
      linkCount: 1,
      communityCount: 2,
      hyperedgeCount: 0,
      fileTypeBreakdown: { code: 1, concept: 1 },
    });
  });
});
