import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CheckSquare,
  Component,
  FileSearch,
  FileText,
  Hash,
  Search,
  ServerCog,
  Settings,
  ShieldAlert,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { type UserRole, useAuth } from "../../lib/auth";
import { SearchHistoryService } from "../../services/SearchHistoryService";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: string;
  keywords?: string[];
  roles?: UserRole[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
      setQuery("");
    },
    [navigate, onClose],
  );

  const ALL_COMMANDS: Command[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Main overview",
      icon: BarChart3,
      action: () => go("/"),
      category: "Navigation",
      keywords: ["home", "overview"],
    },
    {
      id: "documents",
      label: "Document Hub",
      description: "Browse documents",
      icon: FileText,
      action: () => go("/documents"),
      category: "Navigation",
      keywords: ["files", "docs"],
    },
    {
      id: "search",
      label: "Search Explorer",
      description: "Full-text search",
      icon: FileSearch,
      action: () => go("/search"),
      category: "Navigation",
      keywords: ["find", "query"],
    },
    {
      id: "bom",
      label: "BOM Explorer",
      description: "Locomotive BOM",
      icon: Component,
      action: () => go("/bom"),
      category: "Navigation",
      roles: ["admin", "supervisor", "engineer"],
    },
    {
      id: "pl",
      label: "PL Knowledge Hub",
      description: "Part list items",
      icon: Hash,
      action: () => go("/pl"),
      category: "Navigation",
      roles: ["admin", "supervisor", "engineer"],
    },
    {
      id: "ledger",
      label: "Work Ledger",
      description: "Track work records",
      icon: Briefcase,
      action: () => go("/ledger"),
      category: "Navigation",
      roles: ["admin", "supervisor", "engineer"],
    },
    {
      id: "ledger-reports",
      label: "Ledger Reports",
      description: "Work analytics",
      icon: BarChart3,
      action: () => go("/ledger-reports"),
      category: "Navigation",
      roles: ["admin", "supervisor"],
    },
    {
      id: "cases",
      label: "Cases",
      description: "Discrepancy cases",
      icon: ShieldAlert,
      action: () => go("/cases"),
      category: "Navigation",
    },
    {
      id: "approvals",
      label: "Approvals",
      description: "Pending decisions",
      icon: CheckSquare,
      action: () => go("/approvals"),
      category: "Navigation",
    },
    {
      id: "profile",
      label: "Profile & Preferences",
      description: "Account details and personal settings",
      icon: UserRound,
      action: () => go("/profile"),
      category: "Navigation",
    },
    {
      id: "reports",
      label: "Reports",
      description: "System reports",
      icon: BarChart3,
      action: () => go("/reports"),
      category: "Navigation",
      roles: ["admin", "supervisor"],
    },
    {
      id: "alerts",
      label: "Alert Rules",
      description: "Manage alert rules",
      icon: Bell,
      action: () => go("/alerts"),
      category: "Navigation",
    },
    {
      id: "templates",
      label: "Document Templates",
      description: "Pre-filled templates",
      icon: BookOpen,
      action: () => go("/templates"),
      category: "Navigation",
    },
    {
      id: "audit",
      label: "Audit Log",
      description: "Action history",
      icon: AlertTriangle,
      action: () => go("/audit"),
      category: "Admin",
      roles: ["admin"],
    },
    {
      id: "admin",
      label: "Admin Workspace",
      description: "System admin",
      icon: Users,
      action: () => go("/admin"),
      category: "Admin",
      roles: ["admin"],
    },
    {
      id: "users",
      label: "User Administration",
      description: "Manage workspace accounts",
      icon: Users,
      action: () => go("/admin/users"),
      category: "Admin",
      roles: ["admin"],
    },
    {
      id: "ocr",
      label: "OCR Monitor",
      description: "Extraction jobs",
      icon: ServerCog,
      action: () => go("/ocr"),
      category: "Admin",
      roles: ["admin"],
    },
    {
      id: "health",
      label: "System Health",
      description: "Service metrics",
      icon: ServerCog,
      action: () => go("/health"),
      category: "Admin",
      roles: ["admin"],
    },
    {
      id: "settings",
      label: "Settings",
      description: "System config",
      icon: Settings,
      action: () => go("/settings"),
      category: "Admin",
      roles: ["admin"],
    },
  ];

  const commands = ALL_COMMANDS.filter(
    (cmd) =>
      (!cmd.roles || hasPermission(cmd.roles)) &&
      (!query ||
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
        cmd.keywords?.some((k) => k.includes(query.toLowerCase()))),
  );

  const recentSearches = query ? [] : SearchHistoryService.getRecentSearches(3);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      setSelected((s) => Math.min(s + 1, commands.length - 1));
      e.preventDefault();
    }
    if (e.key === "ArrowUp") {
      setSelected((s) => Math.max(s - 1, 0));
      e.preventDefault();
    }
    if (e.key === "Enter" && commands[selected]) {
      commands[selected].action();
    }
    if (e.key === "Escape") {
      onClose();
      setQuery("");
    }
  };

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  if (!open) return null;

  const grouped = commands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, Command[]>,
  );

  let flatIdx = 0;

  return (
    <button
      type="button"
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
          }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions, records..."
            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-xs px-1.5 py-0.5 bg-secondary text-muted-foreground rounded border border-border">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {recentSearches.length > 0 && !query && (
            <div className="px-3 py-2">
              <div className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wider">
                Recent Searches
              </div>
              {recentSearches.map((item) => (
                <button
                  type="button"
                  key={`${item.query}-${item.scope}`}
                  onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(item.query)}`);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-foreground/90 hover:bg-secondary/50 transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{item.query}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.scope}</span>
                </button>
              ))}
            </div>
          )}

          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category} className="px-3 py-2">
              <div className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wider">
                {category}
              </div>
              {cmds.map((cmd) => {
                const idx = flatIdx++;
                const Icon = cmd.icon;
                return (
                  <button
                    type="button"
                    key={cmd.id}
                    onClick={cmd.action}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      idx === selected
                        ? "bg-primary/15 text-foreground"
                        : "text-foreground/90 hover:bg-secondary/50"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${idx === selected ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{cmd.label}</div>
                      {cmd.description && (
                        <div className="text-xs text-muted-foreground">{cmd.description}</div>
                      )}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          ))}

          {commands.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No results for "{query}"
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-white/8 text-xs text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </button>
  );
}
