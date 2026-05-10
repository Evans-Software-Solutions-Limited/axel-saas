import { useState } from "react";
import {
  updateNotificationPreferences,
  type NotificationPreferences,
} from "./settingsApi";

export interface NotificationsPanelProps {
  preferences: NotificationPreferences | null;
  loading: boolean;
  loadError: string | null;
  onUpdated: (next: NotificationPreferences) => void;
}

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}

function Toggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: Readonly<ToggleProps>) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-text font-medium" id={`${id}-label`}>
          {label}
        </p>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 disabled:opacity-50 ${
          checked ? "bg-accent" : "bg-surface-elevated"
        }`}
      >
        <span className="sr-only">{checked ? "On" : "Off"}</span>
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function NotificationsPanel({
  preferences,
  loading,
  loadError,
  onUpdated,
}: Readonly<NotificationsPanelProps>) {
  const [saving, setSaving] = useState<keyof NotificationPreferences | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading preferences…</p>;
  }
  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }
  if (!preferences) {
    return (
      <p className="text-sm text-text-secondary">Preferences unavailable.</p>
    );
  }

  const handleToggle = async (
    key: keyof NotificationPreferences,
    next: boolean,
  ) => {
    if (saving) return;
    setSaving(key);
    setSaveError(null);
    // Optimistic update — restore on failure. The handler is the source
    // of truth, so on success we adopt whatever it returns (in case the
    // server filled in defaults for keys we didn't send).
    onUpdated({ ...preferences, [key]: next });
    try {
      const updated = await updateNotificationPreferences({ [key]: next });
      onUpdated(updated);
    } catch (err) {
      onUpdated({ ...preferences });
      setSaveError(
        err instanceof Error
          ? err.message
          : "Could not update your preferences",
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <Toggle
        id="email-notifications"
        label="Email notifications"
        description="Transactional emails (sign-in alerts, billing receipts)."
        checked={preferences.emailNotifications}
        disabled={saving === "emailNotifications"}
        onChange={(next) => void handleToggle("emailNotifications", next)}
      />
      <Toggle
        id="weekly-digest"
        label="Weekly digest"
        description="A short summary of what Axel did this week."
        checked={preferences.weeklyDigest}
        disabled={saving === "weeklyDigest"}
        onChange={(next) => void handleToggle("weeklyDigest", next)}
      />
      {saveError && (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
}
