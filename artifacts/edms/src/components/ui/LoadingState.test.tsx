import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingCard, LoadingRows, LoadingState } from "./LoadingState";

describe("LoadingState", () => {
  it("renders with default message", () => {
    render(<LoadingState />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders with custom message", () => {
    render(<LoadingState message="Fetching documents..." />);
    expect(screen.getByText("Fetching documents...")).toBeInTheDocument();
  });

  it("renders spinner element", () => {
    const { container } = render(<LoadingState />);
    // The spinner has an animated border
    const spinner = container.querySelector("[style*='animation']");
    expect(spinner).toBeInTheDocument();
  });

  it("applies size classes correctly", () => {
    const { container: sm } = render(<LoadingState size="sm" />);
    const { container: lg } = render(<LoadingState size="lg" />);

    expect(sm.firstChild).toHaveClass("py-6");
    expect(lg.firstChild).toHaveClass("py-14");
  });
});

describe("LoadingRows", () => {
  it("renders default 5 skeleton rows", () => {
    const { container } = render(<LoadingRows />);
    const rows = container.querySelectorAll(".animate-pulse");
    expect(rows.length).toBe(5);
  });

  it("renders custom count", () => {
    const { container } = render(<LoadingRows count={3} />);
    const rows = container.querySelectorAll(".animate-pulse");
    expect(rows.length).toBe(3);
  });
});

describe("LoadingCard", () => {
  it("renders skeleton card with animated bars", () => {
    const { container } = render(<LoadingCard />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
