import { beforeAll, afterEach, vi } from "vitest";

beforeAll(() => {
  function ResizeObserverMock(this: {
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }) {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  }
  global.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;

  if (typeof Element !== "undefined") {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});
