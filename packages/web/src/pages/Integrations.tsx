import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@axel-saas/ui/button";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@axel-saas/ui/dialog";
import { IconLock } from "@tabler/icons-react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  INTEGRATIONS_CATALOG,
  type CatalogCategory,
  type CatalogEntry,
} from "./integrations/integrationsCatalog";
import {
  connectIntegration,
  fetchIntegrations,
  revokeIntegration,
  startIntegrationOauth,
  type ConnectedIntegration,
} from "./integrations/integrationsApi";
import { fetchSubscriptionStatus } from "./settings/settingsApi";

interface JoinedRow {
  catalog: CatalogEntry;
  connected: ConnectedIntegration | null;
}

type Tier = "free" | "premium" | "enterprise";

type Banner =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

function readUrlBanner(): Banner {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const connected = params.get("connected");
  const error = params.get("error");
  if (connected) {
    return {
      kind: "success",
      message: `Connected ${connected}`,
    };
  }
  if (error) {
    return { kind: "error", message: error };
  }
  return null;
}

function clearUrlParams() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("connected") && !url.searchParams.has("error")) {
    return;
  }
  url.searchParams.delete("connected");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.toString());
}

function isLockedForTier(catalog: CatalogEntry, tier: Tier): boolean {
  return catalog.tierRequired === "premium" && tier === "free";
}

export function Integrations() {
  const [tier, setTier] = useState<Tier>("free");
  const [tierResolved, setTierResolved] = useState(false);
  const [connections, setConnections] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(() => readUrlBanner());
  const [connectTarget, setConnectTarget] = useState<CatalogEntry | null>(null);
  const [manageTarget, setManageTarget] = useState<{
    catalog: CatalogEntry;
    connected: ConnectedIntegration;
  } | null>(null);

  useEffect(() => {
    clearUrlParams();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      fetchIntegrations(),
      fetchSubscriptionStatus(),
    ]).then(([listResult, subResult]) => {
      if (cancelled) return;
      if (listResult.status === "fulfilled") {
        setConnections(listResult.value);
      } else {
        setLoadError(
          listResult.reason instanceof Error
            ? listResult.reason.message
            : "Could not load your integrations",
        );
      }
      if (subResult.status === "fulfilled") {
        const value = subResult.value;
        if (value?.tier) setTier(value.tier);
      }
      setTierResolved(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const byCategory = new Map<CatalogCategory, JoinedRow[]>();
    for (const catalog of INTEGRATIONS_CATALOG) {
      const connected =
        connections.find((c) => c.integrationId === catalog.id) ?? null;
      const isActive = connected?.status === "connected";
      const row: JoinedRow = {
        catalog,
        connected: isActive ? connected : null,
      };
      const list = byCategory.get(catalog.category) ?? [];
      list.push(row);
      byCategory.set(catalog.category, list);
    }
    return byCategory;
  }, [connections]);

  const handleConnectClick = (entry: CatalogEntry) => {
    if (entry.authType === "oauth") {
      void startOauth(entry.id);
      return;
    }
    setConnectTarget(entry);
  };

  const startOauth = async (integrationId: string) => {
    setBanner(null);
    try {
      const { redirectUrl } = await startIntegrationOauth(
        integrationId,
        "/integrations",
      );
      window.location.assign(redirectUrl);
    } catch (err) {
      setBanner({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to start OAuth",
      });
    }
  };

  const handleManageClick = (entry: CatalogEntry) => {
    const connected = connections.find(
      (c) => c.integrationId === entry.id && c.status === "connected",
    );
    if (!connected) return;
    setManageTarget({ catalog: entry, connected });
  };

  const handleConnectSubmit = async (credential: string, label?: string) => {
    if (!connectTarget) return;
    const id = connectTarget.id;
    const result = await connectIntegration(id, credential, label);
    setConnections((prev) => {
      const existingIdx = prev.findIndex((c) => c.integrationId === id);
      const next: ConnectedIntegration = {
        id: existingIdx >= 0 ? prev[existingIdx]!.id : `temp-${id}`,
        integrationId: id,
        status: "connected",
        keyHint: result.keyHint || null,
        label: label ?? null,
        connectedAt: result.connectedAt,
        lastErrorMessageSafe: null,
      };
      if (existingIdx >= 0) {
        const copy = prev.slice();
        copy[existingIdx] = next;
        return copy;
      }
      return [...prev, next];
    });
    setConnectTarget(null);
    setBanner({
      kind: "success",
      message: `${connectTarget.name} connected`,
    });
  };

  const handleRevoke = async (integrationId: string) => {
    await revokeIntegration(integrationId);
    setConnections((prev) =>
      prev.map((c) =>
        c.integrationId === integrationId
          ? { ...c, status: "revoked", keyHint: null }
          : c,
      ),
    );
    setManageTarget(null);
    setBanner({
      kind: "success",
      message: `Disconnected ${integrationId}`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">
          Integrations
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Connect the tools Axel needs to help you
        </p>
      </div>

      {banner && (
        <div
          role="status"
          className={
            banner.kind === "success"
              ? "rounded-xl border border-accent/30 bg-accent-muted/40 p-3 text-sm text-accent"
              : "rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {banner.message}
        </div>
      )}

      {loading && (
        <p className="text-sm text-text-secondary">Loading integrations…</p>
      )}

      {!loading && loadError && (
        <p className="text-sm text-destructive">{loadError}</p>
      )}

      {!loading && !loadError && (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const rows = grouped.get(category);
            if (!rows || rows.length === 0) return null;
            return (
              <section key={category} className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-text-secondary">
                  {CATEGORY_LABELS[category]}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rows.map((row) => (
                    <IntegrationCard
                      key={row.catalog.id}
                      row={row}
                      tier={tier}
                      tierResolved={tierResolved}
                      onConnect={() => handleConnectClick(row.catalog)}
                      onManage={() => handleManageClick(row.catalog)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {connectTarget && (
        <ConnectModal
          entry={connectTarget}
          onClose={() => setConnectTarget(null)}
          onSubmit={handleConnectSubmit}
        />
      )}

      {manageTarget && (
        <ManageModal
          entry={manageTarget.catalog}
          connected={manageTarget.connected}
          onClose={() => setManageTarget(null)}
          onRevoke={() => handleRevoke(manageTarget.catalog.id)}
        />
      )}
    </div>
  );
}

interface IntegrationCardProps {
  row: JoinedRow;
  tier: Tier;
  tierResolved: boolean;
  onConnect: () => void;
  onManage: () => void;
}

function IntegrationCard({
  row,
  tier,
  tierResolved,
  onConnect,
  onManage,
}: Readonly<IntegrationCardProps>) {
  const { catalog, connected } = row;
  const Icon = catalog.icon;
  const isConnected = connected !== null;
  const locked = tierResolved && isLockedForTier(catalog, tier);

  return (
    <div
      className={`glass-card rounded-xl p-5 ${
        !isConnected ? "border-dashed opacity-90" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl ${catalog.iconBg} flex items-center justify-center shrink-0`}
          >
            <Icon className={`w-5 h-5 ${catalog.iconColor}`} stroke={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-text font-medium">{catalog.name}</p>
              {locked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                  <IconLock className="w-3 h-3" stroke={1.5} />
                  Premium
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {catalog.description}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {isConnected && (
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
              )}
              <p className="text-xs text-text-secondary">
                {isConnected
                  ? connected.keyHint
                    ? `Connected · ${connected.keyHint}`
                    : "Connected"
                  : locked
                    ? "Premium subscription required"
                    : "Not connected"}
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          {isConnected ? (
            <Button variant="ghost" className="text-xs" onClick={onManage}>
              Manage
            </Button>
          ) : locked ? (
            <Button
              variant="outline"
              className="text-xs"
              onClick={() => window.location.assign("/subscribe")}
            >
              Upgrade
            </Button>
          ) : (
            <Button variant="outline" className="text-xs" onClick={onConnect}>
              Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConnectModalProps {
  entry: CatalogEntry;
  onClose: () => void;
  onSubmit: (credential: string, label?: string) => Promise<void>;
}

function ConnectModal({
  entry,
  onClose,
  onSubmit,
}: Readonly<ConnectModalProps>) {
  const [credential, setCredential] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (credential.trim().length === 0) {
      setError("Please paste your credential");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(credential.trim(), label.trim() || undefined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect integration",
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Connect {entry.name}</DialogTitle>
            <DialogDescription>{entry.helpText}</DialogDescription>
          </DialogHeader>

          {entry.helpUrl && (
            <a
              href={entry.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              How to get a {entry.credentialLabel.toLowerCase()} →
            </a>
          )}

          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="credential"
                className="text-text-secondary text-sm"
              >
                {entry.credentialLabel}
              </Label>
              <Input
                id="credential"
                type="password"
                autoComplete="off"
                placeholder={entry.credentialPlaceholder}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                className="bg-surface-raised border-border text-text"
              />
              <p className="text-xs text-text-secondary">
                Encrypted at rest — never returned to your browser after
                submission.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label" className="text-text-secondary text-sm">
                Label (optional)
              </Label>
              <Input
                id="label"
                placeholder="e.g. Production key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="bg-surface-raised border-border text-text"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ManageModalProps {
  entry: CatalogEntry;
  connected: ConnectedIntegration;
  onClose: () => void;
  onRevoke: () => Promise<void>;
}

function ManageModal({
  entry,
  connected,
  onClose,
  onRevoke,
}: Readonly<ManageModalProps>) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = async () => {
    setConfirming(true);
    setError(null);
    try {
      await onRevoke();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      setConfirming(false);
    }
  };

  const connectedDate = connected.connectedAt
    ? new Date(connected.connectedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry.name}</DialogTitle>
          <DialogDescription>
            Connected{" "}
            {connectedDate ? `on ${connectedDate}` : "to your account"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {connected.keyHint && (
            <div className="text-sm">
              <span className="text-text-secondary">Credential: </span>
              <span className="text-text font-mono">{connected.keyHint}</span>
            </div>
          )}
          {connected.label && (
            <div className="text-sm">
              <span className="text-text-secondary">Label: </span>
              <span className="text-text">{connected.label}</span>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={confirming}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleRevoke()}
            disabled={confirming}
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
          >
            {confirming ? "Disconnecting…" : "Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
