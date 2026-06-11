import { describe, expect, it } from "vitest";
import {
  classifyConfidenceLevel,
  calculatePageConfidence,
  calculateDocumentConfidence,
  flagLowConfidenceRegions,
} from "./ocrConfidenceScoring";

describe("ocrConfidenceScoring", () => {
  describe("classifyConfidenceLevel", () => {
    it("returns HIGH for confidence > 85", () => {
      expect(classifyConfidenceLevel(90)).toBe("HIGH");
      expect(classifyConfidenceLevel(100)).toBe("HIGH");
      expect(classifyConfidenceLevel(86)).toBe("HIGH");
    });

    it("returns MEDIUM for confidence between 60 and 85 inclusive", () => {
      expect(classifyConfidenceLevel(70)).toBe("MEDIUM");
      expect(classifyConfidenceLevel(60)).toBe("MEDIUM");
      expect(classifyConfidenceLevel(85)).toBe("MEDIUM");
    });

    it("returns LOW for confidence < 60", () => {
      expect(classifyConfidenceLevel(50)).toBe("LOW");
      expect(classifyConfidenceLevel(0)).toBe("LOW");
      expect(classifyConfidenceLevel(59)).toBe("LOW");
    });

    it("handles boundary values correctly", () => {
      expect(classifyConfidenceLevel(85)).toBe("MEDIUM");
      expect(classifyConfidenceLevel(85.1)).toBe("HIGH");
      expect(classifyConfidenceLevel(60)).toBe("MEDIUM");
      expect(classifyConfidenceLevel(59.9)).toBe("LOW");
    });
  });

  describe("calculatePageConfidence", () => {
    it("returns average of word confidences", () => {
      expect(calculatePageConfidence([80, 90, 100])).toBe(90);
    });

    it("returns 0 for empty array", () => {
      expect(calculatePageConfidence([])).toBe(0);
    });

    it("handles single word", () => {
      expect(calculatePageConfidence([75])).toBe(75);
    });

    it("handles all zeros", () => {
      expect(calculatePageConfidence([0, 0, 0])).toBe(0);
    });

    it("calculates correctly with varied values", () => {
      const result = calculatePageConfidence([50, 60, 70, 80]);
      expect(result).toBe(65);
    });
  });

  describe("calculateDocumentConfidence", () => {
    it("returns weighted confidence by word count", () => {
      const result = calculateDocumentConfidence([
        { pageNumber: 1, confidence: 90, wordCount: 100 },
        { pageNumber: 2, confidence: 70, wordCount: 100 },
      ]);
      expect(result.overall).toBe(80);
      expect(result.level).toBe("MEDIUM");
    });

    it("weights pages by word count", () => {
      const result = calculateDocumentConfidence([
        { pageNumber: 1, confidence: 90, wordCount: 300 },
        { pageNumber: 2, confidence: 60, wordCount: 100 },
      ]);
      // Weighted: (90*300 + 60*100) / 400 = 33000/400 = 82.5
      expect(result.overall).toBe(82.5);
      expect(result.level).toBe("MEDIUM");
    });

    it("returns 0 for empty pages array", () => {
      const result = calculateDocumentConfidence([]);
      expect(result.overall).toBe(0);
      expect(result.level).toBe("LOW");
      expect(result.pages).toEqual([]);
      expect(result.lowConfidencePages).toEqual([]);
    });

    it("handles single page", () => {
      const result = calculateDocumentConfidence([
        { pageNumber: 1, confidence: 92, wordCount: 50 },
      ]);
      expect(result.overall).toBe(92);
      expect(result.level).toBe("HIGH");
    });

    it("identifies low confidence pages", () => {
      const result = calculateDocumentConfidence([
        { pageNumber: 1, confidence: 90, wordCount: 100 },
        { pageNumber: 2, confidence: 45, wordCount: 100 },
        { pageNumber: 3, confidence: 30, wordCount: 50 },
      ]);
      expect(result.lowConfidencePages).toEqual([2, 3]);
    });

    it("handles pages with zero word count", () => {
      const result = calculateDocumentConfidence([
        { pageNumber: 1, confidence: 80, wordCount: 0 },
        { pageNumber: 2, confidence: 60, wordCount: 0 },
      ]);
      // When total words is 0, simple average: (80+60)/2 = 70
      expect(result.overall).toBe(70);
      expect(result.level).toBe("MEDIUM");
    });
  });

  describe("flagLowConfidenceRegions", () => {
    it("returns empty array for empty input", () => {
      expect(flagLowConfidenceRegions([])).toEqual([]);
    });

    it("returns empty array when all words are above threshold", () => {
      const words = [
        { text: "hello", confidence: 90, pageNumber: 1, index: 0 },
        { text: "world", confidence: 85, pageNumber: 1, index: 1 },
      ];
      expect(flagLowConfidenceRegions(words)).toEqual([]);
    });

    it("flags single low-confidence word", () => {
      const words = [
        { text: "hello", confidence: 90, pageNumber: 1, index: 0 },
        { text: "blurry", confidence: 30, pageNumber: 1, index: 1 },
        { text: "world", confidence: 88, pageNumber: 1, index: 2 },
      ];
      const regions = flagLowConfidenceRegions(words);
      expect(regions).toHaveLength(1);
      expect(regions[0].text).toBe("blurry");
      expect(regions[0].confidence).toBe(30);
      expect(regions[0].pageNumber).toBe(1);
    });

    it("groups contiguous low-confidence words on same page", () => {
      const words = [
        { text: "clear", confidence: 90, pageNumber: 1, index: 0 },
        { text: "fuzzy", confidence: 40, pageNumber: 1, index: 1 },
        { text: "text", confidence: 35, pageNumber: 1, index: 2 },
        { text: "ok", confidence: 80, pageNumber: 1, index: 3 },
      ];
      const regions = flagLowConfidenceRegions(words);
      expect(regions).toHaveLength(1);
      expect(regions[0].text).toBe("fuzzy text");
      expect(regions[0].startIndex).toBe(1);
      expect(regions[0].endIndex).toBe(2);
    });

    it("creates separate regions for different pages", () => {
      const words = [
        { text: "bad1", confidence: 30, pageNumber: 1, index: 0 },
        { text: "bad2", confidence: 25, pageNumber: 2, index: 1 },
      ];
      const regions = flagLowConfidenceRegions(words);
      expect(regions).toHaveLength(2);
      expect(regions[0].pageNumber).toBe(1);
      expect(regions[1].pageNumber).toBe(2);
    });

    it("uses custom threshold", () => {
      const words = [
        { text: "hello", confidence: 75, pageNumber: 1, index: 0 },
        { text: "world", confidence: 80, pageNumber: 1, index: 1 },
      ];
      // Default threshold is 60, both above. With threshold 85, both below.
      expect(flagLowConfidenceRegions(words, 85)).toHaveLength(1);
      expect(flagLowConfidenceRegions(words, 60)).toHaveLength(0);
    });
  });
});
