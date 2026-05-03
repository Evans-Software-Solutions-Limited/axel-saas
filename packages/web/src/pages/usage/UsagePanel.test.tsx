import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UsagePanel } from "./UsagePanel";
import type { UsageSummary } from "./usageApi";

afterEach(() => cleanup());

describe("UsagePanel", () => {
  it("renders a loading state", () => {
    render(<UsagePanel usage={null} loading error={null} />);
    expect(screen.getByText(/loading usage/i)).toBeDefined();
  });

  it("renders the error message when one is set", () => {
    render(
      <UsagePanel
        usage={null}
        loading={false}
        error="Could not load your usage"
      />,
    );
    expect(screen.getByText(/could not load your usage/i)).toBeDefined();
  });

  it("renders the empty state when usage is null and no error", () => {
    render(<UsagePanel usage={null} loading={false} error={null} />);
    expect(screen.getByText(/no usage recorded yet/i)).toBeDefined();
  });

  it("renders Free-tier daily bars with input + output", () => {
    const usage: UsageSummary = {
      tier: "free",
      daily: {
        inputTokens: 25_000,
        outputTokens: 10_000,
        limits: { inputTokens: 50_000, outputTokens: 25_000 },
      },
      monthly: { inputTokens: 0, outputTokens: 0, limits: null },
      percentUsed: 0.5,
      warningThreshold: 0.8,
    };
    render(<UsagePanel usage={usage} loading={false} error={null} />);
    expect(screen.getByText(/daily allowance/i)).toBeDefined();
    expect(screen.getByText(/input tokens \(today\)/i)).toBeDefined();
    expect(screen.getByText(/output tokens \(today\)/i)).toBeDefined();
    expect(screen.getByText(/25\.0k \/ 50\.0k/)).toBeDefined();
  });

  it("renders Premium-tier monthly bars (no daily)", () => {
    const usage: UsageSummary = {
      tier: "premium",
      daily: { inputTokens: 0, outputTokens: 0, limits: null },
      monthly: {
        inputTokens: 1_500_000,
        outputTokens: 750_000,
        limits: { inputTokens: 2_000_000, outputTokens: 1_000_000 },
      },
      percentUsed: 0.75,
      warningThreshold: 0.8,
    };
    render(<UsagePanel usage={usage} loading={false} error={null} />);
    expect(screen.getByText(/monthly allowance/i)).toBeDefined();
    expect(screen.getByText(/input tokens \(this month\)/i)).toBeDefined();
    expect(screen.getByText(/1\.5M \/ 2\.0M/)).toBeDefined();
    expect(screen.queryByText(/today/i)).toBeNull();
  });

  it("renders the Enterprise no-cap copy", () => {
    const usage: UsageSummary = {
      tier: "enterprise",
      daily: { inputTokens: 0, outputTokens: 0, limits: null },
      monthly: { inputTokens: 0, outputTokens: 0, limits: null },
      percentUsed: null,
      warningThreshold: 0.8,
    };
    render(<UsagePanel usage={usage} loading={false} error={null} />);
    expect(screen.getByText(/no platform caps|account manager/i)).toBeDefined();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows the warning copy with upgrade nudge when Free is over threshold", () => {
    const usage: UsageSummary = {
      tier: "free",
      daily: {
        inputTokens: 45_000,
        outputTokens: 0,
        limits: { inputTokens: 50_000, outputTokens: 25_000 },
      },
      monthly: { inputTokens: 0, outputTokens: 0, limits: null },
      percentUsed: 0.9,
      warningThreshold: 0.8,
    };
    render(<UsagePanel usage={usage} loading={false} error={null} />);
    expect(screen.getByText(/used 90%/i)).toBeDefined();
    expect(screen.getByText(/upgrade to premium/i)).toBeDefined();
  });

  it("shows the warning copy WITHOUT upgrade nudge when Premium is over threshold", () => {
    const usage: UsageSummary = {
      tier: "premium",
      daily: { inputTokens: 0, outputTokens: 0, limits: null },
      monthly: {
        inputTokens: 1_900_000,
        outputTokens: 0,
        limits: { inputTokens: 2_000_000, outputTokens: 1_000_000 },
      },
      percentUsed: 0.95,
      warningThreshold: 0.8,
    };
    render(<UsagePanel usage={usage} loading={false} error={null} />);
    expect(screen.getByText(/used 95%/i)).toBeDefined();
    expect(screen.getByText(/reach out if you need more/i)).toBeDefined();
    expect(screen.queryByText(/upgrade to premium/i)).toBeNull();
  });

  it("does not show the warning copy when below the warning threshold", () => {
    const usage: UsageSummary = {
      tier: "free",
      daily: {
        inputTokens: 5_000,
        outputTokens: 0,
        limits: { inputTokens: 50_000, outputTokens: 25_000 },
      },
      monthly: { inputTokens: 0, outputTokens: 0, limits: null },
      percentUsed: 0.1,
      warningThreshold: 0.8,
    };
    render(<UsagePanel usage={usage} loading={false} error={null} />);
    expect(screen.queryByText(/upgrade to premium/i)).toBeNull();
  });

  it("renders progressbars with correct accessible attributes", () => {
    const usage: UsageSummary = {
      tier: "free",
      daily: {
        inputTokens: 25_000,
        outputTokens: 12_500,
        limits: { inputTokens: 50_000, outputTokens: 25_000 },
      },
      monthly: { inputTokens: 0, outputTokens: 0, limits: null },
      percentUsed: 0.5,
      warningThreshold: 0.8,
    };
    render(<UsagePanel usage={usage} loading={false} error={null} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBe(2);
    expect(bars[0]?.getAttribute("aria-valuenow")).toBe("50");
  });
});
