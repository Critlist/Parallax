import { describe, expect, it } from "vitest";
import { computeCameraPosition } from "./graph3d";

const isFiniteVec = (v: { x: number; y: number; z: number }) =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe("computeCameraPosition", () => {
  it("scales an off-origin node along its direction vector", () => {
    // node at (100,0,0), pull-back distance 100 → distRatio = 1 + 100/100 = 2
    const pos = computeCameraPosition({ x: 100, y: 0, z: 0 }, 100);
    expect(pos).toEqual({ x: 200, y: 0, z: 0 });
  });

  it("does not produce NaN for a node sitting exactly at the origin", () => {
    const pos = computeCameraPosition({ x: 0, y: 0, z: 0 }, 100);
    expect(isFiniteVec(pos)).toBe(true);
    // fixed pull-back along +z when there is no direction to scale toward
    expect(pos).toEqual({ x: 0, y: 0, z: 100 });
  });

  it("falls back safely when the sim has not assigned coordinates yet", () => {
    const pos = computeCameraPosition(
      {
        x: undefined as unknown as number,
        y: undefined as unknown as number,
        z: undefined as unknown as number,
      },
      100,
    );
    expect(isFiniteVec(pos)).toBe(true);
  });
});
