import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("ThemeContext", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    window.localStorage.clear();
  });

  it("provides default theme from preferences", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    // Default is 'light' when no preference is stored
    expect(result.current.theme).toBe("light");
  });

  it("toggleTheme switches between dark and light", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme explicitly sets the theme", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.setTheme("light");
    });
    expect(result.current.theme).toBe("light");
  });

  it("persists theme preference to localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    const stored = window.localStorage.getItem("ldo2_preferences");
    expect(stored).toBeTruthy();
    const prefs = JSON.parse(stored!);
    expect(prefs.theme).toBe("dark");
  });
});
