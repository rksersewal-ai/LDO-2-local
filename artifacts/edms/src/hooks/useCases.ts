import { useCallback, useEffect, useState } from "react";
import type { CaseRecord } from "../lib/types";
import { CaseService } from "../services/CaseService";

interface UseCasesResult {
  data: CaseRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  add: (c: Omit<CaseRecord, "id" | "createdAt" | "updatedAt">) => Promise<CaseRecord>;
  update: (id: string, patch: Partial<CaseRecord>) => Promise<CaseRecord | null>;
  remove: (id: string) => Promise<boolean>;
}

export function useCases(): UseCasesResult {
  const [data, setData] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    CaseService.getAll()
      .then((cases) => {
        if (!cancelled) {
          setData(cases);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load cases");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const add = useCallback(
    async (c: Omit<CaseRecord, "id" | "createdAt" | "updatedAt">) => {
      const result = await CaseService.add(c);
      refetch();
      return result;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, patch: Partial<CaseRecord>) => {
      const result = await CaseService.update(id, patch);
      refetch();
      return result;
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await CaseService.delete(id);
      refetch();
      return result;
    },
    [refetch],
  );

  return { data, loading, error, refetch, add, update, remove };
}
