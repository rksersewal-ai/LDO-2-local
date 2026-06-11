import { describe, expect, it } from "vitest";
import {
  validateDrawingNumber,
  validatePLNumber,
  validateRevisionSequence,
  validateRequiredFields,
  validateCrossReferences,
  getRequiredFields,
} from "./metadataValidation";

describe("metadataValidation", () => {
  describe("validateDrawingNumber", () => {
    it("validates DWG-XXXXX format", () => {
      expect(validateDrawingNumber("DWG-12345")).toEqual({ valid: true });
    });

    it("validates DWG/XXXXX format", () => {
      expect(validateDrawingNumber("DWG/12345")).toEqual({ valid: true });
    });

    it("validates SK-NNNNN format", () => {
      expect(validateDrawingNumber("SK-99001")).toEqual({ valid: true });
    });

    it("validates CLW/ED/... format", () => {
      expect(validateDrawingNumber("CLW/ED/1234")).toEqual({ valid: true });
    });

    it("validates RDSO/... format", () => {
      expect(validateDrawingNumber("RDSO/2023/DR-100")).toEqual({ valid: true });
    });

    it("rejects empty string", () => {
      const result = validateDrawingNumber("");
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("rejects invalid format", () => {
      const result = validateDrawingNumber("INVALID-123");
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("rejects DWG with too few digits", () => {
      const result = validateDrawingNumber("DWG-123");
      expect(result.valid).toBe(false);
    });

    it("rejects DWG with too many digits", () => {
      const result = validateDrawingNumber("DWG-1234567");
      expect(result.valid).toBe(false);
    });
  });

  describe("validatePLNumber", () => {
    it("validates 8-digit number", () => {
      expect(validatePLNumber("12345678")).toEqual({ valid: true });
    });

    it("validates PL-prefixed 8-digit number", () => {
      expect(validatePLNumber("PL-12345678")).toEqual({ valid: true });
    });

    it("validates PL space-prefixed 8-digit number", () => {
      expect(validatePLNumber("PL 12345678")).toEqual({ valid: true });
    });

    it("rejects 7-digit number", () => {
      const result = validatePLNumber("1234567");
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("rejects 9-digit number", () => {
      const result = validatePLNumber("123456789");
      expect(result.valid).toBe(false);
    });

    it("rejects empty string", () => {
      const result = validatePLNumber("");
      expect(result.valid).toBe(false);
    });

    it("rejects non-numeric characters", () => {
      const result = validatePLNumber("1234ABCD");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateRevisionSequence", () => {
    it("validates correct alphabetic sequence", () => {
      expect(validateRevisionSequence(["A", "B", "C"])).toEqual({ valid: true });
    });

    it("validates correct numeric sequence", () => {
      expect(validateRevisionSequence(["1", "2", "3"])).toEqual({ valid: true });
    });

    it("validates single revision", () => {
      expect(validateRevisionSequence(["A"])).toEqual({ valid: true });
    });

    it("validates empty array", () => {
      expect(validateRevisionSequence([])).toEqual({ valid: true });
    });

    it("rejects out-of-order alphabetic sequence", () => {
      const result = validateRevisionSequence(["A", "C", "B"]);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("rejects out-of-order numeric sequence", () => {
      const result = validateRevisionSequence(["1", "3", "2"]);
      expect(result.valid).toBe(false);
    });

    it("rejects duplicate revisions", () => {
      const result = validateRevisionSequence(["A", "A", "B"]);
      expect(result.valid).toBe(false);
    });

    it("reports error for mixed formats", () => {
      const result = validateRevisionSequence(["A", "2", "C"]);
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain("Mixed revision formats");
    });
  });

  describe("validateRequiredFields", () => {
    it("validates DRAWING with all required fields", () => {
      const result = validateRequiredFields("DRAWING", {
        drawingNumber: "DWG-12345",
        title: "Main Frame",
        revision: "A",
      });
      expect(result.valid).toBe(true);
    });

    it("rejects DRAWING missing drawingNumber", () => {
      const result = validateRequiredFields("DRAWING", {
        title: "Main Frame",
        revision: "A",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes("drawingNumber"))).toBe(true);
    });

    it("validates SPECIFICATION with all required fields", () => {
      const result = validateRequiredFields("SPECIFICATION", {
        specNumber: "SPEC-001",
        title: "Bogie Spec",
        revision: "1",
      });
      expect(result.valid).toBe(true);
    });

    it("rejects SPECIFICATION missing specNumber", () => {
      const result = validateRequiredFields("SPECIFICATION", {
        title: "Bogie Spec",
        revision: "1",
      });
      expect(result.valid).toBe(false);
    });

    it("returns valid for category with no specific requirements", () => {
      const result = validateRequiredFields("OTHER", {});
      expect(result.valid).toBe(true);
    });

    it("rejects fields that are empty strings", () => {
      const result = validateRequiredFields("DRAWING", {
        drawingNumber: "",
        title: "Title",
        revision: "A",
      });
      expect(result.valid).toBe(false);
    });

    it("rejects fields that are whitespace only", () => {
      const result = validateRequiredFields("DRAWING", {
        drawingNumber: "   ",
        title: "Title",
        revision: "A",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("getRequiredFields", () => {
    it("returns requirements for DRAWING category", () => {
      const fields = getRequiredFields("DRAWING");
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.field === "drawingNumber")).toBe(true);
    });

    it("returns empty array for unknown category", () => {
      const fields = getRequiredFields("OTHER");
      expect(fields).toEqual([]);
    });
  });

  describe("validateCrossReferences", () => {
    it("validates correct references", () => {
      const result = validateCrossReferences([
        { type: "drawing", value: "DWG-12345" },
        { type: "pl", value: "12345678" },
      ]);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid drawing reference", () => {
      const result = validateCrossReferences([
        { type: "drawing", value: "INVALID" },
      ]);
      expect(result.valid).toBe(false);
    });

    it("rejects invalid PL reference", () => {
      const result = validateCrossReferences([
        { type: "pl", value: "1234" },
      ]);
      expect(result.valid).toBe(false);
    });

    it("validates empty references array", () => {
      expect(validateCrossReferences([])).toEqual({ valid: true });
    });
  });
});
