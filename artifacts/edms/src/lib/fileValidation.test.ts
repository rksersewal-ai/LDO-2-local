import { describe, it, expect } from "vitest";
import {
  validateFile,
  detectFileType,
  getFileExtension,
  DEFAULT_MAX_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAGIC_BYTES,
} from "./fileValidation";

describe("fileValidation", () => {
  describe("detectFileType", () => {
    it("detects PDF magic bytes (%PDF = 25504446)", () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      expect(detectFileType(bytes)).toBe("pdf");
    });

    it("detects PNG magic bytes (89504E47)", () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]);
      expect(detectFileType(bytes)).toBe("png");
    });

    it("detects TIFF little-endian magic bytes (49492A00)", () => {
      const bytes = new Uint8Array([0x49, 0x49, 0x2a, 0x00]);
      expect(detectFileType(bytes)).toBe("tiff");
    });

    it("detects TIFF big-endian magic bytes (4D4D002A)", () => {
      const bytes = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
      expect(detectFileType(bytes)).toBe("tiff");
    });

    it("detects JPEG magic bytes (FFD8FF)", () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(detectFileType(bytes)).toBe("jpeg");
    });

    it("returns unknown for unrecognized bytes", () => {
      const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(detectFileType(bytes)).toBe("unknown");
    });

    it("returns unknown for too-short byte arrays", () => {
      const bytes = new Uint8Array([0xff, 0xd8]);
      expect(detectFileType(bytes)).toBe("unknown");
    });

    it("returns unknown for empty byte array", () => {
      const bytes = new Uint8Array([]);
      expect(detectFileType(bytes)).toBe("unknown");
    });
  });

  describe("getFileExtension", () => {
    it("extracts .pdf extension", () => {
      expect(getFileExtension("document.pdf")).toBe(".pdf");
    });

    it("extracts .tiff extension", () => {
      expect(getFileExtension("scan.TIFF")).toBe(".tiff");
    });

    it("handles multiple dots in filename", () => {
      expect(getFileExtension("my.file.name.png")).toBe(".png");
    });

    it("returns empty string for no extension", () => {
      expect(getFileExtension("noextension")).toBe("");
    });

    it("returns empty string for trailing dot", () => {
      expect(getFileExtension("file.")).toBe("");
    });
  });

  describe("validateFile", () => {
    const validPdfFile = {
      name: "document.pdf",
      size: 1024 * 1024, // 1 MB
      type: "application/pdf",
      headerBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    };

    it("accepts a valid PDF file", () => {
      const result = validateFile(validPdfFile);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts a valid TIFF file", () => {
      const result = validateFile({
        name: "scan.tiff",
        size: 5 * 1024 * 1024,
        type: "image/tiff",
        headerBytes: new Uint8Array([0x49, 0x49, 0x2a, 0x00]),
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects an empty file", () => {
      const result = validateFile({
        name: "empty.pdf",
        size: 0,
        type: "application/pdf",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("FILE_EMPTY");
    });

    it("rejects a file exceeding the size limit", () => {
      const result = validateFile({
        name: "huge.pdf",
        size: 600 * 1024 * 1024, // 600 MB
        type: "application/pdf",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "FILE_TOO_LARGE")).toBe(true);
    });

    it("uses default max size of 500MB from config", () => {
      expect(DEFAULT_MAX_SIZE_BYTES).toBe(500 * 1024 * 1024);
      // File at exactly 500MB should pass
      const result = validateFile({
        name: "max.pdf",
        size: 500 * 1024 * 1024,
        type: "application/pdf",
      });
      expect(result.valid).toBe(true);
    });

    it("supports custom max size", () => {
      const result = validateFile(
        { name: "small.pdf", size: 20 * 1024 * 1024, type: "application/pdf" },
        { maxSizeBytes: 10 * 1024 * 1024 },
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("FILE_TOO_LARGE");
    });

    it("rejects an unsupported MIME type", () => {
      const result = validateFile({
        name: "script.js",
        size: 1024,
        type: "application/javascript",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "FILE_INVALID_TYPE")).toBe(true);
    });

    it("rejects an unsupported file extension", () => {
      const result = validateFile({
        name: "document.exe",
        size: 1024,
        type: "",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "FILE_INVALID_EXTENSION")).toBe(true);
    });

    it("detects magic bytes mismatch (extension says pdf but content is jpeg)", () => {
      const result = validateFile({
        name: "document.pdf",
        size: 1024,
        type: "application/pdf",
        headerBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG bytes
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "FILE_EXTENSION_MISMATCH")).toBe(true);
    });

    it("skips magic bytes check when disabled", () => {
      const result = validateFile(
        {
          name: "document.pdf",
          size: 1024,
          type: "application/pdf",
          headerBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG bytes
        },
        { checkMagicBytes: false },
      );
      expect(result.errors.some((e) => e.code === "FILE_EXTENSION_MISMATCH")).toBe(false);
    });

    it("does not error when magic bytes are not provided", () => {
      const result = validateFile({
        name: "document.pdf",
        size: 1024,
        type: "application/pdf",
      });
      expect(result.valid).toBe(true);
    });

    it("collects multiple validation errors", () => {
      const result = validateFile({
        name: "bad.exe",
        size: 600 * 1024 * 1024,
        type: "application/x-executable",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("accepts all supported engineering extensions", () => {
      for (const ext of ALLOWED_EXTENSIONS) {
        const name = `file${ext}`;
        const result = validateFile({
          name,
          size: 1024,
          type: "application/pdf", // Generic type for test
        });
        // Should not have extension error
        expect(result.errors.some((e) => e.code === "FILE_INVALID_EXTENSION")).toBe(false);
      }
    });
  });

  describe("constants", () => {
    it("has correct magic byte definitions", () => {
      expect(MAGIC_BYTES.pdf[0]).toEqual([0x25, 0x50, 0x44, 0x46]);
      expect(MAGIC_BYTES.png[0]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(MAGIC_BYTES.tiff[0]).toEqual([0x49, 0x49, 0x2a, 0x00]);
      expect(MAGIC_BYTES.tiff[1]).toEqual([0x4d, 0x4d, 0x00, 0x2a]);
      expect(MAGIC_BYTES.jpeg[0]).toEqual([0xff, 0xd8, 0xff]);
    });

    it("includes all required MIME types", () => {
      expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
      expect(ALLOWED_MIME_TYPES).toContain("image/tiff");
      expect(ALLOWED_MIME_TYPES).toContain("image/png");
      expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    });
  });
});
