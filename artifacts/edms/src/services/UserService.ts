import type { User as AuthUser, UserRole } from "../lib/auth";

export interface ManagedUser extends AuthUser {
  employeeId?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  initials?: string;
  password?: string;
}

const STORAGE_KEY = "ldo2_managed_users";

const DEFAULT_USERS: ManagedUser[] = [
  {
    id: "USR-0001",
    username: "admin",
    name: "Ravi Admin",
    designation: "EDMS Administrator",
    role: "admin",
    department: "System Administration",
    email: "admin@ldo2.local",
    employeeId: "EMP-001",
    phone: "+91 90000 10001",
    isActive: true,
    lastLogin: "2026-03-27T09:15:00.000Z",
    initials: "RA",
    password: "admin123",
  },
  {
    id: "USR-0002",
    username: "m.chen",
    name: "M. Chen",
    designation: "Records Manager",
    role: "supervisor",
    department: "Records Control",
    email: "m.chen@ldo2.local",
    employeeId: "EMP-002",
    phone: "+91 90000 10002",
    isActive: true,
    lastLogin: "2026-03-27T08:40:00.000Z",
    initials: "MC",
    password: "ldo2pass",
  },
  {
    id: "USR-0003",
    username: "a.kowalski",
    name: "A. Kowalski",
    designation: "Design Engineer",
    role: "engineer",
    department: "Locomotive Design",
    email: "a.kowalski@ldo2.local",
    employeeId: "EMP-003",
    phone: "+91 90000 10003",
    isActive: true,
    lastLogin: "2026-03-27T07:55:00.000Z",
    initials: "AK",
    password: "ldo2pass",
  },
  {
    id: "USR-0004",
    username: "s.vance",
    name: "S. Vance",
    designation: "Quality Reviewer",
    role: "reviewer",
    department: "Quality Assurance",
    email: "s.vance@ldo2.local",
    employeeId: "EMP-004",
    phone: "+91 90000 10004",
    isActive: true,
    lastLogin: "2026-03-26T17:20:00.000Z",
    initials: "SV",
    password: "ldo2pass",
  },
  {
    id: "USR-0005",
    username: "viewer.ops",
    name: "Ops Viewer",
    designation: "Operations Viewer",
    role: "viewer",
    department: "Operations",
    email: "viewer.ops@ldo2.local",
    employeeId: "EMP-005",
    phone: "+91 90000 10005",
    isActive: true,
    lastLogin: "2026-03-26T13:10:00.000Z",
    initials: "OV",
    password: "ldo2pass",
  },
];

function normalize(user: ManagedUser): ManagedUser {
  return {
    ...user,
    initials:
      user.initials ||
      user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    isActive: user.isActive ?? true,
  };
}

function persist(store: ManagedUser[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function loadStore() {
  if (typeof window === "undefined") {
    return DEFAULT_USERS.map(normalize);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = DEFAULT_USERS.map(normalize);
      persist(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("User store is invalid");
    }

    return parsed.map((entry) => normalize(entry as ManagedUser));
  } catch {
    const fallback = DEFAULT_USERS.map(normalize);
    persist(fallback);
    return fallback;
  }
}

let _store = loadStore();

function nextUserId() {
  const max = _store.reduce((highest, user) => {
    const numeric = Number(user.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return `USR-${String(max + 1).padStart(4, "0")}`;
}

export const UserService = {
  getAll(): Promise<ManagedUser[]> {
    return Promise.resolve([..._store].sort((left, right) => left.name.localeCompare(right.name)));
  },

  getById(id: string): Promise<ManagedUser | null> {
    return Promise.resolve(_store.find((user) => user.id === id) ?? null);
  },

  ensureSessionUser(user: AuthUser): Promise<ManagedUser> {
    const existing = _store.find(
      (entry) =>
        entry.id === user.id || entry.username === user.username || entry.email === user.email,
    );
    const next = normalize({
      ...existing,
      ...user,
      id: existing?.id || user.id || nextUserId(),
      isActive: existing?.isActive ?? true,
      lastLogin: new Date().toISOString(),
      employeeId: existing?.employeeId,
      phone: existing?.phone,
      initials: existing?.initials,
    });

    if (existing) {
      _store = _store.map((entry) => (entry.id === existing.id ? next : entry));
    } else {
      _store = [..._store, next];
    }
    persist(_store);
    return Promise.resolve(next);
  },

  create(input: Omit<ManagedUser, "id" | "initials">): Promise<ManagedUser> {
    const next = normalize({
      ...input,
      id: nextUserId(),
    });
    _store = [..._store, next];
    persist(_store);
    return Promise.resolve(next);
  },

  update(id: string, patch: Partial<ManagedUser>): Promise<ManagedUser | null> {
    const index = _store.findIndex((user) => user.id === id);
    if (index < 0) {
      return Promise.resolve(null);
    }

    _store[index] = normalize({
      ..._store[index],
      ...patch,
      id: _store[index].id,
    });
    persist(_store);
    return Promise.resolve(_store[index]);
  },

  remove(id: string): Promise<boolean> {
    const before = _store.length;
    _store = _store.filter((user) => user.id !== id);
    persist(_store);
    return Promise.resolve(_store.length < before);
  },

  getRoleOptions(): UserRole[] {
    return ["admin", "supervisor", "engineer", "reviewer", "viewer"];
  },
};
