import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { PageMeta } from "../PageMeta";

// React 19 hoists <title>, <meta>, and <link> to document.head. After each
// test React unmounts the tree and removes the hoisted elements.
afterEach(() => {
  document.title = "";
});

describe("PageMeta", () => {
  it("sets document title", () => {
    render(
      <PageMeta
        title="Test Page — Axel"
        description="A test description."
        path="/test"
      />,
    );
    expect(document.title).toBe("Test Page — Axel");
  });

  it("renders meta description with correct content", () => {
    render(
      <PageMeta
        title="Test Page — Axel"
        description="A test description."
        path="/test"
      />,
    );
    const meta = document.head.querySelector('meta[name="description"]');
    expect(meta?.getAttribute("content")).toBe("A test description.");
  });

  it("renders canonical link pointing to SITE_URL + path", () => {
    render(
      <PageMeta
        title="Test Page — Axel"
        description="A test description."
        path="/pricing"
      />,
    );
    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toContain("/pricing");
  });

  it("renders index,follow robots tag by default", () => {
    render(
      <PageMeta
        title="Test Page — Axel"
        description="A test description."
        path="/pricing"
      />,
    );
    const robots = document.head.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute("content")).toBe("index,follow");
  });

  it("renders noindex,nofollow robots tag when noIndex is true", () => {
    render(
      <PageMeta
        title="Unsubscribe — Axel"
        description="Remove your email."
        path="/waitlist/unsubscribe"
        noIndex
      />,
    );
    const robots = document.head.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute("content")).toBe("noindex,nofollow");
  });

  it("canonical href uses the provided path for root", () => {
    render(<PageMeta title="Home — Axel" description="Home page." path="/" />);
    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toMatch(/\/$/);
  });
});
