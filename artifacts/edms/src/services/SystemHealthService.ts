export interface BackupRecord {
  label: string;
  time: string;
  size: string;
  status: "success" | "pending";
}

const STORAGE_KEY = "ldo2_system_backups";

const DEFAULT_BACKUPS: BackupRecord[] = [
  {
    label: "Last Full Backup",
    time: "2026-03-25 02:00 UTC",
    size: "1.4 GB",
    status: "success",
  },
  {
    label: "Last Incremental",
    time: "2026-03-25 08:00 UTC",
    size: "42 MB",
    status: "success",
  },
  {
    label: "Next Scheduled",
    time: "2026-03-25 14:00 UTC",
    size: "~50 MB",
    status: "pending",
  },
];

function normalize(record: BackupRecord): BackupRecord {
  return {
    label: String(record.label ?? "").trim(),
    time: String(record.time ?? ""),
    size: String(record.size ?? ""),
    status: record.status === "success" ? "success" : "pending",
  };
}

function buildDefaultStore() {
  return DEFAULT_BACKUPS.map(normalize);
}

function persist(store: BackupRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function loadStore() {
  if (typeof window === "undefined") {
    return buildDefaultStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildDefaultStore();
      persist(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("System backup store is invalid");
    }

    return parsed.map((record) => normalize(record as BackupRecord));
  } catch {
    const fallback = buildDefaultStore();
    persist(fallback);
    return fallback;
  }
}

let _store = loadStore();

export const SystemHealthService = {
  getBackups(): Promise<BackupRecord[]> {
    return Promise.resolve([..._store]);
  },

  queueManualBackup(): Promise<BackupRecord[]> {
    const requestedAt = new Date();
    const record = normalize({
      label: "Manual Backup Request",
      time: requestedAt.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      size: "Pending",
      status: "pending",
    });

    _store = [record, ..._store].slice(0, 6);
    persist(_store);
    return Promise.resolve([..._store]);
  },
};
