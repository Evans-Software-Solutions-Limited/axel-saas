import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TermsOfService } from "../TermsOfService";

describe("TermsOfService", () => {
  it("renders the page with correct title", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /terms of service/i }),
    ).toBeDefined();
  });

  it("renders the Axel branding link", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /axel/i })).toBeDefined();
  });

  it("renders join waitlist link in header", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /join waitlist/i });
    expect(link.getAttribute("href")).toBe("/#waitlist");
  });

  it("renders privacy policy link in footer", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /privacy policy/i })).toBeDefined();
  });

  it("renders terms of service link in footer (current page)", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    // Should have a link to terms (could be the current page or a link)
    const termsLinks = screen.getAllByRole("link", {
      name: /terms of service/i,
    });
    expect(termsLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders key sections of terms content", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    // Use getAllByText since text can appear in both headings and paragraphs
    expect(screen.getAllByText(/acceptance of terms/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/user accounts/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/payment and subscription/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/termination/i).length).toBeGreaterThan(0);
  });

  it("renders copyright notice", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    expect(screen.getByText(/©.*axel\. all rights reserved\./i)).toBeDefined();
  });

  it("has correct paths for navigation links", () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>,
    );
    const privacyLink = screen.getByRole("link", { name: /privacy policy/i });
    expect(privacyLink.getAttribute("href")).toBe("/privacy");
  });
});
