import { PL_DATABASE } from "../lib/bomData";
import { MOCK_PL_RECORDS } from "../lib/mock";
import { ApiPLItemSchema } from "../lib/schemas";
import type { EngineeringChange, InspectionCategory, PLNumber, PLStatus } from "../lib/types";
import apiClient from "./ApiClient";

function mapBomRecord(_plNumber: string, r: (typeof PL_DATABASE)[string]): PLNumber {
  const inspCat: InspectionCategory = r.safetyVital ? "CAT-A" : "CAT-C";
  const statusMap: Record<string, PLStatus> = {
    Production: "ACTIVE",
    Active: "ACTIVE",
    Prototyping: "UNDER_REVIEW",
    "In Development": "UNDER_REVIEW",
    "End of Life": "OBSOLETE",
    Obsolete: "OBSOLETE",
  };

  return {
    id: r.plNumber,
    plNumber: r.plNumber,
    name: r.name,
    description: r.description,
    category: inspCat,
    controllingAgency: "CLW",
    status: statusMap[r.lifecycleState] ?? "ACTIVE",
    safetyCritical: r.safetyVital,
    safetyClassification: r.safetyVital ? "CRITICAL" : "LOW",
    usedIn: r.whereUsed.map((w) => w.parentPL),
    drawingNumbers: r.linkedDrawings.map((d) => d.drawingId),
    specNumbers: [],
    designSupervisor: r.owner,
    engineeringChanges: r.changeHistory.map((c) => ({
      id: c.changeId,
      ecNumber: c.changeId,
      status:
        c.status === "Implemented" ? "IMPLEMENTED" : c.status === "Pending" ? "IN_REVIEW" : "OPEN",
      description: c.title,
      date: c.date,
      author: c.author,
    })),
    linkedDocumentIds: r.linkedDocuments.map((d) => d.docId),
    linkedWorkIds: [],
    linkedCaseIds: [],
    recentActivity: r.changeHistory.slice(0, 3).map((c) => `${c.type}: ${c.title} (${c.date})`),
    createdAt: r.createdDate,
    updatedAt: r.lastModified,
  };
}

function mapLegacyRecord(r: (typeof MOCK_PL_RECORDS)[0]): PLNumber {
  return {
    id: r.id,
    plNumber: r.id.replace("PL-", ""),
    name: r.title,
    description: r.description,
    category: "CAT-C",
    controllingAgency: "CLW",
    status:
      r.status === "Active" ? "ACTIVE" : r.status === "Obsolete" ? "OBSOLETE" : "UNDER_REVIEW",
    safetyCritical: false,
    usedIn: [],
    drawingNumbers: [],
    specNumbers: [],
    designSupervisor: r.owner,
    engineeringChanges: [],
    linkedDocumentIds: r.linkedDocs ?? [],
    linkedWorkIds: [],
    linkedCaseIds: r.cases ?? [],
    createdAt: r.lastUpdated,
    updatedAt: r.lastUpdated,
  };
}

const mockStore: PLNumber[] = [
  ...Object.values(PL_DATABASE).map((r) => mapBomRecord(r.plNumber, r)),
  ...MOCK_PL_RECORDS.map(mapLegacyRecord),
];

const useMockApi = import.meta.env.VITE_ENABLE_DEV_MOCK_API === "true";

function mapApiPlItem(rawItem: unknown): PLNumber {
  const item = ApiPLItemSchema.parse(rawItem);
  const status =
    item.status === "ACTIVE" || item.status === "UNDER_REVIEW" || item.status === "OBSOLETE"
      ? item.status
      : item.status === "Retired"
        ? "OBSOLETE"
        : item.status === "Inactive"
          ? "UNDER_REVIEW"
          : "ACTIVE";

  return {
    id: String(item.id),
    plNumber: String(item.id),
    name: item.name ?? "",
    description: item.description ?? "",
    category: (item.category as InspectionCategory | undefined) ?? "CAT-C",
    controllingAgency: item.controlling_agency ?? "CLW",
    status,
    safetyCritical: Boolean(item.safety_critical),
    safetyClassification: item.safety_classification ?? undefined,
    severityOfFailure: item.severity_of_failure ?? undefined,
    consequences: item.consequences ?? undefined,
    functionality: item.functionality ?? undefined,
    applicationArea: item.application_area ?? undefined,
    usedIn: item.used_in ?? [],
    drawingNumbers: item.drawing_numbers ?? [],
    specNumbers: item.spec_numbers ?? [],
    motherPart: item.mother_part ?? undefined,
    uvamId: item.uvam_item_id ?? undefined,
    strNumber: item.str_number ?? undefined,
    eligibilityCriteria: item.eligibility_criteria ?? undefined,
    procurementConditions: item.procurement_conditions ?? undefined,
    designSupervisor: item.design_supervisor ?? undefined,
    concernedSupervisor: item.concerned_supervisor ?? undefined,
    eOfficeFile: item.eoffice_file ?? undefined,
    vendorType: item.vendor_type ?? undefined,
    recentActivity: item.recent_activity ?? [],
    engineeringChanges: item.engineering_changes ?? [],
    linkedDocumentIds: item.linked_document_ids ?? [],
    linkedWorkIds: item.linked_work_ids ?? [],
    linkedCaseIds: item.linked_case_ids ?? [],
    createdAt: item.created_at ?? "",
    updatedAt: item.last_updated ?? item.updated_at ?? item.created_at ?? "",
  };
}

function toApiPayload(data: Partial<PLNumber>) {
  const payload: Record<string, unknown> = {};

  if ("plNumber" in data && data.plNumber) payload.id = data.plNumber;
  if ("name" in data) payload.name = data.name;
  if ("description" in data) payload.description = data.description;
  if ("category" in data) payload.category = data.category;
  if ("controllingAgency" in data) payload.controlling_agency = data.controllingAgency;
  if ("status" in data) payload.status = data.status;
  if ("safetyCritical" in data) payload.safety_critical = data.safetyCritical;
  if ("safetyClassification" in data) payload.safety_classification = data.safetyClassification;
  if ("severityOfFailure" in data) payload.severity_of_failure = data.severityOfFailure;
  if ("consequences" in data) payload.consequences = data.consequences;
  if ("functionality" in data) payload.functionality = data.functionality;
  if ("applicationArea" in data) payload.application_area = data.applicationArea;
  if ("usedIn" in data) payload.used_in = data.usedIn;
  if ("drawingNumbers" in data) payload.drawing_numbers = data.drawingNumbers;
  if ("specNumbers" in data) payload.spec_numbers = data.specNumbers;
  if ("motherPart" in data) payload.mother_part = data.motherPart;
  if ("uvamId" in data) payload.uvam_item_id = data.uvamId;
  if ("strNumber" in data) payload.str_number = data.strNumber;
  if ("eligibilityCriteria" in data) payload.eligibility_criteria = data.eligibilityCriteria;
  if ("procurementConditions" in data) payload.procurement_conditions = data.procurementConditions;
  if ("designSupervisor" in data) payload.design_supervisor = data.designSupervisor;
  if ("concernedSupervisor" in data) payload.concerned_supervisor = data.concernedSupervisor;
  if ("eOfficeFile" in data) payload.eoffice_file = data.eOfficeFile;
  if ("vendorType" in data) payload.vendor_type = data.vendorType;
  if ("recentActivity" in data) payload.recent_activity = data.recentActivity;
  if ("engineeringChanges" in data) payload.engineering_changes = data.engineeringChanges;
  if ("linkedWorkIds" in data) payload.linked_work_ids = data.linkedWorkIds;
  if ("linkedCaseIds" in data) payload.linked_case_ids = data.linkedCaseIds;

  return payload;
}

async function fetchAllViaApi(search?: string): Promise<PLNumber[]> {
  const response = await apiClient.getPlItems({
    page: 1,
    pageSize: 500,
    search,
  });
  return response.items.map(mapApiPlItem);
}

export const PLService = {
  async getAll(): Promise<PLNumber[]> {
    if (useMockApi) {
      return [...mockStore];
    }
    return fetchAllViaApi();
  },

  async getById(id: string): Promise<PLNumber | null> {
    if (useMockApi) {
      const normalized = id.replace("PL-", "");
      return (
        mockStore.find((p) => p.id === id || p.plNumber === normalized || p.plNumber === id) ?? null
      );
    }
    try {
      const item = await apiClient.getPlItem(id.replace("PL-", ""));
      return mapApiPlItem(item);
    } catch (err: any) {
      // 404 = genuinely not found, return null; anything else = log and re-throw
      if (err?.response?.status === 404) return null;
      console.error("[PLService.getById] Unexpected error", err);
      return null;
    }
  },

  async search(query: string): Promise<PLNumber[]> {
    const q = query.trim();
    if (!q) return this.getAll();
    if (useMockApi) {
      const lower = q.toLowerCase();
      return mockStore.filter(
        (p) =>
          p.plNumber.includes(q) ||
          p.name.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower) ||
          p.drawingNumbers.some((d) => d.toLowerCase().includes(lower)) ||
          p.specNumbers.some((s) => s.toLowerCase().includes(lower)),
      );
    }
    return fetchAllViaApi(q);
  },

  async add(data: Omit<PLNumber, "id" | "createdAt" | "updatedAt">): Promise<PLNumber> {
    if (useMockApi) {
      const now = new Date().toISOString().split("T")[0];
      const pl: PLNumber = {
        ...data,
        id: data.plNumber,
        createdAt: now,
        updatedAt: now,
      };
      mockStore.unshift(pl);
      return pl;
    }

    const created = await apiClient.createPlItem(toApiPayload(data));
    if (Array.isArray(data.linkedDocumentIds) && data.linkedDocumentIds.length > 0) {
      await this.setDocumentLinks(created.id, data.linkedDocumentIds);
      const refreshed = await apiClient.getPlItem(created.id);
      return mapApiPlItem(refreshed);
    }
    return mapApiPlItem(created);
  },

  async update(id: string, patch: Partial<PLNumber>): Promise<PLNumber | null> {
    if (useMockApi) {
      const normalized = id.replace("PL-", "");
      const idx = mockStore.findIndex((p) => p.id === id || p.plNumber === normalized);
      if (idx < 0) return null;
      mockStore[idx] = {
        ...mockStore[idx],
        ...patch,
        updatedAt: new Date().toISOString().split("T")[0],
      };
      return mockStore[idx];
    }

    const normalizedId = id.replace("PL-", "");
    const { linkedDocumentIds, ...metadataPatch } = patch;

    // Only send PATCH if there are actual metadata fields to update
    let updated: PLNumber | undefined;
    if (Object.keys(metadataPatch).length > 0) {
      updated = await apiClient.updatePlItem(normalizedId, toApiPayload(metadataPatch));
    }

    if (Array.isArray(linkedDocumentIds)) {
      await this.setDocumentLinks(normalizedId, linkedDocumentIds);
      const refreshed = await apiClient.getPlItem(normalizedId);
      return mapApiPlItem(refreshed);
    }
    return updated
      ? mapApiPlItem(updated)
      : await apiClient.getPlItem(normalizedId).then(mapApiPlItem);
  },

  async delete(id: string): Promise<boolean> {
    if (useMockApi) {
      const before = mockStore.length;
      const normalized = id.replace("PL-", "");
      const next = mockStore.filter((p) => p.id !== id && p.plNumber !== normalized);
      mockStore.splice(0, mockStore.length, ...next);
      return next.length < before;
    }
    await apiClient.client.delete(`/pl-items/${id.replace("PL-", "")}/`);
    return true;
  },

  async addEngineeringChange(
    plId: string,
    ec: {
      ecNumber: string;
      description: string;
      status: string;
      date: string;
      author?: string;
    },
  ): Promise<PLNumber | null> {
    const pl = await this.getById(plId);
    if (!pl) return null;
    const nextChanges: EngineeringChange[] = [
      ...(pl.engineeringChanges ?? []),
      {
        id: `EC-${Date.now()}`,
        ecNumber: ec.ecNumber,
        description: ec.description,
        status: ec.status as EngineeringChange["status"],
        date: ec.date,
        author: ec.author,
      },
    ];
    return this.update(plId, { engineeringChanges: nextChanges });
  },

  async setDocumentLinks(plId: string, documentIds: string[]): Promise<PLNumber> {
    if (useMockApi) {
      const updated = await this.update(plId, {
        linkedDocumentIds: documentIds,
      });
      if (!updated) {
        throw new Error("PL item not found");
      }
      return updated;
    }

    const response = await apiClient.client.post(
      `/pl-items/${plId.replace("PL-", "")}/documents/set/`,
      {
        document_ids: documentIds,
      },
    );
    return mapApiPlItem(response.data);
  },

  getLinkedDocuments(plId: string, allDocs: { id: string }[]): string[] {
    const item = mockStore.find((p) => p.id === plId || p.plNumber === plId.replace("PL-", ""));
    if (!item) return [];
    return (item.linkedDocumentIds ?? []).filter((docId) => allDocs.some((d) => d.id === docId));
  },
};
