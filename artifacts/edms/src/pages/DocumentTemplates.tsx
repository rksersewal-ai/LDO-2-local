import {
  ArrowRight,
  BookOpen,
  FileText,
  Plus,
  Search,
  Star,
  StarOff,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { DatePicker } from "../components/ui/DatePicker";
import { Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";
import { Switch } from "../components/ui/switch";
import {
  type DocumentTemplate,
  type DocumentTemplateField,
  DocumentTemplateService,
} from "../services/DocumentTemplateService";

interface EditableField extends DocumentTemplateField {
  optionsText: string;
}

interface TemplateDraftState {
  templateId: string;
  templateName: string;
  templateCategory: string;
  templateDescription: string;
  docTypeHint: string;
  categoryHint: string;
  tags: string[];
  formValues: Record<string, string>;
}

const CATEGORY_SEED = ["Engineering", "Maintenance", "Quality", "Cases", "General"];

function createEmptyField(): EditableField {
  return {
    label: "",
    type: "text",
    required: true,
    optionsText: "",
  };
}

function createEmptyTemplateDraft() {
  return {
    name: "",
    category: "General",
    description: "",
    tagsText: "",
    fields: [createEmptyField()],
  };
}

function inferDocumentHints(category: string) {
  const normalizedCategory = category.toLowerCase();

  if (normalizedCategory.includes("engineering")) {
    return { docTypeHint: "Specification", categoryHint: "Specification" };
  }
  if (normalizedCategory.includes("quality")) {
    return { docTypeHint: "Test Report", categoryHint: "Test Report" };
  }
  if (normalizedCategory.includes("maintenance")) {
    return { docTypeHint: "Procedure", categoryHint: "Maintenance Manual" };
  }
  if (normalizedCategory.includes("cases")) {
    return { docTypeHint: "Procedure", categoryHint: "Procedure" };
  }

  return { docTypeHint: "Procedure", categoryHint: "Procedure" };
}

export default function DocumentTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState(createEmptyTemplateDraft());

  useEffect(() => {
    void loadTemplates();
  }, []);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set([...CATEGORY_SEED, ...templates.map((template) => template.category)])),
    ],
    [templates],
  );

  const filtered = useMemo(
    () =>
      templates.filter((template) => {
        const normalizedQuery = query.trim().toLowerCase();
        const matchesCategory = activeCategory === "All" || template.category === activeCategory;
        const matchesQuery =
          !normalizedQuery ||
          template.name.toLowerCase().includes(normalizedQuery) ||
          template.description.toLowerCase().includes(normalizedQuery) ||
          template.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
        return matchesCategory && matchesQuery;
      }),
    [activeCategory, query, templates],
  );

  const starred = filtered.filter((template) => template.starred);
  const unstarred = filtered.filter((template) => !template.starred);

  async function loadTemplates() {
    const nextTemplates = await DocumentTemplateService.getAll();
    setTemplates(nextTemplates);
  }

  async function toggleStar(id: string) {
    await DocumentTemplateService.toggleStar(id);
    await loadTemplates();
  }

  function useTemplate(template: DocumentTemplate) {
    setPreviewTemplate(template);
    setFormValues({});
    setShowForm(true);
  }

  async function submitForm() {
    if (!previewTemplate) {
      return;
    }

    const missingRequiredField = previewTemplate.fields.find(
      (field) => field.required && !(formValues[field.label] ?? "").trim(),
    );
    if (missingRequiredField) {
      toast.error(`Fill "${missingRequiredField.label}" before continuing.`);
      return;
    }

    await DocumentTemplateService.recordUsage(previewTemplate.id);
    await loadTemplates();

    const hints = inferDocumentHints(previewTemplate.category);
    const templateDraft: TemplateDraftState = {
      templateId: previewTemplate.id,
      templateName: previewTemplate.name,
      templateCategory: previewTemplate.category,
      templateDescription: previewTemplate.description,
      docTypeHint: hints.docTypeHint,
      categoryHint: hints.categoryHint,
      tags: previewTemplate.tags,
      formValues,
    };

    toast.success(`Template "${previewTemplate.name}" prepared`, {
      description: "Continue in document ingest to upload the real file and finalize metadata.",
    });

    setShowForm(false);
    setPreviewTemplate(null);
    navigate("/documents/ingest", { state: { templateDraft } });
  }

  function closeUseModal() {
    setShowForm(false);
    setPreviewTemplate(null);
    setFormValues({});
  }

  function updateDraftField(index: number, patch: Partial<EditableField>) {
    setDraftTemplate((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    }));
  }

  function addTemplateField() {
    setDraftTemplate((current) => ({
      ...current,
      fields: [...current.fields, createEmptyField()],
    }));
  }

  function removeTemplateField(index: number) {
    setDraftTemplate((current) => ({
      ...current,
      fields:
        current.fields.length > 1
          ? current.fields.filter((_, fieldIndex) => fieldIndex !== index)
          : current.fields,
    }));
  }

  async function createTemplate() {
    const name = draftTemplate.name.trim();
    const category = draftTemplate.category.trim();
    const description = draftTemplate.description.trim();
    const tags = draftTemplate.tagsText
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    if (!name || !category || !description) {
      toast.error("Name, category, and description are required.");
      return;
    }

    const sanitizedFields = draftTemplate.fields
      .map((field) => ({
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options:
          field.type === "select"
            ? field.optionsText
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean)
            : undefined,
      }))
      .filter((field) => field.label);

    if (sanitizedFields.length === 0) {
      toast.error("Add at least one template field.");
      return;
    }

    const invalidSelectField = sanitizedFields.find(
      (field) => field.type === "select" && (!field.options || field.options.length === 0),
    );
    if (invalidSelectField) {
      toast.error(`Select field "${invalidSelectField.label}" needs at least one option.`);
      return;
    }

    await DocumentTemplateService.create({
      name,
      category,
      description,
      tags,
      fields: sanitizedFields,
      starred: true,
    });
    await loadTemplates();

    toast.success(`Template "${name}" created`);
    setDraftTemplate(createEmptyTemplateDraft());
    setShowCreateModal(false);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Document Templates"
        subtitle="Start a document from a reusable template, then continue into ingest with the captured context."
      >
        <Button
          size="sm"
          className="flex items-center gap-2"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates..."
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCategory === category ? "bg-teal-500/20 text-primary/90 border border-teal-500/30" : "bg-secondary/50 text-muted-foreground border border-border/50 hover:border-primary/30 hover:bg-secondary/70"}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <GlassCard
            className="w-full max-w-3xl p-3.5 relative max-h-[90vh] overflow-y-auto border-border/50 bg-card/40 backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-foreground">Create Template</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Define the reusable metadata fields that should be captured before document ingest.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground mb-1.5 block">Template Name</span>
                <Input
                  className="h-9"
                  value={draftTemplate.name}
                  onChange={(event) =>
                    setDraftTemplate((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground mb-1.5 block">Category</span>
                <Select
                  className="h-9 text-xs"
                  value={draftTemplate.category}
                  onChange={(event) =>
                    setDraftTemplate((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                >
                  {CATEGORY_SEED.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs text-muted-foreground mb-1.5 block">Description</span>{" "}
              <textarea
                value={draftTemplate.description}
                onChange={(event) =>
                  setDraftTemplate((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-24 w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>

            <div className="mt-4">
              <span className="text-xs text-muted-foreground mb-1.5 block">Tags</span>
              <Input
                className="h-9"
                value={draftTemplate.tagsText}
                onChange={(event) =>
                  setDraftTemplate((current) => ({
                    ...current,
                    tagsText: event.target.value,
                  }))
                }
                placeholder="engineering, release, safety"
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">Template Fields</h4>
                <Button size="sm" variant="secondary" onClick={addTemplateField}>
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </Button>
              </div>
              <div className="space-y-3">
                {draftTemplate.fields.map((field, index) => (
                  <div
                    key={`${index}-${field.label}`}
                    className="rounded-xl border border-border/50 bg-card/30 p-2.5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto_auto] gap-3 items-end">
                      <div>
                        <span className="text-xs text-muted-foreground mb-1.5 block">
                          Field Label
                        </span>
                        <Input
                          className="h-9"
                          value={field.label}
                          onChange={(event) =>
                            updateDraftField(index, {
                              label: event.target.value,
                            })
                          }
                          placeholder="e.g. Equipment ID"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground mb-1.5 block">
                          Field Type
                        </span>
                        <Select
                          className="h-9 text-xs"
                          value={field.type}
                          onChange={(event) =>
                            updateDraftField(index, {
                              type: event.target.value as EditableField["type"],
                            })
                          }
                        >
                          <option value="text">Text</option>
                          <option value="select">Select</option>
                          <option value="date">Date</option>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(checked) =>
                            updateDraftField(index, { required: checked })
                          }
                          aria-label={`Toggle required for field ${index + 1}`}
                        />
                        <span className="text-xs text-muted-foreground">Required</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTemplateField(index)}
                        disabled={draftTemplate.fields.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {field.type === "select" && (
                      <div className="mt-3">
                        <span className="text-xs text-muted-foreground mb-1.5 block">Options</span>
                        <Input
                          className="h-9"
                          value={field.optionsText}
                          onChange={(event) =>
                            updateDraftField(index, {
                              optionsText: event.target.value,
                            })
                          }
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={createTemplate}>Create Template</Button>
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {showForm && previewTemplate && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closeUseModal}
        >
          <GlassCard
            className="w-full max-w-lg p-3.5 relative border-border/50 bg-card/40 backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={closeUseModal} className="absolute top-4 right-4">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{previewTemplate.name}</h3>
                <p className="text-xs text-muted-foreground">{previewTemplate.category}</p>
              </div>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {previewTemplate.fields.map((field) => (
                <div key={field.label}>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {field.label} {field.required && <span className="text-rose-400">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <Select
                      className="h-9 text-xs"
                      value={formValues[field.label] || ""}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [field.label]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select...</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === "date" ? (
                    <DatePicker
                      value={formValues[field.label] || ""}
                      onChange={(nextValue) =>
                        setFormValues((current) => ({
                          ...current,
                          [field.label]: nextValue,
                        }))
                      }
                      placeholder="Select date"
                    />
                  ) : (
                    <Input
                      className="h-9"
                      value={formValues[field.label] || ""}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [field.label]: event.target.value,
                        }))
                      }
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <Button onClick={submitForm} className="flex-1">
                Continue to Ingest
              </Button>
              <Button variant="ghost" onClick={closeUseModal}>
                Cancel
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {starred.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-400" /> Starred Templates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {starred.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onStar={toggleStar}
                onUse={useTemplate}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          All Templates
        </h2>
        {unstarred.length === 0 && starred.length === 0 ? (
          <GlassCard className="p-10 border-border/50 bg-card/40 backdrop-blur-md text-center text-muted-foreground text-sm">
            No templates match your search.
          </GlassCard>
        ) : unstarred.length === 0 ? null : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unstarred.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onStar={toggleStar}
                onUse={useTemplate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onStar,
  onUse,
}: {
  template: DocumentTemplate;
  onStar: (id: string) => void | Promise<void>;
  onUse: (template: DocumentTemplate) => void;
}) {
  return (
    <GlassCard className="p-3.5 flex flex-col gap-3 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{template.name}</div>
            <div className="text-xs text-muted-foreground">{template.category}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onStar(template.id)}
          className="text-muted-foreground hover:text-amber-400 transition-colors"
        >
          {template.starred ? (
            <Star className="w-4 h-4 text-amber-400" />
          ) : (
            <StarOff className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>
      <div className="flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-secondary/50 text-muted-foreground rounded"
          >
            <Tag className="w-2.5 h-2.5" /> {tag}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t border-border/50">
        <span>Used {template.usageCount}×</span>
        {template.lastUsed && <span>Last: {template.lastUsed}</span>}
      </div>
      <Button
        onClick={() => onUse(template)}
        size="sm"
        className="w-full flex items-center justify-center gap-2 mt-1"
      >
        Use Template <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </GlassCard>
  );
}
