import { describe, expect, it } from "vitest";
import { linkParticleCount, linkParticleSpeed } from "./graph3d";

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
