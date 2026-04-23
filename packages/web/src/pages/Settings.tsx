import { useState } from "react";
import { Button } from "@axel-saas/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@axel-saas/ui/card";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";
import { Badge } from "@axel-saas/ui/badge";

export function Settings() {
  const [email, setEmail] = useState("user@example.com");
  const [name, setName] = useState("John Doe");
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text font-display">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-text-secondary text-sm">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-raised border-border text-text focus:border-accent focus:ring-accent-glow/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-secondary text-sm">
                Email
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface-raised border-border text-text focus:border-accent focus:ring-accent-glow/30"
              />
            </div>
            <Button>Save changes</Button>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text font-display">
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text font-medium">Email notifications</p>
                <p className="text-sm text-text-secondary">
                  Get notified of important updates
                </p>
              </div>
              <button
                type="button"
                role="button"
                onClick={() => setNotifications(!notifications)}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                  notifications ? "bg-accent" : "bg-surface-elevated"
                }`}
              >
                <span className="sr-only">{notifications ? "On" : "Off"}</span>
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                    notifications ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text font-display">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-text font-medium">Free</p>
                  <Badge className="bg-accent-muted text-accent border-0">
                    Active
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary mt-0.5">£0/month</p>
              </div>
              <Button variant="outline" className="text-xs">
                Change plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
