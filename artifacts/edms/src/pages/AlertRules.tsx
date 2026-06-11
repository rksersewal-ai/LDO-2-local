import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle,
  Clock,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge, Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";
import {
  type AlertRule,
  AlertRuleService,
  type NotifyChannel,
  resolveAlertRuleRoute,
  type TriggerType,
} from "../services/AlertRuleService";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  OVERDUE: "Overdue",
  STATUS_CHANGE: "Status Change",
  THRESHOLD: "Threshold",
  SCHEDULED: "Scheduled",
};

const TRIGGER_COLORS: Record<TriggerType, "danger" | "warning" | "processing" | "default"> = {
  OVERDUE: "danger",
  STATUS_CHANGE: "warning",
  THRESHOLD: "processing",
  SCHEDULED: "default",
};

const CHANNEL_LABELS: Record<NotifyChannel, string> = {
  IN_APP: "In-App",
  EMAIL: "Email",
  BOTH: "Both",
};

const EMPTY_RULE: Omit<AlertRule, "id" | "createdAt"> = {
  name: "",
  trigger: "OVERDUE",
  condition: "",
  channel: "IN_APP",
  notifyRoles: ["admin"],
  enabled: true,
};

export default function AlertRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [editRule, setEditRule] = useState<AlertRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_RULE);

  const refreshRules = async () => {
    setRules(await AlertRuleService.getAll());
  };

  useEffect(() => {
    void refreshRules();
  }, []);

  const closeForm = () => {
    setCreating(false);
    setEditRule(null);
  };

  const toggleRule = async (id: string) => {
    const updated = await AlertRuleService.toggleEnabled(id);
    if (!updated) {
      toast.error("Rule could not be updated");
      return;
    }

    await refreshRules();
    toast.success(`Rule "${updated.name}" ${updated.enabled ? "enabled" : "disabled"}`);
  };

  const deleteRule = async (id: string) => {
    const existing = rules.find((rule) => rule.id === id);
    const deleted = await AlertRuleService.remove(id);
    if (!deleted) {
      toast.error("Rule could not be deleted");
      return;
    }

    await refreshRules();
    if (editRule?.id === id) {
      closeForm();
    }
    toast.success(`Rule "${existing?.name}" deleted`);
  };

  const openEdit = (rule: AlertRule) => {
    setEditRule(rule);
    setForm({ ...rule, notifyRoles: [...rule.notifyRoles] });
    setCreating(false);
  };

  const openCreate = () => {
    setEditRule(null);
    setForm({ ...EMPTY_RULE, notifyRoles: [...EMPTY_RULE.notifyRoles] });
    setCreating(true);
  };

  const saveRule = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const notifyRoles = form.notifyRoles.map((role) => role.trim()).filter(Boolean);
    if (notifyRoles.length === 0) {
      toast.error("Add at least one role to notify");
      return;
    }

    if (editRule) {
      const updated = await AlertRuleService.update(editRule.id, {
        ...form,
        notifyRoles,
      });
      if (!updated) {
        toast.error("Rule could not be saved");
        return;
      }
      toast.success("Rule updated");
    } else {
      await AlertRuleService.create({ ...form, notifyRoles });
      toast.success("Alert rule created");
    }

    await refreshRules();
    closeForm();
  };

  const showForm = creating || editRule !== null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Alert Rules"
        subtitle="Define conditions that trigger notifications to team members."
      >
        <Button onClick={openCreate} size="sm" className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Rule
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Rules",
            value: rules.length,
            icon: Bell,
            color: "text-primary bg-teal-500/10",
          },
          {
            label: "Active",
            value: rules.filter((rule) => rule.enabled).length,
            icon: CheckCircle,
            color: "text-emerald-400 bg-emerald-500/10",
          },
          {
            label: "Overdue Triggers",
            value: rules.filter((rule) => rule.trigger === "OVERDUE").length,
            icon: Clock,
            color: "text-amber-400 bg-amber-500/10",
          },
          {
            label: "Disabled",
            value: rules.filter((rule) => !rule.enabled).length,
            icon: AlertTriangle,
            color: "text-muted-foreground bg-muted",
          },
        ].map((stat) => (
          <GlassCard
            key={stat.label}
            className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200"
          >
            <div
              className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-2`}
            >
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-foreground tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </GlassCard>
        ))}
      </div>

      {showForm && (
        <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {editRule ? "Edit Rule" : "New Alert Rule"}
            </h3>
            <button type="button" onClick={closeForm}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <span className="text-xs text-muted-foreground mb-1 block">Rule Name *</span>
              <Input
                className="h-9"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="e.g. Work Record Overdue"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Trigger Type</span>
              <Select
                className="h-9 text-xs"
                value={form.trigger}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    trigger: event.target.value as TriggerType,
                  }))
                }
              >
                <option value="OVERDUE">Overdue</option>
                <option value="STATUS_CHANGE">Status Change</option>
                <option value="THRESHOLD">Threshold</option>
                <option value="SCHEDULED">Scheduled</option>
              </Select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Notification Channel</span>
              <Select
                className="h-9 text-xs"
                value={form.channel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    channel: event.target.value as NotifyChannel,
                  }))
                }
              >
                <option value="IN_APP">In-App Only</option>
                <option value="EMAIL">Email Only</option>
                <option value="BOTH">Both</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <span className="text-xs text-muted-foreground mb-1 block">Condition</span>
              <Input
                value={form.condition}
                onChange={(event) =>
                  setForm((current) => ({ ...current, condition: event.target.value }))
                }
                placeholder="e.g. daysTaken > targetDays"
                className="font-mono text-xs h-9"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">
                Notify Roles (comma-separated)
              </span>
              <Input
                className="h-9"
                value={form.notifyRoles.join(", ")}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notifyRoles: event.target.value.split(",").map((role) => role.trim()),
                  }))
                }
                placeholder="admin, supervisor"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={() => void saveRule()} size="sm">
              {editRule ? "Save Changes" : "Create Rule"}
            </Button>
            <Button variant="ghost" size="sm" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md transition-all duration-200">
        <div className="pb-3 mb-3 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">{rules.length} Alert Rules</h3>
        </div>
        <div className="divide-y divide-border/50">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-4 py-3 ${!rule.enabled ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                onClick={() => void toggleRule(rule.id)}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                {rule.enabled ? (
                  <ToggleRight className="w-5 h-5 text-primary" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-foreground">{rule.name}</span>
                  <Badge variant={TRIGGER_COLORS[rule.trigger]} size="sm">
                    {TRIGGER_LABELS[rule.trigger]}
                  </Badge>
                  <Badge variant="default" size="sm">
                    {CHANNEL_LABELS[rule.channel]}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono">{rule.condition}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Notifies: {rule.notifyRoles.join(", ")} ·{" "}
                  {rule.lastFired ? `Last fired: ${rule.lastFired}` : "Never fired"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(resolveAlertRuleRoute(rule))}
                  className="w-7 h-7 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
                  title="Open related workspace"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(rule)}
                  className="w-7 h-7 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground/90 flex items-center justify-center transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteRule(rule.id)}
                  className="w-7 h-7 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
