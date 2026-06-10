import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router";
import { GlassCard } from "../components/ui/Shared";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <GlassCard className="max-w-md w-full p-6 text-center border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200 flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Page Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The page you're looking for doesn't exist or you don't have permission to access it.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 w-full justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-secondary/50 hover:text-foreground transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 cursor-pointer"
          >
            <Home className="h-4 w-4" /> Dashboard
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
