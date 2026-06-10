const SYSTEM_SETTINGS_KEY = "ldo2_system_settings";

export interface SystemSettingsState {
  theme: "Dark (Default)" | "Light" | "System";
  density: "Comfortable" | "Compact" | "Spacious";
  animations: boolean;
  ocr_auto: boolean;
  ocr_confidence: string;
  ocr_retries: "0" | "1" | "2" | "3";
  default_status: "Draft" | "Pending Review";
  obsolete_visible: boolean;
  revision_format: "A.1, A.2, B.0..." | "1.0, 1.1, 2.0...";
  session_timeout: string;
  audit_retention: string;
  max_upload: string;
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettingsState = {
  theme: "Dark (Default)",
  density: "Comfortable",
  animations: true,
  ocr_auto: true,
  ocr_confidence: "75",
  ocr_retries: "1",
  default_status: "Draft",
  obsolete_visible: false,
  revision_format: "A.1, A.2, B.0...",
  session_timeout: "30",
  audit_retention: "365",
  max_upload: "50",
};

export class SystemSettingsService {
  static get(): SystemSettingsState {
    try {
      const stored = localStorage.getItem(SYSTEM_SETTINGS_KEY);
      return stored
        ? { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(stored) }
        : { ...DEFAULT_SYSTEM_SETTINGS };
    } catch {
      return { ...DEFAULT_SYSTEM_SETTINGS };
    }
  }

  static set(next: Partial<SystemSettingsState>) {
    const updated = { ...SystemSettingsService.get(), ...next };
    localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  }

  static reset() {
    localStorage.removeItem(SYSTEM_SETTINGS_KEY);
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}

export { DEFAULT_SYSTEM_SETTINGS };
