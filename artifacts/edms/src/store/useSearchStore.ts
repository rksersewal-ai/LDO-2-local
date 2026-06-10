import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SearchScope } from "../lib/types";
import type { DuplicateSearchFilter } from "../services/SearchService";

const _RECENT_KEY = "ldo2_recent_searches";
const _SAVED_KEY = "ldo2_saved_searches";

export interface SavedSearch {
  q: string;
  scope: SearchScope;
  label: string;
}

interface SearchState {
  // Query
  query: string;
  setQuery: (q: string) => void;
  scope: SearchScope;
  setScope: (scope: SearchScope) => void;

  // Filters
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  statusFilters: Set<string>;
  setStatusFilters: (filters: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  dateFilter: "any" | "7d" | "30d" | "90d";
  setDateFilter: (filter: "any" | "7d" | "30d" | "90d") => void;
  entityFilters: Set<string>;
  setEntityFilters: (filters: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  duplicateFilter: DuplicateSearchFilter;
  setDuplicateFilter: (filter: DuplicateSearchFilter) => void;

  // History / Saved
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  savedSearches: SavedSearch[];
  addSavedSearch: (saved: SavedSearch) => void;
  removeSavedSearch: (index: number) => void;

  // UI Meta
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      query: "",
      setQuery: (query) => set({ query }),
      scope: "ALL",
      setScope: (scope) => set({ scope }),

      showFilters: false,
      setShowFilters: (showFilters) => set({ showFilters }),

      statusFilters: new Set(),
      setStatusFilters: (updater) =>
        set((state) => ({
          statusFilters: typeof updater === "function" ? updater(state.statusFilters) : updater,
        })),

      dateFilter: "any",
      setDateFilter: (dateFilter) => set({ dateFilter }),

      entityFilters: new Set(),
      setEntityFilters: (updater) =>
        set((state) => ({
          entityFilters: typeof updater === "function" ? updater(state.entityFilters) : updater,
        })),

      duplicateFilter: "include",
      setDuplicateFilter: (duplicateFilter) => set({ duplicateFilter }),

      recentSearches: [],
      addRecentSearch: (q) =>
        set((state) => {
          const trimmed = q.trim();
          if (!trimmed) return state;
          const next = [trimmed, ...state.recentSearches.filter((s) => s !== trimmed)].slice(0, 10);
          return { recentSearches: next };
        }),
      removeRecentSearch: (q) =>
        set((state) => ({
          recentSearches: state.recentSearches.filter((s) => s !== q),
        })),

      savedSearches: [],
      addSavedSearch: (saved) =>
        set((state) => ({
          savedSearches: [...state.savedSearches, saved],
        })),
      removeSavedSearch: (index) =>
        set((state) => ({
          savedSearches: state.savedSearches.filter((_, i) => i !== index),
        })),

      inputFocused: false,
      setInputFocused: (inputFocused) => set({ inputFocused }),
    }),
    {
      name: "ldo2-search-store",
      // Only persist History and Saved Searches, keep current query ephemeral if needed
      partialize: (state) => ({
        recentSearches: state.recentSearches,
        savedSearches: state.savedSearches,
      }),
    },
  ),
);
