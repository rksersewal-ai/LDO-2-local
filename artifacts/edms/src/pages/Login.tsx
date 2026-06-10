import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  Lock,
  ShieldCheck,
  Train,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth";
import { PreferencesService } from "../services/PreferencesService";

const DEMO_CREDENTIALS = [
  { u: "admin", p: "admin123", r: "Administrator" },
  { u: "a.kowalski", p: "ldo2pass", r: "Engineering" },
  { u: "m.chen", p: "ldo2pass", r: "Review" },
  { u: "s.patel", p: "ldo2pass", r: "Supervisor" },
];

const STATIONS = [
  {
    id: 1,
    name: "OCR Intake & Ingestion",
    x: 250,
    y: 100,
    color: "from-blue-500 to-indigo-600",
    glow: "rgba(59, 130, 246, 0.4)",
    desc: "Ingests engineering drawings and documents. Automates text extraction via OCR queues, supporting multi-language scanning.",
    icon: Cpu,
  },
  {
    id: 2,
    name: "Registry & Verification",
    x: 550,
    y: 100,
    color: "from-amber-500 to-orange-600",
    glow: "rgba(245, 158, 11, 0.4)",
    desc: "Validates metadata, structures documents, and runs duplicate checks to avoid version conflicts across engineering groups.",
    icon: Database,
  },
  {
    id: 3,
    name: "BOM Configuration Link",
    x: 550,
    y: 300,
    color: "from-purple-500 to-fuchsia-600",
    glow: "rgba(139, 92, 246, 0.4)",
    desc: "Integrates documents directly with production BOMs and Parts Lists, enabling digital configuration management.",
    icon: GitBranch,
  },
  {
    id: 4,
    name: "Release & Ledger Sign-off",
    x: 250,
    y: 300,
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16, 185, 129, 0.4)",
    desc: "Commits reviewed documents to the secure audit ledger, executing digital approvals and preparing export packages.",
    icon: CheckCircle2,
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error, sessionExpired, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeStation, setActiveStation] = useState<number>(1);

  // Auto-cycle through stations to keep the preview dynamic
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStation((prev) => (prev % STATIONS.length) + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await login(username, password);
    if (ok) {
      const lastPath = PreferencesService.get().lastVisitedPath;
      navigate(lastPath && lastPath !== "/login" ? lastPath : "/");
    }
  };

  const currentStationData = STATIONS.find((s) => s.id === activeStation) || STATIONS[0];
  const StationIcon = currentStationData.icon;

  const trackPath =
    "M 100,200 A 100,100 0 0,1 200,100 L 600,100 A 100,100 0 0,1 700,200 A 100,100 0 0,1 600,300 L 200,300 A 100,100 0 0,1 100,200 Z";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-background text-foreground overflow-hidden">
      {/* LEFT SIDE: Railway Toy Model & Details (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[58%] bg-slate-950 text-slate-100 flex-col justify-between p-8 relative overflow-hidden">
        {/* Beautiful gradient separation line with horizontal glow */}
        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-slate-800/80 to-transparent pointer-events-none z-20" />
        <div className="absolute right-0 top-0 bottom-0 w-[8px] bg-gradient-to-b from-transparent via-blue-500/10 to-transparent blur-[2px] pointer-events-none z-10" />
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:40px_40px] opacity-25 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-900">
            <img src="/login-logo.png" alt="LDO-2 EDMS" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              LDO-2 EDMS{" "}
              <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10">
                v2.0.4
              </Badge>
            </h1>
            <p className="text-xs text-slate-400">Engineering Document Management System</p>
          </div>
        </div>

        {/* Central Toy Railway Board */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center py-6">
          <div className="w-full max-w-[620px] aspect-[8/4.5] relative">
            <svg
              viewBox="0 0 800 400"
              className="w-full h-full drop-shadow-[0_0_25px_rgba(30,41,59,0.5)]"
            >
              {/* Wooden sleepers (Ties) */}
              <path
                d={trackPath}
                fill="none"
                stroke="#3e2723"
                strokeWidth="14"
                strokeDasharray="4,10"
                className="opacity-70"
              />

              {/* Steel Track Bed */}
              <path d={trackPath} fill="none" stroke="#475569" strokeWidth="8" />

              {/* Center Track Space (Creates the two-rail illusion) */}
              <path d={trackPath} fill="none" stroke="#0f172a" strokeWidth="6" />

              {/* Station Indicators on Track */}
              {STATIONS.map((station) => {
                const isSelected = activeStation === station.id;
                return (
                  <g
                    key={station.id}
                    className="cursor-pointer group"
                    onClick={() => setActiveStation(station.id)}
                  >
                    {/* Ring glow */}
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r={isSelected ? "18" : "12"}
                      fill="none"
                      stroke={isSelected ? "currentColor" : "transparent"}
                      strokeWidth="2"
                      className="text-slate-400/30 transition-all duration-300"
                      style={{
                        filter: isSelected ? `drop-shadow(0 0 6px ${station.glow})` : "none",
                      }}
                    />
                    {/* Base circle */}
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r={isSelected ? "9" : "7"}
                      className="transition-all duration-300"
                      fill={isSelected ? "#ffffff" : "#334155"}
                      style={{
                        filter: isSelected ? `drop-shadow(0 0 8px ${station.glow})` : "none",
                      }}
                    />
                    {/* Glowing center LED */}
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r="4"
                      className={`${isSelected ? "animate-pulse" : ""}`}
                      fill={
                        station.id === 1
                          ? "#3b82f6"
                          : station.id === 2
                            ? "#f59e0b"
                            : station.id === 3
                              ? "#8b5cf6"
                              : "#10b981"
                      }
                    />
                  </g>
                );
              })}

              {/* Animated Train System */}
              <g>
                {/* Engine (Red Locomotive) */}
                <g>
                  {/* Cabin structure */}
                  <path d="M -14,-5 L 8,-5 L 12,0 L 8,5 L -14,5 Z" fill="#ef4444" />
                  <rect x="-8" y="-3.5" width="14" height="7" rx="0.5" fill="#1e293b" />
                  {/* Yellow glowing Headlight */}
                  <circle cx="12" cy="0" r="2" fill="#facc15" className="animate-pulse" />
                  <animateMotion
                    dur="18s"
                    repeatCount="indefinite"
                    path={trackPath}
                    rotate="auto"
                  />
                </g>

                {/* Cargo Carriage 1 - OCR Documents (Blue) */}
                <g>
                  <rect x="-10" y="-5" width="20" height="10" rx="1.5" fill="#3b82f6" />
                  <path
                    d="M -6,-2.5 L 6,-2.5 M -6,0 L 4,0 M -6,2.5 L 1,2.5"
                    stroke="#ffffff"
                    strokeWidth="1"
                    opacity="0.8"
                  />
                  <animateMotion
                    dur="18s"
                    repeatCount="indefinite"
                    path={trackPath}
                    rotate="auto"
                    begin="-0.4s"
                  />
                </g>

                {/* Cargo Carriage 2 - BOM Assemblies (Purple) */}
                <g>
                  <rect x="-10" y="-5" width="20" height="10" rx="1.5" fill="#8b5cf6" />
                  {/* Small link icon representing BOM */}
                  <circle cx="-3" cy="0" r="2" fill="none" stroke="#ffffff" strokeWidth="1" />
                  <circle cx="3" cy="0" r="2" fill="none" stroke="#ffffff" strokeWidth="1" />
                  <line x1="-1" y1="0" x2="1" y2="0" stroke="#ffffff" strokeWidth="1" />
                  <animateMotion
                    dur="18s"
                    repeatCount="indefinite"
                    path={trackPath}
                    rotate="auto"
                    begin="-0.8s"
                  />
                </g>

                {/* Cargo Carriage 3 - Approved Records (Green) */}
                <g>
                  <rect x="-10" y="-5" width="20" height="10" rx="1.5" fill="#10b981" />
                  {/* Checkmark inside */}
                  <path d="M -3,0 L -1,2 L 3,-2" fill="none" stroke="#ffffff" strokeWidth="1" />
                  <animateMotion
                    dur="18s"
                    repeatCount="indefinite"
                    path={trackPath}
                    rotate="auto"
                    begin="-1.2s"
                  />
                </g>
              </g>
            </svg>

            {/* Glowing Pipeline Centerpiece */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <div className="text-[10px] font-mono tracking-[0.25em] text-slate-500 uppercase">
                EDMS Pipeline
              </div>
              <div className="text-sm font-semibold tracking-wider text-slate-300 mt-1 flex items-center gap-1.5">
                <Train className="h-3.5 w-3.5 text-blue-400 animate-bounce" />
                <span>PROCESS MODEL</span>
              </div>
            </div>
          </div>

          {/* Interactive Station Information Details Card */}
          <div className="w-full max-w-[500px] mt-6 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 transition-all duration-300 shadow-xl">
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2 rounded-lg bg-gradient-to-br ${currentStationData.color} text-white shadow-md`}
              >
                <StationIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white tracking-tight">
                    {currentStationData.name}
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-slate-700 text-slate-400 bg-slate-800/50"
                  >
                    STAGE 0{currentStationData.id}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  {currentStationData.desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Details Footer */}
        <div className="relative z-10 pt-4 flex items-center justify-between text-xs text-slate-500">
          {/* Horizontal gradient border line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-800/80 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All background workers active</span>
          </div>
          <span>Secure AES-256 Transport</span>
        </div>
      </div>

      {/* RIGHT SIDE: Login form & Demo Credentials */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-12 bg-card">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            {/* Show Logo on Mobile Header */}
            <div className="flex lg:hidden justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background shadow-sm">
                <img src="/login-logo.png" alt="LDO-2 EDMS" className="h-8 w-8 object-contain" />
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              LDO-2 Control Center
            </p>
            <h2 className="text-2xl font-bold tracking-tight">Sign in to Admin Workspace</h2>
            <p className="text-sm text-muted-foreground">
              Manage drawing vaults, assemblies, work records, approvals, and system pipelines.
            </p>
          </div>

          {sessionExpired && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30 px-3.5 py-2.5 text-amber-900 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <p className="text-xs font-medium">Your session expired. Sign in again to resume.</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-destructive">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="username" className="text-xs font-semibold">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. a.kowalski"
                required
                autoComplete="username"
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs font-semibold">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 h-10"
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-10 mt-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin mr-2" />
                  Accessing Secure Vault
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Enter Workspace
                </>
              )}
            </Button>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
              <span>
                Route context, custom styling preferences, and visual settings will be restored.
              </span>
            </div>
          </form>

          {/* Quick Demo Access Roles */}
          <div className="pt-4 border-t">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 text-center lg:text-left">
              Quick Role Authentication (Demo)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_CREDENTIALS.map((credential) => (
                <button
                  key={credential.u}
                  type="button"
                  onClick={() => {
                    setUsername(credential.u);
                    setPassword(credential.p);
                    clearError();
                  }}
                  className="flex items-center justify-between gap-1 text-left px-3 py-2 rounded-lg border bg-background hover:bg-muted transition-all duration-200 text-xs shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-foreground">{credential.r}</p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {credential.u}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
