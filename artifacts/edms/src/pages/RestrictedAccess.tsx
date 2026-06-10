import { ArrowLeft, ShieldOff } from "lucide-react";
import { useNavigate } from "react-router";
import { GlassCard } from "../components/ui/Shared";

export default function RestrictedAccess() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <GlassCard className="text-center max-w-md p-6 border-border/50 bg-card/40 backdrop-blur-md">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-rose-400" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-3">Access Restricted</h1>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          You do not have the required permissions to view this page. Contact your system
          administrator if you believe this is an error.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm transition-colors mx-auto"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </GlassCard>
    </div>
  );
}
