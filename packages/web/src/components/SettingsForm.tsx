import React from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface SettingsFormProps {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  morningBriefEnabled: boolean;
  onMorningBriefToggle: (enabled: boolean) => void;
  morningBriefTime?: string;
  onMorningBriefTimeChange?: (time: string) => void;
  notificationPreferences: {
    email: boolean;
    telegram: boolean;
    slack: boolean;
  };
  onNotificationChange: (key: string, value: boolean) => void;
  onSave: () => void;
  isSaving?: boolean;
}

const timezones = [
  "Europe/London",
  "Europe/Paris",
  "US/Eastern",
  "US/Central",
  "US/Mountain",
  "US/Pacific",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const SettingsForm: React.FC<SettingsFormProps> = ({
  displayName,
  onDisplayNameChange,
  timezone,
  onTimezoneChange,
  morningBriefEnabled,
  onMorningBriefToggle,
  morningBriefTime = "08:00",
  onMorningBriefTimeChange,
  notificationPreferences,
  onNotificationChange,
  onSave,
  isSaving = false,
}) => {
  return (
    <div className="space-y-6">
      {/* Display Name */}
      <div>
        <Label htmlFor="displayName" className="text-white font-semibold">
          Display name
        </Label>
        <p className="text-sm text-gray-400 mb-2">
          How you want to be addressed
        </p>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
          placeholder="Your name"
        />
      </div>

      {/* Timezone */}
      <div>
        <Label htmlFor="timezone" className="text-white font-semibold">
          Timezone
        </Label>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Morning Brief */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-white font-semibold">Morning brief</Label>
            <p className="text-sm text-gray-400">
              Daily summary delivered to your preferred channel
            </p>
          </div>
          <Switch
            checked={morningBriefEnabled}
            onCheckedChange={onMorningBriefToggle}
          />
        </div>

        {morningBriefEnabled && (
          <div>
            <Label
              htmlFor="briefTime"
              className="text-white font-semibold text-sm"
            >
              Preferred time
            </Label>
            <Input
              id="briefTime"
              type="time"
              value={morningBriefTime}
              onChange={(e) => onMorningBriefTimeChange?.(e.target.value)}
              className="bg-[#1a1a1a] border-[#2a2a2a] text-white mt-2 max-w-xs"
            />
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div>
        <Label className="text-white font-semibold block mb-3">
          Notifications
        </Label>
        <p className="text-sm text-gray-400 mb-4">
          Which channels should we notify you on?
        </p>
        <div className="space-y-3">
          {Object.entries(notificationPreferences).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-3">
              <Checkbox
                id={`notif-${key}`}
                checked={value}
                onCheckedChange={(checked) =>
                  onNotificationChange(key, checked as boolean)
                }
              />
              <Label
                htmlFor={`notif-${key}`}
                className="text-gray-400 capitalize font-normal cursor-pointer"
              >
                {key} notifications
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsForm;
