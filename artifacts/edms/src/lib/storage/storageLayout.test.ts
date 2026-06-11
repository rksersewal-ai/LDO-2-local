import { describe, it, expect } from "vitest";
import {
  getPathForCategory,
  getCategoryFromPath,
  getAllCategories,
  DEFAULT_LAYOUT,
} from "./storageLayout";
import type { StorageCategory } from "./storageLayout";

describe("storageLayout", () => {
  describe("DEFAULT_LAYOUT", () => {
    it("defines all 5 categories", () => {
      const categories: StorageCategory[] = ["originals", "previews", "tiles", "ocr", "temp"];
      for (const category of categories) {
        expect(DEFAULT_LAYOUT[category]).toBeDefined();
      }
    });

    it("each category has a basePath, retentionDays, and maxSizeBytes", () => {
      for (const category of getAllCategories()) {
        const config = DEFAULT_LAYOUT[category];
        expect(config.basePath).toBeTruthy();
        expect(typeof config.basePath).toBe("string");
        expect(
          config.retentionDays === null || typeof config.retentionDays === "number",
        ).toBe(true);
        expect(typeof config.maxSizeBytes).toBe("number");
        expect(config.maxSizeBytes).toBeGreaterThan(0);
      }
    });

    it("originals have permanent retention (null)", () => {
      expect(DEFAULT_LAYOUT.originals.retentionDays).toBeNull();
    });

    it("ocr has permanent retention (null)", () => {
      expect(DEFAULT_LAYOUT.ocr.retentionDays).toBeNull();
    });

    it("temp has shortest retention (7 days)", () => {
      expect(DEFAULT_LAYOUT.temp.retentionDays).toBe(7);
    });

    it("previews has 90-day retention", () => {
      expect(DEFAULT_LAYOUT.previews.retentionDays).toBe(90);
    });

    it("tiles has 180-day retention", () => {
      expect(DEFAULT_LAYOUT.tiles.retentionDays).toBe(180);
    });
  });

  describe("getPathForCategory", () => {
    it("generates path for originals category", () => {
      const path = getPathForCategory("originals", "document.pdf");
      expect(path).toBe("/storage/originals/document.pdf");
    });

    it("generates path for previews category", () => {
      const path = getPathForCategory("previews", "thumb_001.png");
      expect(path).toBe("/storage/previews/thumb_001.png");
    });

    it("generates path for tiles category", () => {
      const path = getPathForCategory("tiles", "tile_0_0.jpg");
      expect(path).toBe("/storage/tiles/tile_0_0.jpg");
    });

    it("generates path for ocr category", () => {
      const path = getPathForCategory("ocr", "result.json");
      expect(path).toBe("/storage/ocr/result.json");
    });

    it("generates path for temp category", () => {
      const path = getPathForCategory("temp", "upload_12345.tmp");
      expect(path).toBe("/storage/temp/upload_12345.tmp");
    });

    it("handles filenames with subdirectories", () => {
      const path = getPathForCategory("originals", "2024/01/document.pdf");
      expect(path).toBe("/storage/originals/2024/01/document.pdf");
    });
  });

  describe("getCategoryFromPath", () => {
    it("detects originals category", () => {
      expect(getCategoryFromPath("/storage/originals/file.pdf")).toBe("originals");
    });

    it("detects previews category", () => {
      expect(getCategoryFromPath("/storage/previews/thumb.png")).toBe("previews");
    });

    it("detects tiles category", () => {
      expect(getCategoryFromPath("/storage/tiles/tile.jpg")).toBe("tiles");
    });

    it("detects ocr category", () => {
      expect(getCategoryFromPath("/storage/ocr/output.json")).toBe("ocr");
    });

    it("detects temp category", () => {
      expect(getCategoryFromPath("/storage/temp/upload.tmp")).toBe("temp");
    });

    it("returns null for unknown paths", () => {
      expect(getCategoryFromPath("/storage/unknown/file.pdf")).toBeNull();
      expect(getCategoryFromPath("/other/path/file.pdf")).toBeNull();
      expect(getCategoryFromPath("")).toBeNull();
    });

    it("handles nested paths within a category", () => {
      expect(getCategoryFromPath("/storage/originals/2024/01/file.pdf")).toBe("originals");
    });

    it("does not match partial category names", () => {
      expect(getCategoryFromPath("/storage/original/file.pdf")).toBeNull();
    });
  });

  describe("getAllCategories", () => {
    it("returns all 5 categories", () => {
      const categories = getAllCategories();
      expect(categories).toHaveLength(5);
    });

    it("includes all expected categories", () => {
      const categories = getAllCategories();
      expect(categories).toContain("originals");
      expect(categories).toContain("previews");
      expect(categories).toContain("tiles");
      expect(categories).toContain("ocr");
      expect(categories).toContain("temp");
    });

    it("returns a new array each time (not a reference)", () => {
      const categories1 = getAllCategories();
      const categories2 = getAllCategories();
      expect(categories1).not.toBe(categories2);
      expect(categories1).toEqual(categories2);
    });
  });
});
