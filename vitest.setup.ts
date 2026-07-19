import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement ResizeObserver; graph3d.ts's constructor creates
// one unconditionally, so the whole class is untestable without this stub.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  (
    globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
  ).ResizeObserver = ResizeObserverStub;
}
