import { useCallback, useEffect, useState } from "react";
import apiClient from "../services/ApiClient";
import {
  type DocumentChangeAlert,
  DocumentChangeAlertService,
} from "../services/DocumentChangeAlertService";

interface UseDocumentChangeAlertsOptions {
  plItem?: string;
  document?: string;
}

export function useDocumentChangeAlerts(options: UseDocumentChangeAlertsOptions = {}) {
  const [alerts, setAlerts] = useState<DocumentChangeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getSupervisorDocumentReviews({
        ...(options.plItem ? { pl_item: options.plItem } : {}),
        ...(options.document ? { document: options.document } : {}),
      });
      setAlerts(response.items.map(DocumentChangeAlertService.mapApiReview));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document change alerts");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [options.document, options.plItem]);

  useEffect(() => {
    void load();
    return DocumentChangeAlertService.subscribe(() => {
      void load();
    });
  }, [load]);

  const approveAlert = useCallback(async (alertId: string, notes?: string) => {
    await apiClient.approveSupervisorDocumentReview(alertId, notes ? { notes } : undefined);
    DocumentChangeAlertService.notifyUpdated();
  }, []);

  const bypassAlert = useCallback(
    async (alertId: string, payload?: { notes?: string; bypassReason?: string }) => {
      await apiClient.bypassSupervisorDocumentReview(alertId, {
        ...(payload?.notes ? { notes: payload.notes } : {}),
        ...(payload?.bypassReason ? { bypass_reason: payload.bypassReason } : {}),
      });
      DocumentChangeAlertService.notifyUpdated();
    },
    [],
  );

  return { alerts, loading, error, approveAlert, bypassAlert, refetch: load };
}
