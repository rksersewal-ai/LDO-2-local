import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckSquare,
  ClipboardCopy,
  Command,
  Component,
  Eye,
  FileSearch,
  FileText,
  Hash,
  History,
  Maximize,
  PanelLeftClose,
  RefreshCcw,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTheme } from "../../contexts/ThemeContext";
import { type UserRole, useAuth } from "../../lib/auth";
import { resolveDocumentPreviewPath } from "../../lib/documentPreview";
import { DocumentPreviewService } from "../../services/DocumentPreviewService";
import { NavigationHistoryService } from "../../services/NavigationHistoryService";
import { CommandPalette } from "./CommandPalette";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface PaletteAction {
  id: string;
  group: "context" | "quick" | "navigation" | "workspace" | "tools";
  label: string;
  description: string;
  path?: string;
  icon: ComponentType<{ className?: string }>;
  roles?: UserRole[];
  disabled?: boolean;
  action?: () => void;
}

interface PalettePosition {
  x: number;
  y: number;
}

interface ContextDocumentInfo {
  id: string;
  title: string;
}

const PALETTE_WIDTH = 320;
const PALETTE_MARGIN = 16;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, option, [contenteditable="true"], [data-no-context-palette="true"]',
    ),
  );
}

export function RightClickPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const { toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [position, setPosition] = useState<PalettePosition>({ x: 24, y: 96 });
  const [contextDocument, setContextDocument] = useState<ContextDocumentInfo | null>(null);

  const currentPath = `${location.pathname}${location.search}`;
  const previousPath = NavigationHistoryService.getPreviousPath(currentPath);
  const recentPreview = DocumentPreviewService.getRecentPreview();

  const backAction = useMemo(
    () => ({
      disabled: !previousPath,
      go: () => {
        if (previousPath) {
          setOpen(false);
          setContextDocument(null);
          navigate(previousPath);
        }
      },
    }),
    [previousPath, navigate],
  );

  const actions = useMemo<PaletteAction[]>(
    () =>
      [
        // ── Context (document-specific) ──
        ...(contextDocument
          ? [
              {
                id: "preview-current-document",
                group: "context" as const,
                label: "Preview this document",
                description: contextDocument.title,
                path: resolveDocumentPreviewPath(contextDocument.id),
                icon: Eye,
              },
              {
                id: "open-current-document",
                group: "context" as const,
                label: "Open document details",
                description: `Open ${contextDocument.id} in the full document workspace`,
                path: `/documents/${contextDocument.id}`,
                icon: FileText,
              },
              {
                id: "preview-current-document-tab",
                group: "context" as const,
                label: "Open preview in new tab",
                description: `Detach ${contextDocument.id} into a separate browser tab`,
                icon: FileSearch,
                action: () =>
                  window.open(
                    resolveDocumentPreviewPath(contextDocument.id),
                    "_blank",
                    "noopener,noreferrer",
                  ),
              },
            ]
          : []),
        // ── Quick Actions ──
        {
          id: "copy-url",
          group: "quick" as const,
          label: "Copy page URL",
          description: "Copy current page link to clipboard",
          icon: ClipboardCopy,
          action: () => {
            navigator.clipboard.writeText(window.location.href);
          },
        },
        {
          id: "toggle-theme",
          group: "quick" as const,
          label: "Toggle theme",
          description: "Switch between dark and light mode",
          icon: Sun,
          action: () => {
            toggleTheme();
          },
        },
        {
          id: "fullscreen",
          group: "quick" as const,
          label: "Full screen",
          description: "Enter or exit full-screen mode",
          icon: Maximize,
          action: () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
          },
        },
        {
          id: "toggle-sidebar",
          group: "quick" as const,
          label: "Toggle sidebar",
          description: "Collapse or expand the navigation sidebar",
          icon: PanelLeftClose,
          action: () => {
            window.dispatchEvent(new CustomEvent("toggle-sidebar"));
          },
        },
        // ── Navigation ──
        {
          id: "recent-preview",
          group: "navigation" as const,
          label: "Open recent document preview",
          description: recentPreview
            ? `Reopen ${recentPreview.title}`
            : "No recent preview window has been opened yet",
          path: recentPreview ? resolveDocumentPreviewPath(recentPreview.documentId) : undefined,
          icon: Eye,
          disabled: !recentPreview,
        },
        {
          id: "history",
          group: "navigation" as const,
          label: "Notifications inbox",
          description: "Resume recent workflow actions and alerts",
          path: "/notifications",
          icon: History,
        },
        // ── Workspace ──
        {
          id: "search",
          group: "workspace" as const,
          label: "Search explorer",
          description: "Jump into indexed document and PL search",
          path: "/search",
          icon: FileSearch,
        },
        {
          id: "pl",
          group: "workspace" as const,
          label: "PL knowledge hub",
          description: "Browse and manage PL-controlled items",
          path: "/pl",
          icon: Hash,
          roles: ["admin", "supervisor", "engineer"] as UserRole[],
        },
        {
          id: "ledger",
          group: "workspace" as const,
          label: "Work ledger",
          description: "Go to the work ledger and create a new entry",
          path: "/ledger",
          icon: Briefcase,
          roles: ["admin", "supervisor", "engineer"] as UserRole[],
        },
        {
          id: "bom",
          group: "workspace" as const,
          label: "BOM workspace",
          description: "Start a new BOM draft from the guided creation page",
          path: "/bom/new",
          icon: Component,
          roles: ["admin", "supervisor", "engineer"] as UserRole[],
        },
        {
          id: "approvals",
          group: "workspace" as const,
          label: "Approvals",
          description: "Open the approvals queue",
          path: "/approvals",
          icon: CheckSquare,
          roles: ["admin", "supervisor", "engineer", "reviewer"] as UserRole[],
        },
        {
          id: "cases",
          group: "workspace" as const,
          label: "Cases",
          description: "Open the cases dashboard",
          path: "/cases",
          icon: ShieldAlert,
          roles: ["admin", "supervisor", "engineer", "reviewer"] as UserRole[],
        },
        // ── Tools ──
        {
          id: "refresh",
          group: "tools" as const,
          label: "Refresh current view",
          description: "Reload the active route and data surface",
          icon: RefreshCcw,
          action: () => window.location.reload(),
        },
        {
          id: "command",
          group: "tools" as const,
          label: "Command palette",
          description: "Keyboard-style navigation (⌘K)",
          icon: Command,
          action: () => setCommandOpen(true),
        },
      ].filter((action) => !action.roles || hasPermission(action.roles)),
    [contextDocument, hasPermission, previousPath, recentPreview, toggleTheme],
  );

  const groupedActions = useMemo(() => {
    return {
      context: actions.filter((action) => action.group === "context"),
      quick: actions.filter((action) => action.group === "quick"),
      navigation: actions.filter((action) => action.group === "navigation"),
      workspace: actions.filter((action) => action.group === "workspace"),
      tools: actions.filter((action) => action.group === "tools"),
    };
  }, [actions]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const targetDocument =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>("[data-document-id]")
          : null;

      if (event.shiftKey || (isInteractiveTarget(event.target) && !targetDocument)) {
        return;
      }

      event.preventDefault();

      const maxX = Math.max(PALETTE_MARGIN, window.innerWidth - PALETTE_WIDTH - PALETTE_MARGIN);
      const nextX = Math.min(event.clientX, maxX);
      const nextY = Math.min(event.clientY, window.innerHeight - 280);

      setPosition({
        x: Math.max(PALETTE_MARGIN, nextX),
        y: Math.max(88, nextY),
      });
      setContextDocument(
        targetDocument?.dataset.documentId
          ? {
              id: targetDocument.dataset.documentId,
              title: targetDocument.dataset.documentTitle || targetDocument.dataset.documentId,
            }
          : null,
      );
      setOpen(true);
    };

    const handleDismiss = () => {
      setOpen(false);
      setContextDocument(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const runAction = (action: PaletteAction) => {
    if (action.disabled) {
      return;
    }
    setOpen(false);
    setContextDocument(null);

    if (action.action) {
      action.action();
      return;
    }

    if (action.path && action.path !== location.pathname) {
      navigate(action.path);
      return;
    }

    if (action.path) {
      navigate(action.path);
    }
  };

  const renderAction = (action: PaletteAction) => {
    const Icon = action.icon;
    return (
      <button
        type="button"
        key={action.id}
        onClick={() => runAction(action)}
        disabled={action.disabled}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-cyan-400/8 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/6 text-cyan-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{action.label}</div>
          <div className="truncate text-[11px] text-muted-foreground">{action.description}</div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
      </button>
    );
  };

  const renderSection = (label: string, group: PaletteAction["group"]) => {
    const sectionActions = groupedActions[group];
    if (!sectionActions.length) {
      return null;
    }

    return (
      <div className="px-2 py-1">
        <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {label}
        </div>
        <div className="space-y-1">{sectionActions.map(renderAction)}</div>
      </div>
    );
  };

  return (
    <>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      {open && (
        <div
          className="fixed z-[100000] w-80 rounded-2xl border border-cyan-400/18 bg-slate-950/94 shadow-[0_22px_70px_rgba(2,10,20,0.6)] backdrop-blur-xl"
          role="menu"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          style={{ left: position.x, top: position.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-white/6 px-4 py-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">
                Mouse Palette
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Hold <span className="font-mono text-foreground/90">Shift</span> for the browser
                menu.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    backAction.go();
                  }}
                  disabled={backAction.disabled}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/6 text-cyan-300 hover:bg-cyan-400/12 transition-colors disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {previousPath ? `Back to ${previousPath}` : "No previous page"}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="max-h-[420px] overflow-y-auto py-2">
            {renderSection("Document", "context")}
            {renderSection("Quick Actions", "quick")}
            {renderSection("Navigation", "navigation")}
            {renderSection("Workspace", "workspace")}
            {renderSection("Tools", "tools")}
          </div>

          <div className="border-t border-white/6 px-4 py-3 text-[11px] text-muted-foreground">
            Built for quick mouse travel: jump back, reopen previews, or continue a workflow without
            expanding the sidebar.
          </div>
        </div>
      )}
    </>
  );
}
