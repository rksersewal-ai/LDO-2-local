import { ArrowLeft, CheckCircle2, Layers, Plus, Shield } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { PLNumberSelect } from "../components/ui/PLNumberSelect";
import { Badge, Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";
import { usePLItems } from "../hooks/usePLItems";
import { type BOMNode, PL_DATABASE } from "../lib/bomData";
import type { PLNumber } from "../lib/types";
import { BomDraftService } from "../services/BomDraftService";

type LifecycleOption = "In Development" | "Production" | "Prototyping";

interface CreateBomForm {
  productName: string;
  subtitle: string;
  category: string;
  description: string;
  lifecycle: LifecycleOption;
  rootPlNumber: string;
}

const DEFAULT_FORM: CreateBomForm = {
  productName: "",
  subtitle: "",
  category: "Custom BOM",
  description: "",
  lifecycle: "In Development",
  rootPlNumber: "",
};

function createRootNode(form: CreateBomForm, selectedPl?: PLNumber) {
  const matchedPL = PL_DATABASE[form.rootPlNumber.trim()];

  const rootNode: BOMNode = {
    id: form.rootPlNumber.trim(),
    name: matchedPL?.name || selectedPl?.name || form.productName.trim(),
    type: matchedPL?.type || "assembly",
    revision: matchedPL?.revision || "A",
    quantity: 1,
    findNumber: "1",
    unitOfMeasure: matchedPL?.unitOfMeasure || "EA",
    tags: matchedPL?.tags?.slice(0, 3) ?? [selectedPl?.category ?? "Draft"],
    children: [],
  };

  return { matchedPL, rootNode };
}

export default function BOMCreate() {
  const navigate = useNavigate();
  const { data: plItems, loading: plItemsLoading } = usePLItems();
  const [form, setForm] = useState<CreateBomForm>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const matchedPL = form.rootPlNumber.trim() ? PL_DATABASE[form.rootPlNumber.trim()] : undefined;
  const selectedPl = form.rootPlNumber.trim()
    ? plItems.find((item) => item.plNumber === form.rootPlNumber.trim())
    : undefined;

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.productName.trim()) {
      nextErrors.productName = "Product name is required.";
    }

    if (!form.rootPlNumber.trim()) {
      nextErrors.rootPlNumber = "Select at least one root PL number.";
    }

    return nextErrors;
  };

  const handleCreate = () => {
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const { rootNode } = createRootNode(form, selectedPl);
    const draft = BomDraftService.create({
      product: {
        id: "draft",
        name: form.productName.trim(),
        subtitle:
          form.subtitle.trim() || (matchedPL?.name ?? selectedPl?.name ?? "Draft BOM workspace"),
        category: form.category,
        description:
          form.description.trim() ||
          matchedPL?.description ||
          selectedPl?.description ||
          "Custom BOM created in the frontend workspace.",
        rootPL: rootNode.id,
        revision: rootNode.revision,
        lifecycle: form.lifecycle,
        icon: "Layers",
      },
      tree: [rootNode],
    });

    navigate(`/bom/${draft.id}`);
  };

  return (
    <div className="space-y-6 max-w-[1180px] mx-auto">
      <PageHeader
        title="Create New BOM"
        subtitle="Start with a product name and one root PL. The workspace will open with that PL as the first node, and you can continue building the hierarchy from there."
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate("/bom")}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Explorer
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <GlassCard className="p-4 bg-card/40 border-border/50 backdrop-blur-md">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Product Name
              </span>
              <Input
                value={form.productName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productName: event.target.value,
                  }))
                }
                placeholder="e.g. High Capacity Traction Converter Pack"
                className={errors.productName ? "border-rose-500/60 h-9" : "h-9"}
              />
              {errors.productName && (
                <p className="mt-1 text-[11px] text-rose-400">{errors.productName}</p>
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Subtitle
              </span>
              <Input
                value={form.subtitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subtitle: event.target.value,
                  }))
                }
                placeholder="Optional operator-facing label"
                className="h-9"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Lifecycle
              </span>
              <Select
                value={form.lifecycle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lifecycle: event.target.value as LifecycleOption,
                  }))
                }
                className="h-9"
              >
                <option value="In Development">In Development</option>
                <option value="Production">Production</option>
                <option value="Prototyping">Prototyping</option>
              </Select>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Category
              </span>
              <Input
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="e.g. Electrical Component"
                className="h-9"
              />
            </div>

            <div className="md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Description
              </span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional summary for the BOM workspace"
                className="min-h-24 w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/15 transition-all duration-150"
              />
            </div>

            <div className="md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Root PL Number
              </span>
              <PLNumberSelect
                value={form.rootPlNumber}
                onChange={(rootPlNumber) => setForm((current) => ({ ...current, rootPlNumber }))}
                plItems={plItems}
                loading={plItemsLoading}
                placeholder="Search and select the root PL..."
                helperText="This PL becomes the first node in the BOM. Additional PLs can be added later from the editor."
              />
              {errors.rootPlNumber && (
                <p className="mt-1 text-[11px] text-rose-400">{errors.rootPlNumber}</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
            <Button variant="secondary" onClick={() => navigate("/bom")}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4" /> Create BOM Workspace
            </Button>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="overflow-hidden bg-card/40 border-border/50 backdrop-blur-md">
            <div className="border-b border-border/50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Root PL Preview
              </p>
            </div>
            <div className="p-4">
              {matchedPL || selectedPl ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {matchedPL?.name ?? selectedPl?.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {matchedPL?.description ?? selectedPl?.description}
                      </p>
                    </div>
                    <Badge variant="success">Matched</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">PL Number</p>
                      <p className="font-mono text-primary">
                        {matchedPL?.plNumber ?? selectedPl?.plNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Revision</p>
                      <p className="font-mono text-foreground">{matchedPL?.revision ?? "A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="capitalize text-foreground">{matchedPL?.type ?? "assembly"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{matchedPL ? "Department" : "Agency"}</p>
                      <p className="text-foreground">
                        {matchedPL?.department ?? selectedPl?.controllingAgency ?? "—"}
                      </p>
                    </div>
                  </div>
                  {(matchedPL?.safetyVital || selectedPl?.safetyCritical) && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">
                      <Shield className="w-3.5 h-3.5" /> Safety-vital root PL
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 backdrop-blur-sm px-3 py-3">
                  <Layers className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Enter the first PL to seed the hierarchy
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      The workspace will start with one top-level node, and the node editor will
                      handle the rest of the assembly structure.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-4 bg-card/40 border-border/50 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              What happens next
            </p>
            <div className="space-y-2.5">
              {[
                "The BOM opens with the chosen root PL already placed at the top level.",
                "Engineers can add more PLs from the node editor and drag them up or down the hierarchy.",
                "This stays frontend-local for now so the backend contract can be finalized after the interaction model settles.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-xs text-foreground/95">
                  <CheckCircle2 className="mt-0.5 w-3.5 h-3.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
