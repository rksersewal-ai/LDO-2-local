import { createContext, type ReactNode, useContext, useState } from "react";

export interface RightPanelContent {
  panelKey?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  defaultExpandedSections?: number[];
  sections: Array<{
    heading: string;
    content: React.ReactNode;
  }>;
}

interface RightPanelContextType {
  content: RightPanelContent | null;
  setContent: (content: RightPanelContent | null) => void;
  openPanel: (content: RightPanelContent) => void;
  closePanel: () => void;
}

const RightPanelContext = createContext<RightPanelContextType | undefined>(undefined);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<RightPanelContent | null>(null);

  const openPanel = (newContent: RightPanelContent) => {
    setContent(newContent);
  };

  const closePanel = () => {
    setContent(null);
  };

  return (
    <RightPanelContext.Provider value={{ content, setContent, openPanel, closePanel }}>
      {children}
    </RightPanelContext.Provider>
  );
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) {
    throw new Error("useRightPanel must be used within RightPanelProvider");
  }
  return ctx;
}
