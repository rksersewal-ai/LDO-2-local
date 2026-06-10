import { MOCK_BANNERS } from "../lib/mockExtended";

export interface BannerRecord {
  id: string;
  title: string;
  message: string;
  link: string | null;
  active: boolean;
  validFrom: string;
  validTo: string;
  order: number;
}

const STORAGE_KEY = "ldo2_banners";

function buildDefaultStore(): BannerRecord[] {
  return MOCK_BANNERS.map((banner) => ({ ...banner })).sort(
    (left, right) => left.order - right.order,
  );
}

function resequence(banners: BannerRecord[]) {
  return banners.map((banner, index) => ({ ...banner, order: index + 1 }));
}

function loadStore(): BannerRecord[] {
  if (typeof window === "undefined") {
    return buildDefaultStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildDefaultStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Banner store is not an array");
    }

    return resequence(
      parsed.map((banner) => ({
        id: String(banner.id),
        title: String(banner.title ?? ""),
        message: String(banner.message ?? ""),
        link: banner.link ? String(banner.link) : null,
        active: Boolean(banner.active),
        validFrom: String(banner.validFrom ?? ""),
        validTo: String(banner.validTo ?? ""),
        order: Number(banner.order ?? 0),
      })),
    );
  } catch {
    const fallback = buildDefaultStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function persist(banners: BannerRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(banners));
  }
}

let _store = loadStore();

export const BannerService = {
  getAll(): Promise<BannerRecord[]> {
    return Promise.resolve([..._store].sort((left, right) => left.order - right.order));
  },

  create(input: Omit<BannerRecord, "id" | "order">): Promise<BannerRecord> {
    const banner: BannerRecord = {
      ...input,
      id: `BNR-${Date.now()}`,
      order: _store.length + 1,
    };
    _store = [..._store, banner];
    persist(_store);
    return Promise.resolve(banner);
  },

  update(id: string, patch: Partial<Omit<BannerRecord, "id">>): Promise<BannerRecord | null> {
    const index = _store.findIndex((banner) => banner.id === id);
    if (index < 0) {
      return Promise.resolve(null);
    }

    _store[index] = {
      ..._store[index],
      ...patch,
      link: patch.link === "" ? null : (patch.link ?? _store[index].link),
    };
    _store = resequence(_store);
    persist(_store);
    return Promise.resolve(_store[index]);
  },

  toggleActive(id: string): Promise<BannerRecord | null> {
    const banner = _store.find((item) => item.id === id);
    if (!banner) {
      return Promise.resolve(null);
    }

    banner.active = !banner.active;
    persist(_store);
    return Promise.resolve({ ...banner });
  },

  delete(id: string): Promise<boolean> {
    const before = _store.length;
    _store = resequence(_store.filter((banner) => banner.id !== id));
    persist(_store);
    return Promise.resolve(_store.length < before);
  },
};
