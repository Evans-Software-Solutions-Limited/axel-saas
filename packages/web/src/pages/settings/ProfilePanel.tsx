import { useState } from "react";
import { Button } from "@axel-saas/ui/button";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";
import { updateProfileName, type UserProfile } from "./settingsApi";

export interface ProfilePanelProps {
  profile: UserProfile | null;
  loading: boolean;
  loadError: string | null;
  /** Called after a successful save so the parent can keep its mirror of
   * the profile in sync — this avoids a refetch round-trip. */
  onUpdated: (next: UserProfile) => void;
}

export function ProfilePanel({
  profile,
  loading,
  loadError,
  onUpdated,
}: Readonly<ProfilePanelProps>) {
  // Editable name state is owned by this panel; the parent's `profile`
  // is the saved baseline used to detect dirty state. Derived once from
  // the profile so prop changes (e.g. another panel triggering a refetch)
  // don't clobber an in-progress edit.
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading profile…</p>;
  }
  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }
  if (!profile) {
    return <p className="text-sm text-text-secondary">Profile unavailable.</p>;
  }

  const baseline = profile.fullName ?? "";
  const currentName = name ?? baseline;
  const trimmed = currentName.trim();
  const dirty = trimmed !== baseline.trim();
  const validLength = trimmed.length >= 1 && trimmed.length <= 100;

  const handleSave = async () => {
    if (!dirty || !validLength || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateProfileName(trimmed);
      onUpdated(updated);
      setName(updated.fullName ?? "");
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save your changes",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name" className="text-text-secondary text-sm">
          Name
        </Label>
        <Input
          id="profile-name"
          value={currentName}
          onChange={(e) => {
            setName(e.target.value);
            // Clear stale feedback as soon as the user keeps typing —
            // a success toast lingering past the next edit is misleading.
            if (saveSuccess) setSaveSuccess(false);
            if (saveError) setSaveError(null);
          }}
          disabled={saving}
          maxLength={100}
          className="bg-surface-raised border-border text-text focus:border-accent focus:ring-accent-glow/30"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email" className="text-text-secondary text-sm">
          Email
        </Label>
        <Input
          id="profile-email"
          value={profile.email}
          readOnly
          aria-readonly="true"
          className="bg-surface-raised border-border text-text-secondary cursor-not-allowed"
        />
        <p className="text-xs text-text-secondary">
          Email is managed through your sign-in provider.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => void handleSave()}
          disabled={!dirty || !validLength || saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saveSuccess && <span className="text-sm text-accent">Saved</span>}
      </div>
      {saveError && (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
}
