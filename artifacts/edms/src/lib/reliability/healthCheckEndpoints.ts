/**
 * Health Check Endpoints
 *
 * Client-side health check polling service that periodically checks
 * the status of backend services (DB, Redis, OCR, Storage) and
 * aggregates their health into an overall system status.
 *
 * Usage:
 *   import { HealthCheckPoller } from "@/lib/reliability/healthCheckEndpoints";
 *
 *   const poller = new HealthCheckPoller({ services: [...] });
 *   poller.onStatusChange((result) => console.log(result));
 *   poller.startPolling(5000);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Possible statuses for a service */
export type ServiceStatus = "healthy" | "degraded" | "unhealthy";

/** Result of a single service health check */
export interface HealthCheckResult {
  /** Name of the service */
  serviceName: string;
  /** Current status */
  status: ServiceStatus;
  /** Latency of the check in milliseconds */
  latencyMs: number;
  /** Timestamp of the last check */
  lastChecked: number;
  /** Optional error message if check failed */
  errorMessage?: string;
}

/** Overall health status aggregation */
export interface OverallHealth {
  /** Aggregated system status */
  status: ServiceStatus;
  /** Individual service results */
  services: HealthCheckResult[];
  /** Timestamp of the aggregation */
  checkedAt: number;
  /** Number of healthy services */
  healthyCount: number;
  /** Number of degraded services */
  degradedCount: number;
  /** Number of unhealthy services */
  unhealthyCount: number;
}

/** Configuration for a single service check */
export interface ServiceCheckConfig {
  /** Unique service name */
  name: string;
  /** Function that performs the health check. Returns true for healthy, false for unhealthy. */
  checkFn: () => Promise<boolean>;
  /** Latency threshold in ms above which the service is marked degraded */
  degradedThresholdMs?: number;
}

/** Configuration for the health check poller */
export interface HealthCheckPollerConfig {
  /** List of services to monitor */
  services: ServiceCheckConfig[];
}

/** Callback invoked when a service status changes */
export type StatusChangeCallback = (result: HealthCheckResult) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default latency threshold for degraded status (500ms) */
export const DEFAULT_DEGRADED_THRESHOLD_MS = 500;

/** Default polling interval (10 seconds) */
export const DEFAULT_POLL_INTERVAL_MS = 10_000;

// ─── HealthCheckPoller Class ──────────────────────────────────────────────────

/**
 * Periodically polls configured services and tracks their health status.
 * Notifies listeners when a service status changes.
 */
export class HealthCheckPoller {
  private services: ServiceCheckConfig[];
  private results: Map<string, HealthCheckResult>;
  private callbacks: StatusChangeCallback[];
  private intervalId: ReturnType<typeof setInterval> | null;
  private polling: boolean;

  constructor(config: HealthCheckPollerConfig) {
    this.services = config.services;
    this.results = new Map();
    this.callbacks = [];
    this.intervalId = null;
    this.polling = false;
  }

  /**
   * Start polling all services at the given interval.
   * @param intervalMs - Polling interval in milliseconds. Default: 10000
   */
  startPolling(intervalMs: number = DEFAULT_POLL_INTERVAL_MS): void {
    if (this.polling) {
      return;
    }
    this.polling = true;
    // Run an immediate check
    void this.runChecks();
    this.intervalId = setInterval(() => {
      void this.runChecks();
    }, intervalMs);
  }

  /** Stop polling all services. */
  stopPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.polling = false;
  }

  /**
   * Get the latest status for a specific service.
   * @param serviceName - The name of the service
   * @returns The latest HealthCheckResult, or undefined if not yet checked
   */
  getStatus(serviceName: string): HealthCheckResult | undefined {
    return this.results.get(serviceName);
  }

  /**
   * Get the aggregated overall health across all services.
   * @returns OverallHealth summary
   */
  getOverallHealth(): OverallHealth {
    const services = Array.from(this.results.values());
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const svc of services) {
      if (svc.status === "healthy") healthyCount++;
      else if (svc.status === "degraded") degradedCount++;
      else unhealthyCount++;
    }

    let status: ServiceStatus = "healthy";
    if (unhealthyCount > 0) {
      status = "unhealthy";
    } else if (degradedCount > 0) {
      status = "degraded";
    }

    return {
      status,
      services,
      checkedAt: Date.now(),
      healthyCount,
      degradedCount,
      unhealthyCount,
    };
  }

  /**
   * Register a callback for service status changes.
   * @param callback - Function called with the new HealthCheckResult when a service status changes
   */
  onStatusChange(callback: StatusChangeCallback): void {
    this.callbacks.push(callback);
  }

  /** Whether the poller is currently active */
  isPolling(): boolean {
    return this.polling;
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /** Run health checks for all configured services */
  private async runChecks(): Promise<void> {
    const checks = this.services.map((svc) => this.checkService(svc));
    await Promise.allSettled(checks);
  }

  /** Check a single service and update its result */
  private async checkService(config: ServiceCheckConfig): Promise<void> {
    const threshold = config.degradedThresholdMs ?? DEFAULT_DEGRADED_THRESHOLD_MS;
    const start = Date.now();
    let status: ServiceStatus;
    let errorMessage: string | undefined;

    try {
      const healthy = await config.checkFn();
      const latency = Date.now() - start;

      if (!healthy) {
        status = "unhealthy";
        errorMessage = "Check returned unhealthy";
      } else if (latency > threshold) {
        status = "degraded";
      } else {
        status = "healthy";
      }

      const result: HealthCheckResult = {
        serviceName: config.name,
        status,
        latencyMs: latency,
        lastChecked: Date.now(),
        errorMessage,
      };

      this.updateResult(result);
    } catch (err) {
      const latency = Date.now() - start;
      const result: HealthCheckResult = {
        serviceName: config.name,
        status: "unhealthy",
        latencyMs: latency,
        lastChecked: Date.now(),
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };

      this.updateResult(result);
    }
  }

  /** Update result and notify listeners if status changed */
  private updateResult(newResult: HealthCheckResult): void {
    const previous = this.results.get(newResult.serviceName);
    this.results.set(newResult.serviceName, newResult);

    if (!previous || previous.status !== newResult.status) {
      for (const cb of this.callbacks) {
        cb(newResult);
      }
    }
  }
}
