import { describe, it, expect, vi } from "vitest";
import { createCleanupScope, withCleanup } from "./safeCleanup";

describe("safeCleanup", () => {
  describe("createCleanupScope", () => {
    it("creates a scope with zero registered cleanups", () => {
      const scope = createCleanupScope();
      expect(scope.size).toBe(0);
      expect(scope.disposed).toBe(false);
    });

    it("registers cleanup functions", () => {
      const scope = createCleanupScope();
      scope.register(() => {});
      scope.register(() => {});
      expect(scope.size).toBe(2);
    });

    it("executes cleanups in reverse order (LIFO)", async () => {
      const order: number[] = [];
      const scope = createCleanupScope();

      scope.register(() => { order.push(1); });
      scope.register(() => { order.push(2); });
      scope.register(() => { order.push(3); });

      await scope.cleanup();
      expect(order).toEqual([3, 2, 1]);
    });

    it("returns success result when all cleanups pass", async () => {
      const scope = createCleanupScope();
      scope.register(() => {});
      scope.register(() => {});

      const result = await scope.cleanup();
      expect(result.success).toBe(true);
      expect(result.totalRegistered).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("continues executing remaining cleanups when one fails", async () => {
      const scope = createCleanupScope();
      const executed: string[] = [];

      scope.register(() => { executed.push("first"); });
      scope.register(() => { throw new Error("middle fails"); });
      scope.register(() => { executed.push("last"); });

      const result = await scope.cleanup();

      // LIFO: last, middle (fails), first
      expect(executed).toContain("first");
      expect(executed).toContain("last");
      expect(result.success).toBe(false);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    it("captures error details for failed cleanups", async () => {
      const scope = createCleanupScope();
      scope.register(() => { throw new Error("cleanup error"); });

      const result = await scope.cleanup();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("cleanup error");
      expect(result.errors[0].index).toBe(0);
      expect(result.errors[0].error).toBeInstanceOf(Error);
    });

    it("handles multiple failures without aborting", async () => {
      const scope = createCleanupScope();
      scope.register(() => { throw new Error("error-1"); });
      scope.register(() => { throw new Error("error-2"); });
      scope.register(() => { throw new Error("error-3"); });

      const result = await scope.cleanup();
      expect(result.failureCount).toBe(3);
      expect(result.successCount).toBe(0);
      expect(result.errors).toHaveLength(3);
    });

    it("supports async cleanup functions", async () => {
      const scope = createCleanupScope();
      const executed: string[] = [];

      scope.register(async () => {
        await Promise.resolve();
        executed.push("async-1");
      });
      scope.register(async () => {
        await Promise.resolve();
        executed.push("async-2");
      });

      const result = await scope.cleanup();
      expect(result.success).toBe(true);
      expect(executed).toEqual(["async-2", "async-1"]);
    });

    it("marks scope as disposed after cleanup", async () => {
      const scope = createCleanupScope();
      scope.register(() => {});

      expect(scope.disposed).toBe(false);
      await scope.cleanup();
      expect(scope.disposed).toBe(true);
    });

    it("throws when registering on a disposed scope", async () => {
      const scope = createCleanupScope();
      await scope.cleanup();

      expect(() => scope.register(() => {})).toThrow("disposed scope");
    });

    it("returns empty result when cleanup is called on disposed scope", async () => {
      const scope = createCleanupScope();
      scope.register(() => {});
      await scope.cleanup();

      const result = await scope.cleanup(); // Second call
      expect(result.success).toBe(true);
      expect(result.totalRegistered).toBe(0);
    });

    it("dispose is an alias for cleanup", async () => {
      const scope = createCleanupScope();
      const fn = vi.fn();
      scope.register(fn);

      await scope.dispose();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(scope.disposed).toBe(true);
    });

    it("handles non-Error throws in cleanup functions", async () => {
      const scope = createCleanupScope();
      scope.register(() => {
        throw "string error"; // eslint-disable-line no-throw-literal
      });

      const result = await scope.cleanup();
      expect(result.errors[0].message).toBe("string error");
    });
  });

  describe("withCleanup", () => {
    it("returns result on success", async () => {
      const outcome = await withCleanup(async (scope) => {
        scope.register(() => {});
        return "done";
      });

      expect(outcome.result).toBe("done");
      expect(outcome.error).toBeUndefined();
      expect(outcome.cleanup.success).toBe(true);
    });

    it("captures error and still runs cleanup", async () => {
      const cleanupFn = vi.fn();

      const outcome = await withCleanup(async (scope) => {
        scope.register(cleanupFn);
        throw new Error("work failed");
      });

      expect(outcome.error).toBeInstanceOf(Error);
      expect(outcome.result).toBeUndefined();
      expect(cleanupFn).toHaveBeenCalledTimes(1);
      expect(outcome.cleanup.success).toBe(true);
    });

    it("runs cleanup even when no error occurs", async () => {
      const cleanupFn = vi.fn();

      const outcome = await withCleanup(async (scope) => {
        scope.register(cleanupFn);
        return 42;
      });

      expect(outcome.result).toBe(42);
      expect(cleanupFn).toHaveBeenCalledTimes(1);
    });

    it("reports cleanup failures alongside the result", async () => {
      const outcome = await withCleanup(async (scope) => {
        scope.register(() => { throw new Error("cleanup boom"); });
        return "ok";
      });

      expect(outcome.result).toBe("ok");
      expect(outcome.cleanup.success).toBe(false);
      expect(outcome.cleanup.failureCount).toBe(1);
    });
  });
});
