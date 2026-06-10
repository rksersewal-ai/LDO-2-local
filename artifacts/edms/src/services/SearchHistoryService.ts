const SEARCH_HISTORY_KEY = "edms_search_history";
const MAX_HISTORY = 50;

export interface SearchHistoryItem {
  query: string;
  scope: string;
  timestamp: number;
  count?: number;
}

export class SearchHistoryService {
  static addSearch(query: string, scope: string, count: number = 0) {
    if (!query.trim()) return;

    const history = SearchHistoryService.getHistory();
    const filtered = history.filter((h) => !(h.query === query && h.scope === scope));
    const updated = [{ query, scope, timestamp: Date.now(), count }, ...filtered].slice(
      0,
      MAX_HISTORY,
    );
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  }

  static getHistory(): SearchHistoryItem[] {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static getRecentSearches(limit: number = 10): SearchHistoryItem[] {
    return SearchHistoryService.getHistory().slice(0, limit);
  }

  static getSuggestions(query: string, scope: string = "ALL"): SearchHistoryItem[] {
    if (!query.trim()) return SearchHistoryService.getRecentSearches(5);

    const history = SearchHistoryService.getHistory();
    const q = query.toLowerCase();
    return history
      .filter((h) => h.query.toLowerCase().includes(q) && (scope === "ALL" || h.scope === scope))
      .slice(0, 5);
  }

  static clearHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }

  static removeItem(query: string, scope: string) {
    const history = SearchHistoryService.getHistory();
    const filtered = history.filter((h) => !(h.query === query && h.scope === scope));
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  }
}
