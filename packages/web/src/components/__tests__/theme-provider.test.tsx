import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../theme-provider";

function Consumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={() => setTheme("dark")}>
        Set dark
      </button>
      <button type="button" onClick={() => setTheme("light")}>
        Set light
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        Set system
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  });

  it("applies system theme (dark) when theme is system and prefers-color-scheme is dark", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("system");
    const matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, "matchMedia", { value: matchMedia });
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies system theme (light) when theme is system and prefers-color-scheme is light", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("system");
    const matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, "matchMedia", { value: matchMedia });
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("renders children", () => {
    render(
      <ThemeProvider>
        <span>Child</span>
      </ThemeProvider>,
    );
    expect(screen.getByText("Child")).toBeDefined();
  });

  it("provides default theme when localStorage is empty", () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("provides theme from localStorage when set", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("light");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("setTheme updates theme and localStorage", () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Set light"));
    expect(localStorage.setItem).toHaveBeenCalledWith("vite-ui-theme", "light");
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });
});
