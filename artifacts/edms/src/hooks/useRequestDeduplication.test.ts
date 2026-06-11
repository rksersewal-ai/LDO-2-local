import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  useRequestDeduplication,
  deduplicateRequest,
  generateRequestKey,
  getGlobalInflightCount,
  clearGlobalInflightMap,
} from "./useRequestDeduplication";

describe("useRequestDeduplication", () => {
  beforeEach(() => {
    clearGlobalInflightMap();
  });

  describe("generateRequestKey", () => {
    it("should generate a unique key from URL and params", () => {
      const key = generateRequestKey("/api/docs", { page: 1, sort: "name" });
      expect(key).toBe('/api/docs::{"page":1,"sort":"name"}');
    });

    it("should produce the same key regardless of param insertion order", () => {
      const key1 = generateRequestKey("/api/docs", { b: 2, a: 1 });
      const key2 = generateRequestKey("/api/docs", { a: 1, b: 2 });
      expect(key1).toBe(key2);
    });

    it("should produce different keys for different URLs", () => {
      const key1 = generateRequestKey("/api/docs", { page: 1 });
      const key2 = generateRequestKey("/api/search", { page: 1 });
      expect(key1).not.toBe(key2);
    });

    it("should produce different keys for different params", () => {
      const key1 = generateRequestKey("/api/docs", { page: 1 });
      const key2 = generateRequestKey("/api/docs", { page: 2 });
      expect(key1).not.toBe(key2);
    });
  });

  describe("deduplicateRequest (standalone)", () => {
    it("should deduplicate concurrent identical requests", async () => {
      const fetcher = vi.fn().mockResolvedValue("result");

      const promise1 = deduplicateRequest("/api/docs", { id: 1 }, fetcher);
      const promise2 = deduplicateRequest("/api/docs", { id: 1 }, fetcher);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe("result");
      expect(result2).toBe("result");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("should allow different requests to proceed independently", async () => {
      const fetcher1 = vi.fn().mockResolvedValue("result1");
      const fetcher2 = vi.fn().mockResolvedValue("result2");

      const promise1 = deduplicateRequest("/api/docs", { id: 1 }, fetcher1);
      const promise2 = deduplicateRequest("/api/docs", { id: 2 }, fetcher2);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe("result1");
      expect(result2).toBe("result2");
      expect(fetcher1).toHaveBeenCalledTimes(1);
      expect(fetcher2).toHaveBeenCalledTimes(1);
    });

    it("should clean up after request completes", async () => {
      const fetcher = vi.fn().mockResolvedValue("done");

      await deduplicateRequest("/api/docs", { id: 1 }, fetcher);
      expect(getGlobalInflightCount()).toBe(0);
    });

    it("should clean up after request fails", async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(
        deduplicateRequest("/api/docs", { id: 1 }, fetcher),
      ).rejects.toThrow("fail");

      expect(getGlobalInflightCount()).toBe(0);
    });

    it("should allow retrying after a failed request", async () => {
      const fetcher1 = vi.fn().mockRejectedValue(new Error("fail"));
      const fetcher2 = vi.fn().mockResolvedValue("success");

      await expect(
        deduplicateRequest("/api/docs", { id: 1 }, fetcher1),
      ).rejects.toThrow("fail");

      const result = await deduplicateRequest("/api/docs", { id: 1 }, fetcher2);
      expect(result).toBe("success");
    });
  });

  describe("useRequestDeduplication hook", () => {
    it("should deduplicate concurrent identical requests", async () => {
      const { result } = renderHook(() => useRequestDeduplication());
      const fetcher = vi.fn().mockResolvedValue("data");

      let result1: string | undefined;
      let result2: string | undefined;

      await act(async () => {
        const promise1 = result.current.deduplicate("/api/docs", { page: 1 }, fetcher);
        const promise2 = result.current.deduplicate("/api/docs", { page: 1 }, fetcher);
        [result1, result2] = await Promise.all([promise1, promise2]);
      });

      expect(result1).toBe("data");
      expect(result2).toBe("data");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("should allow different requests to proceed", async () => {
      const { result } = renderHook(() => useRequestDeduplication());
      const fetcher1 = vi.fn().mockResolvedValue("data1");
      const fetcher2 = vi.fn().mockResolvedValue("data2");

      let res1: string | undefined;
      let res2: string | undefined;

      await act(async () => {
        const p1 = result.current.deduplicate("/api/docs", { page: 1 }, fetcher1);
        const p2 = result.current.deduplicate("/api/docs", { page: 2 }, fetcher2);
        [res1, res2] = await Promise.all([p1, p2]);
      });

      expect(res1).toBe("data1");
      expect(res2).toBe("data2");
      expect(fetcher1).toHaveBeenCalledTimes(1);
      expect(fetcher2).toHaveBeenCalledTimes(1);
    });

    it("should report inflight count", async () => {
      const { result } = renderHook(() => useRequestDeduplication());

      let resolve: (value: string) => void;
      const pending = new Promise<string>((r) => { resolve = r; });
      const fetcher = vi.fn().mockReturnValue(pending);

      await act(async () => {
        result.current.deduplicate("/api/docs", { id: 1 }, fetcher);
      });

      expect(result.current.getInflightCount()).toBe(1);

      await act(async () => {
        resolve!("done");
        await pending;
      });

      expect(result.current.getInflightCount()).toBe(0);
    });

    it("should clear all inflight tracking", async () => {
      const { result } = renderHook(() => useRequestDeduplication());

      let resolve: (value: string) => void;
      const pending = new Promise<string>((r) => { resolve = r; });
      const fetcher = vi.fn().mockReturnValue(pending);

      await act(async () => {
        result.current.deduplicate("/api/docs", { id: 1 }, fetcher);
      });

      expect(result.current.getInflightCount()).toBe(1);

      act(() => {
        result.current.clear();
      });

      expect(result.current.getInflightCount()).toBe(0);

      // Resolve to avoid unhandled promise
      resolve!("done");
    });

    it("should clean up on unmount", async () => {
      const { result, unmount } = renderHook(() => useRequestDeduplication());

      let resolve: (value: string) => void;
      const pending = new Promise<string>((r) => { resolve = r; });
      const fetcher = vi.fn().mockReturnValue(pending);

      await act(async () => {
        result.current.deduplicate("/api/docs", { id: 1 }, fetcher);
      });

      unmount();

      // Should not throw after unmount
      resolve!("done");
    });
  });
});
