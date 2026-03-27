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
      <div className="space-y-8">
        {/* Profile Section */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-text">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-text">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-raised border-border text-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text">
                Email
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface-raised border-border text-text"
              />
            </div>
            <Button className="bg-accent hover:bg-accent/90 text-white">
              Save changes
            </Button>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-text">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text font-medium">Email notifications</p>
                <p className="text-sm text-muted">
                  Get notified of important updates
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setNotifications(!notifications)}
                className={`border-border ${
                  notifications
                    ? "bg-success/20 text-success"
                    : "bg-muted/20 text-muted"
                }`}
              >
                {notifications ? "On" : "Off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-text">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
              <div>
                <p className="text-text font-medium">Current plan</p>
                <p className="text-sm text-muted">Professional - £79/month</p>
              </div>
              <Button
                variant="outline"
                className="border-border text-text text-xs"
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
