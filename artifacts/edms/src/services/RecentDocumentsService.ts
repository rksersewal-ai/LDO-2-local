const RECENT_DOCS_KEY = "edms_recent_documents";
const MAX_RECENT_ITEMS = 20;

export interface RecentDocumentEntry {
  documentId: string;
  title: string;
  viewedAt: string;
  documentType: string;
}

function readRecent(): RecentDocumentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentDocumentEntry[];
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry?.documentId === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecent(entries: RecentDocumentEntry[]) {
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(entries.slice(0, MAX_RECENT_ITEMS)));
}

export const RecentDocumentsService = {
  record(documentId: string, title: string, documentType: string = "PDF") {
    if (!documentId) return;

    const entries = readRecent();
    // Remove existing entry for same document
    const filtered = entries.filter((e) => e.documentId !== documentId);
    // Add to front (most recent first)
    filtered.unshift({
      documentId,
      title,
      viewedAt: new Date().toISOString(),
      documentType,
    });
    writeRecent(filtered);
  },

  getRecent(limit: number = 10): RecentDocumentEntry[] {
    return readRecent().slice(0, limit);
  },

  clear() {
    localStorage.removeItem(RECENT_DOCS_KEY);
  },
};
