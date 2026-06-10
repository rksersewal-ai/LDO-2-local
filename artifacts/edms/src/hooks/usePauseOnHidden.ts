import { useEffect, useState } from "react";

/**
 * usePauseOnHidden — pauses auto-updates when the browser tab is hidden.
 * Use this in SystemHealth, LiveFeeds, or any polling component to avoid
 * unnecessary network requests when the user has switched tabs.
 *
 * @example
 * const isPaused = usePauseOnHidden();
 * useEffect(() => {
 *   if (isPaused) return;
 *   const id = setInterval(fetchHealth, 10_000);
 *   return () => clearInterval(id);
 * }, [isPaused]);
 */
export function usePauseOnHidden(): boolean {
  const [isPaused, setIsPaused] = useState(() => document.hidden);

  useEffect(() => {
    const handleVisibility = () => setIsPaused(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return isPaused;
}
