/**
 * Worker Heartbeat
 *
 * Tracks worker liveness by recording periodic heartbeats.
 * Workers that miss heartbeats within a configurable threshold
 * are marked as stale or dead. State is stored in localStorage
 * for persistence across page reloads.
 *
 * Usage:
 *   import { HeartbeatTracker } from "@/lib/reliability/workerHeartbeat";
 *
 *   const tracker = new HeartbeatTracker({ stalenessThresholdMs: 30000 });
 *   tracker.registerWorker("w-1", "Document Processor");
 *   tracker.recordHeartbeat("w-1");
 *   const stale = tracker.getStaleWorkers(30000);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Possible worker liveness statuses */
export type WorkerStatus = "alive" | "stale" | "dead";

/** Information about a tracked worker */
export interface WorkerInfo {
  /** Unique worker identifier */
  id: string;
  /** Human-readable worker name */
  name: string;
  /** Timestamp of the last recorded heartbeat */
  lastHeartbeat: number;
  /** Current computed status */
  status: WorkerStatus;
  /** Timestamp when the worker was registered */
  registeredAt: number;
}

/** Configuration for the heartbeat tracker */
export interface HeartbeatTrackerConfig {
  /** Milliseconds before a worker is considered stale. Default: 30000 (30s) */
  stalenessThresholdMs?: number;
  /** Milliseconds before a stale worker is considered dead. Default: 90000 (90s) */
  deadThresholdMs?: number;
  /** localStorage key for persistence. Default: "edms_worker_heartbeats" */
  storageKey?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default staleness threshold: 30 seconds */
export const DEFAULT_STALENESS_THRESHOLD_MS = 30_000;

/** Default dead threshold: 90 seconds (3x staleness) */
export const DEFAULT_DEAD_THRESHOLD_MS = 90_000;

/** Default localStorage key */
export const DEFAULT_HEARTBEAT_STORAGE_KEY = "edms_worker_heartbeats";

// ─── Internal Types ───────────────────────────────────────────────────────────

/** Stored worker record (without computed status) */
interface StoredWorker {
  id: string;
  name: string;
  lastHeartbeat: number;
  registeredAt: number;
}

// ─── HeartbeatTracker Class ───────────────────────────────────────────────────

/**
 * Tracks worker liveness via periodic heartbeat recordings.
 * Workers transition from alive -> stale -> dead based on time
 * since their last heartbeat.
 */
export class HeartbeatTracker {
  private stalenessThresholdMs: number;
  private deadThresholdMs: number;
  private storageKey: string;

  constructor(config?: HeartbeatTrackerConfig) {
    this.stalenessThresholdMs = config?.stalenessThresholdMs ?? DEFAULT_STALENESS_THRESHOLD_MS;
    this.deadThresholdMs = config?.deadThresholdMs ?? DEFAULT_DEAD_THRESHOLD_MS;
    this.storageKey = config?.storageKey ?? DEFAULT_HEARTBEAT_STORAGE_KEY;
  }

  /**
   * Register a new worker for tracking.
   * @param id - Unique worker identifier
   * @param name - Human-readable worker name
   */
  registerWorker(id: string, name: string): void {
    const workers = this.loadWorkers();
    const existing = workers.find((w) => w.id === id);

    if (existing) {
      existing.name = name;
      existing.lastHeartbeat = Date.now();
    } else {
      workers.push({
        id,
        name,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });
    }

    this.saveWorkers(workers);
  }

  /**
   * Record a heartbeat for a worker.
   * @param id - The worker id to update
   * @returns true if the worker was found and updated, false otherwise
   */
  recordHeartbeat(id: string): boolean {
    const workers = this.loadWorkers();
    const worker = workers.find((w) => w.id === id);

    if (!worker) {
      return false;
    }

    worker.lastHeartbeat = Date.now();
    this.saveWorkers(workers);
    return true;
  }

  /**
   * Get the current status and info for a specific worker.
   * @param id - The worker id
   * @returns WorkerInfo with computed status, or undefined if not found
   */
  getWorkerStatus(id: string): WorkerInfo | undefined {
    const workers = this.loadWorkers();
    const worker = workers.find((w) => w.id === id);

    if (!worker) {
      return undefined;
    }

    return this.toWorkerInfo(worker);
  }

  /**
   * Get all workers that are currently stale (past staleness threshold).
   * @param thresholdMs - Optional override for staleness threshold
   * @returns Array of stale WorkerInfo objects
   */
  getStaleWorkers(thresholdMs?: number): WorkerInfo[] {
    const threshold = thresholdMs ?? this.stalenessThresholdMs;
    const workers = this.loadWorkers();
    const now = Date.now();

    return workers
      .filter((w) => {
        const elapsed = now - w.lastHeartbeat;
        return elapsed > threshold;
      })
      .map((w) => this.toWorkerInfo(w));
  }

  /**
   * Get all registered workers with their current status.
   * @returns Array of all WorkerInfo objects
   */
  getAllWorkers(): WorkerInfo[] {
    return this.loadWorkers().map((w) => this.toWorkerInfo(w));
  }

  /**
   * Remove a worker from tracking.
   * @param id - The worker id to remove
   * @returns true if the worker was found and removed, false otherwise
   */
  removeWorker(id: string): boolean {
    const workers = this.loadWorkers();
    const filtered = workers.filter((w) => w.id !== id);

    if (filtered.length === workers.length) {
      return false;
    }

    this.saveWorkers(filtered);
    return true;
  }

  /** Clear all worker tracking data */
  clear(): void {
    this.saveWorkers([]);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /** Compute the status for a stored worker based on current time */
  private toWorkerInfo(worker: StoredWorker): WorkerInfo {
    const elapsed = Date.now() - worker.lastHeartbeat;
    let status: WorkerStatus;

    if (elapsed > this.deadThresholdMs) {
      status = "dead";
    } else if (elapsed > this.stalenessThresholdMs) {
      status = "stale";
    } else {
      status = "alive";
    }

    return {
      id: worker.id,
      name: worker.name,
      lastHeartbeat: worker.lastHeartbeat,
      status,
      registeredAt: worker.registeredAt,
    };
  }

  /** Load worker records from localStorage */
  private loadWorkers(): StoredWorker[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as StoredWorker[];
    } catch {
      return [];
    }
  }

  /** Save worker records to localStorage */
  private saveWorkers(workers: StoredWorker[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(workers));
  }
}
