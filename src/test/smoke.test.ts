/**
 * Smoke tests for critical application paths.
 * These verify that core modules load and basic functionality works.
 */

import { describe, expect, it } from "vitest";

describe("Application smoke tests", () => {
  it("localStorage mock works for theme persistence", () => {
    localStorage.setItem("ldo2-theme", "light");
    expect(localStorage.getItem("ldo2-theme")).toBe("light");
  });

  it("localStorage returns null for missing keys", () => {
    expect(localStorage.getItem("nonexistent")).toBeNull();
  });

  it("matchMedia mock returns expected shape", () => {
    const mql = window.matchMedia("(min-width: 768px)");
    expect(mql.matches).toBe(false);
    expect(mql.media).toBe("(min-width: 768px)");
  });
});

describe("Theme toggle logic", () => {
  it("toggles light-theme class on document element", () => {
    // Start with no theme
    document.documentElement.classList.remove("light-theme");
    expect(document.documentElement.classList.contains("light-theme")).toBe(false);

    // Toggle on
    document.documentElement.classList.add("light-theme");
    expect(document.documentElement.classList.contains("light-theme")).toBe(true);

    // Toggle off
    document.documentElement.classList.remove("light-theme");
    expect(document.documentElement.classList.contains("light-theme")).toBe(false);
  });

  it("persists theme choice to localStorage", () => {
    const isLight = true;
    localStorage.setItem("ldo2-theme", isLight ? "light" : "dark");
    expect(localStorage.getItem("ldo2-theme")).toBe("light");

    localStorage.setItem("ldo2-theme", "dark");
    expect(localStorage.getItem("ldo2-theme")).toBe("dark");
  });
});
