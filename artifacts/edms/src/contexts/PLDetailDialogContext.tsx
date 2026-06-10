import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useState,
} from "react";
import { Dialog, DialogContent } from "../components/ui/dialog";

const PLDetailLazy = lazy(() => import("../pages/PLDetail"));

interface PLDetailDialogState {
  openPLDetail: (id: string) => void;
  closePLDetail: () => void;
  /** The PL ID currently shown in the dialog (null when closed). */
  activePlId: string | null;
}

const PLDetailDialogContext = createContext<PLDetailDialogState | null>(null);

export function usePLDetailDialog() {
  const ctx = useContext(PLDetailDialogContext);
  if (!ctx) throw new Error("usePLDetailDialog must be inside PLDetailDialogProvider");
  return ctx;
}

export function PLDetailDialogProvider({ children }: { children: ReactNode }) {
  const [plId, setPlId] = useState<string | null>(null);

  const openPLDetail = useCallback((id: string) => setPlId(id), []);
  const closePLDetail = useCallback(() => setPlId(null), []);

  return (
    <PLDetailDialogContext.Provider value={{ openPLDetail, closePLDetail, activePlId: plId }}>
      {children}
      <Dialog
        open={!!plId}
        onOpenChange={(open) => {
          if (!open) closePLDetail();
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto p-0 gap-0">
          {plId && (
            <Suspense
              fallback={
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Loading PL details...
                </div>
              }
            >
              <div className="pl-detail-dialog-wrapper">
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-border bg-card">
                  <h2 className="text-sm font-semibold text-foreground">PL Detail — {plId}</h2>
                  <button
                    type="button"
                    onClick={closePLDetail}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Close
                  </button>
                </div>
                <div className="p-0">
                  <PLDetailLazy plId={plId} />
                </div>
              </div>
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </PLDetailDialogContext.Provider>
  );
}
