import { AlertCircle, Edit3, Eye, Megaphone, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type NavigateFunction, useNavigate } from "react-router";
import { toast } from "sonner";
import { DatePicker } from "../components/ui/DatePicker";
import { Badge, Button, GlassCard, Input } from "../components/ui/Shared";
import { type BannerRecord, BannerService } from "../services/BannerService";

function normalizeBannerLink(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  if (/^[A-Za-z0-9][A-Za-z0-9/_?&=%.-]*$/.test(trimmed)) {
    return `/${trimmed}`;
  }

  throw new Error("Use an internal path like /documents or a full https:// URL.");
}

function openBannerLink(link: string, navigate: NavigateFunction) {
  const normalized = normalizeBannerLink(link);
  if (!normalized) {
    return;
  }

  if (/^https?:\/\//i.test(normalized)) {
    window.open(normalized, "_blank", "noopener,noreferrer");
    return;
  }

  navigate(normalized);
}

export default function BannerManagement() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editBanner, setEditBanner] = useState<BannerRecord | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newValidFrom, setNewValidFrom] = useState("");
  const [newValidTo, setNewValidTo] = useState("");

  const activeBanners = useMemo(
    () => banners.filter((banner) => banner.active).sort((left, right) => left.order - right.order),
    [banners],
  );

  useEffect(() => {
    BannerService.getAll().then(setBanners);
  }, []);

  const resetForm = () => {
    setEditBanner(null);
    setNewTitle("");
    setNewMessage("");
    setNewLink("");
    setNewValidFrom("");
    setNewValidTo("");
    setShowForm(false);
  };

  const toggleActive = async (id: string) => {
    const updated = await BannerService.toggleActive(id);
    if (!updated) {
      toast.error("Banner could not be updated");
      return;
    }
    setBanners(await BannerService.getAll());
    toast.success(`${updated.title} ${updated.active ? "activated" : "deactivated"}`);
  };

  const deleteBanner = async (id: string) => {
    const deleted = await BannerService.delete(id);
    if (!deleted) {
      toast.error("Banner could not be deleted");
      return;
    }
    setBanners(await BannerService.getAll());
    if (editBanner?.id === id) {
      resetForm();
    }
    toast.success("Announcement removed");
  };

  const handleCreate = async () => {
    if (!newTitle || !newMessage) return;

    let normalizedLink: string | null;
    try {
      normalizedLink = normalizeBannerLink(newLink);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Announcement link is invalid");
      return;
    }

    const payload = {
      title: newTitle,
      message: newMessage,
      link: normalizedLink,
      active: true,
      validFrom: newValidFrom || new Date().toISOString().split("T")[0],
      validTo: newValidTo,
    };

    if (editBanner) {
      const updated = await BannerService.update(editBanner.id, payload);
      if (!updated) {
        toast.error("Announcement could not be saved");
        return;
      }
      toast.success("Announcement updated");
    } else {
      await BannerService.create(payload);
      toast.success("Announcement created");
    }

    setBanners(await BannerService.getAll());
    resetForm();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Announcement Management</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage running banner announcements visible to all users.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditBanner(null);
            setNewTitle("");
            setNewMessage("");
            setNewLink("");
            setNewValidFrom("");
            setNewValidTo("");
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4" /> New Announcement
        </Button>
      </div>

      <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Live Preview
        </h3>
        <div className="bg-gradient-to-r from-teal-900 to-emerald-900 border border-teal-500/30 text-teal-100 text-xs px-4 py-2 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-primary" />
          <div className="flex-1 overflow-hidden">
            {activeBanners.length > 0 ? (
              <div className="flex gap-8 animate-pulse">
                {activeBanners.map((b) => (
                  <span key={b.id}>
                    <span className="font-semibold">{b.title}:</span> {b.message}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-primary/90/50">No active announcements</span>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="space-y-3">
        {banners.map((banner) => (
          <GlassCard
            key={banner.id}
            className={`p-3.5 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200 ${!banner.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <Megaphone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{banner.title}</span>
                  <Badge variant={banner.active ? "success" : "default"}>
                    {banner.active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="font-mono text-xs text-primary">{banner.id}</span>
                </div>
                <p className="text-sm text-muted-foreground pl-7">{banner.message}</p>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1 pl-7">
                  <span>From: {banner.validFrom}</span>
                  {banner.validTo && <span>To: {banner.validTo}</span>}
                  {banner.link && <span>Link: {banner.link}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {banner.link ? (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        openBannerLink(banner.link!, navigate);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Announcement link is invalid",
                        );
                      }
                    }}
                    className="p-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-primary/90 transition-colors"
                    title="Open banner link"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleActive(banner.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    banner.active
                      ? "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      : "bg-teal-500/10 border-teal-500/30 text-primary hover:bg-teal-500/20"
                  }`}
                >
                  {banner.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditBanner(banner);
                    setNewTitle(banner.title);
                    setNewMessage(banner.message);
                    setNewLink(banner.link ?? "");
                    setNewValidFrom(banner.validFrom);
                    setNewValidTo(banner.validTo);
                    setShowForm(true);
                  }}
                  className="p-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteBanner(banner.id)}
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">
                {editBanner ? "Edit Announcement" : "New Announcement"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground mb-1 block">Title</span>
                <Input
                  className="w-full h-9"
                  placeholder="e.g. System Maintenance"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground mb-1 block">Message</span>{" "}
                <textarea
                  className="w-full bg-card/50 border border-border/50 text-foreground text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-teal-400/50 resize-none placeholder:text-muted-foreground"
                  rows={3}
                  placeholder="Announcement message visible to all users..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground mb-1 block">Optional Link</span>
                <Input
                  className="w-full h-9"
                  placeholder="e.g. /documents or /bom"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">Valid From</span>
                  <DatePicker
                    value={newValidFrom}
                    onChange={setNewValidFrom}
                    placeholder="From date"
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">Valid To</span>
                  <DatePicker value={newValidTo} onChange={setNewValidTo} placeholder="To date" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button className="flex-1" onClick={handleCreate}>
                {editBanner ? "Save Changes" : "Create Announcement"}
              </Button>
              <Button variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
