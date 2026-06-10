const PREFS_KEY = "ldo2_preferences";
const PREFS_EVENT = "ldo2_preferences_updated";

export interface UserPreferences {
  theme: "dark" | "light" | "system";
  sidebarExpanded: boolean;
  defaultView: string;
  workLedgerColumns: string[];
  documentHubColumns: string[];
  workLedgerPageSize: number;
  documentHubPageSize: number;
  lastVisitedPath: string;
  fontSize: number;
  dateFormat: "dd-mmm-yyyy" | "yyyy-mm-dd";
  timeFormat: "12h" | "24h";
  compactTables: boolean;
  reduceMotion: boolean;
  showLiveClock: boolean;
}

const DEFAULTS: UserPreferences = {
  theme: "light",
  sidebarExpanded: true,
  defaultView: "/",
  workLedgerColumns: [
    "id",
    "description",
    "category",
    "plOffice",
    "status",
    "kpi",
    "daysTarget",
    "officer",
    "date",
  ],
  documentHubColumns: ["name", "type", "status", "revision", "ocr", "size"],
  workLedgerPageSize: 20,
  documentHubPageSize: 20,
  lastVisitedPath: "/",
  fontSize: 14,
  dateFormat: "dd-mmm-yyyy",
  timeFormat: "24h",
  compactTables: false,
  reduceMotion: false,
  showLiveClock: true,
};

export class PreferencesService {
  static get(): UserPreferences {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  static set(prefs: Partial<UserPreferences>) {
    const current = PreferencesService.get();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: updated }));
    }
    return updated;
  }

  static reset() {
    localStorage.removeItem(PREFS_KEY);
    const updated = { ...DEFAULTS };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: updated }));
    }
    return updated;
  }

  static subscribe(listener: (prefs: UserPreferences) => void) {
    if (typeof window === "undefined") {
      return () => {};
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<UserPreferences>;
      if (customEvent.detail) {
        listener(customEvent.detail);
      }
    };

    window.addEventListener(PREFS_EVENT, handler);
    return () => window.removeEventListener(PREFS_EVENT, handler);
  }
}
