/**
 * Graceful Degradation Service
 *
 * Monitors subsystem health (OCR, search, cache) and provides
 * failover strategies when services are unavailable.
 *
 * Implements the circuit breaker pattern with three states:
 *   - CLOSED: Normal operation, requests pass through
 *   - OPEN: Service is failing, requests are short-circuited
 *   - HALF_OPEN: Testing if service has recovered
 *
 * State transitions:
 *   CLOSED -> OPEN: After failureThreshold consecutive failures
 *   OPEN -> HALF_OPEN: After recoveryTimeout expires
 *   HALF_OPEN -> CLOSED: On successful health check
 *   HALF_OPEN -> OPEN: On failed health check
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServiceStatus = "healthy" | "degraded" | "down";

export type CircuitState = "closed" | "open" | "half-open";

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  circuitState: CircuitState;
  lastCheck: string | null;
  consecutiveFailures: number;
  lastError: string | null;
}

export interface SystemStatus {
  overall: ServiceStatus;
  services: ServiceHealth[];
  timestamp: string;
}

export interface FailoverStrategy {
  serviceName: string;
  status: ServiceStatus;
  action: "proceed" | "use_cache" | "queue_for_retry" | "reject";
  message: string;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** Time in ms before trying half-open. Default: 60000 (1 minute) */
  recoveryTimeout?: number;
  /** Number of successes in half-open to close circuit. Default: 2 */
  successThreshold?: number;
}

export type HealthCheckFn = () => Promise<boolean>;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RECOVERY_TIMEOUT = 60_000;
const DEFAULT_SUCCESS_THRESHOLD = 2;

// ─── Internal State ───────────────────────────────────────────────────────────

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastError: string | null;
  lastCheck: string | null;
  config: Required<CircuitBreakerConfig>;
  healthCheck: HealthCheckFn;
}

// ─── Service Class ────────────────────────────────────────────────────────────

/**
 * Graceful Degradation Service
 *
 * Usage:
 *   const service = new GracefulDegradationService();
 *   service.registerHealthCheck("ocr", async () => { ... });
 *   const status = await service.getSystemStatus();
 *   const strategy = service.getFailoverStrategy("ocr");
 */
export class GracefulDegradationService {
  private circuits: Map<string, CircuitBreakerState> = new Map();

  /**
   * Register a health check function for a named service.
   * Creates a circuit breaker for the service.
   *
   * @param name - Service name (e.g., "ocr", "search", "cache")
   * @param healthCheck - Async function that returns true if service is healthy
   * @param config - Optional circuit breaker configuration
   */
  registerHealthCheck(
    name: string,
    healthCheck: HealthCheckFn,
    config?: CircuitBreakerConfig,
  ): void {
    this.circuits.set(name, {
      state: "closed",
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      lastError: null,
      lastCheck: null,
      config: {
        failureThreshold: config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
        recoveryTimeout: config?.recoveryTimeout ?? DEFAULT_RECOVERY_TIMEOUT,
        successThreshold: config?.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD,
      },
      healthCheck,
    });
  }

  /**
   * Check the health of a specific service and update its circuit breaker state.
   *
   * @param serviceName - The name of the service to check
   * @returns The current health status of the service
   */
  async checkServiceHealth(serviceName: string): Promise<ServiceHealth> {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      return {
        name: serviceName,
        status: "down",
        circuitState: "open",
        lastCheck: null,
        consecutiveFailures: 0,
        lastError: "Service not registered",
      };
    }

    // Check if we should transition from OPEN to HALF_OPEN
    if (circuit.state === "open" && circuit.lastFailureTime) {
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed >= circuit.config.recoveryTimeout) {
        circuit.state = "half-open";
        circuit.successes = 0;
      }
    }

    // If circuit is OPEN and recovery timeout hasn't elapsed, skip the check
    if (circuit.state === "open") {
      circuit.lastCheck = new Date().toISOString();
      return this.buildServiceHealth(serviceName, circuit);
    }

    // Execute health check
    try {
      const healthy = await circuit.healthCheck();
      circuit.lastCheck = new Date().toISOString();

      if (healthy) {
        this.onSuccess(circuit);
      } else {
        this.onFailure(circuit, "Health check returned false");
      }
    } catch (error) {
      circuit.lastCheck = new Date().toISOString();
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.onFailure(circuit, errorMsg);
    }

    return this.buildServiceHealth(serviceName, circuit);
  }

  /**
   * Get the overall system status by checking all registered services.
   *
   * @returns SystemStatus with individual service health and overall assessment
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const services: ServiceHealth[] = [];

    for (const name of this.circuits.keys()) {
      const health = await this.checkServiceHealth(name);
      services.push(health);
    }

    const overall = this.calculateOverallStatus(services);

    return {
      overall,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get the recommended failover strategy for a service.
   *
   * @param serviceName - The name of the service
   * @returns FailoverStrategy with recommended action
   */
  getFailoverStrategy(serviceName: string): FailoverStrategy {
    const circuit = this.circuits.get(serviceName);

    if (!circuit) {
      return {
        serviceName,
        status: "down",
        action: "reject",
        message: `Service '${serviceName}' is not registered`,
      };
    }

    const status = this.getStatusFromState(circuit);

    switch (status) {
      case "healthy":
        return {
          serviceName,
          status: "healthy",
          action: "proceed",
          message: `Service '${serviceName}' is operating normally`,
        };
      case "degraded":
        return {
          serviceName,
          status: "degraded",
          action: "use_cache",
          message: `Service '${serviceName}' is degraded, using cached results where available`,
        };
      case "down":
        return {
          serviceName,
          status: "down",
          action: "queue_for_retry",
          message: `Service '${serviceName}' is down, queuing request for retry when service recovers`,
        };
    }
  }

  /**
   * Record a manual failure for a service (e.g., from an external error).
   *
   * @param serviceName - The name of the service
   * @param error - Error description
   */
  recordFailure(serviceName: string, error: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      this.onFailure(circuit, error);
    }
  }

  /**
   * Record a manual success for a service.
   *
   * @param serviceName - The name of the service
   */
  recordSuccess(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      this.onSuccess(circuit);
    }
  }

  /**
   * Reset a service's circuit breaker to closed state.
   *
   * @param serviceName - The name of the service to reset
   */
  reset(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.state = "closed";
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastError = null;
      circuit.lastFailureTime = null;
    }
  }

  /**
   * Get the current circuit breaker state for a service.
   *
   * @param serviceName - The service name
   * @returns The circuit state or undefined if not registered
   */
  getCircuitState(serviceName: string): CircuitState | undefined {
    return this.circuits.get(serviceName)?.state;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private onSuccess(circuit: CircuitBreakerState): void {
    if (circuit.state === "half-open") {
      circuit.successes++;
      if (circuit.successes >= circuit.config.successThreshold) {
        // Recovery confirmed, close the circuit
        circuit.state = "closed";
        circuit.failures = 0;
        circuit.successes = 0;
        circuit.lastError = null;
      }
    } else {
      // In closed state, reset failure counter
      circuit.failures = 0;
    }
  }

  private onFailure(circuit: CircuitBreakerState, error: string): void {
    circuit.lastError = error;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === "half-open") {
      // Recovery failed, reopen the circuit
      circuit.state = "open";
      circuit.successes = 0;
    } else {
      // In closed state, increment failures
      circuit.failures++;
      if (circuit.failures >= circuit.config.failureThreshold) {
        circuit.state = "open";
      }
    }
  }

  private getStatusFromState(circuit: CircuitBreakerState): ServiceStatus {
    switch (circuit.state) {
      case "closed":
        return "healthy";
      case "half-open":
        return "degraded";
      case "open":
        return "down";
    }
  }

  private buildServiceHealth(
    name: string,
    circuit: CircuitBreakerState,
  ): ServiceHealth {
    return {
      name,
      status: this.getStatusFromState(circuit),
      circuitState: circuit.state,
      lastCheck: circuit.lastCheck,
      consecutiveFailures: circuit.failures,
      lastError: circuit.lastError,
    };
  }

  private calculateOverallStatus(services: ServiceHealth[]): ServiceStatus {
    if (services.length === 0) return "healthy";

    const hasDown = services.some((s) => s.status === "down");
    const hasDegraded = services.some((s) => s.status === "degraded");

    if (hasDown) return "down";
    if (hasDegraded) return "degraded";
    return "healthy";
  }
}
