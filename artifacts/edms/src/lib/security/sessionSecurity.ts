/**
 * Session Security
 *
 * Session timeout tracking with configurable idle duration and token
 * rotation scheduling. Detects user inactivity and provides an interface
 * for session management.
 *
 * Usage:
 *   import { SessionManager } from "@/lib/security/sessionSecurity";
 *
 *   const session = new SessionManager({ timeoutMs: 30 * 60 * 1000 });
 *   session.startSession("user-1");
 *   session.recordActivity();
 *   if (session.isSessionExpired()) { // redirect to login }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Configuration for session security */
export interface SessionConfig {
  /** Session timeout in milliseconds. Default: 30 minutes (1800000) */
  timeoutMs?: number;
  /** Token rotation interval in milliseconds. Default: 15 minutes (900000) */
  rotationIntervalMs?: number;
  /** Function to get current time (for testing). Default: Date.now */
  now?: () => number;
}

/** Session state information */
export interface SessionState {
  /** Whether a session is currently active */
  active: boolean;
  /** User ID of the session owner */
  userId: string | null;
  /** ISO timestamp when the session started */
  startedAt: string | null;
  /** ISO timestamp of the last recorded activity */
  lastActivityAt: string | null;
  /** Whether the session has expired due to inactivity */
  expired: boolean;
  /** Idle duration in milliseconds since last activity */
  idleDurationMs: number;
}

/** Token rotation state */
export interface TokenRotationState {
  /** Whether a token rotation is due */
  shouldRotate: boolean;
  /** Milliseconds since the last rotation (or session start) */
  timeSinceLastRotationMs: number;
  /** Milliseconds until next rotation is due */
  timeUntilRotationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default session timeout: 30 minutes */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

/** Default token rotation interval: 15 minutes */
const DEFAULT_ROTATION_INTERVAL_MS = 15 * 60 * 1000;

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Manages session security including idle timeout and token rotation.
 *
 * Sessions expire after a configurable period of inactivity. Token rotation
 * is scheduled at regular intervals to limit the window of token compromise.
 */
export class SessionManager {
  private readonly timeoutMs: number;
  private readonly rotationIntervalMs: number;
  private readonly getNow: () => number;

  private userId: string | null = null;
  private sessionStartTime: number | null = null;
  private lastActivityTime: number | null = null;
  private lastRotationTime: number | null = null;

  constructor(config?: SessionConfig) {
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.rotationIntervalMs = config?.rotationIntervalMs ?? DEFAULT_ROTATION_INTERVAL_MS;
    this.getNow = config?.now ?? (() => Date.now());
  }

  /**
   * Start a new session for the given user.
   * Resets all timers and initializes the session state.
   *
   * @param userId - The ID of the user starting the session
   */
  startSession(userId: string): void {
    const now = this.getNow();
    this.userId = userId;
    this.sessionStartTime = now;
    this.lastActivityTime = now;
    this.lastRotationTime = now;
  }

  /**
   * Record user activity, resetting the idle timer.
   * Should be called on user interactions (clicks, key presses, navigation).
   */
  recordActivity(): void {
    if (this.sessionStartTime === null) return;
    this.lastActivityTime = this.getNow();
  }

  /**
   * Check whether the session has expired due to inactivity.
   *
   * @returns true if the session has been idle longer than timeoutMs
   */
  isSessionExpired(): boolean {
    if (this.sessionStartTime === null || this.lastActivityTime === null) {
      return true;
    }

    const idle = this.getNow() - this.lastActivityTime;
    return idle >= this.timeoutMs;
  }

  /**
   * Get the current idle duration in milliseconds.
   *
   * @returns Milliseconds since last activity, or 0 if no session
   */
  getIdleDuration(): number {
    if (this.lastActivityTime === null) return 0;
    return Math.max(0, this.getNow() - this.lastActivityTime);
  }

  /**
   * Check whether a token rotation is due.
   *
   * @returns true if time since last rotation exceeds rotationIntervalMs
   */
  shouldRotateToken(): boolean {
    if (this.lastRotationTime === null || this.sessionStartTime === null) {
      return false;
    }

    if (this.isSessionExpired()) {
      return false;
    }

    const timeSinceRotation = this.getNow() - this.lastRotationTime;
    return timeSinceRotation >= this.rotationIntervalMs;
  }

  /**
   * Mark that a token rotation has occurred, resetting the rotation timer.
   */
  markTokenRotated(): void {
    this.lastRotationTime = this.getNow();
  }

  /**
   * Get the full session state.
   *
   * @returns Current session state information
   */
  getSessionState(): SessionState {
    const active = this.sessionStartTime !== null && !this.isSessionExpired();
    return {
      active,
      userId: this.userId,
      startedAt: this.sessionStartTime ? new Date(this.sessionStartTime).toISOString() : null,
      lastActivityAt: this.lastActivityTime ? new Date(this.lastActivityTime).toISOString() : null,
      expired: this.sessionStartTime !== null && this.isSessionExpired(),
      idleDurationMs: this.getIdleDuration(),
    };
  }

  /**
   * Get the token rotation state.
   *
   * @returns Token rotation state information
   */
  getTokenRotationState(): TokenRotationState {
    if (this.lastRotationTime === null) {
      return { shouldRotate: false, timeSinceLastRotationMs: 0, timeUntilRotationMs: this.rotationIntervalMs };
    }

    const timeSince = this.getNow() - this.lastRotationTime;
    const timeUntil = Math.max(0, this.rotationIntervalMs - timeSince);

    return {
      shouldRotate: this.shouldRotateToken(),
      timeSinceLastRotationMs: timeSince,
      timeUntilRotationMs: timeUntil,
    };
  }

  /**
   * End the current session.
   */
  endSession(): void {
    this.userId = null;
    this.sessionStartTime = null;
    this.lastActivityTime = null;
    this.lastRotationTime = null;
  }
}
