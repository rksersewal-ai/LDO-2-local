const SAVED_FILTERS_KEY = "edms_saved_filters";

export interface SavedFilter {
  id: string;
  name: string;
  createdAt: string;
  filters: {
    search: string;
    status: string;
    ocrStatus: string;
    type: string;
    category: string;
  };
}

function readFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFilter[];
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f?.id === "string") : [];
  } catch {
    return [];
  }
}

function writeFilters(filters: SavedFilter[]) {
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}

export const SavedFiltersService = {
  save(name: string, filters: SavedFilter["filters"]): SavedFilter {
    const all = readFilters();
    const entry: SavedFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: new Date().toISOString(),
      filters,
    };
    all.unshift(entry);
    writeFilters(all);
    return entry;
  },

  getAll(): SavedFilter[] {
    return readFilters();
  },

  delete(id: string) {
    const all = readFilters();
    writeFilters(all.filter((f) => f.id !== id));
  },

  apply(id: string): SavedFilter["filters"] | null {
    const all = readFilters();
    const found = all.find((f) => f.id === id);
    return found?.filters ?? null;
  },
};
