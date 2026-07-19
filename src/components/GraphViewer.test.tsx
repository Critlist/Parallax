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
    fitGraph: ReturnType<typeof vi.fn>;
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
      fitGraph = vi.fn();
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
    fireEvent.click(screen.getByRole("button", { name: /types/i }));
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

  it("groups filters into chevron dropdowns", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [
        { id: "a", label: "main()", file_type: "code", community: 0 },
        { id: "b", label: "Concept", file_type: "concept", community: 1 },
      ],
      links: [
        {
          source: "a",
          target: "b",
          relation: "references",
          confidence: "INFERRED",
        },
      ],
    });
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([graph], "graph.json", { type: "application/json" })],
      },
    });

    await screen.findByText(/2 nodes .* 1 edges/i);

    for (const name of ["Types", "Communities", "Relations", "Confidence"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(name, "i") }),
      ).toHaveAttribute("aria-expanded", "false");
    }
    expect(
      screen.queryByRole("checkbox", { name: /code/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /types/i }));

    expect(screen.getByRole("button", { name: /types/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: /code/i })).toBeInTheDocument();
  });

  it("filters visible graph data by community and clears a hidden selected node", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [
        { id: "a", label: "main()", file_type: "code", community: 0 },
        { id: "b", label: "Concept", file_type: "concept", community: 1 },
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
      target: { value: "concept" },
    });
    fireEvent.click(screen.getByRole("button", { name: /concept/i }));
    expect(
      screen.getByRole("region", { name: /selected node/i }),
    ).toHaveTextContent("Concept");

    fireEvent.click(screen.getByRole("button", { name: /communities/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /community 1/i }));

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: /selected node/i }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText(/visible: 1 nodes .* 0 edges/i),
    ).toBeInTheDocument();
  });

  it("filters visible links by relation and confidence without dropping nodes", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [
        { id: "a", label: "main()", file_type: "code", community: 0 },
        { id: "b", label: "Concept", file_type: "concept", community: 1 },
        { id: "c", label: "Readme", file_type: "document", community: 1 },
      ],
      links: [
        {
          source: "a",
          target: "b",
          relation: "references",
          confidence: "EXTRACTED",
        },
        { source: "b", target: "c", relation: "calls", confidence: "INFERRED" },
      ],
    });
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([graph], "graph.json", { type: "application/json" })],
      },
    });

    await screen.findByText(/3 nodes .* 2 edges/i);
    fireEvent.click(screen.getByRole("button", { name: /relations/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /calls/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/visible: 3 nodes .* 1 edges/i),
      ).toBeInTheDocument(),
    );
    expect(graphInstances[0].loadData).toHaveBeenLastCalledWith({
      nodes: [
        expect.objectContaining({ id: "a" }),
        expect.objectContaining({ id: "b" }),
        expect.objectContaining({ id: "c" }),
      ],
      links: [expect.objectContaining({ type: "references" })],
    });

    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confidence/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /inferred/i }));

    await waitFor(() =>
      expect(graphInstances[0].loadData).toHaveBeenLastCalledWith({
        nodes: [
          expect.objectContaining({ id: "a" }),
          expect.objectContaining({ id: "b" }),
          expect.objectContaining({ id: "c" }),
        ],
        links: [expect.objectContaining({ confidence: "EXTRACTED" })],
      }),
    );
  });

  it("fits the loaded graph from the toolbar", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [{ id: "a", label: "main()", file_type: "code", community: 0 }],
      links: [],
    });
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([graph], "graph.json", { type: "application/json" })],
      },
    });

    await screen.findByText(/1 nodes .* 0 edges/i);
    fireEvent.click(screen.getByRole("button", { name: /^fit$/i }));

    expect(graphInstances[0].fitGraph).toHaveBeenCalledOnce();
  });

  it("shows incoming, outgoing, and connected-node summaries for the selected node", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [
        { id: "a", label: "caller()", file_type: "code", community: 0 },
        { id: "b", label: "target()", file_type: "code", community: 0 },
        { id: "c", label: "Concept", file_type: "concept", community: 1 },
      ],
      links: [
        { source: "a", target: "b", relation: "calls" },
        { source: "b", target: "c", relation: "references" },
      ],
    });
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([graph], "graph.json", { type: "application/json" })],
      },
    });

    await screen.findByText(/3 nodes .* 2 edges/i);
    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), {
      target: { value: "target" },
    });
    fireEvent.click(screen.getByRole("button", { name: /target\(\)/i }));

    const inspector = screen.getByRole("region", { name: /selected node/i });
    expect(inspector).toHaveTextContent("incoming: 1");
    expect(inspector).toHaveTextContent("outgoing: 1");
    expect(inspector).toHaveTextContent("caller() -> calls");
    expect(inspector).toHaveTextContent("references -> Concept");
  });

  it("shows only the selected node neighborhood and clears that neighborhood view", async () => {
    render(<GraphViewer />);
    const graph = JSON.stringify({
      nodes: [
        { id: "a", label: "caller()", file_type: "code", community: 0 },
        { id: "b", label: "target()", file_type: "code", community: 0 },
        { id: "c", label: "Concept", file_type: "concept", community: 1 },
        { id: "d", label: "Unrelated", file_type: "document", community: 2 },
      ],
      links: [
        { source: "a", target: "b", relation: "calls" },
        { source: "b", target: "c", relation: "references" },
      ],
    });
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([graph], "graph.json", { type: "application/json" })],
      },
    });

    await screen.findByText(/4 nodes .* 2 edges/i);
    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), {
      target: { value: "target" },
    });
    fireEvent.click(screen.getByRole("button", { name: /target\(\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /show neighbors/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/visible: 3 nodes .* 2 edges/i),
      ).toBeInTheDocument(),
    );
    expect(graphInstances[0].loadData).toHaveBeenLastCalledWith({
      nodes: [
        expect.objectContaining({ id: "a" }),
        expect.objectContaining({ id: "b" }),
        expect.objectContaining({ id: "c" }),
      ],
      links: [
        expect.objectContaining({ type: "calls" }),
        expect.objectContaining({ type: "references" }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /clear neighbors/i }));

    await waitFor(() =>
      expect(
        screen.queryByText(/visible: 3 nodes .* 2 edges/i),
      ).not.toBeInTheDocument(),
    );
    expect(graphInstances[0].loadData).toHaveBeenLastCalledWith({
      nodes: [
        expect.objectContaining({ id: "a" }),
        expect.objectContaining({ id: "b" }),
        expect.objectContaining({ id: "c" }),
        expect.objectContaining({ id: "d" }),
      ],
      links: [
        expect.objectContaining({ type: "calls" }),
        expect.objectContaining({ type: "references" }),
      ],
    });
  });
});
