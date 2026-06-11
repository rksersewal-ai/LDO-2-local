/**
 * Maintenance Mode Detection
 *
 * Client-side maintenance mode detection service that checks for
 * maintenance flags via simulated API response headers or localStorage.
 * Provides callback notifications when maintenance status changes.
 *
 * In production, the X-Maintenance-Mode header on API responses triggers
 * maintenance mode. For local testing, a simulation mode uses localStorage.
 *
 * Usage:
 *   import { MaintenanceDetector } from "@/lib/reliability/maintenanceMode";
 *
 *   const detector = new MaintenanceDetector();
 *   detector.onMaintenanceChange((inMaintenance) => { ... });
 *   await detector.checkMaintenanceStatus();
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Maintenance status information */
export interface MaintenanceInfo {
  /** Whether the system is currently in maintenance mode */
  inMaintenance: boolean;
  /** Human-readable maintenance message */
  message: string;
  /** Estimated end time as ISO string or timestamp */
  estimatedEndTime?: string;
  /** When maintenance started */
  startedAt?: string;
}

/** Configuration for the maintenance detector */
export interface MaintenanceDetectorConfig {
  /** Whether to use simulation mode (localStorage-backed). Default: true */
  simulationMode?: boolean;
  /** localStorage key for simulation mode. Default: "edms_maintenance_mode" */
  storageKey?: string;
  /** Optional custom check function (e.g., for reading response headers) */
  customCheckFn?: () => Promise<MaintenanceInfo>;
}

/** Callback for maintenance status changes */
export type MaintenanceChangeCallback = (info: MaintenanceInfo) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default localStorage key for maintenance mode simulation */
export const DEFAULT_MAINTENANCE_STORAGE_KEY = "edms_maintenance_mode";

/** Default maintenance message */
export const DEFAULT_MAINTENANCE_MESSAGE = "System is under scheduled maintenance.";

// ─── MaintenanceDetector Class ────────────────────────────────────────────────

/**
 * Detects and tracks maintenance mode status.
 * Supports both simulation mode (localStorage) and custom check functions
 * for reading actual API response headers.
 */
export class MaintenanceDetector {
  private config: Required<Pick<MaintenanceDetectorConfig, "simulationMode" | "storageKey">>;
  private customCheckFn?: () => Promise<MaintenanceInfo>;
  private currentInfo: MaintenanceInfo;
  private callbacks: MaintenanceChangeCallback[];

  constructor(config?: MaintenanceDetectorConfig) {
    this.config = {
      simulationMode: config?.simulationMode ?? true,
      storageKey: config?.storageKey ?? DEFAULT_MAINTENANCE_STORAGE_KEY,
    };
    this.customCheckFn = config?.customCheckFn;
    this.currentInfo = {
      inMaintenance: false,
      message: "",
    };
    this.callbacks = [];
  }

  /**
   * Check the current maintenance status.
   * Updates internal state and notifies listeners on change.
   * @returns The current MaintenanceInfo
   */
  async checkMaintenanceStatus(): Promise<MaintenanceInfo> {
    const newInfo = this.customCheckFn
      ? await this.customCheckFn()
      : this.checkSimulationMode();

    const previousState = this.currentInfo.inMaintenance;
    this.currentInfo = newInfo;

    if (previousState !== newInfo.inMaintenance) {
      this.notifyCallbacks(newInfo);
    }

    return newInfo;
  }

  /**
   * Get whether the system is currently in maintenance mode.
   * Uses the last known state (does not perform a new check).
   * @returns true if in maintenance mode
   */
  isInMaintenance(): boolean {
    return this.currentInfo.inMaintenance;
  }

  /**
   * Get the maintenance message.
   * @returns The human-readable maintenance message, or empty string if not in maintenance
   */
  getMaintenanceMessage(): string {
    return this.currentInfo.message;
  }

  /**
   * Get the estimated end time of the maintenance window.
   * @returns ISO string of estimated end, or undefined if unknown
   */
  getEstimatedEndTime(): string | undefined {
    return this.currentInfo.estimatedEndTime;
  }

  /**
   * Register a callback for maintenance status changes.
   * @param callback - Function called with MaintenanceInfo when status changes
   */
  onMaintenanceChange(callback: MaintenanceChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Get the full current maintenance info.
   * @returns Current MaintenanceInfo
   */
  getCurrentInfo(): MaintenanceInfo {
    return { ...this.currentInfo };
  }

  // ─── Simulation Mode Methods ──────────────────────────────────────────────

  /**
   * Enable maintenance mode in simulation.
   * Only works when simulationMode is true.
   * @param message - Maintenance message to display
   * @param estimatedEndTime - Optional estimated end time (ISO string)
   */
  enableMaintenance(message?: string, estimatedEndTime?: string): void {
    if (!this.config.simulationMode) return;

    const info: MaintenanceInfo = {
      inMaintenance: true,
      message: message ?? DEFAULT_MAINTENANCE_MESSAGE,
      estimatedEndTime,
      startedAt: new Date().toISOString(),
    };

    localStorage.setItem(this.config.storageKey, JSON.stringify(info));
  }

  /**
   * Disable maintenance mode in simulation.
   * Only works when simulationMode is true.
   */
  disableMaintenance(): void {
    if (!this.config.simulationMode) return;
    localStorage.removeItem(this.config.storageKey);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /** Check localStorage for simulated maintenance flag */
  private checkSimulationMode(): MaintenanceInfo {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) {
        return { inMaintenance: false, message: "" };
      }
      const stored = JSON.parse(raw) as MaintenanceInfo;
      return {
        inMaintenance: stored.inMaintenance ?? false,
        message: stored.message ?? DEFAULT_MAINTENANCE_MESSAGE,
        estimatedEndTime: stored.estimatedEndTime,
        startedAt: stored.startedAt,
      };
    } catch {
      return { inMaintenance: false, message: "" };
    }
  }

  /** Notify all registered callbacks */
  private notifyCallbacks(info: MaintenanceInfo): void {
    for (const cb of this.callbacks) {
      cb(info);
    }
  }
}
