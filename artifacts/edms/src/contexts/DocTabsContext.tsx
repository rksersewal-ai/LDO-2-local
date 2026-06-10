import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

export interface TabDoc {
  id: string;
  name: string;
}

interface DocTabsContextValue {
  tabs: TabDoc[];
  openTab: (docId: string, docName?: string) => void;
  closeTab: (tabId: string) => void;
  clearTabs: () => void;
}

const DocTabsContext = createContext<DocTabsContextValue>({
  tabs: [],
  openTab: () => {},
  closeTab: () => {},
  clearTabs: () => {},
});

export function DocTabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabDoc[]>([]);

  const openTab = useCallback((docId: string, docName?: string) => {
    setTabs((prev) => {
      const nextName = docName?.trim() || docId;
      const existing = prev.find((t) => t.id === docId);

      if (existing) {
        if (existing.name === nextName) {
          return prev;
        }

        return prev.map((tab) => (tab.id === docId ? { ...tab, name: nextName } : tab));
      }

      return [...prev, { id: docId, name: nextName }];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  }, []);

  const clearTabs = useCallback(() => {
    setTabs([]);
  }, []);

  return (
    <DocTabsContext.Provider value={{ tabs, openTab, closeTab, clearTabs }}>
      {children}
    </DocTabsContext.Provider>
  );
}

export const useDocTabs = () => useContext(DocTabsContext);
