export type DocumentTemplateFieldType = "text" | "select" | "date";

export interface DocumentTemplateField {
  label: string;
  type: DocumentTemplateFieldType;
  required: boolean;
  options?: string[];
}

export interface DocumentTemplateRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: DocumentTemplateField[];
  tags: string[];
  usageCount: number;
  starred: boolean;
  lastUsed?: string;
}

interface CreateTemplateInput {
  name: string;
  category: string;
  description: string;
  tags: string[];
  fields?: DocumentTemplateField[];
  starred?: boolean;
}

const STORAGE_KEY = "ldo2_document_templates";

const DEFAULT_TEMPLATES: DocumentTemplateRecord[] = [
  {
    id: "TPL-001",
    name: "Maintenance Report",
    category: "Maintenance",
    description: "Standard maintenance activity report for traction equipment.",
    fields: [
      { label: "Equipment ID", type: "text", required: true },
      {
        label: "Maintenance Type",
        type: "select",
        required: true,
        options: ["Preventive", "Corrective", "Predictive"],
      },
      { label: "Date of Work", type: "date", required: true },
      { label: "Technician Name", type: "text", required: true },
      { label: "Work Description", type: "text", required: true },
      { label: "Next Due Date", type: "date", required: false },
    ],
    tags: ["maintenance", "traction", "report"],
    usageCount: 47,
    starred: true,
    lastUsed: "2026-03-22",
  },
  {
    id: "TPL-002",
    name: "Engineering Change Notice",
    category: "Engineering",
    description: "Document engineering design changes with impact analysis.",
    fields: [
      { label: "ECN Number", type: "text", required: true },
      { label: "Drawing Number", type: "text", required: true },
      { label: "Change Description", type: "text", required: true },
      { label: "Reason for Change", type: "text", required: true },
      { label: "Effective Date", type: "date", required: true },
      {
        label: "Safety Impact",
        type: "select",
        required: true,
        options: ["None", "Low", "Medium", "High"],
      },
    ],
    tags: ["engineering", "change", "design"],
    usageCount: 32,
    starred: false,
    lastUsed: "2026-03-18",
  },
  {
    id: "TPL-003",
    name: "Inspection Report",
    category: "Quality",
    description: "Pre-departure / periodic inspection checklist.",
    fields: [
      { label: "Loco Number", type: "text", required: true },
      {
        label: "Inspection Type",
        type: "select",
        required: true,
        options: ["CAT-A", "CAT-B", "CAT-C", "CAT-D", "IA", "AOH"],
      },
      { label: "Inspector", type: "text", required: true },
      { label: "Inspection Date", type: "date", required: true },
      { label: "Defects Found", type: "text", required: false },
      {
        label: "Clearance Status",
        type: "select",
        required: true,
        options: ["Cleared", "Conditional", "Failed"],
      },
    ],
    tags: ["inspection", "quality", "loco"],
    usageCount: 89,
    starred: true,
    lastUsed: "2026-03-24",
  },
  {
    id: "TPL-004",
    name: "Discrepancy Report (DR)",
    category: "Cases",
    description: "Report a component or process discrepancy for investigation.",
    fields: [
      { label: "DR Number", type: "text", required: true },
      {
        label: "Defect Category",
        type: "select",
        required: true,
        options: ["Mechanical", "Electrical", "Hydraulic", "Software", "Structural"],
      },
      { label: "Reported By", type: "text", required: true },
      { label: "Date Found", type: "date", required: true },
      { label: "Root Cause (preliminary)", type: "text", required: false },
      {
        label: "Severity",
        type: "select",
        required: true,
        options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      },
    ],
    tags: ["cases", "discrepancy", "quality"],
    usageCount: 21,
    starred: false,
    lastUsed: "2026-03-15",
  },
  {
    id: "TPL-005",
    name: "Technical Specification",
    category: "Engineering",
    description: "Define technical requirements for a component or system.",
    fields: [
      { label: "Spec Number", type: "text", required: true },
      { label: "Part / System Name", type: "text", required: true },
      { label: "Standard Reference", type: "text", required: false },
      {
        label: "Safety Classification",
        type: "select",
        required: true,
        options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      },
      { label: "Effective Date", type: "date", required: true },
    ],
    tags: ["engineering", "specification", "technical"],
    usageCount: 15,
    starred: false,
  },
  {
    id: "TPL-006",
    name: "Work Order Form",
    category: "Maintenance",
    description: "Authorize and track a maintenance work order.",
    fields: [
      { label: "WO Number", type: "text", required: true },
      {
        label: "Priority",
        type: "select",
        required: true,
        options: ["Routine", "Urgent", "Emergency"],
      },
      { label: "Assigned To", type: "text", required: true },
      { label: "Scheduled Date", type: "date", required: true },
      { label: "Estimated Hours", type: "text", required: false },
    ],
    tags: ["work", "maintenance", "order"],
    usageCount: 63,
    starred: true,
    lastUsed: "2026-03-21",
  },
];

function persist(store: DocumentTemplateRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function cloneFields(fields: DocumentTemplateField[]) {
  return fields.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }));
}

function loadStore() {
  if (typeof window === "undefined") {
    return DEFAULT_TEMPLATES.map((template) => ({
      ...template,
      fields: cloneFields(template.fields),
      tags: [...template.tags],
    }));
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = DEFAULT_TEMPLATES.map((template) => ({
        ...template,
        fields: cloneFields(template.fields),
        tags: [...template.tags],
      }));
      persist(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Template store is invalid");
    }

    return parsed.map((template) => ({
      id: String(template.id),
      name: String(template.name ?? ""),
      category: String(template.category ?? ""),
      description: String(template.description ?? ""),
      fields: Array.isArray(template.fields)
        ? template.fields.map((field: DocumentTemplateField) => ({
            label: String(field.label ?? ""),
            type: (field.type ?? "text") as DocumentTemplateFieldType,
            required: Boolean(field.required),
            options: Array.isArray(field.options) ? field.options.map(String) : undefined,
          }))
        : cloneFields(DEFAULT_TEMPLATES[0].fields),
      tags: Array.isArray(template.tags) ? template.tags.map(String) : [],
      usageCount: Number(template.usageCount ?? 0),
      starred: Boolean(template.starred),
      lastUsed: template.lastUsed ? String(template.lastUsed) : undefined,
    })) as DocumentTemplateRecord[];
  } catch {
    const fallback = DEFAULT_TEMPLATES.map((template) => ({
      ...template,
      fields: cloneFields(template.fields),
      tags: [...template.tags],
    }));
    persist(fallback);
    return fallback;
  }
}

let _store = loadStore();

function nextTemplateId() {
  const max = _store.reduce((highest, template) => {
    const numeric = Number(String(template.id).replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return `TPL-${String(max + 1).padStart(3, "0")}`;
}

export const DocumentTemplateService = {
  async getAll() {
    return [..._store].sort((left, right) => left.name.localeCompare(right.name));
  },

  async create(input: CreateTemplateInput) {
    const template: DocumentTemplateRecord = {
      id: nextTemplateId(),
      name: input.name.trim(),
      category: input.category.trim(),
      description: input.description.trim(),
      tags: input.tags,
      usageCount: 0,
      starred: Boolean(input.starred),
      fields:
        input.fields && input.fields.length > 0
          ? cloneFields(input.fields)
          : [{ label: "Document Title", type: "text", required: true }],
    };
    _store = [..._store, template];
    persist(_store);
    return template;
  },

  async toggleStar(id: string) {
    _store = _store.map((template) =>
      template.id === id ? { ...template, starred: !template.starred } : template,
    );
    persist(_store);
    return _store.find((template) => template.id === id) ?? null;
  },

  async recordUsage(id: string) {
    const today = new Date().toISOString().split("T")[0];
    _store = _store.map((template) =>
      template.id === id
        ? { ...template, usageCount: template.usageCount + 1, lastUsed: today }
        : template,
    );
    persist(_store);
    return _store.find((template) => template.id === id) ?? null;
  },
};

export type DocumentTemplate = DocumentTemplateRecord;
