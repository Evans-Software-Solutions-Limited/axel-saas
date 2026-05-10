import { useState } from "react";
import { Button } from "@axel-saas/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@axel-saas/ui/dialog";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";
import { deleteAccount } from "./settingsApi";

export interface DangerZonePanelProps {
  /** The user's email — required for the typed-confirmation comparison.
   * The parent is expected to render this panel only when the profile
   * has loaded (or to render a fallback for the loading / error
   * states). */
  email: string;
  /** Called after the server confirms the deletion succeeded. The
   * parent is responsible for signing the user out and redirecting
   * — keeping that decision out of this panel means the same
   * component works in environments without an AuthProvider (tests,
   * Storybook). */
  onDeleted: () => void | Promise<void>;
}

export function DangerZonePanel({
  email,
  onDeleted,
}: Readonly<DangerZonePanelProps>) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmation.trim() === email;

  const reset = () => {
    setConfirmation("");
    setSubmitting(false);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleConfirm = async () => {
    if (!matches || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccount();
      // Close the dialog before invoking the parent so the caller can
      // navigate away cleanly without an open Radix overlay still in
      // the DOM.
      setOpen(false);
      reset();
      await onDeleted();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Account deletion failed. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-text font-medium">Delete account</p>
          <p className="text-sm text-text-secondary">
            Permanently delete your account, cancel any active subscription, and
            remove all of your data. This cannot be undone.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="text-destructive border-destructive/40 hover:bg-destructive/10 shrink-0"
        >
          Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-surface text-text">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription className="text-text-secondary">
              This action is permanent. We&rsquo;ll cancel your subscription,
              remove your data, and sign you out. To confirm, type your email
              address below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label
              htmlFor="delete-confirmation"
              className="text-text-secondary text-sm"
            >
              Type <span className="font-mono text-text">{email}</span> to
              confirm
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
              className="bg-surface-raised border-border text-text focus:border-destructive focus:ring-destructive/30"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleConfirm()}
              disabled={!matches || submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
