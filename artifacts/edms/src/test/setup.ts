/**
 * Vitest setup file for @workspace/edms
 * Runs before each test suite to mock browser APIs and extend matchers
 */
import { afterEach, expect } from "vitest";

// ── Custom DOM matchers (replaces @testing-library/jest-dom) ────────────────

interface CustomMatchers<R = unknown> {
  toBeInTheDocument(): R;
  toHaveClass(...classNames: string[]): R;
}

declare module "vitest" {
  // biome-ignore lint/suspicious/noExplicitAny: extending vitest matcher types requires any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeInTheDocument(received: unknown) {
    const element = received as Element | null;
    const pass = element !== null && element !== undefined && document.contains(element);
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to be in the document`
          : `expected element to be in the document`,
    };
  },
  toHaveClass(received: unknown, ...classNames: string[]) {
    const element = received as Element | null;
    if (!element || !element.classList) {
      return {
        pass: false,
        message: () => `expected element to have classes [${classNames.join(", ")}], but element is null or has no classList`,
      };
    }
    const missing = classNames.filter((c) => !element.classList.contains(c));
    const pass = missing.length === 0;
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have classes [${classNames.join(", ")}]`
          : `expected element to have classes [${classNames.join(", ")}], but missing [${missing.join(", ")}]`,
    };
  },
});

// ── Mock localStorage ──────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ── Mock matchMedia ────────────────────────────────────────────────────────

Object.defineProperty(window, "matchMedia", {
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// ── Mock IntersectionObserver ──────────────────────────────────────────────

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "IntersectionObserver", {
  value: MockIntersectionObserver,
});

// ── Mock ResizeObserver ────────────────────────────────────────────────────

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
  value: MockResizeObserver,
});

// ── Clean up after each test ───────────────────────────────────────────────

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.className = "";
  window.localStorage.clear();
});
