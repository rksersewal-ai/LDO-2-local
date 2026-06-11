/**
 * Reliability, Backup, and Recovery
 *
 * Phase 11 reliability utilities for the EDMS system.
 * Provides health checking, backup verification, maintenance mode
 * detection, startup pre-flight checks, and worker heartbeat tracking.
 */

export {
  HealthCheckPoller,
  type ServiceStatus,
  type HealthCheckResult,
  type OverallHealth,
  type ServiceCheckConfig,
  type HealthCheckPollerConfig,
  type StatusChangeCallback,
  DEFAULT_DEGRADED_THRESHOLD_MS,
  DEFAULT_POLL_INTERVAL_MS,
} from "./healthCheckEndpoints";

export {
  BackupTracker,
  type BackupType,
  type BackupStatus,
  type BackupRecord,
  type BackupVerificationResult,
  type BackupEntry,
  type BackupTrackerOptions,
  DEFAULT_STORAGE_KEY,
} from "./backupVerification";

export {
  MaintenanceDetector,
  type MaintenanceInfo,
  type MaintenanceDetectorConfig,
  type MaintenanceChangeCallback,
  DEFAULT_MAINTENANCE_STORAGE_KEY,
  DEFAULT_MAINTENANCE_MESSAGE,
} from "./maintenanceMode";

export {
  PreflightRunner,
  createDefaultRunner,
  checkLocalStorageAvailable,
  checkApiReachable,
  checkBrowserFeatures,
  type CheckResult,
  type StartupCheck,
  type CheckOutcome,
  type PreflightReport,
} from "./startupChecks";

export {
  HeartbeatTracker,
  type WorkerStatus,
  type WorkerInfo,
  type HeartbeatTrackerConfig,
  DEFAULT_STALENESS_THRESHOLD_MS,
  DEFAULT_DEAD_THRESHOLD_MS,
  DEFAULT_HEARTBEAT_STORAGE_KEY,
} from "./workerHeartbeat";
