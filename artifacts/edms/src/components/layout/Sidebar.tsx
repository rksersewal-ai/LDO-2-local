import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CheckSquare,
  ClipboardList,
  Component,
  CopyCheck,
  DatabaseBackup,
  FileBarChart,
  FileCheck2,
  FolderOpen,
  Layers3,
  LayoutDashboard,
  Megaphone,
  MonitorCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ServerCog,
  Settings,
  ShieldAlert,
  Telescope,
  Users,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import type { UserRole } from "../../lib/auth";
import { useAuth } from "../../lib/auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  roles?: UserRole[];
  exact?: boolean;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "General",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Telescope, label: "Global Search", path: "/search" },
      { icon: FolderOpen, label: "Documents", path: "/documents" },
    ],
  },
  {
    label: "Tasks",
    items: [
      {
        icon: CheckSquare,
        label: "Approvals",
        path: "/approvals",
        roles: ["admin", "supervisor", "engineer", "reviewer"],
      },
      {
        icon: Briefcase,
        label: "Work Ledger",
        path: "/ledger",
        roles: ["admin", "supervisor", "engineer"],
      },
      {
        icon: ShieldAlert,
        label: "Cases",
        path: "/cases",
        roles: ["admin", "supervisor", "engineer", "reviewer"],
      },
    ],
  },
  {
    label: "Pages",
    items: [
      {
        icon: Component,
        label: "BOM",
        path: "/bom",
        roles: ["admin", "supervisor", "engineer"],
      },
      {
        icon: DatabaseBackup,
        label: "PL Knowledge",
        path: "/pl",
        roles: ["admin", "supervisor", "engineer"],
      },
      {
        icon: BarChart3,
        label: "Reports",
        path: "/reports",
        roles: ["admin", "supervisor"],
      },
      {
        icon: FileBarChart,
        label: "Ledger Reports",
        path: "/ledger-reports",
        roles: ["admin", "supervisor"],
      },
    ],
  },
  {
    label: "Users",
    items: [
      { icon: Users, label: "User Management", path: "/admin/users", roles: ["admin"] },
      { icon: ShieldAlert, label: "Profile", path: "/profile" },
      { icon: Bell, label: "Notifications", path: "/notifications" },
    ],
  },
  {
    label: "Settings",
    items: [
      { icon: Bell, label: "Alert Rules", path: "/alerts" },
      { icon: FileCheck2, label: "Templates", path: "/templates" },
      {
        icon: ServerCog,
        label: "Admin",
        path: "/admin",
        roles: ["admin"],
        exact: true,
      },
      {
        icon: Layers3,
        label: "Initial Run",
        path: "/admin/initial-run",
        roles: ["admin"],
      },
      {
        icon: Settings,
        label: "System Settings",
        path: "/settings",
        roles: ["admin"],
      },
      { icon: Megaphone, label: "Banners", path: "/banners", roles: ["admin"] },
    ],
  },
  {
    label: "Developers",
    items: [
      {
        icon: CopyCheck,
        label: "Deduplication",
        path: "/admin/deduplication",
        roles: ["admin"],
      },
      { icon: Activity, label: "OCR Monitor", path: "/ocr", roles: ["admin"] },
      {
        icon: MonitorCheck,
        label: "System Health",
        path: "/health",
        roles: ["admin"],
      },
      {
        icon: ClipboardList,
        label: "Audit Log",
        path: "/audit",
        roles: ["admin"],
      },
      {
        icon: BookOpen,
        label: "Design System",
        path: "/design-system",
        roles: ["admin"],
      },
    ],
  },
];

const NAV_EXPANDED = 248;
const NAV_COLLAPSED = 64;

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ isExpanded, onToggle }: SidebarProps) {
  const location = useLocation();
  const { hasPermission } = useAuth();

  return (
    <aside
      style={{ width: isExpanded ? NAV_EXPANDED : NAV_COLLAPSED }}
      className="workspace-rail relative z-40 flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
    >
      {/* ── Logo + collapse toggle ────────────────────────────────────────── */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3">
        {/* Brand mark */}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 overflow-hidden",
            !isExpanded && "justify-center",
          )}
        >
          {/* Logo badge */}
          <img
            src="/sidebar-logo.png"
            alt="LDO-2"
            className="relative h-8 w-8 shrink-0 rounded-md border border-sidebar-border bg-card object-contain p-1 select-none"
          />
          {isExpanded && (
            <div className="overflow-hidden whitespace-nowrap">
              <p className="text-sm font-semibold leading-tight text-sidebar-foreground">
                LDO-2 EDMS
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] leading-tight text-muted-foreground">
                Admin Console
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle (only in expanded state) */}
        {isExpanded && (
          <button
            type="button"
            onClick={onToggle}
            title="Collapse navigation"
            aria-label="Collapse navigation"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-sidebar-foreground/50 transition-colors duration-150 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftClose className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>

      {/* ── Expand toggle (collapsed state only) ─────────────────────────── */}
      {!isExpanded && (
        <button
          type="button"
          onClick={onToggle}
          title="Expand navigation"
          aria-label="Expand navigation"
          className="mx-auto mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-sidebar-foreground/50 transition-colors duration-150 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <PanelLeftOpen className="h-[15px] w-[15px]" />
        </button>
      )}

      {/* ── Nav scroll area ─────────────────────────────────────────────── */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2 thin-scrollbar">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || hasPermission(item.roles),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {/* Section label */}
              {isExpanded ? (
                <div className="nav-section-label">{group.label}</div>
              ) : (
                <div className="mx-3 my-2 h-px bg-sidebar-border" />
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/"
                    : item.exact
                      ? location.pathname === item.path
                      : location.pathname.startsWith(item.path);

                const link = (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative mx-2 flex h-8 items-center gap-2 rounded-md border text-[13px] transition-colors duration-150",
                      isExpanded ? "px-3" : "justify-center px-0",
                      isActive
                        ? "border-sidebar-border bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "border-transparent text-sidebar-foreground/65 hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                    )}
                  >
                    {/* Active left indicator */}
                    {isActive && (
                      <span className="absolute left-1 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
                    )}

                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-100",
                        isActive
                          ? "text-sidebar-primary"
                          : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                      )}
                    />

                    {isExpanded && (
                      <span className="flex-1 overflow-hidden whitespace-nowrap text-[13px] leading-none tracking-[0.005em]">
                        {item.label}
                      </span>
                    )}

                    {isExpanded && item.badge != null && item.badge > 0 && (
                      <span
                        className="ml-auto shrink-0 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center"
                        style={{
                          background: "color-mix(in oklab, var(--sidebar-primary) 20%, transparent)",
                          color: "var(--sidebar-primary)",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );

                if (!isExpanded) {
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }

                return link;
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
