import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        name="Application"
        fallback={(error) => (
          <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <div className="max-w-md text-center space-y-4 p-8">
              <h1 className="text-xl font-semibold text-rose-400">Application Error</h1>
              <p className="text-sm text-muted-foreground">
                {error.message || "An unexpected error occurred. Please reload the page."}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Reload Application
              </button>
            </div>
          </div>
        )}
      >
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
