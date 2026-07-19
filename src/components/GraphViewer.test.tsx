import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import GraphViewer from "./GraphViewer";

// The renderer creates a live WebGL context, which jsdom can't provide. These
// tests exercise GraphViewer's file-loading / validation / error handling, not
// the renderer (which has its own unit tests), so stub it out entirely.
vi.mock("@/lib/graph3d", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/graph3d")>();
  return {
    ...actual,
    Graph3DVisualization: class {
      loadData() {}
      resetView() {}
      dispose() {}
    },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

describe("GraphViewer file loading", () => {
  it("does not subscribe to a window-level node selection event", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<GraphViewer />);

    expect(addEventListener).not.toHaveBeenCalledWith(
      "node-selected",
      expect.any(Function),
    );
  });

  it("surfaces an error and clears the loading state when the file read fails", async () => {
    const original = globalThis.FileReader;
    class ErroringFileReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      readAsText() {
        this.onerror?.();
      }
    }
    globalThis.FileReader = ErroringFileReader as unknown as typeof FileReader;
    try {
      render(<GraphViewer />);
      const file = new File(["{}"], "graph.json", { type: "application/json" });
      fireEvent.change(fileInput(), { target: { files: [file] } });

      await waitFor(() =>
        expect(
          screen.getByText(/could not read that file/i),
        ).toBeInTheDocument(),
      );
      // loading state must not be stuck
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    } finally {
      globalThis.FileReader = original;
    }
  });

  it("rejects a file with links that reference unknown node ids", async () => {
    render(<GraphViewer />);
    const dangling = JSON.stringify({
      nodes: [{ id: "a", label: "A", file_type: "code" }],
      links: [{ source: "a", target: "ghost", relation: "calls" }],
    });
    const file = new File([dangling], "graph.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput(), { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/unknown node id "ghost"/i)).toBeInTheDocument(),
    );
  });

  it("rejects a structurally invalid export with a shape error, not a JSON-parse error", async () => {
    render(<GraphViewer />);
    // Valid JSON, but a malformed node element (no id) — must NOT be reported
    // as a JSON parse failure.
    const badShape = JSON.stringify({ nodes: [{ label: "no id" }], links: [] });
    const file = new File([badShape], "graph.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput(), { target: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.getByText(/not a recognized graph export/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText(/could not parse that file as json/i),
    ).not.toBeInTheDocument();
  });
});
