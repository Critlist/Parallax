import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import GraphViewer from "./GraphViewer";

const { graphInstances } = vi.hoisted(() => ({
  graphInstances: [] as Array<{
    loadData: ReturnType<typeof vi.fn>;
    resetView: ReturnType<typeof vi.fn>;
    focusNode: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    selectNode: (node: unknown) => void;
  }>,
}));

// The renderer creates a live WebGL context, which jsdom can't provide. These
// tests exercise GraphViewer's file-loading / validation / error handling, not
// the renderer (which has its own unit tests), so stub it out entirely.
vi.mock("@/lib/graph3d", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/graph3d")>();
  return {
    ...actual,
    Graph3DVisualization: class {
      loadData = vi.fn();
      resetView = vi.fn();
      focusNode = vi.fn();
      dispose = vi.fn();
      selectNode: (node: unknown) => void;

      constructor(
        _container: HTMLElement,
        options?: { onNodeSelected?: (node: unknown) => void },
      ) {
        this.selectNode = (node: unknown) => options?.onNodeSelected?.(node);
        graphInstances.push(this);
      }
    },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  graphInstances.length = 0;
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

  it("searches loaded nodes and focuses a selected result", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [
        { id: "a", label: "pline()", file_type: "code", community: 0 },
        { id: "b", label: "Manual", file_type: "document", community: 1 },
      ],
      links: [{ source: "a", target: "b", relation: "references" }],
    });
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([graph], "graph.json", { type: "application/json" })],
      },
    });

    await screen.findByText(/2 nodes .* 1 edges/i);
    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), {
      target: { value: "pline" },
    });
    fireEvent.click(screen.getByRole("button", { name: /pline\(\)/i }));

    expect(graphInstances[0].focusNode).toHaveBeenCalledWith("a");
    expect(
      screen.getByRole("region", { name: /selected node/i }),
    ).toHaveTextContent("pline()");
    expect(screen.getByText("id: a")).toBeInTheDocument();
  });

  it("filters visible graph data by node type and shows visible counts", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [
        { id: "a", label: "main()", file_type: "code", community: 0 },
        { id: "b", label: "Concept", file_type: "concept", community: 1 },
        { id: "c", label: "Readme", file_type: "document", community: 1 },
      ],
      links: [
        { source: "a", target: "b", relation: "references" },
        { source: "b", target: "c", relation: "references" },
      ],
    });
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([graph], "graph.json", { type: "application/json" })],
      },
    });

    await screen.findByText(/3 nodes .* 2 edges/i);
    fireEvent.click(screen.getByRole("checkbox", { name: /concept/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/visible: 2 nodes .* 0 edges/i),
      ).toBeInTheDocument(),
    );
    expect(graphInstances[0].loadData).toHaveBeenLastCalledWith({
      nodes: [
        expect.objectContaining({ id: "a" }),
        expect.objectContaining({ id: "c" }),
      ],
      links: [],
    });
  });
});
