import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FileText, Loader2, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useDocTabs } from "../../contexts/DocTabsContext";
import { useRightPanel } from "../../contexts/RightPanelContext";
import { useAuth } from "../../lib/auth";
import { NavigationHistoryService } from "../../services/NavigationHistoryService";
import { PreferencesService } from "../../services/PreferencesService";
import { getDocumentContextAttributes } from "../documents/DocumentPreviewActions";
import { RightClickPalette } from "../ui/RightClickPalette";
import { Header } from "./Header";
import { PageContainer } from "./PageContainer";
import { RightPanel } from "./RightPanel";
import { Sidebar } from "./Sidebar";

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { tabs, closeTab } = useDocTabs();
  const { content: rightPanelContent, closePanel } = useRightPanel();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sidebar expand/collapse — persisted in preferences
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    try {
      const prefs = PreferencesService.get();
      return prefs.sidebarExpanded ?? true;
    } catch {
      return true;
    }
  });

  const handleSidebarToggle = () => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        PreferencesService.set({
          sidebarExpanded: next,
        });
      } catch {}
      return next;
    });
  };

  const checkScroll = () => {
    if (tabsContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [tabs.length]);

  // Persist last visited path for session restore
  useEffect(() => {
    if (isAuthenticated && location.pathname !== "/login") {
      const route = `${location.pathname}${location.search}`;
      PreferencesService.set({ lastVisitedPath: route });
      NavigationHistoryService.record(route);
    }
  }, [location.pathname, location.search, isAuthenticated]);

  const scroll = (direction: "left" | "right") => {
    if (tabsContainerRef.current) {
      const amount = 200;
      tabsContainerRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const activeDocId = location.pathname.startsWith("/documents/")
    ? (location.pathname.split("/")[2] ?? null)
    : null;

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(tabId);
    if (tabId === activeDocId) {
      const remaining = tabs.filter((t) => t.id !== tabId);
      if (remaining.length > 0) {
        const idx = tabs.findIndex((t) => t.id === tabId);
        const next = remaining[Math.max(0, idx - 1)];
        navigate(`/documents/${next.id}`);
      } else {
        navigate("/documents");
      }
    }
  };

  return (
    <div className="workspace-shell app-shell-bg flex min-h-screen flex-col overflow-hidden font-sans text-foreground">
      {/* Skip to main content link — A11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <RightClickPalette />

      {/* ── Shell: sidebar + main ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/70"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative h-full p-2">
            <Sidebar isExpanded={true} onToggle={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden md:gap-0">
        {/* Persistent left navigation rail */}
        <div className="hidden md:block">
          <Sidebar isExpanded={sidebarExpanded} onToggle={handleSidebarToggle} />
        </div>

        {/* ── Main column ─────────────────────────────────────── */}
        <main
          id="main-content"
          className="workspace-main flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          <Header />

          {/* Multi-document tab strip — only shown when 2+ docs are open */}
          {tabs.length > 1 && (
            <div className="shrink-0 border-b border-border bg-card px-3 py-1.5">
              <div className="flex items-center rounded-md border border-border bg-background">
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scroll("left")}
                    className="shrink-0 p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}

                <div
                  ref={tabsContainerRef}
                  onScroll={checkScroll}
                  className="flex flex-1 items-center gap-1 overflow-x-auto px-2 py-1.5 scrollbar-hide"
                >
                  {tabs.map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      {...getDocumentContextAttributes(tab.id, tab.name)}
                      onClick={() => navigate(`/documents/${tab.id}`)}
                      className={`group flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeDocId === tab.id
                          ? "border-border bg-secondary text-foreground"
                          : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="max-w-[180px] truncate">{tab.name}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCloseTab(tab.id, e)}
                        className="ml-1 rounded-md p-0.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </button>
                  ))}
                </div>

                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => scroll("right")}
                    className="shrink-0 p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Content + optional right panel ─────────────────── */}
          <div className="flex-1 overflow-hidden flex">
            <div className="custom-scrollbar flex-1 overflow-auto px-3 pb-4 pt-3 md:px-4">
              <PageContainer maxWidth="full">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="h-full"
                  >
                    <Outlet />
                  </motion.div>
                </AnimatePresence>
              </PageContainer>
            </div>

            {/* Right Utility Panel */}
            {rightPanelContent && <RightPanel content={rightPanelContent} onClose={closePanel} />}
          </div>
        </main>
      </div>
    </div>
  );
}
