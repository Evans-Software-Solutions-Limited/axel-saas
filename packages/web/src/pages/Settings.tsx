import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";

export function Settings() {
  const [settings, setSettings] = useState({
    displayName: "Bradley Evans",
    timezone: "Europe/London",
    morningBrief: true,
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const timezones = [
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney",
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Settings</h1>
        <p className="text-[#8b8fa8]">Manage your preferences and account</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-8 space-y-6">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={settings.displayName}
              onChange={(e) => handleChange("displayName", e.target.value)}
              className="w-full bg-[#252840] text-white px-4 py-3 rounded-lg border border-[#2a2d3e] focus:border-indigo-500 focus:outline-none transition-colors duration-150"
              placeholder="Your name"
            />
            <p className="text-xs text-[#8b8fa8] mt-2">
              How you'll be identified in the system
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full bg-[#252840] text-white px-4 py-3 rounded-lg border border-[#2a2d3e] focus:border-indigo-500 focus:outline-none transition-colors duration-150"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#8b8fa8] mt-2">
              Used for scheduling and notifications
            </p>
          </div>

          {/* Morning Brief Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">Morning Brief</h3>
              <p className="text-xs text-[#8b8fa8] mt-1">
                Receive a daily summary at 9:00 AM
              </p>
            </div>
            <button
              onClick={() =>
                handleChange("morningBrief", !settings.morningBrief)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 ${
                settings.morningBrief ? "bg-green-600" : "bg-[#2a2d3e]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${
                  settings.morningBrief ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Save Button */}
          <div className="flex gap-4 pt-6 border-t border-[#2a2d3e]">
            <button
              onClick={handleSave}
              className="bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-600 transition-colors duration-150 flex items-center gap-2"
            >
              {saved && <IconCheck size={20} />}
              {saved ? "Saved" : "Save Changes"}
            </button>
            <button className="bg-[#252840] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#2d3050] transition-colors duration-150">
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-8">
          <button className="text-red-400 hover:text-red-300 font-medium transition-colors duration-150">
            Delete Account
          </button>
          <p className="text-xs text-[#8b8fa8] mt-2">
            Permanently delete your account and all associated data
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
