import { useState } from "react";
import SettingsForm from "@/components/SettingsForm";
import { Card } from "@/components/ui/card";

export function Settings() {
  const [settings, setSettings] = useState({
    displayName: "John Doe",
    timezone: "Europe/London",
    morningBriefEnabled: true,
    morningBriefTime: "08:00",
    notifications: {
      email: true,
      telegram: true,
      slack: false,
    },
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleDisplayNameChange = (name: string) => {
    setSettings((prev) => ({ ...prev, displayName: name }));
  };

  const handleTimezoneChange = (tz: string) => {
    setSettings((prev) => ({ ...prev, timezone: tz }));
  };

  const handleMorningBriefToggle = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, morningBriefEnabled: enabled }));
  };

  const handleMorningBriefTimeChange = (time: string) => {
    setSettings((prev) => ({ ...prev, morningBriefTime: time }));
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="p-6 bg-[#0a0a0a] min-h-screen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2">
          Configure your assistant and preferences
        </p>
      </div>

      <Card className="bg-[#111] border-[#1a1a1a] p-8 max-w-2xl">
        <SettingsForm
          displayName={settings.displayName}
          onDisplayNameChange={handleDisplayNameChange}
          timezone={settings.timezone}
          onTimezoneChange={handleTimezoneChange}
          morningBriefEnabled={settings.morningBriefEnabled}
          onMorningBriefToggle={handleMorningBriefToggle}
          morningBriefTime={settings.morningBriefTime}
          onMorningBriefTimeChange={handleMorningBriefTimeChange}
          notificationPreferences={settings.notifications}
          onNotificationChange={handleNotificationChange}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </Card>
    </div>
  );
}

export default Settings;
