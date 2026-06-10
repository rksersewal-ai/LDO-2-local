import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
} from "lucide-react";
import { useState } from "react";

export function Structured() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const sessionExpired = false; // Simulated state

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      if (
        username !== "admin" &&
        username !== "a.kowalski" &&
        username !== "m.chen" &&
        username !== "s.patel"
      ) {
        setError("Invalid username or password");
      } else {
        // success simulation
      }
    }, 1500);
  };

  const clearError = () => setError("");

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/20 via-slate-950 to-green-900/10 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Blueprint grid overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(20,184,166,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/8 border border-teal-500/15 text-[9px] font-mono font-medium tracking-[0.15em] text-teal-500/70 uppercase">
              INTERNAL SYSTEM · RESTRICTED ACCESS
            </span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">L2</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">LDO-2 EDMS</h1>
          <p className="text-slate-400 text-sm">Enterprise Document Management System</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800/70 rounded-2xl p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {/* Card top accent */}
          <div className="absolute top-0 left-0 right-0 h-px w-full bg-gradient-to-r from-transparent via-teal-500/60 to-transparent" />

          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-semibold text-slate-100">Secure Sign In</h2>
          </div>

          {sessionExpired && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-300">
                Your session has expired. Please sign in again to continue.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[9px] font-medium tracking-[0.15em] uppercase text-slate-500 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-l-teal-400 focus:border-l-2 focus:border-t-slate-700 focus:border-r-slate-700 focus:border-b-slate-700 transition-all placeholder:text-slate-600"
                placeholder="e.g. a.kowalski"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] font-medium tracking-[0.15em] uppercase text-slate-500 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 text-sm rounded-lg px-4 py-3 pr-11 focus:outline-none focus:border-l-teal-400 focus:border-l-2 focus:border-t-slate-700 focus:border-r-slate-700 focus:border-b-slate-700 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> Authenticating…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowCreds(!showCreds)}
            className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase text-slate-600 hover:text-slate-400 transition-colors mb-4"
          >
            {showCreds ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Demo Credentials
          </button>

          {showCreds && (
            <div className="w-full p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl mb-4">
              <div className="space-y-1">
                {[
                  { u: "admin", p: "admin123", r: "Admin" },
                  { u: "a.kowalski", p: "ldo2pass", r: "Engineer" },
                  { u: "m.chen", p: "ldo2pass", r: "Reviewer" },
                  { u: "s.patel", p: "ldo2pass", r: "Supervisor" },
                ].map((c) => (
                  <button
                    type="button"
                    key={c.u}
                    onClick={() => {
                      setUsername(c.u);
                      setPassword(c.p);
                      clearError();
                    }}
                    className="w-full text-left text-xs text-slate-400 hover:text-teal-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800/50 flex items-center justify-between group"
                  >
                    <div>
                      <span className="font-mono text-teal-400/80 group-hover:text-teal-400">
                        {c.u}
                      </span>
                      <span className="mx-1 text-slate-600">/</span>
                      <span className="font-mono text-slate-500">{c.p}</span>
                    </div>
                    <span className="text-slate-600 font-medium text-[10px] uppercase tracking-wider">
                      {c.r}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[9px] font-mono text-slate-700">
          [CLASSIFICATION: INTERNAL] · LDO-2 · Rev B
        </p>
      </div>
    </div>
  );
}
