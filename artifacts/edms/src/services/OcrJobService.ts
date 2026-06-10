import { MOCK_OCR_JOBS } from "../lib/mockExtended";
import { DocumentService } from "./DocumentService";

export interface OcrJobRecord {
  id: string;
  document: string;
  filename: string;
  status: string;
  confidence: number | null;
  pages: number;
  startTime: string | null;
  endTime: string | null;
  extractedRefs: number;
  failureReason?: string;
}

const STORAGE_KEY = "ldo2_ocr_jobs";

function normalize(job: OcrJobRecord): OcrJobRecord {
  return {
    id: String(job.id),
    document: String(job.document ?? ""),
    filename: String(job.filename ?? "unknown"),
    status: String(job.status ?? "Queued"),
    confidence: typeof job.confidence === "number" ? job.confidence : null,
    pages: Number(job.pages ?? 0),
    startTime: job.startTime ? String(job.startTime) : null,
    endTime: job.endTime ? String(job.endTime) : null,
    extractedRefs: Number(job.extractedRefs ?? 0),
    failureReason: job.failureReason ? String(job.failureReason) : undefined,
  };
}

function buildDefaultStore() {
  return MOCK_OCR_JOBS.map((job) => normalize(job as OcrJobRecord));
}

function persist(store: OcrJobRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function loadStore() {
  if (typeof window === "undefined") {
    return buildDefaultStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildDefaultStore();
      persist(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("OCR job store is invalid");
    }

    return parsed.map((job) => normalize(job as OcrJobRecord));
  } catch {
    const fallback = buildDefaultStore();
    persist(fallback);
    return fallback;
  }
}

function nextJobId(store: OcrJobRecord[]) {
  const max = store.reduce((highest, job) => {
    const numeric = Number(job.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return `OCR-${String(max + 1).padStart(4, "0")}`;
}

function formatTimestamp(date: Date) {
  return `${date.toISOString().slice(0, 16).replace("T", " ")}`;
}

let _store = loadStore();

export const OcrJobService = {
  async getAll(): Promise<OcrJobRecord[]> {
    return [..._store];
  },

  async getLatestForDocument(documentId: string): Promise<OcrJobRecord | null> {
    return _store.find((job) => job.document === documentId) ?? null;
  },

  async queueRetry(documentId: string): Promise<OcrJobRecord> {
    const existing = _store.find((job) => job.document === documentId) ?? null;
    const document = await DocumentService.getById(documentId);
    const now = new Date();

    const nextJob = normalize({
      id: nextJobId(_store),
      document: documentId,
      filename:
        existing?.filename ??
        `${document?.title?.toLowerCase().replace(/[^a-z0-9]+/g, "_") || documentId.toLowerCase()}.${document?.fileType?.toLowerCase() || "pdf"}`,
      status: "Processing",
      confidence: null,
      pages: existing?.pages ?? document?.pages ?? 0,
      startTime: formatTimestamp(now),
      endTime: null,
      extractedRefs: 0,
    });

    _store = [nextJob, ..._store];
    persist(_store);

    if (document) {
      await DocumentService.update(documentId, {
        ocrStatus: "PROCESSING",
        ocrConfidence: null,
        ocrError: undefined,
      });
    }

    return nextJob;
  },
};
