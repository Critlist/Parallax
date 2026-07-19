import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebugOverlay } from "./DebugOverlay";
import type { PerfSnapshot } from "@/lib/graph3d";

const snap: PerfSnapshot = {
  nodeCount: 12,
  visibleEdgeCount: 20,
  particleCount: 33,
  renderMode: "stress",
  engineRunning: true,
  drawCalls: 7,
  triangles: 4200,
  geometries: 5,
  textures: 1,
  materials: 3,
  settleMs: 812,
};

describe("DebugOverlay", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <DebugOverlay
        visible={false}
        snapshot={snap}
        fps={60}
        frameMs={16}
        loadMs={100}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the key metrics when visible", () => {
    render(
      <DebugOverlay
        visible
        snapshot={snap}
        fps={60}
        frameMs={16.7}
        loadMs={123}
      />,
    );
    expect(screen.getByText(/60/)).toBeInTheDocument();
    expect(screen.getByText(/draw calls/i)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText(/nodes/i)).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
    expect(screen.getByText(/mode/i)).toBeInTheDocument();
    expect(screen.getByText(/stress/i)).toBeInTheDocument();
  });
});
