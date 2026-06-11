/**
 * useTiledOcrPolling Hook
 *
 * Polls the TiledOcrService for job status updates at a configurable interval.
 * Only activates when the TILED_OCR feature flag is enabled.
 * Uses useRef for timers and cleans up on unmount to prevent memory leaks.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isFeatureEnabled } from "../lib/featureFlags";
import type { TiledOcrJob } from "../lib/tiledOcrTypes";
import { TiledOcrService } from "../services/TiledOcrService";

export interface UseTiledOcrPollingOptions {
  /** Job ID to poll for */
  jobId: string;
  /** Polling interval in milliseconds (default: 5000) */
  intervalMs?: number;
  /** Whether to start polling immediately (default: false) */
  autoStart?: boolean;
}

export interface UseTiledOcrPollingResult {
  /** Current job state (null if not loaded yet or feature disabled) */
  job: TiledOcrJob | null;
  /** Whether the hook is actively polling */
  isPolling: boolean;
  /** Error message if polling encountered an issue */
  error: string | null;
  /** Start polling for job updates */
  startPolling: () => void;
  /** Stop polling for job updates */
  stopPolling: () => void;
}

export function useTiledOcrPolling(options: UseTiledOcrPollingOptions): UseTiledOcrPollingResult {
  const { jobId, intervalMs = 5000, autoStart = false } = options;

  const [job, setJob] = useState<TiledOcrJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchJob = useCallback(() => {
    if (!isFeatureEnabled("TILED_OCR")) {
      setError("TILED_OCR feature flag is not enabled");
      setIsPolling(false);
      return;
    }

    try {
      const result = TiledOcrService.getJob(jobId);
      if (mountedRef.current) {
        setJob(result);
        setError(result === null ? `Job ${jobId} not found` : null);

        // Stop polling if job reached a terminal state
        if (
          result &&
          (result.status === "completed" || result.status === "failed" || result.status === "cancelled")
        ) {
          stopPollingInternal();
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Unknown polling error");
      }
    }
  }, [jobId]);

  const stopPollingInternal = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mountedRef.current) {
      setIsPolling(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!isFeatureEnabled("TILED_OCR")) {
      setError("TILED_OCR feature flag is not enabled");
      return;
    }

    // Clear any existing interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    setIsPolling(true);
    setError(null);

    // Fetch immediately, then at interval
    fetchJob();
    intervalRef.current = setInterval(fetchJob, intervalMs);
  }, [fetchJob, intervalMs]);

  const stopPolling = useCallback(() => {
    stopPollingInternal();
  }, [stopPollingInternal]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { job, isPolling, error, startPolling, stopPolling };
}
