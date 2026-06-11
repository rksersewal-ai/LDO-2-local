/**
 * OCR Confidence Scoring Utility
 *
 * Provides confidence scoring and classification for OCR results.
 * Thresholds aligned with config/ocr_pipeline.yaml:
 *   confidence_threshold: 60
 *
 * Classification levels:
 *   HIGH   - confidence > 85
 *   MEDIUM - confidence 60-85 (inclusive)
 *   LOW    - confidence < 60
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface PageConfidence {
  pageNumber: number;
  confidence: number;
  wordCount: number;
}

export interface DocumentConfidence {
  overall: number;
  level: ConfidenceLevel;
  pages: PageConfidence[];
  lowConfidencePages: number[];
}

export interface LowConfidenceRegion {
  pageNumber: number;
  startIndex: number;
  endIndex: number;
  confidence: number;
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants (aligned with config/ocr_pipeline.yaml)
// ─────────────────────────────────────────────────────────────────────────

const HIGH_THRESHOLD = 85;
const MEDIUM_THRESHOLD = 60;

// ─────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Classify a confidence score into HIGH, MEDIUM, or LOW.
 *
 * - HIGH: confidence > 85
 * - MEDIUM: confidence >= 60 and <= 85
 * - LOW: confidence < 60
 */
export function classifyConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence > HIGH_THRESHOLD) return "HIGH";
  if (confidence >= MEDIUM_THRESHOLD) return "MEDIUM";
  return "LOW";
}

/**
 * Calculate page-level confidence from an array of word confidences.
 * Returns the average confidence for the page.
 * Returns 0 for empty arrays.
 */
export function calculatePageConfidence(wordConfidences: number[]): number {
  if (wordConfidences.length === 0) return 0;
  const sum = wordConfidences.reduce((acc, val) => acc + val, 0);
  return sum / wordConfidences.length;
}

/**
 * Calculate document-level confidence from page confidences.
 * Uses word-count weighting: pages with more words have proportionally
 * more influence on the overall score.
 *
 * Returns 0 for empty input.
 */
export function calculateDocumentConfidence(pages: PageConfidence[]): DocumentConfidence {
  if (pages.length === 0) {
    return {
      overall: 0,
      level: "LOW",
      pages: [],
      lowConfidencePages: [],
    };
  }

  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);

  let weightedSum = 0;
  if (totalWords > 0) {
    for (const page of pages) {
      weightedSum += page.confidence * (page.wordCount / totalWords);
    }
  } else {
    // If no words at all, simple average
    weightedSum = pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;
  }

  const overall = Math.round(weightedSum * 100) / 100;
  const level = classifyConfidenceLevel(overall);
  const lowConfidencePages = pages
    .filter((p) => p.confidence < MEDIUM_THRESHOLD)
    .map((p) => p.pageNumber);

  return {
    overall,
    level,
    pages,
    lowConfidencePages,
  };
}

/**
 * Flag regions with low confidence in OCR results.
 * Identifies contiguous text spans where confidence drops below the threshold.
 */
export function flagLowConfidenceRegions(
  words: Array<{ text: string; confidence: number; pageNumber: number; index: number }>,
  threshold: number = MEDIUM_THRESHOLD,
): LowConfidenceRegion[] {
  if (words.length === 0) return [];

  const regions: LowConfidenceRegion[] = [];
  let currentRegion: {
    pageNumber: number;
    startIndex: number;
    endIndex: number;
    confidences: number[];
    texts: string[];
  } | null = null;

  for (const word of words) {
    if (word.confidence < threshold) {
      if (currentRegion && currentRegion.pageNumber === word.pageNumber) {
        currentRegion.endIndex = word.index;
        currentRegion.confidences.push(word.confidence);
        currentRegion.texts.push(word.text);
      } else {
        // Flush previous region if exists
        if (currentRegion) {
          regions.push({
            pageNumber: currentRegion.pageNumber,
            startIndex: currentRegion.startIndex,
            endIndex: currentRegion.endIndex,
            confidence:
              currentRegion.confidences.reduce((a, b) => a + b, 0) /
              currentRegion.confidences.length,
            text: currentRegion.texts.join(" "),
          });
        }
        currentRegion = {
          pageNumber: word.pageNumber,
          startIndex: word.index,
          endIndex: word.index,
          confidences: [word.confidence],
          texts: [word.text],
        };
      }
    } else {
      // Word is above threshold, flush current region
      if (currentRegion) {
        regions.push({
          pageNumber: currentRegion.pageNumber,
          startIndex: currentRegion.startIndex,
          endIndex: currentRegion.endIndex,
          confidence:
            currentRegion.confidences.reduce((a, b) => a + b, 0) /
            currentRegion.confidences.length,
          text: currentRegion.texts.join(" "),
        });
        currentRegion = null;
      }
    }
  }

  // Flush final region
  if (currentRegion) {
    regions.push({
      pageNumber: currentRegion.pageNumber,
      startIndex: currentRegion.startIndex,
      endIndex: currentRegion.endIndex,
      confidence:
        currentRegion.confidences.reduce((a, b) => a + b, 0) / currentRegion.confidences.length,
      text: currentRegion.texts.join(" "),
    });
  }

  return regions;
}
