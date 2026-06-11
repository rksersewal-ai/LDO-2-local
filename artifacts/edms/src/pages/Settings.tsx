import { CheckCircle, ChevronRight, RotateCcw, Save, Settings as SettingsIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, GlassCard, Input } from "../components/ui/Shared";
import { Switch } from "../components/ui/switch";
import { useTheme } from "../contexts/ThemeContext";
import { PreferencesService } from "../services/PreferencesService";
import { SystemSettingsService, type SystemSettingsState } from "../services/SystemSettingsService";

type SettingsKey = keyof SystemSettingsState;

type SettingGroup = {
  label: string;
  settings: Array<{
    key: SettingsKey;
    label: string;
    type: "select" | "toggle" | "input";
    options?: string[];
  }>;
};

const settingGroups: SettingGroup[] = [
  {
    label: "UI & Display",
    settings: [
      {
        key: "theme",
        label: "Theme Mode",
        type: "select",
        options: ["Dark (Default)", "Light", "System"],
      },
      {
        key: "density",
        label: "Table Row Density",
        type: "select",
        options: ["Comfortable", "Compact", "Spacious"],
      },
      { key: "animations", label: "Enable Animations", type: "toggle" },
    ],
  },
  {
    label: "OCR Engine",
    settings: [
      { key: "ocr_auto", label: "Auto-run OCR on Upload", type: "toggle" },
      {
        key: "ocr_confidence",
        label: "Minimum Confidence Threshold (%)",
        type: "input",
      },
      {
        key: "ocr_retries",
        label: "Max Auto-Retries on Failure",
        type: "select",
        options: ["0", "1", "2", "3"],
      },
    ],
  },
  {
    label: "Document Defaults",
    settings: [
      {
        key: "default_status",
        label: "Default New Document Status",
        type: "select",
        options: ["Draft", "Pending Review"],
      },
      {
        key: "obsolete_visible",
        label: "Show Obsolete Documents by Default",
        type: "toggle",
      },
      {
        key: "revision_format",
        label: "Revision Numbering Format",
        type: "select",
        options: ["A.1, A.2, B.0...", "1.0, 1.1, 2.0..."],
      },
    ],
  },
  {
    label: "System & Operational",
    settings: [
      {
        key: "session_timeout",
        label: "Session Timeout (minutes)",
        type: "input",
      },
      {
        key: "audit_retention",
        label: "Audit Log Retention (days)",
        type: "input",
      },
      { key: "max_upload", label: "Max Upload Size (MB)", type: "input" },
    ],
  },
];

function getInitialValues(): SystemSettingsState {
  const prefs = PreferencesService.get();
  const system = SystemSettingsService.get();

  return {
    ...system,
    theme: prefs.theme === "dark" ? "Dark (Default)" : prefs.theme === "light" ? "Light" : "System",
    density: prefs.compactTables ? "Compact" : system.density,
    animations: !prefs.reduceMotion,
  };
}

export default function Settings() {
  const { setTheme } = useTheme();
  const [activeGroup, setActiveGroup] = useState<string>(settingGroups[0].label);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<SystemSettingsState>(() => getInitialValues());

  const currentGroup = useMemo(
    () => settingGroups.find((group) => group.label === activeGroup),
    [activeGroup],
  );

  const setValue = (key: SettingsKey, nextValue: string | boolean) => {
    setValues((current) => ({ ...current, [key]: nextValue }));
  };

  const handleSave = () => {
    const nextThemePreference =
      values.theme === "Dark (Default)" ? "dark" : values.theme === "Light" ? "light" : "system";
    SystemSettingsService.set(values);
    PreferencesService.set({
      theme: nextThemePreference,
      compactTables: values.density === "Compact",
      reduceMotion: !values.animations,
    });
    if (values.theme === "System") {
      const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
      setTheme(prefersLight ? "light" : "dark");
    } else {
      setTheme(nextThemePreference as "dark" | "light");
    }

    setSaved(true);
    toast.success("Settings saved", {
      description: "Local workspace preferences have been updated.",
    });
    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    const next = getInitialValues();
    setValues(next);
    toast.info("Unsaved changes cleared");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground text-sm">
            System configuration and workspace preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" /> Reset Changes
          </Button>
          <Button onClick={handleSave} className={saved ? "from-teal-700 to-emerald-700" : ""}>
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <GlassCard className="p-3.5 self-start border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
          <nav className="space-y-1">
            {settingGroups.map((group) => (
              <button
                type="button"
                key={group.label}
                onClick={() => setActiveGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                  activeGroup === group.label
                    ? "bg-teal-500/15 text-primary/90 border border-teal-500/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="font-medium">{group.label}</span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${activeGroup === group.label ? "text-primary rotate-90" : ""}`}
                />
              </button>
            ))}
          </nav>
        </GlassCard>

        <div className="lg:col-span-3">
          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md transition-all duration-200">
            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              {activeGroup}
            </h2>
            <div className="space-y-5">
              {currentGroup?.settings.map((setting) => {
                const settingKey = setting.key as SettingsKey;
                const settingValue = values[settingKey];
                return (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between gap-4 py-3 border-b border-border/50 last:border-0"
                  >
                    <div className="max-w-md">
                      <p className="text-sm font-medium text-foreground">{setting.label}</p>
                    </div>
                    <div className="min-w-[180px]">
                      {setting.type === "toggle" && (
                        <div className="flex justify-end">
                          <Switch
                            checked={Boolean(settingValue)}
                            onCheckedChange={(checked) => setValue(settingKey, checked)}
                            aria-label={setting.label}
                          />
                        </div>
                      )}
                      {setting.type === "select" && (
                        <select
                          className="h-9 bg-card/50 border border-border/50 text-foreground text-sm rounded-xl px-3 focus:outline-none focus:border-teal-500/40 w-full"
                          value={String(settingValue)}
                          onChange={(event) => setValue(settingKey, event.target.value)}
                        >
                          {setting.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      )}
                      {setting.type === "input" && (
                        <Input
                          className="w-full text-right h-9"
                          value={String(settingValue)}
                          onChange={(event) => setValue(settingKey, event.target.value)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
