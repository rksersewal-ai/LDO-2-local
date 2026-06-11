import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: "/reports", search: "" }),
  useNavigate: () => navigateMock,
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAppInbox", () => ({
  useAppInbox: () => ({
    items: [],
    source: "backend",
    refresh: vi.fn(),
  }),
}));

vi.mock("../../hooks/useDocumentChangeAlerts", () => ({
  useDocumentChangeAlerts: () => ({
    alerts: [],
    approveAlert: vi.fn(),
    bypassAlert: vi.fn(),
  }),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      username: "admin",
      name: "Admin User",
      designation: "Administrator",
      role: "admin",
      department: "Engineering",
      email: "admin@example.com",
    },
    logout: vi.fn(),
    hasPermission: () => true,
  }),
}));

vi.mock("../ui/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("../ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./NotificationPanel", () => ({
  NotificationPanel: () => null,
}));

describe("Header", () => {
  it("provides a compact back button that returns to the previous page", () => {
    render(<Header sidebarExpanded={true} onSidebarToggle={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Go back to previous page" }));

    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
