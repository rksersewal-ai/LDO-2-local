import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "./sessionSecurity";

describe("sessionSecurity", () => {
  let session: SessionManager;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1000000;
    session = new SessionManager({
      timeoutMs: 30 * 60 * 1000, // 30 minutes
      rotationIntervalMs: 15 * 60 * 1000, // 15 minutes
      now: () => currentTime,
    });
  });

  describe("startSession", () => {
    it("initializes a new session", () => {
      session.startSession("user-1");

      const state = session.getSessionState();
      expect(state.active).toBe(true);
      expect(state.userId).toBe("user-1");
      expect(state.startedAt).toBeTruthy();
      expect(state.lastActivityAt).toBeTruthy();
      expect(state.expired).toBe(false);
    });

    it("resets previous session state", () => {
      session.startSession("user-1");
      currentTime += 31 * 60 * 1000; // Expire old session

      session.startSession("user-2");
      const state = session.getSessionState();
      expect(state.active).toBe(true);
      expect(state.userId).toBe("user-2");
      expect(state.expired).toBe(false);
    });
  });

  describe("recordActivity", () => {
    it("resets the idle timer", () => {
      session.startSession("user-1");

      currentTime += 10 * 60 * 1000; // 10 minutes idle
      session.recordActivity();

      currentTime += 10 * 60 * 1000; // 10 more minutes
      expect(session.isSessionExpired()).toBe(false);
    });

    it("does nothing if no session is active", () => {
      session.recordActivity(); // Should not throw
      expect(session.getIdleDuration()).toBe(0);
    });

    it("prevents session expiration when activity is regular", () => {
      session.startSession("user-1");

      // Simulate regular activity every 5 minutes
      for (let i = 0; i < 10; i++) {
        currentTime += 5 * 60 * 1000;
        session.recordActivity();
      }

      expect(session.isSessionExpired()).toBe(false);
    });
  });

  describe("isSessionExpired", () => {
    it("returns true when no session has been started", () => {
      expect(session.isSessionExpired()).toBe(true);
    });

    it("returns false for active session within timeout", () => {
      session.startSession("user-1");
      currentTime += 29 * 60 * 1000; // 29 minutes (just under 30 min timeout)
      expect(session.isSessionExpired()).toBe(false);
    });

    it("returns true when idle time exceeds timeout", () => {
      session.startSession("user-1");
      currentTime += 30 * 60 * 1000; // Exactly 30 minutes
      expect(session.isSessionExpired()).toBe(true);
    });

    it("returns true when well past timeout", () => {
      session.startSession("user-1");
      currentTime += 60 * 60 * 1000; // 60 minutes
      expect(session.isSessionExpired()).toBe(true);
    });

    it("respects activity resetting the timer", () => {
      session.startSession("user-1");
      currentTime += 25 * 60 * 1000; // 25 minutes
      session.recordActivity(); // Reset timer

      currentTime += 25 * 60 * 1000; // 25 more minutes (total 50, but 25 since activity)
      expect(session.isSessionExpired()).toBe(false);

      currentTime += 6 * 60 * 1000; // 6 more minutes (31 since activity)
      expect(session.isSessionExpired()).toBe(true);
    });
  });

  describe("getIdleDuration", () => {
    it("returns 0 when no session is active", () => {
      expect(session.getIdleDuration()).toBe(0);
    });

    it("returns time since last activity", () => {
      session.startSession("user-1");
      currentTime += 5 * 60 * 1000; // 5 minutes
      expect(session.getIdleDuration()).toBe(5 * 60 * 1000);
    });

    it("resets when activity is recorded", () => {
      session.startSession("user-1");
      currentTime += 10 * 60 * 1000;
      session.recordActivity();

      currentTime += 3 * 60 * 1000;
      expect(session.getIdleDuration()).toBe(3 * 60 * 1000);
    });
  });

  describe("shouldRotateToken", () => {
    it("returns false when no session is active", () => {
      expect(session.shouldRotateToken()).toBe(false);
    });

    it("returns false immediately after session start", () => {
      session.startSession("user-1");
      expect(session.shouldRotateToken()).toBe(false);
    });

    it("returns true when rotation interval has elapsed", () => {
      session.startSession("user-1");
      currentTime += 15 * 60 * 1000; // 15 minutes (rotation interval)
      expect(session.shouldRotateToken()).toBe(true);
    });

    it("returns false after rotation is marked", () => {
      session.startSession("user-1");
      currentTime += 15 * 60 * 1000;
      expect(session.shouldRotateToken()).toBe(true);

      session.markTokenRotated();
      expect(session.shouldRotateToken()).toBe(false);
    });

    it("returns false if session is expired", () => {
      session.startSession("user-1");
      currentTime += 31 * 60 * 1000; // Past timeout
      expect(session.shouldRotateToken()).toBe(false);
    });

    it("tracks multiple rotation cycles", () => {
      session.startSession("user-1");
      session.recordActivity(); // Keep alive

      // First rotation due
      currentTime += 15 * 60 * 1000;
      session.recordActivity();
      expect(session.shouldRotateToken()).toBe(true);
      session.markTokenRotated();
      expect(session.shouldRotateToken()).toBe(false);

      // Second rotation due
      currentTime += 15 * 60 * 1000;
      session.recordActivity();
      expect(session.shouldRotateToken()).toBe(true);
    });
  });

  describe("getSessionState", () => {
    it("returns inactive state when no session exists", () => {
      const state = session.getSessionState();
      expect(state.active).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.startedAt).toBeNull();
      expect(state.lastActivityAt).toBeNull();
      expect(state.expired).toBe(false);
    });

    it("returns active state for current session", () => {
      session.startSession("user-1");
      currentTime += 5000;

      const state = session.getSessionState();
      expect(state.active).toBe(true);
      expect(state.userId).toBe("user-1");
      expect(state.expired).toBe(false);
      expect(state.idleDurationMs).toBe(5000);
    });

    it("returns expired state for timed-out session", () => {
      session.startSession("user-1");
      currentTime += 31 * 60 * 1000;

      const state = session.getSessionState();
      expect(state.active).toBe(false);
      expect(state.userId).toBe("user-1");
      expect(state.expired).toBe(true);
    });
  });

  describe("getTokenRotationState", () => {
    it("returns initial state when no session exists", () => {
      const state = session.getTokenRotationState();
      expect(state.shouldRotate).toBe(false);
      expect(state.timeSinceLastRotationMs).toBe(0);
      expect(state.timeUntilRotationMs).toBe(15 * 60 * 1000);
    });

    it("tracks time since last rotation", () => {
      session.startSession("user-1");
      currentTime += 5 * 60 * 1000;

      const state = session.getTokenRotationState();
      expect(state.timeSinceLastRotationMs).toBe(5 * 60 * 1000);
      expect(state.timeUntilRotationMs).toBe(10 * 60 * 1000);
    });

    it("indicates rotation is due", () => {
      session.startSession("user-1");
      currentTime += 16 * 60 * 1000;

      const state = session.getTokenRotationState();
      expect(state.shouldRotate).toBe(true);
      expect(state.timeUntilRotationMs).toBe(0);
    });
  });

  describe("endSession", () => {
    it("clears all session state", () => {
      session.startSession("user-1");
      session.endSession();

      const state = session.getSessionState();
      expect(state.active).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.startedAt).toBeNull();
    });

    it("marks session as expired after ending", () => {
      session.startSession("user-1");
      session.endSession();
      expect(session.isSessionExpired()).toBe(true);
    });
  });

  describe("configurable timeout", () => {
    it("respects custom timeout duration", () => {
      const shortSession = new SessionManager({
        timeoutMs: 5000, // 5 seconds
        now: () => currentTime,
      });

      shortSession.startSession("user-1");
      currentTime += 4999;
      expect(shortSession.isSessionExpired()).toBe(false);

      currentTime += 1;
      expect(shortSession.isSessionExpired()).toBe(true);
    });

    it("respects custom rotation interval", () => {
      const fastRotation = new SessionManager({
        timeoutMs: 60000,
        rotationIntervalMs: 5000, // 5 seconds
        now: () => currentTime,
      });

      fastRotation.startSession("user-1");
      currentTime += 5000;
      expect(fastRotation.shouldRotateToken()).toBe(true);
    });
  });
});
