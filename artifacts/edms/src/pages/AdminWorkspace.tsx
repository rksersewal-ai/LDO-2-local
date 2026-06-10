import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CopyCheck,
  Database,
  FileSearch,
  Layers3,
  Megaphone,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";
import { GlassCard } from "../components/ui/Shared";
import { MOCK_AUDIT_LOG } from "../lib/mock";

const quickLinks = [
  {
    icon: Layers3,
    label: "Initial Run",
    path: "/admin/initial-run",
    description: "Bootstrap source indexing, hashes, deduplication, and OCR backlog",
    color: "text-primary bg-teal-500/10",
  },
  {
    icon: FileSearch,
    label: "OCR Monitor",
    path: "/ocr",
    description: "Pipeline status and job tracking",
    color: "text-primary bg-teal-500/10",
  },
  {
    icon: Users,
    label: "User Administration",
    path: "/admin/users",
    description: "Create, edit, and retire workspace accounts",
    color: "text-sky-400 bg-sky-500/10",
  },
  {
    icon: CopyCheck,
    label: "Deduplication",
    path: "/admin/deduplication",
    description: "Duplicate groups, hash scans, and storage cleanup decisions",
    color: "text-emerald-400 bg-emerald-500/10",
  },
  {
    icon: ClipboardList,
    label: "Audit Log",
    path: "/audit",
    description: "System event traceability",
    color: "text-blue-400 bg-blue-500/10",
  },
  {
    icon: Megaphone,
    label: "Banner Management",
    path: "/banners",
    description: "Announcements and notices",
    color: "text-amber-400 bg-amber-500/10",
  },
  {
    icon: Settings,
    label: "Settings",
    path: "/settings",
    description: "System configuration",
    color: "text-muted-foreground bg-slate-500/10",
  },
];

export default function AdminWorkspace() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Admin & System Health</h1>
        <p className="text-muted-foreground text-sm">
          OCR Pipeline Monitor, Audit Visibility, and System Diagnostics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            icon: Server,
            label: "OCR Engine Status",
            value: "Operational",
            color: "text-primary bg-teal-500/10",
            dot: "bg-teal-500",
          },
          {
            icon: Database,
            label: "Database",
            value: "Healthy",
            color: "text-blue-400 bg-blue-500/10",
            dot: "bg-blue-500",
          },
          {
            icon: ShieldCheck,
            label: "Security",
            value: "Nominal",
            color: "text-emerald-400 bg-emerald-500/10",
            dot: "bg-emerald-500",
          },
          {
            icon: AlertTriangle,
            label: "Active Alerts",
            value: "1 Warning",
            color: "text-amber-400 bg-amber-500/10",
            dot: "bg-amber-500",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <GlassCard
              key={s.label}
              className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md flex items-center gap-4 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200"
            >
              <div
                className={`w-10 h-10 rounded-full ${s.color} flex items-center justify-center shrink-0`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground font-medium">{s.label}</div>
                <div className="text-lg font-bold text-white flex items-center gap-2">
                  {s.value} <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse`} />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Recent System Events
          </h2>
          <div className="space-y-3">
            {MOCK_AUDIT_LOG.map((e) => (
              <button
                type="button"
                key={e.id}
                className="w-full flex items-start gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer text-left font-normal"
                onClick={() => navigate("/audit")}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">{e.action}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {e.entity} · {e.user} · {e.timestamp}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate("/audit")}
            className="text-xs text-primary hover:text-primary/90 flex items-center gap-1 mt-3 transition-colors"
          >
            View Full Audit Log <ArrowRight className="w-3 h-3" />
          </button>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
            <h2 className="text-base font-bold text-white mb-4">Quick Links</h2>
            <div className="space-y-2">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    type="button"
                    key={link.label}
                    onClick={() => navigate(link.path)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/40 transition-colors text-left group"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg ${link.color} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-3.5 border-amber-500/20 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-300 mb-1">OCR Engine Maintenance</h3>
                <p className="text-xs text-muted-foreground">
                  Scheduled restart at 03:00 AM UTC. 45 minutes of reduced throughput expected.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
