import {
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Badge, Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";
import { Switch } from "../components/ui/switch";
import { type UserRole, useAuth } from "../lib/auth";
import { type ManagedUser, UserService } from "../services/UserService";

interface UserFormState {
  username: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  role: UserRole;
  phone: string;
  employeeId: string;
  isActive: boolean;
  password?: string;
}

const DEFAULT_FORM: UserFormState = {
  username: "",
  name: "",
  email: "",
  designation: "",
  department: "",
  role: "viewer",
  phone: "",
  employeeId: "",
  isActive: true,
  password: "",
};

function roleVariant(role: UserRole) {
  if (role === "admin") return "danger" as const;
  if (role === "supervisor") return "warning" as const;
  if (role === "engineer") return "info" as const;
  if (role === "reviewer") return "success" as const;
  return "default" as const;
}

function formatDateTime(value?: string) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [pendingDelete, setPendingDelete] = useState<ManagedUser | null>(null);

  const loadUsers = async () => {
    setUsers(await UserService.getAll());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return users.filter((entry) => {
      const matchesRole = roleFilter === "all" || entry.role === roleFilter;
      const matchesQuery =
        !lower ||
        entry.name.toLowerCase().includes(lower) ||
        entry.username.toLowerCase().includes(lower) ||
        entry.email.toLowerCase().includes(lower) ||
        entry.department.toLowerCase().includes(lower) ||
        entry.designation.toLowerCase().includes(lower);
      return matchesRole && matchesQuery;
    });
  }, [query, roleFilter, users]);

  const resetDialog = () => {
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(false);
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (entry: ManagedUser) => {
    setEditingUser(entry);
    setForm({
      username: entry.username,
      name: entry.name,
      email: entry.email,
      designation: entry.designation,
      department: entry.department,
      role: entry.role,
      phone: entry.phone ?? "",
      employeeId: entry.employeeId ?? "",
      isActive: entry.isActive,
      password: entry.password ?? "",
    });
    setDialogOpen(true);
  };

  const saveUser = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      toast.error("Name, username, and email are required");
      return;
    }

    if (!editingUser && !form.password?.trim()) {
      toast.error("Password is required for new users");
      return;
    }

    if (editingUser) {
      const updated = await UserService.update(editingUser.id, {
        ...editingUser,
        ...form,
        password: form.password?.trim() ? form.password : editingUser.password,
      });
      if (!updated) {
        toast.error("User could not be updated");
        return;
      }
      toast.success(`${updated.name} updated`);
    } else {
      await UserService.create({
        ...form,
        lastLogin: undefined,
      });
      toast.success(`${form.name} created`);
    }

    await loadUsers();
    resetDialog();
  };

  const toggleActive = async (entry: ManagedUser) => {
    const updated = await UserService.update(entry.id, {
      isActive: !entry.isActive,
    });
    if (!updated) {
      toast.error("User status could not be changed");
      return;
    }
    await loadUsers();
    toast.success(`${updated.name} ${updated.isActive ? "activated" : "deactivated"}`);
  };

  const deleteUser = async () => {
    if (!pendingDelete) return;
    if (currentUser?.id === pendingDelete.id) {
      toast.error("You cannot remove the currently signed-in user");
      return;
    }
    await UserService.remove(pendingDelete.id);
    await loadUsers();
    toast.success(`${pendingDelete.name} removed`);
    setPendingDelete(null);
  };

  return (
    <>
      <div className="space-y-6 max-w-[1380px] mx-auto">
        <PageHeader
          title="User Administration"
          subtitle="Create, update, and retire user accounts for the EDMS workspace without leaving the admin shell."
          breadcrumb={<span>Admin / Identity & Access / Users</span>}
          actions={
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> New User
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total Users", value: users.length, accent: true },
            {
              label: "Active Accounts",
              value: users.filter((entry) => entry.isActive).length,
            },
            {
              label: "Admins",
              value: users.filter((entry) => entry.role === "admin").length,
            },
            {
              label: "Engineers",
              value: users.filter((entry) => entry.role === "engineer").length,
            },
          ].map((stat) => (
            <GlassCard
              key={stat.label}
              className="px-3.5 py-2.5 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {stat.label}
              </p>
              <p
                className={`mt-1 text-2xl font-bold ${stat.accent ? "text-primary/90" : "text-white"}`}
              >
                {stat.value}
              </p>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="p-3 border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9 h-9"
                placeholder="Search by name, username, email, department..."
              />
            </div>
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)}
              className="w-[220px] h-9"
            >
              <option value="all">All roles</option>
              {UserService.getRoleOptions().map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-md">
          <div className="grid grid-cols-[1.3fr_1.1fr_1fr_0.8fr_0.7fr_1fr] gap-4 border-b border-border/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground bg-secondary/20">
            <span>User</span>
            <span>Role & Department</span>
            <span>Contact</span>
            <span>Status</span>
            <span>Last Login</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1.3fr_1.1fr_1fr_0.8fr_0.7fr_1fr] gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-sm font-bold text-white">
                      {entry.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
                      <p className="truncate text-xs font-mono text-primary/90">
                        {entry.username} · {entry.employeeId ?? entry.id}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <Badge variant={roleVariant(entry.role)} className="mb-2 capitalize">
                    {entry.role}
                  </Badge>
                  <p className="truncate text-sm text-foreground/90">{entry.designation}</p>
                  <p className="truncate text-xs text-muted-foreground">{entry.department}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-foreground/90">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {entry.email}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {entry.phone ?? "No phone set"}
                  </div>
                </div>
                <div className="flex items-center">
                  <Badge variant={entry.isActive ? "success" : "default"}>
                    {entry.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(entry.lastLogin)}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(entry)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => toggleActive(entry)}>
                    <ShieldCheck className="w-3.5 h-3.5" /> {entry.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setPendingDelete(entry)}
                    disabled={currentUser?.id === entry.id}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                No users match the current filters.
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border border-border/60 bg-popover text-foreground sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Update User" : "Create User"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Maintain account identity, responsibility, and role scope for the EDMS workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Full Name
              </span>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Username
              </span>
              <Input
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Email
              </span>
              <Input
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Role
              </span>
              <Select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                  }))
                }
              >
                {UserService.getRoleOptions().map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Designation
              </span>
              <Input
                value={form.designation}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    designation: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Department
              </span>
              <Input
                value={form.department}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    department: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Phone
              </span>
              <Input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Employee ID
              </span>
              <Input
                value={form.employeeId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    employeeId: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Password {editingUser ? "(Optional)" : "*"}
              </span>
              <Input
                type="password"
                placeholder={editingUser ? "Leave blank to keep existing" : "Enter password"}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-white/6 bg-card/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Account Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive users remain visible in history but lose operational access.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={resetDialog}>
              Cancel
            </Button>
            <Button onClick={saveUser}>
              {editingUser ? (
                <>
                  <UserCog className="w-4 h-4" /> Save User
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" /> Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="border border-rose-500/25 bg-popover text-foreground sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This removes the user from the local admin directory used by the current frontend
              workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-white/6 bg-card/40 px-4 py-3 text-sm text-foreground/90">
            {pendingDelete ? (
              <span>
                Remove <strong className="text-white">{pendingDelete.name}</strong> from the user
                registry?
              </span>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteUser}>
              <Trash2 className="w-4 h-4" /> Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
