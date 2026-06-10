import { useCallback, useEffect, useState } from "react";
import type { WorkRecord } from "../lib/types";
import { WorkLedgerService } from "../services/WorkLedgerService";

interface UseWorkRecordsResult {
  data: WorkRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  add: (record: Omit<WorkRecord, "id" | "createdAt">) => Promise<WorkRecord>;
  update: (id: string, patch: Partial<WorkRecord>) => Promise<WorkRecord | null>;
  verify: (id: string, verifierName: string) => Promise<WorkRecord | null>;
  remove: (id: string) => Promise<boolean>;
}

export function useWorkRecords(): UseWorkRecordsResult {
  const [data, setData] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    WorkLedgerService.getAll()
      .then((records) => {
        if (!cancelled) {
          setData(records);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load work records");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const add = useCallback(
    async (record: Omit<WorkRecord, "id" | "createdAt">) => {
      const result = await WorkLedgerService.add(record);
      refetch();
      return result;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, patch: Partial<WorkRecord>) => {
      const result = await WorkLedgerService.update(id, patch);
      refetch();
      return result;
    },
    [refetch],
  );

  const verify = useCallback(
    async (id: string, verifierName: string) => {
      const result = await WorkLedgerService.verify(id, verifierName);
      refetch();
      return result;
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await WorkLedgerService.delete(id);
      refetch();
      return result;
    },
    [refetch],
  );

  return { data, loading, error, refetch, add, update, verify, remove };
}
