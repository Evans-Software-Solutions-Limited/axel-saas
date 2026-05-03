import type { UsageSummary } from "./usageApi";

interface UsagePanelProps {
  usage: UsageSummary | null;
  loading: boolean;
  error: string | null;
}

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  warningThreshold: number;
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function UsageBar({
  label,
  used,
  limit,
  warningThreshold,
}: Readonly<UsageBarProps>) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  const percent = Math.round(ratio * 100);
  const isWarning = ratio >= warningThreshold && ratio < 1;
  const isOver = ratio >= 1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span
          className={
            isOver
              ? "text-destructive font-medium"
              : isWarning
                ? "text-amber-400 font-medium"
                : "text-text-secondary"
          }
        >
          {formatTokenCount(used)} / {formatTokenCount(limit)} ({percent}%)
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 rounded-full bg-surface-elevated overflow-hidden"
      >
        <div
          className={
            isOver
              ? "h-full bg-destructive"
              : isWarning
                ? "h-full bg-amber-400"
                : "h-full bg-accent"
          }
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function UsagePanel({
  usage,
  loading,
  error,
}: Readonly<UsagePanelProps>) {
  if (loading) {
    return <p className="text-sm text-text-secondary">Loading usage…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!usage) {
    // No row yet — usage comes online once the user has chatted at least
    // once. Render a friendly empty state rather than blank.
    return (
      <p className="text-sm text-text-secondary">
        No usage recorded yet — your allowance will appear here once you start
        chatting.
      </p>
    );
  }

  // Enterprise has no caps; surface a neutral copy block.
  if (
    usage.tier === "enterprise" ||
    (usage.daily.limits === null && usage.monthly.limits === null)
  ) {
    return (
      <p className="text-sm text-text-secondary">
        Usage tracking is enabled on your account, but your plan has no platform
        caps. Speak to your account manager for a usage report.
      </p>
    );
  }

  const isFree = usage.daily.limits !== null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        {isFree
          ? "Daily allowance — resets every day at midnight UTC."
          : "Monthly allowance — resets on the 1st of every month (UTC)."}
      </p>

      {usage.daily.limits && (
        <>
          <UsageBar
            label="Input tokens (today)"
            used={usage.daily.inputTokens}
            limit={usage.daily.limits.inputTokens}
            warningThreshold={usage.warningThreshold}
          />
          <UsageBar
            label="Output tokens (today)"
            used={usage.daily.outputTokens}
            limit={usage.daily.limits.outputTokens}
            warningThreshold={usage.warningThreshold}
          />
        </>
      )}

      {usage.monthly.limits && (
        <>
          <UsageBar
            label="Input tokens (this month)"
            used={usage.monthly.inputTokens}
            limit={usage.monthly.limits.inputTokens}
            warningThreshold={usage.warningThreshold}
          />
          <UsageBar
            label="Output tokens (this month)"
            used={usage.monthly.outputTokens}
            limit={usage.monthly.limits.outputTokens}
            warningThreshold={usage.warningThreshold}
          />
        </>
      )}

      {usage.percentUsed !== null &&
        usage.percentUsed >= usage.warningThreshold && (
          <p className="text-xs text-amber-400">
            You&apos;ve used {Math.round((usage.percentUsed ?? 0) * 100)}% of
            your allowance.
            {isFree
              ? " Upgrade to Premium for ~40× the capacity."
              : " Reach out if you need more."}
          </p>
        )}
    </div>
  );
}
