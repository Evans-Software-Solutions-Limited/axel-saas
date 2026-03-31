import { useState } from "react";
import { Button } from "@axel-saas/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@axel-saas/ui/card";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";

// ============================================================================
// SETTINGS TAB
// ============================================================================

export function Settings() {
  const [email, setEmail] = useState("user@example.com");
  const [name, setName] = useState("John Doe");
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-text mb-8 tracking-tight">
        Settings
      </h1>
      <div className="space-y-6">
        {/* Profile Section */}
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-text text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-muted text-xs font-medium uppercase tracking-wider"
              >
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface border-border/60 text-text h-10"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-muted text-xs font-medium uppercase tracking-wider"
              >
                Email
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface border-border/60 text-text h-10"
              />
            </div>
            <Button className="bg-accent hover:bg-accent/85 text-white text-sm shadow-sm shadow-accent/20">
              Save changes
            </Button>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-text text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text font-medium text-sm">
                  Email notifications
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Get notified of important updates
                </p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifications ? "bg-success" : "bg-border"
                }`}
                aria-label={notifications ? "On" : "Off"}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                    notifications ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-text text-base">Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/40">
              <div>
                <p className="text-text font-medium text-sm">Current plan</p>
                <p className="text-xs text-muted mt-0.5">
                  Professional — £79/month
                </p>
              </div>
              <Button
                variant="outline"
                className="border-border/60 text-text text-xs hover:bg-surface-elevated"
              >
                Change plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
