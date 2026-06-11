import { describe, expect, it, beforeEach } from "vitest";
import { PreferencesService } from "./PreferencesService";

describe("PreferencesService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when no preferences stored", () => {
    const prefs = PreferencesService.get();
    expect(prefs.theme).toBe("light");
    expect(prefs.fontSize).toBe(14);
    expect(prefs.sidebarExpanded).toBe(true);
    expect(prefs.showLiveClock).toBe(true);
  });

  it("persists preferences to localStorage", () => {
    PreferencesService.set({ theme: "dark", fontSize: 16 });
    const stored = window.localStorage.getItem("ldo2_preferences");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.theme).toBe("dark");
    expect(parsed.fontSize).toBe(16);
  });

  it("merges partial updates with existing preferences", () => {
    PreferencesService.set({ theme: "dark" });
    PreferencesService.set({ fontSize: 18 });

    const prefs = PreferencesService.get();
    expect(prefs.theme).toBe("dark");
    expect(prefs.fontSize).toBe(18);
  });

  it("returns defaults for corrupted localStorage data", () => {
    window.localStorage.setItem("ldo2_preferences", "NOT_VALID_JSON");
    const prefs = PreferencesService.get();
    expect(prefs.theme).toBe("light");
    expect(prefs.fontSize).toBe(14);
  });

  it("set returns the updated preferences object", () => {
    const result = PreferencesService.set({ compactTables: true });
    expect(result.compactTables).toBe(true);
    expect(result.theme).toBe("light"); // defaults still present
  });
});
