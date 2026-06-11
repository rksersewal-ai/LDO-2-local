import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test crash");
  return <div>Working content</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors in tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary name="Test">
        <div>Hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary name="TestWidget">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("TestWidget encountered an error")).toBeInTheDocument();
    expect(screen.getByText("Test crash")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary name="Test" onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test crash" }),
      expect.anything(),
    );
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary name="Test" fallback={(error) => <div>Custom: {error.message}</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom: Test crash")).toBeInTheDocument();
  });

  it("resets error state when retry is clicked", () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary name="Test" onReset={onReset}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Click retry
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
