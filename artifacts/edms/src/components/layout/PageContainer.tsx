import type { ReactNode } from "react";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "full";

const maxWidthMap: Record<MaxWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-[1520px]",
  full: "max-w-none",
};

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: MaxWidth;
  className?: string;
}

/**
 * PageContainer provides consistent max-width and centering for page content.
 *
 * Max-width options:
 * - 'sm': 2xl (42rem/672px) — Reading-heavy pages
 * - 'md': 3xl (48rem/768px) — Forms, detailed views
 * - 'lg': 5xl (64rem/1024px) — Tables, dashboards
 * - 'xl': 7xl (80rem/1280px) — Data-dense pages (default)
 * - 'full': No max-width — Full bleed layouts
 *
 * @example
 * <PageContainer maxWidth="md">
 *   <h1>My Page</h1>
 * </PageContainer>
 */
export function PageContainer({ children, maxWidth = "xl", className = "" }: PageContainerProps) {
  return <div className={`${maxWidthMap[maxWidth]} mx-auto h-full ${className}`}>{children}</div>;
}
