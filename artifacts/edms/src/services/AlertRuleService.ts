export type TriggerType = "OVERDUE" | "STATUS_CHANGE" | "THRESHOLD" | "SCHEDULED";
export type NotifyChannel = "IN_APP" | "EMAIL" | "BOTH";

export interface AlertRule {
  id: string;
  name: string;
  trigger: TriggerType;
  condition: string;
  channel: NotifyChannel;
  notifyRoles: string[];
  enabled: boolean;
  createdAt: string;
  lastFired?: string;
}

const STORAGE_KEY = "ldo2_alert_rules";

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "AR-001",
    name: "Work Record Overdue",
    trigger: "OVERDUE",
    condition: "daysTaken > targetDays",
    channel: "BOTH",
    notifyRoles: ["supervisor", "admin"],
    enabled: true,
    createdAt: "2026-01-10",
    lastFired: "2026-03-20",
  },
  {
    id: "AR-002",
    name: "Case Not Resolved in 7 Days",
    trigger: "OVERDUE",
    condition: "case.openDays > 7",
    channel: "IN_APP",
    notifyRoles: ["admin", "supervisor"],
    enabled: true,
    createdAt: "2026-01-15",
    lastFired: "2026-03-18",
  },
  {
    id: "AR-003",
    name: "Document Status Changed to Obsolete",
    trigger: "STATUS_CHANGE",
    condition: "document.status == OBSOLETE",
    channel: "EMAIL",
    notifyRoles: ["engineer", "supervisor"],
    enabled: false,
    createdAt: "2026-02-01",
  },
  {
    id: "AR-004",
    name: "OCR Failure Rate High",
    trigger: "THRESHOLD",
    condition: "ocr.failRate > 20%",
    channel: "BOTH",
    notifyRoles: ["admin"],
    enabled: true,
    createdAt: "2026-02-14",
    lastFired: "2026-03-22",
  },
  {
    id: "AR-005",
    name: "Weekly Pending Approvals Digest",
    trigger: "SCHEDULED",
    condition: "approvals.pending > 0 - Weekly",
    channel: "EMAIL",
    notifyRoles: ["admin", "supervisor"],
    enabled: true,
    createdAt: "2026-03-01",
    lastFired: "2026-03-22",
  },
];

function normalize(rule: AlertRule): AlertRule {
  return {
    ...rule,
    id: String(rule.id),
    name: String(rule.name ?? "").trim(),
    trigger: rule.trigger,
    condition: String(rule.condition ?? "").trim(),
    channel: rule.channel,
    notifyRoles: Array.from(
      new Set(
        (Array.isArray(rule.notifyRoles) ? rule.notifyRoles : [])
          .map((role) => String(role).trim())
          .filter(Boolean),
      ),
    ),
    enabled: Boolean(rule.enabled),
    createdAt: String(rule.createdAt ?? ""),
    lastFired: rule.lastFired ? String(rule.lastFired) : undefined,
  };
}

function sortRules(rules: AlertRule[]) {
  return [...rules].sort((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function buildDefaultStore() {
  return sortRules(DEFAULT_RULES.map(normalize));
}

function persist(store: AlertRule[]) {
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
      throw new Error("Alert rule store is invalid");
    }

    return sortRules(parsed.map((rule) => normalize(rule as AlertRule)));
  } catch {
    const fallback = buildDefaultStore();
    persist(fallback);
    return fallback;
  }
}

function nextRuleId(store: AlertRule[]) {
  const max = store.reduce((highest, rule) => {
    const numeric = Number(rule.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return `AR-${String(max + 1).padStart(3, "0")}`;
}

let _store = loadStore();

export function resolveAlertRuleRoute(rule: Pick<AlertRule, "name" | "condition" | "trigger">) {
  const haystack = `${rule.name} ${rule.condition}`.toLowerCase();
  if (haystack.includes("ocr")) return "/ocr";
  if (haystack.includes("approval")) return "/approvals";
  if (haystack.includes("case")) return "/cases";
  if (haystack.includes("dedup")) return "/admin/deduplication";
  if (haystack.includes("document")) return "/documents";
  if (haystack.includes("work")) return "/ledger";
  if (rule.trigger === "THRESHOLD") return "/health";
  if (rule.trigger === "SCHEDULED") return "/reports";
  return "/alerts";
}

export const AlertRuleService = {
  getAll(): Promise<AlertRule[]> {
    return Promise.resolve(sortRules(_store));
  },

  create(input: Omit<AlertRule, "id" | "createdAt">): Promise<AlertRule> {
    const nextRule = normalize({
      ...input,
      id: nextRuleId(_store),
      createdAt: new Date().toISOString().split("T")[0],
    });
    _store = sortRules([..._store, nextRule]);
    persist(_store);
    return Promise.resolve(nextRule);
  },

  update(
    id: string,
    patch: Partial<Omit<AlertRule, "id" | "createdAt">>,
  ): Promise<AlertRule | null> {
    const index = _store.findIndex((rule) => rule.id === id);
    if (index < 0) {
      return Promise.resolve(null);
    }

    _store[index] = normalize({
      ..._store[index],
      ...patch,
      id: _store[index].id,
      createdAt: _store[index].createdAt,
    });
    _store = sortRules(_store);
    persist(_store);
    return Promise.resolve(_store[index]);
  },

  toggleEnabled(id: string): Promise<AlertRule | null> {
    const rule = _store.find((entry) => entry.id === id);
    if (!rule) {
      return Promise.resolve(null);
    }

    rule.enabled = !rule.enabled;
    _store = sortRules(_store);
    persist(_store);
    return Promise.resolve({ ...rule });
  },

  remove(id: string): Promise<boolean> {
    const before = _store.length;
    _store = _store.filter((rule) => rule.id !== id);
    persist(_store);
    return Promise.resolve(_store.length < before);
  },
};
