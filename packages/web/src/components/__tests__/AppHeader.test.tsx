import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppHeader } from "../AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

describe("AppHeader", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders logo linking to home", () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    const logo = screen.getByRole("link", { name: /axel/i });
    expect(logo.getAttribute("href")).toBe("/");
  });

  it("renders Join waitlist when unauthenticated", () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    const waitlistLinks = screen.getAllByRole("link", {
      name: /join waitlist/i,
    });
    expect(waitlistLinks.length).toBeGreaterThanOrEqual(1);
    expect(waitlistLinks[0]!.getAttribute("href")).toBe(waitlistSignupHref());
  });

  it("renders Home nav and Logout when authenticated (no Dashboard link)", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    const homeLinks = screen.getAllByRole("link", { name: /^home$/i });
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    expect(homeLinks[0]!.getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: /dashboard/i })).toBeNull();
    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    expect(logoutButtons.length).toBeGreaterThanOrEqual(1);
  });

  describe("mobile hamburger menu", () => {
    it("renders the toggle button with aria-expanded=false by default", () => {
      render(
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>,
      );
      const toggle = screen.getByRole("button", {
        name: /toggle navigation menu/i,
      });
      expect(toggle).toBeDefined();
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    });

    it("opens the mobile nav when the toggle is clicked", () => {
      render(
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>,
      );
      expect(
        screen.queryByRole("navigation", { name: /mobile navigation/i }),
      ).toBeNull();

      fireEvent.click(
        screen.getByRole("button", { name: /toggle navigation menu/i }),
      );

      const mobileNav = screen.getByRole("navigation", {
        name: /mobile navigation/i,
      });
      expect(mobileNav).toBeDefined();
      expect(
        screen
          .getByRole("button", { name: /toggle navigation menu/i })
          .getAttribute("aria-expanded"),
      ).toBe("true");
    });

    it("shows all nav links in the mobile menu when open", () => {
      render(
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>,
      );
      fireEvent.click(
        screen.getByRole("button", { name: /toggle navigation menu/i }),
      );

      const mobileNav = screen.getByRole("navigation", {
        name: /mobile navigation/i,
      });
      expect(mobileNav.querySelector('a[href="/"]')).toBeDefined();
      expect(mobileNav.querySelector('a[href="/use-cases"]')).toBeDefined();
      expect(mobileNav.querySelector('a[href="/pricing"]')).toBeDefined();
      expect(mobileNav.querySelector('a[href="/about"]')).toBeDefined();
    });

    it("closes the mobile nav when a nav link is clicked", () => {
      render(
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>,
      );
      fireEvent.click(
        screen.getByRole("button", { name: /toggle navigation menu/i }),
      );
      expect(
        screen.getByRole("navigation", { name: /mobile navigation/i }),
      ).toBeDefined();

      const mobileNav = screen.getByRole("navigation", {
        name: /mobile navigation/i,
      });
      const pricingLink = mobileNav.querySelector('a[href="/pricing"]')!;
      fireEvent.click(pricingLink as HTMLElement);

      expect(
        screen.queryByRole("navigation", { name: /mobile navigation/i }),
      ).toBeNull();
    });

    it("closes the mobile nav when toggle is clicked again", () => {
      render(
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>,
      );
      const toggle = screen.getByRole("button", {
        name: /toggle navigation menu/i,
      });
      fireEvent.click(toggle);
      expect(
        screen.getByRole("navigation", { name: /mobile navigation/i }),
      ).toBeDefined();

      fireEvent.click(toggle);
      expect(
        screen.queryByRole("navigation", { name: /mobile navigation/i }),
      ).toBeNull();
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    });
  });
});
