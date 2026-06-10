import { useCallback, useEffect, useState } from "react";
import type { PLNumber } from "../lib/types";
import { PLService } from "../services/PLService";

interface UsePLItemsResult {
  data: PLNumber[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  add: (pl: Omit<PLNumber, "id" | "createdAt" | "updatedAt">) => Promise<PLNumber>;
  update: (id: string, patch: Partial<PLNumber>) => Promise<PLNumber | null>;
  remove: (id: string) => Promise<boolean>;
}

export function usePLItems(): UsePLItemsResult {
  const [data, setData] = useState<PLNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    PLService.getAll()
      .then((items) => {
        if (!cancelled) {
          setData(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PL items");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const add = useCallback(
    async (pl: Omit<PLNumber, "id" | "createdAt" | "updatedAt">) => {
      const result = await PLService.add(pl);
      refetch();
      return result;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, patch: Partial<PLNumber>) => {
      const result = await PLService.update(id, patch);
      refetch();
      return result;
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await PLService.delete(id);
      refetch();
      return result;
    },
    [refetch],
  );

  return { data, loading, error, refetch, add, update, remove };
}

export function usePLItem(id: string | undefined) {
  const [data, setData] = useState<PLNumber | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    PLService.getById(id)
      .then((pl) => {
        if (!cancelled) {
          setData(pl);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PL item");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  return { data, loading, error, refetch };
}
