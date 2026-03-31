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
    <div className="p-6 max-w-2xl">
      <div className="space-y-6">
        {/* Profile Section */}
        <Card className="border-border-subtle">
          <CardHeader>
            <CardTitle className="text-text tracking-tight">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-text text-sm font-medium">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-elevated border-border-subtle text-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface-elevated border-border-subtle text-text"
              />
            </div>
            <Button className="bg-accent-strong hover:bg-accent-strong/90 text-white shadow-lg shadow-accent-strong/20 transition-all duration-200">
              Save changes
            </Button>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="border-border-subtle">
          <CardHeader>
            <CardTitle className="text-text tracking-tight">
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text font-medium">Email notifications</p>
                <p className="text-sm text-muted mt-0.5">
                  Get notified of important updates
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setNotifications(!notifications)}
                className={`border-border transition-all duration-200 ${
                  notifications
                    ? "bg-success/15 text-success border-success/20"
                    : "bg-surface-elevated text-muted"
                }`}
              >
                {notifications ? "On" : "Off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card className="border-border-subtle">
          <CardHeader>
            <CardTitle className="text-text tracking-tight">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle">
              <div>
                <p className="text-text font-medium">Current plan</p>
                <p className="text-sm text-muted mt-0.5">
                  Professional &mdash; &pound;79/month
                </p>
              </div>
              <Button
                variant="outline"
                className="border-border text-text text-xs hover:border-accent/30 transition-all duration-200"
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
