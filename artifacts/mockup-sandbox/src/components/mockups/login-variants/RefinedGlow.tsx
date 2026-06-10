import { Eye, EyeOff, Loader2, Lock, Shield } from "lucide-react";
import { useState } from "react";

export function RefinedGlow() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/20 via-slate-950 to-green-900/10 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-teal-500/30 ring-2 ring-teal-400/20 ring-offset-4 ring-offset-slate-950">
            <span className="text-white font-bold text-2xl">L2</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">LDO-2 EDMS</h1>
          <p className="text-slate-400 text-sm">Enterprise Document Management System</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/8 rounded-2xl p-8 shadow-[0_0_80px_-10px_rgba(20,184,166,0.15),0_25px_50px_-12px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-teal-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Secure Sign In</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.12em] uppercase text-slate-500 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-slate-200 text-sm rounded-xl px-4 py-3 transition-all placeholder:text-slate-500 bg-slate-900/40 border border-slate-700/50 focus:outline-none focus:border-teal-400/50 focus:ring-1 focus:ring-teal-400/15 focus:bg-slate-900/60"
                placeholder="e.g. a.kowalski"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.12em] uppercase text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-slate-200 text-sm rounded-xl px-4 py-3 pr-11 transition-all placeholder:text-slate-500 bg-slate-900/40 border border-slate-700/50 focus:outline-none focus:border-teal-400/50 focus:ring-1 focus:ring-teal-400/15 focus:bg-slate-900/60"
                  placeholder="••••••••"
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
              className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-base transition-all shadow-[0_4px_24px_rgba(20,184,166,0.40),0_0_0_1px_rgba(20,184,166,0.2)] hover:shadow-[0_4px_32px_rgba(20,184,166,0.55)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authenticating…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5">
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-slate-600 mb-3">
              Demo Credentials
            </p>
            <div className="space-y-1">
              {[
                { u: "admin", p: "admin123", r: "Admin" },
                { u: "a.kowalski", p: "ldo2pass", r: "Engineer" },
                { u: "m.chen", p: "ldo2pass", r: "Reviewer" },
                { u: "s.patel", p: "ldo2pass", r: "Supervisor" },
              ].map((c) => (
                <button
                  key={c.u}
                  type="button"
                  onClick={() => {
                    setUsername(c.u);
                    setPassword(c.p);
                  }}
                  className="w-full text-left text-xs text-slate-400 hover:text-teal-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800/50 flex items-center"
                >
                  <span className="font-mono text-teal-400">{c.u}</span>
                  <span className="mx-1.5 text-slate-600">/</span>
                  <span className="font-mono text-slate-500">{c.p}</span>
                  <span className="ml-auto text-slate-600 text-[10px] uppercase tracking-wider">
                    {c.r}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[9px] text-slate-700 tracking-wider">
          v2.3.1 · LDO-2 Division · © 2026 RDSO
        </p>
      </div>
    </div>
  );
}
