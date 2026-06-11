import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./ToastContext";

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("ToastContext", () => {
  it("starts with no toasts", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("addToast creates a toast with correct type", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast("Test message", "success");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Test message");
    expect(result.current.toasts[0].type).toBe("success");
  });

  it("removeToast removes a toast by id", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let toastId: string;
    act(() => {
      toastId = result.current.addToast("To be removed", "info");
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("showSuccess creates a success toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showSuccess("Saved!");
    });

    expect(result.current.toasts[0].type).toBe("success");
    expect(result.current.toasts[0].message).toBe("Saved!");
  });

  it("showError creates an error toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showError("Something went wrong");
    });

    expect(result.current.toasts[0].type).toBe("error");
  });

  it("showWarning creates a warning toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showWarning("Careful!");
    });

    expect(result.current.toasts[0].type).toBe("warning");
  });

  it("multiple toasts accumulate", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showSuccess("First");
      result.current.showError("Second");
      result.current.showInfo("Third");
    });

    expect(result.current.toasts).toHaveLength(3);
  });
});
