import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import PrivacyPolicy from "../PrivacyPolicy";

describe("PrivacyPolicy", () => {
  it("renders the page with correct title", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /privacy policy/i }),
    ).toBeDefined();
  });

  it("renders the Axel branding link", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /axel/i })).toBeDefined();
  });

  it("renders sign in link in header", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /sign in/i })).toBeDefined();
  });

  it("renders terms of service link in footer", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /terms of service/i }),
    ).toBeDefined();
  });

  it("renders privacy policy link in footer (current page)", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    // Should have a link to privacy (could be the current page or a link)
    const privacyLinks = screen.getAllByRole("link", {
      name: /privacy policy/i,
    });
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders key sections of privacy content", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    // Use getAllByText since text can appear in both headings and paragraphs
    expect(
      screen.getAllByText(/information we collect/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/how we use your information/i).length,
    ).toBeGreaterThan(0);
    // The actual heading is "Data Storage and Security"
    expect(screen.getAllByText(/data storage/i).length).toBeGreaterThan(0);
  });

  it("renders copyright notice", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(screen.getByText(/©.*axel\. all rights reserved\./i)).toBeDefined();
  });

  it("has correct paths for navigation links", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    const termsLink = screen.getByRole("link", { name: /terms of service/i });
    expect(termsLink.getAttribute("href")).toBe("/terms");
  });
});
