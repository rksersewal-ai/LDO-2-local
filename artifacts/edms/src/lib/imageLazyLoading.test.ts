import { describe, it, expect, vi } from "vitest";
import {
  createIntersectionObserver,
  buildSrcSet,
  generatePlaceholderDataUrl,
  calculateLoadPriority,
  DEFAULT_LAZY_CONFIG,
  STANDARD_SIZES,
} from "./imageLazyLoading";
import type { ViewportRect, ElementRect } from "./imageLazyLoading";

describe("imageLazyLoading", () => {
  describe("createIntersectionObserver", () => {
    it("returns an IntersectionObserver or null depending on environment support", () => {
      const callback = vi.fn();
      const observer = createIntersectionObserver(callback);
      // In jsdom, IntersectionObserver may not be fully available
      // The function should return either an IntersectionObserver instance or null
      if (typeof globalThis.IntersectionObserver !== "undefined") {
        expect(observer).not.toBeNull();
      } else {
        expect(observer).toBeNull();
      }
    });

    it("accepts custom options without throwing", () => {
      const callback = vi.fn();
      // Should not throw regardless of environment
      expect(() =>
        createIntersectionObserver(callback, {
          rootMargin: "100px",
          threshold: 0.5,
        }),
      ).not.toThrow();
    });

    it("accepts default options without throwing", () => {
      const callback = vi.fn();
      expect(() => createIntersectionObserver(callback)).not.toThrow();
    });
  });

  describe("buildSrcSet", () => {
    it("builds a srcSet string with default sizes", () => {
      const result = buildSrcSet("/images/doc-thumb.jpg");
      expect(result).toContain("/images/doc-thumb-sm.jpg 320w");
      expect(result).toContain("/images/doc-thumb-md.jpg 640w");
      expect(result).toContain("/images/doc-thumb-lg.jpg 1024w");
      expect(result).toContain("/images/doc-thumb-xl.jpg 1920w");
    });

    it("builds a srcSet string with custom sizes", () => {
      const customSizes = [
        { width: 200, suffix: "tiny" },
        { width: 800, suffix: "big" },
      ];
      const result = buildSrcSet("/images/photo.png", customSizes);
      expect(result).toBe("/images/photo-tiny.png 200w, /images/photo-big.png 800w");
    });

    it("handles URLs without extension by defaulting to .jpg", () => {
      const result = buildSrcSet("/images/doc-thumb", STANDARD_SIZES);
      expect(result).toContain("/images/doc-thumb-sm.jpg 320w");
    });

    it("handles URLs with path separators correctly", () => {
      const result = buildSrcSet("/path/to/image.png", [{ width: 320, suffix: "sm" }]);
      expect(result).toBe("/path/to/image-sm.png 320w");
    });
  });

  describe("generatePlaceholderDataUrl", () => {
    it("generates a data URL with the specified dimensions", () => {
      const url = generatePlaceholderDataUrl(100, 50);
      expect(url).toContain("data:image/svg+xml;base64,");
    });

    it("generates a data URL with default color", () => {
      const url = generatePlaceholderDataUrl(100, 50);
      // Decode and check for the default color
      const base64Part = url.replace("data:image/svg+xml;base64,", "");
      const decoded = atob(base64Part);
      expect(decoded).toContain('width="100"');
      expect(decoded).toContain('height="50"');
      expect(decoded).toContain(DEFAULT_LAZY_CONFIG.placeholderColor);
    });

    it("generates a data URL with custom color", () => {
      const url = generatePlaceholderDataUrl(200, 100, "#ff0000");
      const base64Part = url.replace("data:image/svg+xml;base64,", "");
      const decoded = atob(base64Part);
      expect(decoded).toContain("#ff0000");
    });
  });

  describe("calculateLoadPriority", () => {
    const viewport: ViewportRect = { width: 1920, height: 1080, scrollY: 0 };

    it("returns 'critical' for elements within the visible viewport", () => {
      const element: ElementRect = { top: 100, left: 0, width: 200, height: 200 };
      expect(calculateLoadPriority(viewport, element)).toBe("critical");
    });

    it("returns 'critical' for elements partially visible", () => {
      const element: ElementRect = { top: 1000, left: 0, width: 200, height: 200 };
      expect(calculateLoadPriority(viewport, element)).toBe("critical");
    });

    it("returns 'high' for elements within 1 viewport height below", () => {
      const element: ElementRect = { top: 1200, left: 0, width: 200, height: 200 };
      expect(calculateLoadPriority(viewport, element)).toBe("high");
    });

    it("returns 'medium' for elements within 2 viewport heights below", () => {
      const element: ElementRect = { top: 2500, left: 0, width: 200, height: 200 };
      expect(calculateLoadPriority(viewport, element)).toBe("medium");
    });

    it("returns 'low' for elements more than 2 viewport heights below", () => {
      const element: ElementRect = { top: 5000, left: 0, width: 200, height: 200 };
      expect(calculateLoadPriority(viewport, element)).toBe("low");
    });

    it("returns 'low' for elements scrolled past (above viewport)", () => {
      const scrolledViewport: ViewportRect = { width: 1920, height: 1080, scrollY: 2000 };
      const element: ElementRect = { top: 100, left: 0, width: 200, height: 200 };
      expect(calculateLoadPriority(scrolledViewport, element)).toBe("low");
    });

    it("returns 'critical' for elements at viewport top with scroll", () => {
      const scrolledViewport: ViewportRect = { width: 1920, height: 1080, scrollY: 500 };
      const element: ElementRect = { top: 600, left: 0, width: 200, height: 200 };
      expect(calculateLoadPriority(scrolledViewport, element)).toBe("critical");
    });
  });
});
