import { useCallback, useEffect, useState } from "react";
import type { Document } from "../lib/types";
import { DocumentService } from "../services/DocumentService";

interface UseDocumentsResult {
  data: Document[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  add: (doc: Omit<Document, "id" | "createdAt" | "updatedAt">) => Promise<Document>;
  update: (id: string, patch: Partial<Document>) => Promise<Document | null>;
  remove: (id: string) => Promise<boolean>;
}

export function useDocuments(): UseDocumentsResult {
  const [data, setData] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    DocumentService.getAll()
      .then((docs) => {
        if (!cancelled) {
          setData(docs);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load documents");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const add = useCallback(
    async (doc: Omit<Document, "id" | "createdAt" | "updatedAt">) => {
      const result = await DocumentService.add(doc);
      refetch();
      return result;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Document>) => {
      const result = await DocumentService.update(id, patch);
      refetch();
      return result;
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await DocumentService.delete(id);
      refetch();
      return result;
    },
    [refetch],
  );

  return { data, loading, error, refetch, add, update, remove };
}

export function useDocument(id: string | undefined) {
  const [data, setData] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    DocumentService.getById(id)
      .then((doc) => {
        if (!cancelled) {
          setData(doc);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, loading, error };
}
