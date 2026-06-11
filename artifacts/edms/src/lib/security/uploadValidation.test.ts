import { describe, it, expect } from "vitest";
import {
  validateUploadSecurity,
  getExtension,
  MAGIC_BYTES,
  DANGEROUS_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
} from "./uploadValidation";
import type { FileInput } from "./uploadValidation";

describe("uploadValidation", () => {
  function createFileInput(overrides: Partial<FileInput> = {}): FileInput {
    const defaultContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    return {
      name: "document.pdf",
      type: "application/pdf",
      size: defaultContent.length,
      content: defaultContent,
      ...overrides,
    };
  }

  describe("getExtension", () => {
    it("extracts extension from filename", () => {
      expect(getExtension("file.pdf")).toBe("pdf");
      expect(getExtension("image.PNG")).toBe("png");
      expect(getExtension("archive.tar.gz")).toBe("gz");
    });

    it("returns undefined for files without extension", () => {
      expect(getExtension("noextension")).toBeUndefined();
      expect(getExtension("file.")).toBeUndefined();
    });

    it("handles edge cases", () => {
      expect(getExtension(".gitignore")).toBe("gitignore");
      expect(getExtension("name.with.many.dots.txt")).toBe("txt");
    });
  });

  describe("validateUploadSecurity", () => {
    describe("empty file detection", () => {
      it("rejects empty files", () => {
        const file = createFileInput({
          size: 0,
          content: new Uint8Array(0),
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("EMPTY_FILE");
      });
    });

    describe("dangerous extension detection", () => {
      it("rejects files with dangerous extensions", () => {
        const dangerousExts = ["exe", "bat", "cmd", "msi", "vbs", "ps1"];

        for (const ext of dangerousExts) {
          const file = createFileInput({
            name: `file.${ext}`,
            content: new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), // MZ header
          });

          const result = validateUploadSecurity(file);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.code === "SUSPICIOUS_EXTENSION")).toBe(true);
        }
      });

      it("allows safe extensions", () => {
        const safeFile = createFileInput({
          name: "document.pdf",
          content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        });

        const result = validateUploadSecurity(safeFile);
        expect(result.errors.some((e) => e.code === "SUSPICIOUS_EXTENSION")).toBe(false);
      });
    });

    describe("dangerous MIME type detection", () => {
      it("rejects dangerous MIME types", () => {
        const file = createFileInput({
          type: "application/x-executable",
          name: "file.bin",
          content: new Uint8Array([0x7f, 0x45, 0x4c, 0x46]),
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "DANGEROUS_MIME_TYPE")).toBe(true);
      });

      it("rejects application/x-msdownload", () => {
        const file = createFileInput({
          type: "application/x-msdownload",
          name: "file.dll",
          content: new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
        });

        const result = validateUploadSecurity(file);
        expect(result.errors.some((e) => e.code === "DANGEROUS_MIME_TYPE")).toBe(true);
      });

      it("allows safe MIME types", () => {
        const file = createFileInput({
          type: "application/pdf",
          content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        });

        const result = validateUploadSecurity(file);
        expect(result.errors.some((e) => e.code === "DANGEROUS_MIME_TYPE")).toBe(false);
      });
    });

    describe("magic byte validation", () => {
      it("validates PDF magic bytes", () => {
        const file = createFileInput({
          name: "document.pdf",
          content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
        });

        const result = validateUploadSecurity(file);
        expect(result.errors.some((e) => e.code === "MAGIC_BYTE_MISMATCH")).toBe(false);
      });

      it("validates PNG magic bytes", () => {
        const file = createFileInput({
          name: "image.png",
          type: "image/png",
          content: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        });

        const result = validateUploadSecurity(file);
        expect(result.errors.some((e) => e.code === "MAGIC_BYTE_MISMATCH")).toBe(false);
      });

      it("detects magic byte mismatch (PDF content with PNG extension)", () => {
        const file = createFileInput({
          name: "image.png",
          type: "image/png",
          content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "MAGIC_BYTE_MISMATCH")).toBe(true);
      });

      it("detects executable disguised as PDF", () => {
        const file = createFileInput({
          name: "document.pdf",
          type: "application/pdf",
          content: new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "MAGIC_BYTE_MISMATCH")).toBe(true);
      });

      it("skips magic byte check for unknown extensions", () => {
        const file = createFileInput({
          name: "data.custom",
          type: "application/octet-stream",
          content: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        });

        const result = validateUploadSecurity(file);
        expect(result.errors.some((e) => e.code === "MAGIC_BYTE_MISMATCH")).toBe(false);
      });

      it("allows ZIP-based formats (docx, xlsx) sharing same magic bytes", () => {
        const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

        const docxFile = createFileInput({
          name: "report.docx",
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          content: zipMagic,
        });

        const result = validateUploadSecurity(docxFile);
        expect(result.errors.some((e) => e.code === "MAGIC_BYTE_MISMATCH")).toBe(false);
      });
    });

    describe("embedded script detection", () => {
      it("detects script tags in SVG files", () => {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('xss')</script></svg>`;
        const encoder = new TextEncoder();
        const content = encoder.encode(svgContent);

        const file = createFileInput({
          name: "image.svg",
          type: "image/svg+xml",
          size: content.length,
          content,
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "EMBEDDED_SCRIPT")).toBe(true);
      });

      it("detects javascript: protocol in SVG", () => {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">click</a></svg>`;
        const encoder = new TextEncoder();
        const content = encoder.encode(svgContent);

        const file = createFileInput({
          name: "link.svg",
          type: "image/svg+xml",
          size: content.length,
          content,
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "EMBEDDED_SCRIPT")).toBe(true);
      });

      it("detects event handlers in HTML files", () => {
        const htmlContent = `<html><body><img src="x" onerror="alert(1)"></body></html>`;
        const encoder = new TextEncoder();
        const content = encoder.encode(htmlContent);

        const file = createFileInput({
          name: "page.html",
          type: "text/html",
          size: content.length,
          content,
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "EMBEDDED_SCRIPT")).toBe(true);
      });

      it("detects iframe injection in HTML", () => {
        const htmlContent = `<html><body><iframe src="https://evil.com"></iframe></body></html>`;
        const encoder = new TextEncoder();
        const content = encoder.encode(htmlContent);

        const file = createFileInput({
          name: "page.html",
          type: "text/html",
          size: content.length,
          content,
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "EMBEDDED_SCRIPT")).toBe(true);
      });

      it("allows clean SVG without scripts", () => {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="red"/></svg>`;
        const encoder = new TextEncoder();
        const content = encoder.encode(svgContent);

        const file = createFileInput({
          name: "circle.svg",
          type: "image/svg+xml",
          size: content.length,
          content,
        });

        const result = validateUploadSecurity(file);
        expect(result.errors.some((e) => e.code === "EMBEDDED_SCRIPT")).toBe(false);
      });

      it("does not check for scripts in non-text files", () => {
        // A PDF with script-like content should not trigger embedded script check
        const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
        const file = createFileInput({
          name: "document.pdf",
          type: "application/pdf",
          size: content.length,
          content,
        });

        const result = validateUploadSecurity(file);
        expect(result.errors.some((e) => e.code === "EMBEDDED_SCRIPT")).toBe(false);
      });
    });

    describe("clean file acceptance", () => {
      it("accepts a valid PDF file", () => {
        const file = createFileInput({
          name: "report.pdf",
          type: "application/pdf",
          content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("accepts a valid JPEG file", () => {
        const file = createFileInput({
          name: "photo.jpg",
          type: "image/jpeg",
          content: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("accepts a valid GIF file", () => {
        const file = createFileInput({
          name: "animation.gif",
          type: "image/gif",
          content: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
        });

        const result = validateUploadSecurity(file);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe("constants", () => {
    it("MAGIC_BYTES contains common file types", () => {
      expect(MAGIC_BYTES).toHaveProperty("pdf");
      expect(MAGIC_BYTES).toHaveProperty("png");
      expect(MAGIC_BYTES).toHaveProperty("jpg");
      expect(MAGIC_BYTES).toHaveProperty("gif");
      expect(MAGIC_BYTES).toHaveProperty("zip");
    });

    it("DANGEROUS_MIME_TYPES includes known dangerous types", () => {
      expect(DANGEROUS_MIME_TYPES.has("application/x-executable")).toBe(true);
      expect(DANGEROUS_MIME_TYPES.has("application/x-msdownload")).toBe(true);
    });

    it("DANGEROUS_EXTENSIONS includes executable extensions", () => {
      expect(DANGEROUS_EXTENSIONS.has("exe")).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has("bat")).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has("cmd")).toBe(true);
    });
  });
});
