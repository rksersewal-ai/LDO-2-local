import { MOCK_DOCUMENTS } from "../lib/mock";
import type { WorkRecord } from "../lib/types";

export interface FullTextResult {
  id: string;
  type: "document" | "work" | "pl";
  title: string;
  snippet: string;
  score: number;
}

export class FullTextSearchService {
  /**
   * Search across document OCR content, work record descriptions, and PL descriptions
   */
  static search(query: string, records?: WorkRecord[]): FullTextResult[] {
    const q = query.toLowerCase();
    const results: FullTextResult[] = [];

    // Search documents by OCR content
    MOCK_DOCUMENTS.forEach((doc) => {
      const ocrText = ((doc as { ocrText?: string }).ocrText || "").toLowerCase();
      const nameMatch = doc.name.toLowerCase().includes(q) ? 3 : 0;
      const ocrMatch = ocrText.includes(q) ? 1 : 0;
      const score = nameMatch + ocrMatch;

      if (score > 0) {
        const snippet = FullTextSearchService.extractSnippet(ocrText, q);
        results.push({
          id: doc.id,
          type: "document",
          title: doc.name,
          snippet,
          score,
        });
      }
    });

    // Search work records
    if (records) {
      records.forEach((rec) => {
        const descMatch = rec.description.toLowerCase().includes(q) ? 2 : 0;
        const typeMatch = (rec.workType || "").toLowerCase().includes(q) ? 1 : 0;
        const remarksMatch = (rec.remarks || "").toLowerCase().includes(q) ? 1 : 0;
        const score = descMatch + typeMatch + remarksMatch;

        if (score > 0) {
          const snippet = FullTextSearchService.extractSnippet(rec.description, q);
          results.push({
            id: rec.id,
            type: "work",
            title: `${rec.id}: ${rec.description}`,
            snippet,
            score,
          });
        }
      });
    }

    // Sort by score and return top 20
    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  private static extractSnippet(text: string, query: string, contextLen: number = 100): string {
    if (!text) return "";

    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text.substring(0, contextLen);

    const start = Math.max(0, idx - contextLen / 2);
    const end = Math.min(text.length, idx + contextLen / 2);
    const snippet = text.substring(start, end).trim();

    return (start > 0 ? "..." : "") + snippet + (end < text.length ? "..." : "");
  }
}
