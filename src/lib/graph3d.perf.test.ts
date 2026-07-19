import { describe, expect, it } from "vitest";
import {
  countSceneMaterials,
  createFpsMeter,
  sumParticleCount,
} from "./graph3d";

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
