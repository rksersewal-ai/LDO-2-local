import {
  Bell,
  Clock3,
  Eye,
  LayoutDashboard,
  Mail,
  MoonStar,
  Palette,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";
import { Switch } from "../components/ui/switch";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../lib/auth";
import { PreferencesService, type UserPreferences } from "../services/PreferencesService";

function _formatLastLogin(value?: string) {
  if (!value) return "Not available";
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

export default function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    designation: user?.designation ?? "",
    department: user?.department ?? "",
  });
  const [prefs, setPrefs] = useState<UserPreferences>(() => PreferencesService.get());

  useEffect(() => {
    setProfile({
      name: user?.name ?? "",
      email: user?.email ?? "",
      designation: user?.designation ?? "",
      department: user?.department ?? "",
    });
  }, [user]);

  useEffect(() => {
    const nextPrefs = PreferencesService.get();
    setPrefs(nextPrefs);
    document.documentElement.style.setProperty("--app-font-size", `${nextPrefs.fontSize}px`);
    document.documentElement.classList.toggle("reduce-motion", nextPrefs.reduceMotion);
  }, []);

  const roleLabel = useMemo(() => user?.role ?? "viewer", [user]);

  const saveProfile = async () => {
    if (!user) return;
    try {
      updateCurrentUser(profile);
      toast.success("Profile updated");
    } catch (err) {
      console.error("[ProfilePage] Failed to save profile", err);
      toast.error("Failed to update profile");
    }
  };

  const savePreference = (patch: Partial<UserPreferences>) => {
    const updated = PreferencesService.set(patch);
    setPrefs(updated);
    document.documentElement.style.setProperty("--app-font-size", `${updated.fontSize}px`);
    document.documentElement.classList.toggle("reduce-motion", updated.reduceMotion);
    toast.success("Personal settings updated");
  };

  return (
    <div className="space-y-6 max-w-[1180px] mx-auto">
      <PageHeader
        title="Profile & Personal Settings"
        subtitle="Maintain your operator identity and workspace behavior without touching the global admin configuration."
        breadcrumb={<span>Account / Profile</span>}
      />

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-xl font-bold text-foreground">
                {user?.name?.charAt(0) ?? "U"}
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{user?.name ?? "User"}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.designation ?? "Workspace User"}
                </p>
                <Badge variant="info" className="mt-2 capitalize">
                  {roleLabel}
                </Badge>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-foreground/90">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" /> {user?.email ?? "No email set"}
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" /> Department:{" "}
                {user?.department ?? "Not set"}
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-muted-foreground" /> Session active
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Current Workspace Behavior
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between text-foreground/90">
                <span>Theme</span>
                <span className="capitalize text-primary/90">{theme}</span>
              </div>
              <div className="flex items-center justify-between text-foreground/90">
                <span>Font Size</span>
                <span className="text-primary/90">{prefs.fontSize}px</span>
              </div>
              <div className="flex items-center justify-between text-foreground/90">
                <span>Clock Format</span>
                <span className="text-primary/90">{prefs.timeFormat}</span>
              </div>
              <div className="flex items-center justify-between text-foreground/90">
                <span>Default Landing</span>
                <span className="text-primary/90">{prefs.defaultView}</span>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
            <div className="mb-5 flex items-center gap-2">
              <UserRound className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Identity</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Full Name
                </span>
                <Input
                  className="h-9"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Email
                </span>
                <Input
                  className="h-9"
                  value={profile.email}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Designation
                </span>
                <Input
                  className="h-9"
                  value={profile.designation}
                  onChange={(event) =>
                    setProfile((current) => ({
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
                  className="h-9"
                  value={profile.department}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="mt-5">
              <Button onClick={saveProfile}>
                <Save className="w-4 h-4" /> Save Profile
              </Button>
            </div>
          </GlassCard>

          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
            <div className="mb-5 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Personalized Settings</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Theme
                </span>
                <Select
                  className="h-9 text-xs"
                  value={theme}
                  onChange={(event) => {
                    const next = event.target.value as "dark" | "light";
                    setTheme(next);
                    setPrefs((current) => ({ ...current, theme: next }));
                    toast.success("Personal settings updated");
                  }}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </Select>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Font Size
                </span>
                <Select
                  className="h-9 text-xs"
                  value={String(prefs.fontSize)}
                  onChange={(event) => savePreference({ fontSize: Number(event.target.value) })}
                >
                  {[12, 13, 14, 15, 16, 17, 18].map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Default Landing Page
                </span>
                <Select
                  className="h-9 text-xs"
                  value={prefs.defaultView}
                  onChange={(event) => savePreference({ defaultView: event.target.value })}
                >
                  <option value="/">Dashboard</option>
                  <option value="/documents">Document Hub</option>
                  <option value="/bom">BOM Explorer</option>
                  <option value="/pl">PL Knowledge Hub</option>
                  <option value="/ledger">Work Ledger</option>
                </Select>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Time Format
                </span>
                <Select
                  className="h-9 text-xs"
                  value={prefs.timeFormat}
                  onChange={(event) =>
                    savePreference({
                      timeFormat: event.target.value as UserPreferences["timeFormat"],
                    })
                  }
                >
                  <option value="24h">24-hour</option>
                  <option value="12h">12-hour</option>
                </Select>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {[
                {
                  icon: Clock3,
                  title: "Show live header clock",
                  description: "Display the current day and time in the top-right app chrome.",
                  checked: prefs.showLiveClock,
                  onChange: (checked: boolean) => savePreference({ showLiveClock: checked }),
                },
                {
                  icon: Eye,
                  title: "Use compact tables",
                  description: "Tighten row density for scan-heavy lists and admin tables.",
                  checked: prefs.compactTables,
                  onChange: (checked: boolean) => savePreference({ compactTables: checked }),
                },
                {
                  icon: MoonStar,
                  title: "Reduce motion",
                  description: "Tone down non-essential animation in the workspace shell.",
                  checked: prefs.reduceMotion,
                  onChange: (checked: boolean) => savePreference({ reduceMotion: checked }),
                },
                {
                  icon: Bell,
                  title: "Keep sidebar expanded on desktop",
                  description:
                    "Preserve the wider navigation rail as your default desktop preference.",
                  checked: prefs.sidebarExpanded,
                  onChange: (checked: boolean) => savePreference({ sidebarExpanded: checked }),
                },
              ].map((setting) => (
                <div
                  key={setting.title}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-card/35 p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/12 text-primary/90">
                      <setting.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{setting.title}</p>
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  <Switch checked={setting.checked} onCheckedChange={setting.onChange} />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
            <div className="mb-4 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Workspace Defaults</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Document Page Size
                </span>
                <Select
                  className="h-9 text-xs"
                  value={String(prefs.documentHubPageSize)}
                  onChange={(event) =>
                    savePreference({
                      documentHubPageSize: Number(event.target.value),
                    })
                  }
                >
                  {[10, 20, 30, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} rows
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Work Ledger Page Size
                </span>
                <Select
                  className="h-9 text-xs"
                  value={String(prefs.workLedgerPageSize)}
                  onChange={(event) =>
                    savePreference({
                      workLedgerPageSize: Number(event.target.value),
                    })
                  }
                >
                  {[10, 20, 30, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} rows
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
