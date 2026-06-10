import { useCallback, useEffect, useState } from "react";
import apiClient from "../services/ApiClient";

export interface PlLinkableDocument {
  id: string;
  name: string;
  category: string;
  revision: string;
  status: string;
  size: string;
  ocrStatus?: string;
  date?: string;
}

function formatSize(size: number | null | undefined): string {
  if (!size || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

interface RawApiDocument {
  id: string | number;
  name?: string;
  title?: string;
  category?: string;
  revision?: string | number;
  status?: string;
  size?: string | number;
  ocr_status?: string;
  updated_at?: string;
  date?: string;
  created_at?: string;
}

function mapApiDocument(doc: RawApiDocument): PlLinkableDocument {
  return {
    id: String(doc.id),
    name: doc.name ?? doc.title ?? String(doc.id),
    category: doc.category ?? "OTHER",
    revision: String(doc.revision ?? ""),
    status: doc.status ?? "Draft",
    size: formatSize(typeof doc.size === "number" ? doc.size : Number(doc.size ?? 0)),
    ocrStatus: doc.ocr_status,
    date: doc.updated_at ?? doc.date ?? doc.created_at ?? "",
  };
}

export function usePlLinkableDocuments(search?: string) {
  const [documents, setDocuments] = useState<PlLinkableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getDocuments({
        page: 1,
        pageSize: 500,
        search,
      });
      setDocuments(response.items.map(mapApiDocument));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { documents, loading, error, refetch: fetch };
}
