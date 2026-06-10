const NAVIGATION_HISTORY_KEY = "edms_navigation_history";
const MAX_HISTORY_ITEMS = 20;

interface NavigationEntry {
  path: string;
  visitedAt: string;
}

function readHistory(): NavigationEntry[] {
  try {
    const raw = localStorage.getItem(NAVIGATION_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as NavigationEntry[];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.path === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: NavigationEntry[]) {
  localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(entries.slice(-MAX_HISTORY_ITEMS)));
}

export const NavigationHistoryService = {
  record(path: string) {
    if (!path) {
      return;
    }

    const entries = readHistory();
    if (entries[entries.length - 1]?.path === path) {
      return;
    }

    entries.push({
      path,
      visitedAt: new Date().toISOString(),
    });
    writeHistory(entries);
  },

  getPreviousPath(currentPath?: string) {
    const entries = readHistory().slice().reverse();
    for (const entry of entries) {
      if (entry.path !== currentPath) {
        return entry.path;
      }
    }
    return null;
  },
};
