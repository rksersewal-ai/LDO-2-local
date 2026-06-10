import { type ComponentType, type LazyExoticComponent, lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { ToastContainer } from "./components/ui/Toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { DocTabsProvider } from "./contexts/DocTabsContext";
import { PLDetailDialogProvider } from "./contexts/PLDetailDialogContext";
import { RightPanelProvider } from "./contexts/RightPanelContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { AuthProvider } from "./lib/auth";

const AppLayout = lazy(() => import("./components/layout/AppLayout"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DocumentHub = lazy(() => import("./pages/DocumentHub"));
const DocumentDetail = lazy(() => import("./pages/DocumentDetail"));
const DocumentPreviewPage = lazy(() => import("./pages/DocumentPreviewPage"));
const BOMExplorer = lazy(() => import("./pages/BOMExplorer"));
const BOMCreate = lazy(() => import("./pages/BOMCreate"));
const BOMProductView = lazy(() => import("./pages/BOMProductView"));
const PLKnowledgeHub = lazy(() => import("./pages/PLKnowledgeHub"));
const PLDetail = lazy(() => import("./pages/PLDetail"));
const PLPreviewPage = lazy(() => import("./pages/PLPreviewPage"));
const WorkLedger = lazy(() => import("./pages/WorkLedger"));
const LedgerReports = lazy(() => import("./pages/LedgerReports"));
const Cases = lazy(() => import("./pages/Cases"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportTablePage = lazy(() => import("./pages/ReportTablePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminWorkspace = lazy(() => import("./pages/AdminWorkspace"));
const AdminInitialRun = lazy(() => import("./pages/AdminInitialRun"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const DeduplicationConsole = lazy(() => import("./pages/DeduplicationConsole"));
const OCRMonitor = lazy(() => import("./pages/OCRMonitor"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Settings = lazy(() => import("./pages/Settings"));
const BannerManagement = lazy(() => import("./pages/BannerManagement"));
const RestrictedAccess = lazy(() => import("./pages/RestrictedAccess"));
const DesignSystem = lazy(() => import("./pages/DesignSystem"));
const DocumentIngestion = lazy(() => import("./pages/DocumentIngestion"));
const SearchExplorer = lazy(() => import("./pages/SearchExplorer"));
const AlertRules = lazy(() => import("./pages/AlertRules"));
const DocumentTemplates = lazy(() => import("./pages/DocumentTemplates"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const NotFound = lazy(() => import("./pages/not-found"));

function RouteFallback() {
  return (
    <div className="app-shell-bg min-h-screen text-foreground flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading workspace...</div>
    </div>
  );
}

function LazyView({ Component }: { Component: LazyExoticComponent<ComponentType> }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

const ALL_ROLES = ["admin", "supervisor", "engineer", "reviewer", "viewer"] as const;
const ADMIN_ONLY = ["admin"] as const;
const ADMIN_SUPERVISOR = ["admin", "supervisor"] as const;
const ENGINEER_UP = ["admin", "supervisor", "engineer"] as const;
const REVIEWER_UP = ["admin", "supervisor", "engineer", "reviewer"] as const;

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LazyView Component={Login} />,
  },
  {
    path: "/",
    element: <LazyView Component={AppLayout} />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={Dashboard} />
          </ProtectedRoute>
        ),
      },
      {
        path: "search",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={SearchExplorer} />
          </ProtectedRoute>
        ),
      },
      {
        path: "documents",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={DocumentHub} />
          </ProtectedRoute>
        ),
      },
      {
        path: "documents/ingest",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={DocumentIngestion} />
          </ProtectedRoute>
        ),
      },
      {
        path: "documents/:id",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={DocumentDetail} />
          </ProtectedRoute>
        ),
      },
      {
        path: "documents/:id/preview",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={DocumentPreviewPage} />
          </ProtectedRoute>
        ),
      },
      {
        path: "bom",
        element: (
          <ProtectedRoute allowedRoles={[...ENGINEER_UP]}>
            <LazyView Component={BOMExplorer} />
          </ProtectedRoute>
        ),
      },
      {
        path: "bom/new",
        element: (
          <ProtectedRoute allowedRoles={[...ENGINEER_UP]}>
            <LazyView Component={BOMCreate} />
          </ProtectedRoute>
        ),
      },
      {
        path: "bom/:productId",
        element: (
          <ProtectedRoute allowedRoles={[...ENGINEER_UP]}>
            <LazyView Component={BOMProductView} />
          </ProtectedRoute>
        ),
      },
      {
        path: "pl",
        element: (
          <ProtectedRoute allowedRoles={[...ENGINEER_UP]}>
            <LazyView Component={PLKnowledgeHub} />
          </ProtectedRoute>
        ),
      },
      {
        path: "pl/preview/:draftId",
        element: (
          <ProtectedRoute allowedRoles={[...ENGINEER_UP]}>
            <LazyView Component={PLPreviewPage} />
          </ProtectedRoute>
        ),
      },
      {
        path: "pl/:id",
        element: (
          <ProtectedRoute allowedRoles={[...ENGINEER_UP]}>
            <LazyView Component={PLDetail} />
          </ProtectedRoute>
        ),
      },
      {
        path: "ledger",
        element: (
          <ProtectedRoute allowedRoles={[...ENGINEER_UP]}>
            <LazyView Component={WorkLedger} />
          </ProtectedRoute>
        ),
      },
      {
        path: "ledger-reports",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_SUPERVISOR]}>
            <LazyView Component={LedgerReports} />
          </ProtectedRoute>
        ),
      },
      {
        path: "cases",
        element: (
          <ProtectedRoute allowedRoles={[...REVIEWER_UP]}>
            <LazyView Component={Cases} />
          </ProtectedRoute>
        ),
      },
      {
        path: "approvals",
        element: (
          <ProtectedRoute allowedRoles={[...REVIEWER_UP]}>
            <LazyView Component={Approvals} />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={ProfilePage} />
          </ProtectedRoute>
        ),
      },
      {
        path: "notifications",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={NotificationsPage} />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_SUPERVISOR]}>
            <LazyView Component={Reports} />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports/:reportId",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_SUPERVISOR]}>
            <LazyView Component={ReportTablePage} />
          </ProtectedRoute>
        ),
      },
      {
        path: "alerts",
        element: (
          <ProtectedRoute allowedRoles={[...REVIEWER_UP]}>
            <LazyView Component={AlertRules} />
          </ProtectedRoute>
        ),
      },
      {
        path: "templates",
        element: (
          <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
            <LazyView Component={DocumentTemplates} />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={AdminWorkspace} />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/initial-run",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={AdminInitialRun} />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={UserManagement} />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/deduplication",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={DeduplicationConsole} />
          </ProtectedRoute>
        ),
      },
      {
        path: "ocr",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={OCRMonitor} />
          </ProtectedRoute>
        ),
      },
      {
        path: "audit",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={AuditLog} />
          </ProtectedRoute>
        ),
      },
      {
        path: "health",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={SystemHealth} />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={Settings} />
          </ProtectedRoute>
        ),
      },
      {
        path: "banners",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={BannerManagement} />
          </ProtectedRoute>
        ),
      },
      {
        path: "restricted",
        element: <LazyView Component={RestrictedAccess} />,
      },
      {
        path: "design-system",
        element: (
          <ProtectedRoute allowedRoles={[...ADMIN_ONLY]}>
            <LazyView Component={DesignSystem} />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <LazyView Component={NotFound} /> },
    ],
  },
]);

function AppWithToasts() {
  const { toasts, removeToast } = useToast();
  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <ToastProvider>
            <PLDetailDialogProvider>
              <RightPanelProvider>
                <DocTabsProvider>
                  <AppWithToasts />
                </DocTabsProvider>
              </RightPanelProvider>
            </PLDetailDialogProvider>
          </ToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
