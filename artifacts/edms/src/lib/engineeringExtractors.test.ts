import { describe, expect, it } from "vitest";
import {
  extractDrawingNumbers,
  extractRevisions,
  extractPLNumbers,
  extractTitleBlockFields,
} from "./engineeringExtractors";

describe("engineeringExtractors", () => {
  describe("extractDrawingNumbers", () => {
    it("extracts DWG-XXXXX pattern", () => {
      const result = extractDrawingNumbers("See DWG-12345 for details");
      expect(result).toEqual(["DWG-12345"]);
    });

    it("extracts DWG/XXXXX pattern", () => {
      const result = extractDrawingNumbers("Refer to DWG/54321");
      expect(result).toEqual(["DWG/54321"]);
    });

    it("extracts SK-NNNNN pattern", () => {
      const result = extractDrawingNumbers("Sketch SK-99001 attached");
      expect(result).toEqual(["SK-99001"]);
    });

    it("extracts CLW/ED pattern", () => {
      const result = extractDrawingNumbers("Drawing CLW/ED/1234 approved");
      expect(result).toEqual(["CLW/ED/1234"]);
    });

    it("extracts RDSO pattern", () => {
      const result = extractDrawingNumbers("As per RDSO/2023/DR-100");
      expect(result).toEqual(["RDSO/2023/DR-100"]);
    });

    it("extracts multiple drawing numbers from the same text", () => {
      const result = extractDrawingNumbers("See DWG-12345 and SK-99001");
      expect(result).toEqual(["DWG-12345", "SK-99001"]);
    });

    it("deduplicates matching entries (case-insensitive)", () => {
      const result = extractDrawingNumbers("DWG-12345 and dwg-12345");
      expect(result).toHaveLength(1);
    });

    it("returns empty array for empty string", () => {
      expect(extractDrawingNumbers("")).toEqual([]);
    });

    it("returns empty array for text with no matches", () => {
      expect(extractDrawingNumbers("No drawing numbers here")).toEqual([]);
    });

    it("handles null/undefined gracefully", () => {
      expect(extractDrawingNumbers(null as unknown as string)).toEqual([]);
      expect(extractDrawingNumbers(undefined as unknown as string)).toEqual([]);
    });
  });

  describe("extractRevisions", () => {
    it("extracts REV X pattern", () => {
      const result = extractRevisions("Updated to REV B");
      expect(result).toEqual(["REV B"]);
    });

    it("extracts Rev. N pattern", () => {
      const result = extractRevisions("Current is Rev. 1");
      expect(result).toEqual(["Rev. 1"]);
    });

    it("extracts R0N compact form", () => {
      const result = extractRevisions("Document at R03");
      expect(result).toEqual(["R03"]);
    });

    it("extracts Revision N pattern", () => {
      const result = extractRevisions("Revision 5 supersedes previous");
      expect(result).toEqual(["Revision 5"]);
    });

    it("extracts -R1 suffix form", () => {
      const result = extractRevisions("DWG-12345-R1");
      expect(result).toEqual(["-R1"]);
    });

    it("extracts multiple revisions from text", () => {
      const result = extractRevisions("Updated to REV B from Rev. 1");
      expect(result).toEqual(["REV B", "Rev. 1"]);
    });

    it("returns empty array for empty string", () => {
      expect(extractRevisions("")).toEqual([]);
    });

    it("returns empty array for text with no matches", () => {
      expect(extractRevisions("No revision info here")).toEqual([]);
    });
  });

  describe("extractPLNumbers", () => {
    it("extracts PL-prefixed 8-digit numbers", () => {
      const result = extractPLNumbers("Part PL-12345678 is active");
      expect(result).toEqual(["12345678"]);
    });

    it("extracts PL space-prefixed 8-digit numbers", () => {
      const result = extractPLNumbers("PL 12345678 linked");
      expect(result).toEqual(["12345678"]);
    });

    it("extracts standalone 8-digit numbers", () => {
      const result = extractPLNumbers("Number 87654321 found");
      expect(result).toEqual(["87654321"]);
    });

    it("extracts multiple PL numbers", () => {
      const result = extractPLNumbers("PL-12345678 and PL 87654321");
      expect(result).toEqual(["12345678", "87654321"]);
    });

    it("deduplicates repeated PL numbers", () => {
      const result = extractPLNumbers("PL-12345678 and PL 12345678");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("12345678");
    });

    it("does not match 7-digit numbers", () => {
      const result = extractPLNumbers("Short 1234567 number");
      expect(result).toEqual([]);
    });

    it("does not match 9-digit numbers", () => {
      const result = extractPLNumbers("Long 123456789 number");
      expect(result).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(extractPLNumbers("")).toEqual([]);
    });

    it("returns empty array for no matches", () => {
      expect(extractPLNumbers("No PL numbers here")).toEqual([]);
    });
  });

  describe("extractTitleBlockFields", () => {
    it("extracts title field", () => {
      const result = extractTitleBlockFields("TITLE: Bogie Frame Assembly\nSCALE: 1:10");
      expect(result.title).toBe("Bogie Frame Assembly");
    });

    it("extracts scale field", () => {
      const result = extractTitleBlockFields("SCALE: 1:10");
      expect(result.scale).toBe("1:10");
    });

    it("extracts material field", () => {
      const result = extractTitleBlockFields("MATERIAL: Mild Steel IS2062");
      expect(result.material).toBe("Mild Steel IS2062");
    });

    it("extracts material with MAT abbreviation", () => {
      const result = extractTitleBlockFields("MAT: Stainless Steel");
      expect(result.material).toBe("Stainless Steel");
    });

    it("extracts drawn by field", () => {
      const result = extractTitleBlockFields("DRAWN BY: A. Kumar");
      expect(result.drawnBy).toBe("A. Kumar");
    });

    it("extracts date field", () => {
      const result = extractTitleBlockFields("DATE: 15-03-2024");
      expect(result.date).toBe("15-03-2024");
    });

    it("extracts multiple fields at once", () => {
      const text = "TITLE: Main Frame\nSCALE: 1:5\nMATERIAL: Steel\nDRAWN BY: R. Singh\nDATE: 01-01-2024";
      const result = extractTitleBlockFields(text);
      expect(result.title).toBe("Main Frame");
      expect(result.scale).toBe("1:5");
      expect(result.material).toBe("Steel");
      expect(result.drawnBy).toBe("R. Singh");
      expect(result.date).toBe("01-01-2024");
    });

    it("returns empty object for empty string", () => {
      expect(extractTitleBlockFields("")).toEqual({});
    });

    it("returns empty object when no fields match", () => {
      expect(extractTitleBlockFields("Random text with no fields")).toEqual({});
    });
  });
});
