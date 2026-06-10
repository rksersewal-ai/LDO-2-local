import {
  AlertTriangle,
  ArrowRight,
  Bell,
  LifeBuoy,
  LogOut,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Type,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { useTheme } from "../../contexts/ThemeContext";
import { useAppInbox } from "../../hooks/useAppInbox";
import { useDocumentChangeAlerts } from "../../hooks/useDocumentChangeAlerts";
import { useAuth } from "../../lib/auth";
import type { InboxAction } from "../../lib/inboxActions";
import type { AppInboxItem } from "../../lib/types";
import { InboxService } from "../../services/InboxService";
import { PreferencesService, type UserPreferences } from "../../services/PreferencesService";
import { CommandPalette } from "../ui/CommandPalette";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { NotificationPanel } from "./NotificationPanel";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  documents: "Document Hub",
  search: "Search Explorer",
  bom: "BOM Explorer",
  pl: "PL Knowledge Hub",
  ledger: "Work Ledger",
  cases: "Cases",
  approvals: "Approvals",
  reports: "Reports",
  "ledger-reports": "Ledger Reports",
  alerts: "Alert Rules",
  templates: "Doc Templates",
  admin: "Administration",
  ocr: "OCR Monitor",
  health: "System Health",
  audit: "Audit Log",
  banners: "Banners",
  settings: "Settings",
  "design-system": "Design System",
  profile: "Profile",
  notifications: "Notifications",
};

function segmentLabel(seg: string): string {
  return ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { alerts: documentChangeAlerts, approveAlert, bypassAlert } = useDocumentChangeAlerts();
  const { items: inboxItems, source: inboxSource, refresh: refreshInbox } = useAppInbox();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showTextControls, setShowTextControls] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(() => PreferencesService.get());
  const [commandOpen, setCommandOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [busyInboxActionId, setBusyInboxActionId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const paths = location.pathname.split("/").filter(Boolean);
  const standardInboxItems = inboxItems.filter((item) => item.type !== "supervisor_review");
  const unreadCount = standardInboxItems.length + documentChangeAlerts.length;

  const getBreadcrumbPath = (index: number): string => {
    if (index === 0) return "/";
    return `/${paths.slice(0, index).join("/")}`;
  };

  const breadcrumbs = [
    { label: "Home", path: "/" },
    ...paths.map((seg, i) => ({
      label: segmentLabel(seg),
      path: getBreadcrumbPath(i + 1),
    })),
  ];

  const pageTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? "Dashboard";
  const isLightTheme = theme === "light";
  const fontSize = preferences.fontSize;
  const contextualGuide = (() => {
    if (location.pathname.startsWith("/documents")) {
      return {
        title: "Document control workflow",
        summary:
          "Keep release decisions, archive moves, and PL linkage inside the same operating lane.",
        tips: [
          "Bulk-select release candidates before opening the approval queue.",
          "Use OCR and status filters to isolate exception-heavy files first.",
          "Open preview before final release when a revision is under review.",
        ],
        actionLabel: "Open Document Templates",
        actionPath: "/templates",
      };
    }
    if (location.pathname.startsWith("/search")) {
      return {
        title: "Cross-entity search tips",
        summary: "Search now deep-links directly into documents, work records, and cases.",
        tips: [
          "Use duplicate-aware filters when reconciling document families.",
          "Switch scope after the first broad query to reduce operator noise.",
          "Save recurring queries for compliance, release, and failure analysis.",
        ],
        actionLabel: "Open Document Hub",
        actionPath: "/documents",
      };
    }
    if (location.pathname.startsWith("/approvals")) {
      return {
        title: "Approval queue guide",
        summary: "Work newest release blockers first, then clear lower-risk document requests.",
        tips: [
          "Pending items from Document Hub land here automatically.",
          "Use the linked document preview before approving or rejecting.",
          "Switch to All when you need full disposition context for the lane.",
        ],
        actionLabel: "Review Approvals",
        actionPath: "/approvals",
      };
    }
    if (location.pathname.startsWith("/ledger")) {
      return {
        title: "Work ledger habits",
        summary: "Keep records complete, linked to PLs, and verified before closure.",
        tips: [
          "Open the focused record from search results using the `id` query.",
          "Use the category chips to separate daily operational work from exceptions.",
          "Lock verified items to preserve a clean audit trail.",
        ],
        actionLabel: "Open Reports",
        actionPath: "/ledger-reports",
      };
    }
    return {
      title: "Workspace orientation",
      summary:
        "Use the role-aware shell to move between search, document control, workflow, and system health.",
      tips: [
        "The command palette is the fastest way to navigate or reopen records.",
        "Notifications combine inbox tasks and change alerts in one queue.",
        "Profile settings control text size, clock visibility, and motion preferences.",
      ],
      actionLabel: "Open Search Explorer",
      actionPath: "/search",
    };
  })();

  const applyPreferences = (prefs: UserPreferences) => {
    setPreferences(prefs);
    document.documentElement.style.setProperty("--app-font-size", `${prefs.fontSize}px`);
    document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
  };

  const adjustFontSize = (delta: number) => {
    const next = Math.max(12, Math.min(18, fontSize + delta));
    applyPreferences(PreferencesService.set({ fontSize: next }));
  };

  const resetFontSize = () => applyPreferences(PreferencesService.set({ fontSize: 14 }));

  const closeFloatingPanels = () => {
    setShowNotifications(false);
    setShowTextControls(false);
    setShowProfile(false);
    setShowHelp(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleInboxWorkflowAction = async (notification: AppInboxItem, action: InboxAction) => {
    setBusyInboxActionId(`${notification.id}:${action.key}`);
    try {
      await InboxService.actOnItem(notification.id, action.payload);
      await refreshInbox();
    } catch (error) {
      console.error("[Header] Failed inbox workflow action", error);
    } finally {
      setBusyInboxActionId(null);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!showTextControls && !showNotifications && !showProfile && !showHelp) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      closeFloatingPanels();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showNotifications, showProfile, showTextControls, showHelp]);

  useEffect(() => {
    applyPreferences(PreferencesService.get());
    let disposed = false;
    const unsubscribe = PreferencesService.subscribe((prefs) => {
      window.setTimeout(() => {
        if (!disposed) {
          applyPreferences(prefs);
        }
      }, 0);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!preferences.showLiveClock) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [preferences.showLiveClock]);

  const clockLabel = now.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: preferences.timeFormat === "24h" ? "2-digit" : undefined,
    hour12: preferences.timeFormat === "12h",
  });

  /* Ghost icon button — no border, clean hover */
  const ghostBtn = (active: boolean) =>
    cn(
      "flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150",
      active
        ? "border-border bg-secondary text-foreground"
        : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
    );

  /* User initials */
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      <div ref={headerRef} className="shrink-0">
        {/* ── System announcement banner ───────────────────────────────── */}
        {showBanner && (
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-b px-4 py-1.5",
              isLightTheme ? "border-border bg-card" : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isLightTheme ? "text-amber-700" : "text-amber-400",
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.05em]",
                  isLightTheme ? "text-foreground" : "text-foreground",
                )}
              >
                Maintenance Window
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  isLightTheme ? "text-muted-foreground" : "text-muted-foreground",
                )}
              >
                OCR engine restart scheduled at 03:00 UTC. Expect minor ingestion and preview
                delays.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigate("/ocr");
                  setShowBanner(false);
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  isLightTheme
                    ? "border-border bg-background text-foreground hover:bg-secondary"
                    : "border-border bg-background text-foreground hover:bg-secondary",
                )}
              >
                OCR Monitor
              </button>
              {hasPermission(["admin"]) && (
                <button
                  type="button"
                  onClick={() => {
                    navigate("/health");
                    setShowBanner(false);
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    isLightTheme
                      ? "border-border bg-background text-foreground hover:bg-secondary"
                      : "border-border bg-background text-foreground hover:bg-secondary",
                  )}
                >
                  System Health
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowBanner(false)}
                aria-label="Dismiss banner"
                className={cn(
                  "shrink-0 rounded-md p-1 transition-colors",
                  isLightTheme
                    ? "text-muted-foreground hover:bg-secondary"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <header className="workspace-topbar relative z-30 flex h-14 items-center justify-between gap-3 border-b border-border px-4 pl-14 md:pl-4">
          <div className="min-w-0 shrink-0">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center">
                  {i > 0 && (
                    <span
                      className="mx-2 select-none text-xs text-muted-foreground/40"
                      aria-hidden="true"
                    >
                      /
                    </span>
                  )}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="max-w-[180px] truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(crumb.path)}
                      className="max-w-[110px] truncate text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </button>
                  )}
                </span>
              ))}
            </nav>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <h1 className="truncate text-base font-semibold text-foreground">{pageTitle}</h1>
              <span className="hidden xl:inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {contextualGuide.title}
              </span>
            </div>
          </div>

          {/* Right: utilities */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="mr-1 hidden h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground xl:flex"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="capitalize">{user?.role ?? "viewer"} access</span>
            </button>

            {/* Live clock */}
            {preferences.showLiveClock && (
              <span
                className="mr-1 hidden h-8 items-center rounded-md border border-border bg-background px-2.5 text-[11px] font-medium tabular-nums text-muted-foreground lg:flex"
                aria-live="polite"
              >
                {clockLabel}
              </span>
            )}

            {/* Search trigger */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="workspace-search-trigger hidden h-8 w-44 items-center gap-2 rounded-md border border-border px-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary sm:flex lg:w-56 xl:mr-1 xl:w-72"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">Search records, PLs, work items...</span>
              <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/70 xl:block">
                ⌘K
              </kbd>
            </button>

            {/* Context help */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHelp(!showHelp);
                      setShowNotifications(false);
                      setShowTextControls(false);
                      setShowProfile(false);
                    }}
                    aria-label="Open contextual help"
                    aria-pressed={showHelp}
                    className={ghostBtn(showHelp)}
                  >
                    <LifeBuoy className="h-[15px] w-[15px]" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Context help</TooltipContent>
              </Tooltip>
              {showHelp && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-md animate-fade-in">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                        {pageTitle}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-foreground">
                        {contextualGuide.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {contextualGuide.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowHelp(false)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label="Close contextual help"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {contextualGuide.tips.map((tip) => (
                      <div
                        key={tip}
                        className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
                      >
                        {tip}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(contextualGuide.actionPath);
                      closeFloatingPanels();
                    }}
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    {contextualGuide.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  className={ghostBtn(false)}
                >
                  {theme === "dark" ? (
                    <Sun className="h-[15px] w-[15px]" aria-hidden="true" />
                  ) : (
                    <Moon className="h-[15px] w-[15px]" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            {/* Text size */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTextControls(!showTextControls);
                      setShowNotifications(false);
                      setShowProfile(false);
                    }}
                    aria-label="Text size controls"
                    aria-pressed={showTextControls}
                    className={ghostBtn(showTextControls)}
                  >
                    <Type className="h-[15px] w-[15px]" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Text size</TooltipContent>
              </Tooltip>
              {showTextControls && (
                <div className="absolute right-0 top-full z-50 mt-2 flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-2 shadow-md animate-fade-in">
                  <button
                    type="button"
                    onClick={() => adjustFontSize(-1)}
                    aria-label="Smaller text"
                    className="h-7 w-7 rounded border border-border bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Minus className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <span className="w-7 text-center text-sm font-mono text-foreground tabular-nums">
                    {fontSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustFontSize(+1)}
                    aria-label="Larger text"
                    className="h-7 w-7 rounded border border-border bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={resetFontSize}
                    aria-label="Reset text size"
                    className="h-7 w-7 rounded border border-border bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setShowTextControls(false);
                      setShowProfile(false);
                    }}
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                    aria-pressed={showNotifications}
                    className={cn(ghostBtn(showNotifications), "relative")}
                  >
                    <Bell className="h-[15px] w-[15px]" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span
                        className="absolute -top-0.5 -right-0.5 h-[14px] min-w-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums"
                        aria-hidden="true"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
              {showNotifications && (
                <NotificationPanel
                  onClose={() => setShowNotifications(false)}
                  inboxItems={standardInboxItems}
                  documentChangeAlerts={documentChangeAlerts}
                  onApproveAlert={approveAlert}
                  onBypassAlert={bypassAlert}
                  onWorkflowAction={handleInboxWorkflowAction}
                  actionable={inboxSource === "backend"}
                  busyItemId={busyInboxActionId}
                />
              )}
            </div>

            {/* Divider */}
            <div className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />

            {/* User profile */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProfile(!showProfile);
                  setShowNotifications(false);
                  setShowTextControls(false);
                }}
                aria-label="Profile menu"
                aria-pressed={showProfile}
                aria-expanded={showProfile}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-1.5 pr-2.5 transition-colors duration-150 cursor-pointer",
                  showProfile
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                {/* Avatar circle */}
                <div
                  className="flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-md text-[11px] font-bold"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 18%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {initials}
                </div>
                <div className="text-left hidden md:block leading-tight">
                  <div className="text-[12px] font-semibold text-foreground leading-none">
                    {user?.name ?? "User"}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize leading-none mt-0.5">
                    {user?.role ?? "viewer"}
                  </div>
                </div>
              </button>

              {showProfile && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-card shadow-md animate-fade-in">
                  {/* User info */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <div
                      className="h-9 w-9 rounded-md flex items-center justify-center shrink-0 text-sm font-bold select-none"
                      style={{
                        background: "color-mix(in oklab, var(--primary) 16%, transparent)",
                        color: "var(--primary)",
                      }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.designation}</p>
                      <p className="text-[11px] text-muted-foreground/70 truncate">{user?.email}</p>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/profile");
                        closeFloatingPanels();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-foreground/80 hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
                    >
                      <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Profile Settings
                    </button>
                    {hasPermission(["admin"]) && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/settings");
                          closeFloatingPanels();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-foreground/80 hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
                      >
                        <SettingsIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> System
                        Settings
                      </button>
                    )}
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      </div>
    </>
  );
}
